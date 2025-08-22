import type { VectorStoreAdapter, Chunk } from '@orquel/core';

interface StoredChunk extends Chunk {
  embedding: number[];
}

export function memoryStore(): VectorStoreAdapter {
  const chunks: StoredChunk[] = [];

  return {
    name: 'memory-store',
    
    async upsert(rows: Array<Chunk & { embedding: number[] }>) {
      for (const row of rows) {
        // Remove existing chunk with same ID
        const existingIndex = chunks.findIndex(c => c.id === row.id);
        if (existingIndex >= 0) {
          chunks.splice(existingIndex, 1);
        }
        
        // Add new chunk
        chunks.push({
          ...row,
          embedding: [...row.embedding], // Copy to avoid mutations
        });
      }
    },

    async searchByVector(query: number[], k: number) {
      if (chunks.length === 0) {
        return [];
      }

      // Calculate cosine similarity for all chunks
      const similarities = chunks.map(chunk => ({
        chunk: {
          id: chunk.id,
          text: chunk.text,
          metadata: chunk.metadata,
        },
        score: cosineSimilarity(query, chunk.embedding),
      }));

      // Sort by similarity (descending) and take top k
      return similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
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