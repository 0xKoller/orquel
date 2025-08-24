import { Pool, PoolClient, type PoolConfig } from 'pg';
import type { VectorStoreAdapter, SearchResult, ChunkWithEmbedding } from '@orquel/core';

/**
 * Configuration options for PostgreSQL + pgvector store
 */
export interface PgVectorStoreOptions {
  /** PostgreSQL connection string */
  connectionString: string;
  /** Database table name for chunks (default: orquel_chunks) */
  tableName?: string;
  /** Vector dimensions (must match embedding model) */
  dimensions: number;
  /** Vector index type (default: ivfflat) */
  indexType?: 'ivfflat' | 'hnsw';
  /** Number of lists for IVFFlat index (default: 100) */
  lists?: number;
  /** ef_construction parameter for HNSW index (default: 200) */
  efConstruction?: number;
  /** Maximum number of connections in pool (default: 20) */
  maxConnections?: number;
  /** Minimum number of connections in pool (default: 5) */
  minConnections?: number;
  /** Connection idle timeout in ms (default: 30000) */
  idleTimeoutMs?: number;
  /** Auto-create table and indexes if they don't exist (default: true) */
  autoSetup?: boolean;
}

/**
 * Extended PostgreSQL vector store adapter with additional utilities
 */
export interface PgVectorStoreAdapter extends VectorStoreAdapter {
  getStats(): Promise<{
    totalChunks: number;
    totalSources: number;
    avgEmbeddingTime: number | null;
    lastUpdated: Date | null;
  }>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
}

/**
 * PostgreSQL + pgvector storage adapter for persistent vector storage
 */
export function pgvectorStore(options: PgVectorStoreOptions): PgVectorStoreAdapter {
  const {
    connectionString,
    tableName = 'orquel_chunks',
    dimensions,
    indexType = 'ivfflat',
    lists = 100,
    efConstruction = 200,
    maxConnections = 20,
    minConnections = 5,
    idleTimeoutMs = 30000,
    autoSetup = true,
  } = options;

  // Create connection pool
  const poolConfig: PoolConfig = {
    connectionString,
    max: maxConnections,
    min: minConnections,
    idleTimeoutMillis: idleTimeoutMs,
  };

  const pool = new Pool(poolConfig);
  let isInitialized = false;

  /**
   * Initialize database schema if needed
   */
  async function ensureInitialized(): Promise<void> {
    if (isInitialized || !autoSetup) return;

    const client = await pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          source_title TEXT NOT NULL,
          source_kind TEXT,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          embedding vector(${dimensions}),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create vector index if it doesn't exist
      const indexName = `${tableName}_embedding_idx`;
      if (indexType === 'ivfflat') {
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${indexName} 
          ON ${tableName} USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = ${lists});
        `);
      } else {
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON ${tableName} USING hnsw (embedding vector_cosine_ops)
          WITH (ef_construction = ${efConstruction});
        `);
      }

      // Create updated_at trigger
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
        CREATE TRIGGER update_${tableName}_updated_at
          BEFORE UPDATE ON ${tableName}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);

      isInitialized = true;
    } finally {
      client.release();
    }
  }

  /**
   * Convert database row to SearchResult
   */
  function rowToSearchResult(row: any): SearchResult {
    return {
      chunk: {
        id: row.id,
        text: row.content,
        index: row.chunk_index,
        hash: row.content_hash,
        source: {
          title: row.source_title,
          kind: row.source_kind || undefined,
        },
        metadata: row.metadata || {},
      },
      score: parseFloat(row.similarity) || 0,
      rank: parseInt(row.rank) || 0,
    };
  }

  return {
    name: 'pgvector',

    async upsert(rows: ChunkWithEmbedding[]): Promise<void> {
      await ensureInitialized();

      if (rows.length === 0) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Prepare batch insert with ON CONFLICT UPDATE
        const values = rows.map((row, index) => {
          const paramOffset = index * 8;
          return `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5}, $${paramOffset + 6}, $${paramOffset + 7}, $${paramOffset + 8})`;
        }).join(', ');

        const params = rows.flatMap(row => [
          row.chunk.id,
          row.chunk.source.title,
          row.chunk.source.kind || null,
          row.chunk.index,
          row.chunk.text,
          row.chunk.hash,
          JSON.stringify(row.embedding),
          JSON.stringify(row.chunk.metadata),
        ]);

        const query = `
          INSERT INTO ${tableName} (id, source_title, source_kind, chunk_index, content, content_hash, embedding, metadata)
          VALUES ${values}
          ON CONFLICT (id) DO UPDATE SET
            source_title = EXCLUDED.source_title,
            source_kind = EXCLUDED.source_kind,
            chunk_index = EXCLUDED.chunk_index,
            content = EXCLUDED.content,
            content_hash = EXCLUDED.content_hash,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP;
        `;

        await client.query(query, params);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Failed to upsert vectors: ${error}`);
      } finally {
        client.release();
      }
    },

    async searchByVector(queryVector: number[], k: number = 10): Promise<SearchResult[]> {
      await ensureInitialized();

      const client = await pool.connect();
      try {
        const query = `
          SELECT 
            id, source_title, source_kind, chunk_index, content, content_hash, metadata,
            1 - (embedding <=> $1::vector) as similarity,
            ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) as rank
          FROM ${tableName}
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector
          LIMIT $2;
        `;

        const result = await client.query(query, [JSON.stringify(queryVector), k]);
        return result.rows.map(rowToSearchResult);
      } catch (error) {
        throw new Error(`Failed to search vectors: ${error}`);
      } finally {
        client.release();
      }
    },

    async searchByIds(ids: string[]): Promise<SearchResult[]> {
      await ensureInitialized();

      if (ids.length === 0) return [];

      const client = await pool.connect();
      try {
        const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
        const query = `
          SELECT 
            id, source_title, source_kind, chunk_index, content, content_hash, metadata,
            1.0 as similarity,
            ROW_NUMBER() OVER (ORDER BY chunk_index) as rank
          FROM ${tableName}
          WHERE id IN (${placeholders});
        `;

        const result = await client.query(query, ids);
        return result.rows.map(rowToSearchResult);
      } catch (error) {
        throw new Error(`Failed to search by IDs: ${error}`);
      } finally {
        client.release();
      }
    },

    async delete(ids: string[]): Promise<void> {
      await ensureInitialized();

      if (ids.length === 0) return;

      const client = await pool.connect();
      try {
        const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
        const query = `DELETE FROM ${tableName} WHERE id IN (${placeholders});`;
        await client.query(query, ids);
      } catch (error) {
        throw new Error(`Failed to delete chunks: ${error}`);
      } finally {
        client.release();
      }
    },

    async clear(): Promise<void> {
      await ensureInitialized();

      const client = await pool.connect();
      try {
        await client.query(`DELETE FROM ${tableName};`);
      } catch (error) {
        throw new Error(`Failed to clear store: ${error}`);
      } finally {
        client.release();
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },

    // Additional PostgreSQL-specific methods
    async getStats(): Promise<{
      totalChunks: number;
      totalSources: number;
      avgEmbeddingTime: number | null;
      lastUpdated: Date | null;
    }> {
      await ensureInitialized();

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_chunks,
            COUNT(DISTINCT source_title) as total_sources,
            MAX(updated_at) as last_updated
          FROM ${tableName};
        `);

        const row = result.rows[0];
        return {
          totalChunks: parseInt(row.total_chunks) || 0,
          totalSources: parseInt(row.total_sources) || 0,
          avgEmbeddingTime: null, // Could be calculated if we track timing
          lastUpdated: row.last_updated ? new Date(row.last_updated) : null,
        };
      } catch (error) {
        throw new Error(`Failed to get stats: ${error}`);
      } finally {
        client.release();
      }
    },

    async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
      const start = Date.now();
      try {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
          return {
            healthy: true,
            latencyMs: Date.now() - start,
          };
        } finally {
          client.release();
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: String(error),
        };
      }
    },
  };
}

