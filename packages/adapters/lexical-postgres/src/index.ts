import { Pool, type PoolConfig } from 'pg';
import type { LexicalAdapter, SearchResult, Chunk } from '@orquel/core';

/**
 * Configuration options for PostgreSQL full-text search
 */
export interface PostgresLexicalOptions {
  /** PostgreSQL connection string */
  connectionString: string;
  /** Database table name for chunks (default: orquel_chunks) */
  tableName?: string;
  /** Text search configuration language (default: english) */
  language?: string;
  /** Maximum number of connections in pool (default: 20) */
  maxConnections?: number;
  /** Minimum number of connections in pool (default: 5) */
  minConnections?: number;
  /** Connection idle timeout in ms (default: 30000) */
  idleTimeoutMs?: number;
  /** Auto-create indexes if they don't exist (default: true) */
  autoSetup?: boolean;
  /** Custom weights for ranking different parts of text (default: A=1.0, B=0.4, C=0.2, D=0.1) */
  rankWeights?: [number, number, number, number];
}

/**
 * Extended PostgreSQL lexical adapter with additional utilities
 */
export interface PostgresLexicalAdapter extends LexicalAdapter {
  searchWithHighlights(query: string, k: number): Promise<Array<SearchResult & { highlights?: string[] }>>;
  suggestQueries(query: string, limit: number): Promise<string[]>;
  getStats(): Promise<{
    totalIndexed: number;
    avgWordsPerChunk: number;
    topTerms: Array<{ term: string; frequency: number }>;
  }>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
}

/**
 * PostgreSQL full-text search adapter for lexical search
 * Uses tsvector and tsquery for fast text search with ranking
 */
export function postgresLexical(options: PostgresLexicalOptions): PostgresLexicalAdapter {
  const {
    connectionString,
    tableName = 'orquel_chunks',
    language = 'english',
    maxConnections = 20,
    minConnections = 5,
    idleTimeoutMs = 30000,
    autoSetup = true,
    rankWeights = [1.0, 0.4, 0.2, 0.1],
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
   * Initialize full-text search schema if needed
   */
  async function ensureInitialized(): Promise<void> {
    if (isInitialized || !autoSetup) return;

    const client = await pool.connect();
    try {
      // Add tsvector column if it doesn't exist
      await client.query(`
        ALTER TABLE ${tableName} 
        ADD COLUMN IF NOT EXISTS content_tsvector tsvector;
      `);

      // Create or update the GIN index for full-text search
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${tableName}_content_tsvector_idx 
        ON ${tableName} USING gin(content_tsvector);
      `);

      // Create trigger function to auto-update tsvector on insert/update
      await client.query(`
        CREATE OR REPLACE FUNCTION update_${tableName}_tsvector() 
        RETURNS trigger AS $$
        BEGIN
          NEW.content_tsvector := 
            setweight(to_tsvector('${language}', COALESCE(NEW.source_title, '')), 'A') ||
            setweight(to_tsvector('${language}', COALESCE(NEW.content, '')), 'B');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger to auto-update tsvector
      await client.query(`
        DROP TRIGGER IF EXISTS ${tableName}_tsvector_update ON ${tableName};
        CREATE TRIGGER ${tableName}_tsvector_update 
          BEFORE INSERT OR UPDATE ON ${tableName}
          FOR EACH ROW EXECUTE FUNCTION update_${tableName}_tsvector();
      `);

      // Update existing rows that don't have tsvector populated
      await client.query(`
        UPDATE ${tableName} 
        SET content_tsvector = 
          setweight(to_tsvector('${language}', COALESCE(source_title, '')), 'A') ||
          setweight(to_tsvector('${language}', COALESCE(content, '')), 'B')
        WHERE content_tsvector IS NULL;
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
      score: parseFloat(row.rank) || 0,
      rank: parseInt(row.row_num) || 0,
    };
  }

  /**
   * Clean and prepare query text for PostgreSQL tsquery
   */
  function prepareQuery(query: string): string {
    // Remove special characters that could break tsquery
    return query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .join(' & ');
  }

  return {
    name: 'postgres-lexical',

    async index(chunks: Chunk[]): Promise<void> {
      await ensureInitialized();

      if (chunks.length === 0) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update tsvector for existing chunks
        for (const chunk of chunks) {
          await client.query(
            `UPDATE ${tableName} 
             SET content_tsvector = 
               setweight(to_tsvector($1, COALESCE(source_title, '')), 'A') ||
               setweight(to_tsvector($1, COALESCE(content, '')), 'B')
             WHERE id = $2`,
            [language, chunk.id]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Failed to index chunks: ${error}`);
      } finally {
        client.release();
      }
    },

    async search(query: string, k: number = 10): Promise<SearchResult[]> {
      await ensureInitialized();

      if (!query.trim()) return [];

      const client = await pool.connect();
      try {
        const preparedQuery = prepareQuery(query);
        const weightsArray = `{${rankWeights.join(',')}}`;

        const result = await client.query(`
          SELECT 
            id, source_title, source_kind, chunk_index, content, content_hash, metadata,
            ts_rank_cd(content_tsvector, plainto_tsquery($1, $2), $3::float4[]) as rank,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsvector, plainto_tsquery($1, $2), $3::float4[]) DESC) as row_num
          FROM ${tableName}
          WHERE content_tsvector @@ plainto_tsquery($1, $2)
          ORDER BY rank DESC
          LIMIT $4;
        `, [language, preparedQuery, weightsArray, k]);

        return result.rows.map(rowToSearchResult);
      } catch (error) {
        // Fallback to simple text search if tsquery fails
        console.warn(`Full-text search failed, falling back to ILIKE: ${error}`);
        
        const result = await client.query(`
          SELECT 
            id, source_title, source_kind, chunk_index, content, content_hash, metadata,
            1.0 as rank,
            ROW_NUMBER() OVER (ORDER BY chunk_index) as row_num
          FROM ${tableName}
          WHERE content ILIKE $1 OR source_title ILIKE $1
          ORDER BY 
            CASE 
              WHEN source_title ILIKE $1 THEN 1
              WHEN content ILIKE $1 THEN 2
              ELSE 3
            END,
            chunk_index
          LIMIT $2;
        `, [`%${query}%`, k]);

        return result.rows.map(rowToSearchResult);
      } finally {
        client.release();
      }
    },

    async searchWithHighlights(query: string, k: number = 10): Promise<Array<SearchResult & { highlights?: string[] }>> {
      await ensureInitialized();

      if (!query.trim()) return [];

      const client = await pool.connect();
      try {
        const preparedQuery = prepareQuery(query);
        const weightsArray = `{${rankWeights.join(',')}}`;

        const result = await client.query(`
          SELECT 
            id, source_title, source_kind, chunk_index, content, content_hash, metadata,
            ts_rank_cd(content_tsvector, plainto_tsquery($1, $2), $3::float4[]) as rank,
            ts_headline($1, content, plainto_tsquery($1, $2), 'MaxFragments=3,FragmentDelimiter=|') as headline,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsvector, plainto_tsquery($1, $2), $3::float4[]) DESC) as row_num
          FROM ${tableName}
          WHERE content_tsvector @@ plainto_tsquery($1, $2)
          ORDER BY rank DESC
          LIMIT $4;
        `, [language, preparedQuery, weightsArray, k]);

        return result.rows.map(row => ({
          ...rowToSearchResult(row),
          highlights: row.headline ? row.headline.split('|') : undefined,
        }));
      } catch (error) {
        throw new Error(`Failed to search with highlights: ${error}`);
      } finally {
        client.release();
      }
    },

    async suggestQueries(query: string, limit: number = 5): Promise<string[]> {
      await ensureInitialized();

      const client = await pool.connect();
      try {
        // Use PostgreSQL's similarity search to find similar content
        const result = await client.query(`
          SELECT DISTINCT 
            regexp_split_to_array(content, E'\\\\s+') as words
          FROM ${tableName}
          WHERE content ILIKE $1
          LIMIT $2;
        `, [`%${query}%`, limit * 3]);

        // Extract unique word combinations that might be good suggestions
        const suggestions = new Set<string>();
        const queryWords = query.toLowerCase().split(/\s+/);

        result.rows.forEach(row => {
          const words = (row.words || []).map((w: string) => w.toLowerCase());
          
          // Find phrases that contain query words
          for (let i = 0; i < words.length - 1; i++) {
            const phrase = words.slice(i, Math.min(i + 3, words.length)).join(' ');
            if (phrase.length > query.length && 
                queryWords.some(qw => phrase.includes(qw))) {
              suggestions.add(phrase);
            }
          }
        });

        return Array.from(suggestions).slice(0, limit);
      } catch (error) {
        console.warn(`Query suggestion failed: ${error}`);
        return [];
      } finally {
        client.release();
      }
    },

    async getStats(): Promise<{
      totalIndexed: number;
      avgWordsPerChunk: number;
      topTerms: Array<{ term: string; frequency: number }>;
    }> {
      await ensureInitialized();

      const client = await pool.connect();
      try {
        // Get basic stats
        const statsResult = await client.query(`
          SELECT 
            COUNT(*) as total_indexed,
            AVG(array_length(string_to_array(content, ' '), 1)) as avg_words
          FROM ${tableName}
          WHERE content_tsvector IS NOT NULL;
        `);

        // Get most frequent terms
        const termsResult = await client.query(`
          SELECT 
            word,
            ndoc as frequency
          FROM ts_stat('SELECT content_tsvector FROM ${tableName} WHERE content_tsvector IS NOT NULL')
          ORDER BY ndoc DESC
          LIMIT 10;
        `);

        const stats = statsResult.rows[0];
        return {
          totalIndexed: parseInt(stats.total_indexed) || 0,
          avgWordsPerChunk: parseFloat(stats.avg_words) || 0,
          topTerms: termsResult.rows.map(row => ({
            term: row.word,
            frequency: parseInt(row.frequency),
          })),
        };
      } catch (error) {
        throw new Error(`Failed to get lexical stats: ${error}`);
      } finally {
        client.release();
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },

    async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
      const start = Date.now();
      try {
        const client = await pool.connect();
        try {
          await client.query(`SELECT COUNT(*) FROM ${tableName} WHERE content_tsvector IS NOT NULL`);
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

