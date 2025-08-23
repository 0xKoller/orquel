import { describe, it, expect, beforeEach } from 'vitest';
import { memoryStore } from './index.js';
import type { Chunk } from '@orquel/core';

describe('memoryStore', () => {
  const createTestChunk = (id: string, text: string): Chunk => ({
    id,
    text,
    metadata: {
      source: { title: 'Test' },
      chunkIndex: 0,
      hash: `hash-${id}`,
    },
  });

  it('should create a memory store adapter', () => {
    const store = memoryStore();
    
    expect(store.name).toBe('memory-store');
    expect(typeof store.upsert).toBe('function');
    expect(typeof store.searchByVector).toBe('function');
  });

  it('should upsert chunks with embeddings', async () => {
    const store = memoryStore();
    const chunks = [
      { ...createTestChunk('1', 'First chunk'), embedding: [1, 0, 0] },
      { ...createTestChunk('2', 'Second chunk'), embedding: [0, 1, 0] },
    ];

    await expect(store.upsert(chunks)).resolves.toBeUndefined();
  });

  it('should search by vector and return sorted results', async () => {
    const store = memoryStore();
    
    // Insert test data
    await store.upsert([
      { ...createTestChunk('1', 'First chunk'), embedding: [1, 0, 0] },
      { ...createTestChunk('2', 'Second chunk'), embedding: [0, 1, 0] },
      { ...createTestChunk('3', 'Third chunk'), embedding: [0, 0, 1] },
    ]);

    // Search with query vector similar to first chunk
    const results = await store.searchByVector([0.9, 0.1, 0.1], 2);

    expect(results).toHaveLength(2);
    expect(results[0].chunk.id).toBe('1'); // Most similar
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results.every(r => r.score >= 0 && r.score <= 1)).toBe(true);
  });

  it('should handle empty store searches', async () => {
    const store = memoryStore();
    
    const results = await store.searchByVector([1, 0, 0], 5);
    
    expect(results).toEqual([]);
  });

  it('should update existing chunks on re-upsert', async () => {
    const store = memoryStore();
    const chunkId = 'test-chunk';
    
    // Initial upsert
    await store.upsert([{
      ...createTestChunk(chunkId, 'Original text'),
      embedding: [1, 0, 0],
    }]);

    // Update with new embedding
    await store.upsert([{
      ...createTestChunk(chunkId, 'Updated text'),
      embedding: [0, 1, 0],
    }]);

    // Search should find updated version
    const results = await store.searchByVector([0, 1, 0], 1);
    
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe(chunkId);
    expect(results[0].chunk.text).toBe('Updated text');
  });

  it('should calculate cosine similarity correctly', async () => {
    const store = memoryStore();
    
    await store.upsert([
      { ...createTestChunk('identical', 'Identical'), embedding: [1, 0, 0] },
      { ...createTestChunk('orthogonal', 'Orthogonal'), embedding: [0, 1, 0] },
      { ...createTestChunk('opposite', 'Opposite'), embedding: [-1, 0, 0] },
    ]);

    const results = await store.searchByVector([1, 0, 0], 3);

    expect(results).toHaveLength(3);
    
    // Identical vectors should have score 1
    expect(results[0].chunk.id).toBe('identical');
    expect(results[0].score).toBeCloseTo(1, 5);
    
    // Orthogonal vectors should have score 0
    expect(results[1].chunk.id).toBe('orthogonal');
    expect(results[1].score).toBeCloseTo(0, 5);
    
    // Opposite vectors should have score -1 (but ranked last)
    expect(results[2].chunk.id).toBe('opposite');
    expect(results[2].score).toBeCloseTo(-1, 5);
  });

  it('should handle zero vectors gracefully', async () => {
    const store = memoryStore();
    
    await store.upsert([{
      ...createTestChunk('zero', 'Zero vector'),
      embedding: [0, 0, 0],
    }]);

    const results = await store.searchByVector([0, 0, 0], 1);
    
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0); // Zero similarity for zero vectors
  });

  it('should respect k parameter for result limit', async () => {
    const store = memoryStore();
    
    // Insert 5 chunks
    const chunks = Array.from({ length: 5 }, (_, i) => ({
      ...createTestChunk(`chunk-${i}`, `Chunk ${i}`),
      embedding: [Math.random(), Math.random(), Math.random()],
    }));
    
    await store.upsert(chunks);

    // Request only 3 results
    const results = await store.searchByVector([1, 0, 0], 3);
    
    expect(results).toHaveLength(3);
  });

  describe('performance and edge cases', () => {
    it('should handle large batches efficiently', async () => {
      const store = memoryStore();
      
      // Create 1000 chunks
      const chunks = Array.from({ length: 1000 }, (_, i) => ({
        ...createTestChunk(`chunk-${i}`, `Content ${i}`),
        embedding: Array.from({ length: 384 }, () => Math.random()),
      }));
      
      const startTime = Date.now();
      await store.upsert(chunks);
      const upsertTime = Date.now() - startTime;
      
      // Should complete in reasonable time (< 1 second)
      expect(upsertTime).toBeLessThan(1000);
      
      const searchStart = Date.now();
      const results = await store.searchByVector(chunks[0].embedding, 10);
      const searchTime = Date.now() - searchStart;
      
      expect(results).toHaveLength(10);
      expect(searchTime).toBeLessThan(100); // Search should be fast
    });

    it('should maintain data integrity with concurrent operations', async () => {
      const store = memoryStore();
      
      // Simulate concurrent upserts
      const batches = Array.from({ length: 10 }, (_, batchIndex) =>
        Array.from({ length: 10 }, (_, i) => ({
          ...createTestChunk(`batch-${batchIndex}-${i}`, `Content ${batchIndex}-${i}`),
          embedding: [batchIndex / 10, i / 10, 0.5],
        }))
      );
      
      // Run upserts concurrently
      await Promise.all(batches.map(batch => store.upsert(batch)));
      
      // Verify all chunks were stored
      const allResults = await store.searchByVector([0.5, 0.5, 0.5], 1000);
      expect(allResults).toHaveLength(100); // 10 batches × 10 chunks
      
      // Verify no duplicate IDs
      const ids = allResults.map(r => r.chunk.id);
      expect(new Set(ids).size).toBe(100);
    });

    it('should validate embedding dimensions for consistency', async () => {
      const store = memoryStore();
      
      // Store embeddings with same dimension
      await store.upsert([
        { ...createTestChunk('3d-1', '3D chunk 1'), embedding: [1, 0, 0] },
        { ...createTestChunk('3d-2', '3D chunk 2'), embedding: [0, 1, 0] },
        { ...createTestChunk('3d-3', '3D chunk 3'), embedding: [0, 0, 1] },
      ]);
      
      // Search should work with matching dimension
      const results = await store.searchByVector([1, 0, 0], 3);
      expect(results).toHaveLength(3);
      
      // Search with wrong dimension should throw error
      await expect(store.searchByVector([1, 0], 1)).rejects.toThrow('Vectors must have the same length');
    });

    it('should preserve complex metadata structures', async () => {
      const store = memoryStore();
      
      const complexChunk = {
        ...createTestChunk('complex', 'Complex chunk'),
        embedding: [0.5, 0.5, 0.5],
        metadata: {
          source: {
            title: 'Complex Document',
            kind: 'pdf' as const,
            author: 'Test Author',
            url: 'https://example.com/doc.pdf',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-06-01'),
          },
          chunkIndex: 42,
          tokens: 150,
          hash: 'complex-hash',
        },
      };
      
      await store.upsert([complexChunk]);
      const results = await store.searchByVector([0.5, 0.5, 0.5], 1);
      
      expect(results[0].chunk.metadata).toEqual(complexChunk.metadata);
      expect(results[0].chunk.metadata.source.createdAt).toBeInstanceOf(Date);
    });
  });
});