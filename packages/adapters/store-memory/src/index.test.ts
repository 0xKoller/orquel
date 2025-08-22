import { describe, it, expect } from 'vitest';
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
});