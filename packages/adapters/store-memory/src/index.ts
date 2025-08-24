import type { VectorStoreAdapter, Chunk, ChunkWithEmbedding, SearchResult } from '@orquel/core';

interface StoredChunk extends Chunk {
  embedding: number[];
}

export function memoryStore(): VectorStoreAdapter {
  const chunks: StoredChunk[] = [];

  return {
    name: 'memory-store',
    
    async upsert(rows: ChunkWithEmbedding[]) {
      for (const row of rows) {
        // Remove existing chunk with same ID
        const existingIndex = chunks.findIndex(c => c.id === row.chunk.id);
        if (existingIndex >= 0) {
          chunks.splice(existingIndex, 1);
        }
        
        // Add new chunk
        chunks.push({
          ...row.chunk,
          embedding: [...row.embedding], // Copy to avoid mutations
        });
      }
    },

    async searchByVector(query: number[], k: number): Promise<SearchResult[]> {
      if (chunks.length === 0) {
        return [];
      }

      // Calculate cosine similarity for all chunks
      const similarities = chunks.map((chunk, index) => ({
        chunk: {
          id: chunk.id,
          text: chunk.text,
          index: chunk.index,
          hash: chunk.hash,
          source: chunk.source,
          metadata: chunk.metadata,
        },
        score: cosineSimilarity(query, chunk.embedding),
        rank: index + 1,
      }));

      // Sort by similarity (descending) and take top k
      return similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((result, index) => ({
          ...result,
          rank: index + 1,
        }));
    },

    async searchByIds(ids: string[]): Promise<SearchResult[]> {
      const results = chunks
        .filter(chunk => ids.includes(chunk.id))
        .map((chunk, index) => ({
          chunk: {
            id: chunk.id,
            text: chunk.text,
            index: chunk.index,
            hash: chunk.hash,
            source: chunk.source,
            metadata: chunk.metadata,
          },
          score: 1.0, // Perfect match for ID search
          rank: index + 1,
        }));

      return results;
    },

    async delete(ids: string[]): Promise<void> {
      ids.forEach(id => {
        const index = chunks.findIndex(c => c.id === id);
        if (index >= 0) {
          chunks.splice(index, 1);
        }
      });
    },

    async clear(): Promise<void> {
      chunks.length = 0;
    },

    async close(): Promise<void> {
      // No resources to clean up for memory store
    },
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}