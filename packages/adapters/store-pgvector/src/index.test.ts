import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pgvectorStore, type PgVectorStoreOptions } from './index.js';
import type { ChunkWithEmbedding } from '@orquel/core';

// Test configuration - uses a test database
const TEST_CONFIG: PgVectorStoreOptions = {
  connectionString: process.env.TEST_DATABASE_URL || 'postgresql://test:test123@localhost:5433/orquel_test',
  tableName: 'test_chunks_' + Date.now(), // Unique table per test run
  dimensions: 384, // Smaller for testing
  autoSetup: true,
  maxConnections: 5, // Lower for tests
};

// Mock embeddings for testing
function createMockEmbedding(size: number = 384): number[] {
  return Array.from({ length: size }, () => Math.random() * 2 - 1);
}

// Create test chunks
function createTestChunk(id: string, content: string, index: number = 0): ChunkWithEmbedding {
  return {
    chunk: {
      id,
      text: content,
      index,
      hash: `hash-${id}`,
      source: {
        title: `Test Document ${Math.floor(index / 3) + 1}`,
        kind: 'md',
      },
      metadata: { testId: id },
    },
    embedding: createMockEmbedding(),
  };
}

describe('pgvectorStore', () => {
  let store: ReturnType<typeof pgvectorStore>;
  const shouldSkipTests = !process.env.TEST_DATABASE_URL && !process.env.CI;

  beforeAll(async () => {
    // Skip tests if no database URL provided
    if (shouldSkipTests) {
      console.warn('⚠️  Skipping PostgreSQL tests - no TEST_DATABASE_URL provided');
      console.warn('   Set TEST_DATABASE_URL or run: ./scripts/setup-tests.sh');
      return;
    }

    store = pgvectorStore(TEST_CONFIG);
    
    // Verify database connection
    const health = await store.healthCheck();
    if (!health.healthy) {
      throw new Error(`Database connection failed: ${health.error}`);
    }
  });

  afterAll(async () => {
    if (store) {
      await store.close();
    }
  });

  beforeEach(async () => {
    if (store && !shouldSkipTests) {
      await store.clear();
    }
  });

  describe('Configuration', () => {
    it('should create store with default options', () => {
      const defaultStore = pgvectorStore({
        connectionString: 'postgresql://test@localhost/test',
        dimensions: 384,
      });
      
      expect(defaultStore.name).toBe('pgvector');
    });

    it('should validate required options', () => {
      expect(() => {
        // @ts-expect-error - testing missing required options
        pgvectorStore({});
      }).toThrow();
    });
  });

  describe('Basic Operations', () => {
    it('should upsert and retrieve vectors', async () => {
      if (!store) return;

      const testChunks = [
        createTestChunk('test-1', 'First test chunk'),
        createTestChunk('test-2', 'Second test chunk'),
        createTestChunk('test-3', 'Third test chunk'),
      ];

      await store.upsert(testChunks);

      // Search by vector
      const results = await store.searchByVector(createMockEmbedding(), 3);
      expect(results).toHaveLength(3);
      expect(results[0].chunk.text).toContain('chunk');
    });

    it('should handle empty upsert', async () => {
      if (!store) return;

      await expect(store.upsert([])).resolves.not.toThrow();
    });

    it('should update existing chunks on conflict', async () => {
      if (!store) return;

      const originalChunk = createTestChunk('test-update', 'Original content');
      await store.upsert([originalChunk]);

      // Update with same ID
      const updatedChunk = createTestChunk('test-update', 'Updated content');
      await store.upsert([updatedChunk]);

      const results = await store.searchByIds(['test-update']);
      expect(results).toHaveLength(1);
      expect(results[0].chunk.text).toBe('Updated content');
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      if (!store) return;

      const testChunks = [
        createTestChunk('doc1-chunk1', 'Machine learning algorithms', 0),
        createTestChunk('doc1-chunk2', 'Deep neural networks', 1),
        createTestChunk('doc2-chunk1', 'Natural language processing', 0),
        createTestChunk('doc2-chunk2', 'Computer vision systems', 1),
        createTestChunk('doc3-chunk1', 'Database optimization', 0),
      ];

      await store.upsert(testChunks);
    });

    it('should search by vector with similarity scores', async () => {
      if (!store) return;

      const results = await store.searchByVector(createMockEmbedding(), 3);
      
      expect(results).toHaveLength(3);
      
      // Check that results have similarity scores
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.rank).toBeGreaterThan(0);
      });

      // Results should be ordered by similarity (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should search by IDs', async () => {
      if (!store) return;

      const results = await store.searchByIds(['doc1-chunk1', 'doc2-chunk2']);
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.chunk.id)).toContain('doc1-chunk1');
      expect(results.map(r => r.chunk.id)).toContain('doc2-chunk2');
    });

    it('should handle empty ID search', async () => {
      if (!store) return;

      const results = await store.searchByIds([]);
      expect(results).toHaveLength(0);
    });

    it('should limit results correctly', async () => {
      if (!store) return;

      const results = await store.searchByVector(createMockEmbedding(), 2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      if (!store) return;

      const testChunks = [
        createTestChunk('del-1', 'Delete test 1'),
        createTestChunk('del-2', 'Delete test 2'),
        createTestChunk('del-3', 'Delete test 3'),
      ];

      await store.upsert(testChunks);
    });

    it('should delete specific chunks', async () => {
      if (!store) return;

      await store.delete(['del-1', 'del-3']);

      const remaining = await store.searchByIds(['del-1', 'del-2', 'del-3']);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].chunk.id).toBe('del-2');
    });

    it('should handle empty delete', async () => {
      if (!store) return;

      await expect(store.delete([])).resolves.not.toThrow();
    });

    it('should clear all chunks', async () => {
      if (!store) return;

      await store.clear();

      const results = await store.searchByVector(createMockEmbedding(), 10);
      expect(results).toHaveLength(0);
    });
  });

  describe('Statistics and Health', () => {
    beforeEach(async () => {
      if (!store) return;

      const testChunks = [
        createTestChunk('stats-1', 'Stats test 1', 0),
        createTestChunk('stats-2', 'Stats test 2', 1),
        createTestChunk('stats-3', 'Stats test 3', 0),
      ];

      await store.upsert(testChunks);
    });

    it('should return accurate statistics', async () => {
      if (!store) return;

      const stats = await store.getStats();
      
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalSources).toBeGreaterThan(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should perform health check', async () => {
      if (!store) return;

      const health = await store.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.error).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const badStore = pgvectorStore({
        connectionString: 'postgresql://invalid:invalid@nonexistent:5432/invalid',
        dimensions: 384,
        autoSetup: false,
      });

      const health = await badStore.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();

      await badStore.close();
    });

    it('should handle malformed vectors', async () => {
      if (!store) return;

      // Test with wrong dimensions
      await expect(
        store.searchByVector(createMockEmbedding(100), 5)
      ).rejects.toThrow();
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent operations', async () => {
      if (!store) return;

      const chunk1 = createTestChunk('concurrent-1', 'Concurrent test 1');
      const chunk2 = createTestChunk('concurrent-2', 'Concurrent test 2');

      // Simulate concurrent upserts
      await Promise.all([
        store.upsert([chunk1]),
        store.upsert([chunk2]),
      ]);

      const results = await store.searchByIds(['concurrent-1', 'concurrent-2']);
      expect(results).toHaveLength(2);
    });

    it('should handle concurrent searches', async () => {
      if (!store) return;

      const testChunk = createTestChunk('search-test', 'Search test content');
      await store.upsert([testChunk]);

      // Simulate concurrent searches
      const searches = await Promise.all([
        store.searchByVector(createMockEmbedding(), 1),
        store.searchByVector(createMockEmbedding(), 1),
        store.searchByVector(createMockEmbedding(), 1),
      ]);

      searches.forEach(results => {
        expect(results).toHaveLength(1);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large batch upserts efficiently', async () => {
      if (!store || shouldSkipTests) return;

      const batchSize = 100;
      const chunks = Array.from({ length: batchSize }, (_, i) => 
        createTestChunk(`perf-${i}`, `Performance test chunk ${i}`, i)
      );

      const start = Date.now();
      await store.upsert(chunks);
      const upsertTime = Date.now() - start;

      // Should handle 100 chunks in reasonable time (< 5 seconds)
      expect(upsertTime).toBeLessThan(5000);

      // Verify all chunks were stored
      const stats = await store.getStats();
      expect(stats.totalChunks).toBe(batchSize);
    });

    it('should maintain search performance with larger datasets', async () => {
      if (!store || shouldSkipTests) return;

      // Insert moderate dataset
      const datasetSize = 50;
      const chunks = Array.from({ length: datasetSize }, (_, i) => 
        createTestChunk(`dataset-${i}`, `Dataset chunk ${i} with searchable content`, i)
      );

      await store.upsert(chunks);

      // Measure search performance
      const searchStart = Date.now();
      const results = await store.searchByVector(createMockEmbedding(), 10);
      const searchTime = Date.now() - searchStart;

      // Search should be fast (< 100ms for 50 chunks)
      expect(searchTime).toBeLessThan(100);
      expect(results.length).toBe(10);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should handle connection pool efficiently', async () => {
      if (!store || shouldSkipTests) return;

      // Simulate concurrent operations that would use multiple connections
      const operations = Array.from({ length: 10 }, async (_, i) => {
        const chunk = createTestChunk(`concurrent-${i}`, `Concurrent test ${i}`);
        await store.upsert([chunk]);
        const results = await store.searchByVector(createMockEmbedding(), 1);
        return results.length;
      });

      const start = Date.now();
      const results = await Promise.all(operations);
      const totalTime = Date.now() - start;

      // All operations should succeed
      results.forEach(count => expect(count).toBe(1));
      
      // Should handle concurrent operations efficiently
      expect(totalTime).toBeLessThan(3000);
    });
  });

  describe('Integration Tests', () => {
    it('should work with different index types', async () => {
      if (shouldSkipTests) return;

      // Test with HNSW index
      const hnswStore = pgvectorStore({
        ...TEST_CONFIG,
        tableName: 'test_hnsw_' + Date.now(),
        indexType: 'hnsw',
      });

      try {
        const chunks = Array.from({ length: 5 }, (_, i) => 
          createTestChunk(`hnsw-${i}`, `HNSW test chunk ${i}`)
        );

        await hnswStore.upsert(chunks);
        const results = await hnswStore.searchByVector(createMockEmbedding(), 3);
        
        expect(results.length).toBe(3);
        expect(results[0].score).toBeGreaterThan(0);
      } finally {
        await hnswStore.close();
      }
    });

    it('should handle database reconnection', async () => {
      if (!store || shouldSkipTests) return;

      // Insert test data
      const chunk = createTestChunk('reconnect-test', 'Reconnection test chunk');
      await store.upsert([chunk]);

      // Verify it's there
      let results = await store.searchByIds(['reconnect-test']);
      expect(results).toHaveLength(1);

      // Health check should still work
      const health = await store.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should maintain data consistency across operations', async () => {
      if (!store || shouldSkipTests) return;

      const chunks = Array.from({ length: 10 }, (_, i) => 
        createTestChunk(`consistency-${i}`, `Consistency test ${i}`)
      );

      // Insert chunks
      await store.upsert(chunks);
      
      // Verify count
      let stats = await store.getStats();
      expect(stats.totalChunks).toBe(10);

      // Update some chunks
      const updatedChunks = chunks.slice(0, 3).map(chunk => ({
        ...chunk,
        chunk: { ...chunk.chunk, text: 'Updated ' + chunk.chunk.text }
      }));
      
      await store.upsert(updatedChunks);
      
      // Count should remain the same (upsert, not insert)
      stats = await store.getStats();
      expect(stats.totalChunks).toBe(10);

      // Verify updates
      const updated = await store.searchByIds(['consistency-0']);
      expect(updated[0].chunk.text).toContain('Updated');

      // Delete some chunks
      await store.delete(['consistency-8', 'consistency-9']);
      
      stats = await store.getStats();
      expect(stats.totalChunks).toBe(8);
    });

    it('should handle edge cases gracefully', async () => {
      if (!store || shouldSkipTests) return;

      // Empty operations
      await expect(store.upsert([])).resolves.not.toThrow();
      await expect(store.searchByIds([])).resolves.toEqual([]);
      await expect(store.delete([])).resolves.not.toThrow();

      // Invalid IDs
      const results = await store.searchByIds(['non-existent-id']);
      expect(results).toHaveLength(0);

      // Zero k search
      const emptyResults = await store.searchByVector(createMockEmbedding(), 0);
      expect(emptyResults).toHaveLength(0);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly clean up resources', async () => {
      if (shouldSkipTests) return;

      const tempStore = pgvectorStore({
        ...TEST_CONFIG,
        tableName: 'temp_test_' + Date.now(),
      });

      // Use the store
      const chunk = createTestChunk('cleanup-test', 'Cleanup test');
      await tempStore.upsert([chunk]);
      
      const results = await tempStore.searchByVector(createMockEmbedding(), 1);
      expect(results).toHaveLength(1);

      // Close should not throw
      await expect(tempStore.close()).resolves.not.toThrow();

      // Operations after close should fail gracefully
      await expect(tempStore.healthCheck()).resolves.toEqual({
        healthy: false,
        latencyMs: expect.any(Number),
        error: expect.any(String)
      });
    });
  });
});