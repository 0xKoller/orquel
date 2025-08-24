import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateTestChunks,
  generateSearchQueries,
  benchmarkVectorStore,
  benchmarkLexicalStore,
  compareResults,
  generateReport,
  DEFAULT_BENCHMARK_CONFIG,
} from './benchmark.js';
import { memoryStore } from '@orquel/store-memory';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
import type { BenchmarkConfig } from './benchmark.js';

// Lightweight benchmark config for tests
const TEST_BENCHMARK_CONFIG: BenchmarkConfig = {
  chunkCounts: [10, 25],
  dimensions: 384, // Smaller for faster tests
  searchQueries: 3,
  k: 5,
  runs: 2,
  warmupRuns: 1,
};

describe('Performance Benchmarking', () => {
  
  describe('Test Data Generation', () => {
    it('should generate realistic test chunks', () => {
      const chunks = generateTestChunks(10, 384);
      
      expect(chunks).toHaveLength(10);
      
      chunks.forEach((chunkWithEmbedding, index) => {
        const { chunk, embedding } = chunkWithEmbedding;
        
        // Verify chunk structure
        expect(chunk.id).toBe(`benchmark-chunk-${index}`);
        expect(chunk.text).toContain(`chunk number ${index}`);
        expect(chunk.index).toBe(index);
        expect(chunk.source.title).toContain('Benchmark Document');
        expect(chunk.metadata.benchmarkId).toBe(index);
        
        // Verify embedding
        expect(embedding).toHaveLength(384);
        expect(embedding.every(val => val >= -1 && val <= 1)).toBe(true);
      });
    });
    
    it('should generate diverse content for variety', () => {
      const chunks = generateTestChunks(20, 256);
      
      const uniqueTexts = new Set(chunks.map(c => c.chunk.text.split(' ')[0]));
      expect(uniqueTexts.size).toBeGreaterThan(5); // Should have variety
      
      const categories = new Set(chunks.map(c => c.chunk.metadata.category));
      expect(categories.size).toBe(5); // Should have all 5 categories
    });
    
    it('should generate realistic search queries', () => {
      const queries = generateSearchQueries(5);
      
      expect(queries).toHaveLength(5);
      
      queries.forEach((query, index) => {
        expect(query.text).toContain(`query ${index}`);
        expect(query.embedding).toHaveLength(1536); // Default dimension
        expect(query.embedding.every(val => val >= -1 && val <= 1)).toBe(true);
      });
    });
  });
  
  describe('Memory Store Benchmarking', () => {
    it('should benchmark memory store performance', async () => {
      const store = memoryStore();
      
      const result = await benchmarkVectorStore(store, TEST_BENCHMARK_CONFIG);
      
      expect(result.adapterName).toBe('memory');
      expect(result.config).toEqual(TEST_BENCHMARK_CONFIG);
      expect(result.metrics.length).toBeGreaterThan(0);
      
      // Should have metrics for both chunk counts
      const upsertMetrics = result.metrics.filter(m => m.operation === 'upsert');
      const searchMetrics = result.metrics.filter(m => m.operation === 'search');
      
      expect(upsertMetrics).toHaveLength(2); // One for each chunk count
      expect(searchMetrics).toHaveLength(2);
      
      // Verify metric structure
      upsertMetrics.forEach(metric => {
        expect(metric.duration).toBeGreaterThan(0);
        expect(metric.throughput).toBeGreaterThan(0);
        expect(metric.itemCount).toBeGreaterThan(0);
      });
      
      searchMetrics.forEach(metric => {
        expect(metric.duration).toBeGreaterThan(0);
        expect(metric.throughput).toBeGreaterThan(0);
      });
      
      // Verify summary
      expect(result.summary.avgUpsertThroughput).toBeGreaterThan(0);
      expect(result.summary.avgSearchLatency).toBeGreaterThan(0);
      expect(result.summary.recommendation).toBeTruthy();
    });
    
    it('should show performance scaling characteristics', async () => {
      const store = memoryStore();
      
      const scalingConfig: BenchmarkConfig = {
        ...TEST_BENCHMARK_CONFIG,
        chunkCounts: [10, 50, 100],
        runs: 1, // Faster for scaling test
      };
      
      const result = await benchmarkVectorStore(store, scalingConfig);
      
      const upsertMetrics = result.metrics.filter(m => m.operation === 'upsert');
      
      // Should have metrics for all chunk counts
      expect(upsertMetrics).toHaveLength(3);
      
      // Verify scaling behavior (throughput should be consistent for memory store)
      upsertMetrics.forEach(metric => {
        expect(metric.throughput).toBeGreaterThan(0);
      });
      
      // Memory store should maintain good performance across sizes
      const throughputs = upsertMetrics.map(m => m.throughput);
      const minThroughput = Math.min(...throughputs);
      const maxThroughput = Math.max(...throughputs);
      
      // Throughput shouldn't vary dramatically for memory store
      expect(maxThroughput / minThroughput).toBeLessThan(10);
    });
  });
  
  describe('PostgreSQL Store Benchmarking', () => {
    const shouldSkipTests = !process.env.TEST_DATABASE_URL && !process.env.CI;
    
    it('should benchmark PostgreSQL store if available', async () => {
      if (shouldSkipTests) {
        console.warn('⚠️  Skipping PostgreSQL benchmark - no TEST_DATABASE_URL');
        return;
      }
      
      const store = pgvectorStore({
        connectionString: process.env.TEST_DATABASE_URL!,
        tableName: 'benchmark_test_' + Date.now(),
        dimensions: TEST_BENCHMARK_CONFIG.dimensions,
        autoSetup: true,
      });
      
      try {
        const result = await benchmarkVectorStore(store, TEST_BENCHMARK_CONFIG);
        
        expect(result.adapterName).toBe('pgvector');
        expect(result.metrics.length).toBeGreaterThan(0);
        
        // PostgreSQL should have measurable performance
        expect(result.summary.avgUpsertThroughput).toBeGreaterThan(0);
        expect(result.summary.avgSearchLatency).toBeGreaterThan(0);
        
        // Should complete operations within reasonable time
        result.metrics.forEach(metric => {
          expect(metric.duration).toBeLessThan(30000); // 30 seconds max
        });
        
      } finally {
        await store.close();
      }
    });
    
    it('should benchmark lexical search if available', async () => {
      if (shouldSkipTests) {
        console.warn('⚠️  Skipping lexical benchmark - no TEST_DATABASE_URL');
        return;
      }
      
      const lexical = postgresLexical({
        connectionString: process.env.TEST_DATABASE_URL!,
        tableName: 'lexical_benchmark_' + Date.now(),
        autoSetup: true,
      });
      
      try {
        const result = await benchmarkLexicalStore(lexical, TEST_BENCHMARK_CONFIG);
        
        expect(result.adapterName).toBe('postgres-lexical');
        expect(result.metrics.length).toBeGreaterThan(0);
        
        // Should have both index and search metrics
        const indexMetrics = result.metrics.filter(m => m.operation === 'index');
        const searchMetrics = result.metrics.filter(m => m.operation === 'search');
        
        expect(indexMetrics.length).toBe(TEST_BENCHMARK_CONFIG.chunkCounts.length);
        expect(searchMetrics.length).toBe(TEST_BENCHMARK_CONFIG.chunkCounts.length);
        
        // Performance should be reasonable
        expect(result.summary.avgUpsertThroughput).toBeGreaterThan(0);
        expect(result.summary.avgSearchLatency).toBeLessThan(1000); // Should be fast
        
      } finally {
        await lexical.close();
      }
    });
  });
  
  describe('Performance Comparison', () => {
    it('should compare multiple benchmark results', async () => {
      const memoryResult = await benchmarkVectorStore(memoryStore(), TEST_BENCHMARK_CONFIG);
      
      // Create a mock second result for comparison
      const mockResult = {
        ...memoryResult,
        adapterName: 'mock-adapter',
        summary: {
          ...memoryResult.summary,
          avgUpsertThroughput: memoryResult.summary.avgUpsertThroughput * 0.5,
          avgSearchLatency: memoryResult.summary.avgSearchLatency * 2,
        },
      };
      
      const comparison = compareResults([memoryResult, mockResult]);
      
      expect(comparison.results).toHaveLength(2);
      expect(comparison.analysis.bestPerformers).toBeDefined();
      expect(comparison.analysis.ratios).toBeDefined();
      expect(comparison.analysis.recommendations).toBeDefined();
      
      // Memory should outperform mock adapter
      expect(comparison.analysis.bestPerformers.upsert).toBe('memory');
      
      // Should have performance ratios
      expect(comparison.analysis.ratios.memory['mock-adapter']).toBeGreaterThan(1);
      expect(comparison.analysis.ratios['mock-adapter'].memory).toBeLessThan(1);
      
      // Should have recommendations for different use cases
      expect(comparison.analysis.recommendations.development).toBeTruthy();
      expect(comparison.analysis.recommendations.production).toBeTruthy();
      expect(comparison.analysis.recommendations.largescale).toBeTruthy();
    });
    
    it('should generate comprehensive reports', async () => {
      const result = await benchmarkVectorStore(memoryStore(), TEST_BENCHMARK_CONFIG);
      const comparison = compareResults([result]);
      
      const report = generateReport(comparison);
      
      expect(report).toContain('# Orquel Performance Benchmark Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Best Performers');
      expect(report).toContain('## Recommendations');
      expect(report).toContain('## Detailed Metrics');
      
      // Should contain actual data
      expect(report).toContain(result.adapterName);
      expect(report).toContain(result.summary.avgUpsertThroughput.toFixed(1));
      expect(report).toContain(result.summary.avgSearchLatency.toFixed(2));
    });
  });
  
  describe('Configuration Validation', () => {
    it('should use default configuration correctly', () => {
      expect(DEFAULT_BENCHMARK_CONFIG.chunkCounts).toContain(100);
      expect(DEFAULT_BENCHMARK_CONFIG.dimensions).toBe(1536);
      expect(DEFAULT_BENCHMARK_CONFIG.k).toBeGreaterThan(0);
      expect(DEFAULT_BENCHMARK_CONFIG.runs).toBeGreaterThan(0);
    });
    
    it('should handle edge case configurations', async () => {
      const edgeConfig: BenchmarkConfig = {
        chunkCounts: [1], // Minimum chunks
        dimensions: 128, // Smaller dimension
        searchQueries: 1,
        k: 1,
        runs: 1,
        warmupRuns: 0, // No warmup
      };
      
      const store = memoryStore();
      const result = await benchmarkVectorStore(store, edgeConfig);
      
      expect(result.metrics.length).toBeGreaterThan(0);
      expect(result.summary.avgUpsertThroughput).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle benchmark errors gracefully', async () => {
      // Create a mock adapter that will fail
      const failingAdapter = {
        name: 'failing-adapter',
        upsert: async () => { throw new Error('Upsert failed'); },
        searchByVector: async () => { throw new Error('Search failed'); },
        searchByIds: async () => { throw new Error('SearchByIds failed'); },
        delete: async () => {},
        clear: async () => {},
        close: async () => {},
      };
      
      // Benchmark should not crash, even if operations fail
      await expect(
        benchmarkVectorStore(failingAdapter, {
          ...TEST_BENCHMARK_CONFIG,
          chunkCounts: [5],
          runs: 1,
        })
      ).rejects.toThrow();
      
      // This is expected - the adapter fails, so benchmark should fail too
      // But it should fail gracefully, not crash the entire process
    });
    
    it('should validate benchmark inputs', async () => {
      const store = memoryStore();
      
      // Invalid configuration should be handled
      const invalidConfig: BenchmarkConfig = {
        chunkCounts: [], // Empty array
        dimensions: 0,  // Invalid dimension
        searchQueries: 0,
        k: 0,
        runs: 0,
      };
      
      // Should not crash, but might return empty/invalid results
      const result = await benchmarkVectorStore(store, invalidConfig);
      
      // Should still return a valid result structure
      expect(result.adapterName).toBe('memory');
      expect(result.config).toEqual(invalidConfig);
      expect(result.metrics).toBeInstanceOf(Array);
    });
  });
  
  describe('Real-World Performance Scenarios', () => {
    it('should simulate realistic workload patterns', async () => {
      const store = memoryStore();
      
      // Simulate a realistic mixed workload
      const workloadConfig: BenchmarkConfig = {
        chunkCounts: [100, 1000], // Typical document sizes
        dimensions: 1536, // OpenAI embedding size
        searchQueries: 10, // Multiple search scenarios
        k: 5, // Typical result count
        runs: 2,
        warmupRuns: 1,
      };
      
      const result = await benchmarkVectorStore(store, workloadConfig);
      
      // Should complete in reasonable time for memory store
      const maxDuration = Math.max(...result.metrics.map(m => m.duration));
      expect(maxDuration).toBeLessThan(5000); // 5 seconds max for memory store
      
      // Memory store should maintain good performance
      expect(result.summary.avgSearchLatency).toBeLessThan(10); // Very fast for memory
    });
    
    it('should provide performance insights', async () => {
      const store = memoryStore();
      const result = await benchmarkVectorStore(store, TEST_BENCHMARK_CONFIG);
      
      // Should provide actionable recommendations
      expect(result.summary.recommendation).toBeTruthy();
      expect(typeof result.summary.recommendation).toBe('string');
      
      // Metrics should be comprehensive
      const upsertMetrics = result.metrics.filter(m => m.operation === 'upsert');
      const searchMetrics = result.metrics.filter(m => m.operation === 'search');
      
      // Should have metadata for deeper analysis
      upsertMetrics.forEach(metric => {
        expect(metric.metadata).toBeDefined();
        if (metric.metadata) {
          expect(metric.metadata.minTime).toBeGreaterThan(0);
          expect(metric.metadata.maxTime).toBeGreaterThan(0);
          expect(metric.metadata.maxTime).toBeGreaterThanOrEqual(metric.metadata.minTime);
        }
      });
    });
  });
});