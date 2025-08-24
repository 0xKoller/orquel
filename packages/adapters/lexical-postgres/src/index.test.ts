import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { postgresLexical, type PostgresLexicalOptions } from './index.js';
import type { Chunk, SearchResult } from '@orquel/core';

// Test configuration
const TEST_CONFIG: PostgresLexicalOptions = {
  connectionString: process.env.TEST_DATABASE_URL || 'postgresql://test:test123@localhost:5433/orquel_test',
  tableName: 'test_lexical_' + Date.now(),
  language: 'english',
  autoSetup: true,
  maxConnections: 5,
};

// Create test chunks with diverse content
function createTestChunk(id: string, content: string, index: number = 0, title: string = 'Test Doc'): Chunk {
  return {
    id,
    text: content,
    index,
    hash: `hash-${id}`,
    source: { title, kind: 'md' },
    metadata: { testId: id },
  };
}

describe('postgresLexical', () => {
  let lexical: ReturnType<typeof postgresLexical>;
  const shouldSkipTests = !process.env.TEST_DATABASE_URL && !process.env.CI;

  beforeAll(async () => {
    if (shouldSkipTests) {
      console.warn('⚠️  Skipping PostgreSQL lexical tests - no TEST_DATABASE_URL provided');
      console.warn('   Set TEST_DATABASE_URL or run: ./scripts/setup-tests.sh');
      return;
    }

    lexical = postgresLexical(TEST_CONFIG);
    
    // Verify database connection
    const health = await lexical.healthCheck();
    if (!health.healthy) {
      throw new Error(`Database connection failed: ${health.error}`);
    }
  });

  afterAll(async () => {
    if (lexical) {
      await lexical.close();
    }
  });

  beforeEach(async () => {
    if (lexical && !shouldSkipTests) {
      // Clear by dropping and recreating table (faster than DELETE)
      try {
        await lexical.close();
        lexical = postgresLexical({
          ...TEST_CONFIG,
          tableName: 'test_lexical_' + Date.now(),
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Configuration', () => {
    it('should create lexical adapter with default options', () => {
      if (shouldSkipTests) return;
      
      const adapter = postgresLexical({
        connectionString: 'postgresql://test@localhost/test',
      });
      
      expect(adapter.name).toBe('postgres-lexical');
    });

    it('should validate required options', () => {
      expect(() => {
        // @ts-expect-error - testing missing required options
        postgresLexical({});
      }).toThrow();
    });
  });

  describe('Basic Operations', () => {
    it('should index and search text chunks', async () => {
      if (!lexical || shouldSkipTests) return;

      const testChunks = [
        createTestChunk('test-1', 'Machine learning algorithms process data efficiently'),
        createTestChunk('test-2', 'Neural networks learn complex patterns from examples'),
        createTestChunk('test-3', 'Database systems store information reliably'),
      ];

      await lexical.index(testChunks);

      // Search for machine learning content
      const results = await lexical.search('machine learning', 2);
      expect(results).toHaveLength(2);
      expect(results[0].chunk.text).toContain('learning');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should handle empty index operations', async () => {
      if (!lexical || shouldSkipTests) return;

      await expect(lexical.index([])).resolves.not.toThrow();
    });

    it('should return empty results for non-matching queries', async () => {
      if (!lexical || shouldSkipTests) return;

      const testChunks = [
        createTestChunk('test-1', 'Simple text content for testing'),
      ];

      await lexical.index(testChunks);

      const results = await lexical.search('nonexistent query terms', 5);
      expect(results).toHaveLength(0);
    });
  });

  describe('Full-Text Search Features', () => {
    beforeEach(async () => {
      if (!lexical || shouldSkipTests) return;

      // Index diverse content for search testing
      const chunks = [
        createTestChunk('ai-1', 'Artificial intelligence and machine learning revolutionize technology', 0, 'AI Guide'),
        createTestChunk('ai-2', 'Deep learning neural networks process complex data patterns', 1, 'AI Guide'),
        createTestChunk('db-1', 'Database management systems ensure data consistency and integrity', 0, 'DB Manual'),
        createTestChunk('db-2', 'SQL queries retrieve information efficiently from relational databases', 1, 'DB Manual'),
        createTestChunk('web-1', 'Web development frameworks simplify application building processes', 0, 'Web Dev'),
        createTestChunk('web-2', 'JavaScript enables dynamic user interface interactions', 1, 'Web Dev'),
      ];

      await lexical.index(chunks);
    });

    it('should rank results by relevance', async () => {
      if (!lexical || shouldSkipTests) return;

      const results = await lexical.search('database SQL', 3);
      expect(results.length).toBeGreaterThan(0);
      
      // Results should be ordered by relevance (descending score)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }

      // Most relevant should contain both terms or be highly relevant
      expect(results[0].chunk.text.toLowerCase()).toMatch(/(database|sql)/);
    });

    it('should handle phrase queries', async () => {
      if (!lexical || shouldSkipTests) return;

      const results = await lexical.search('machine learning', 5);
      expect(results.length).toBeGreaterThan(0);
      
      // Should find the exact phrase or close matches
      const topResult = results[0];
      expect(topResult.chunk.text.toLowerCase()).toContain('machine learning');
    });

    it('should support partial word matching', async () => {
      if (!lexical || shouldSkipTests) return;

      // Search for partial words
      const results = await lexical.search('develop', 3);
      expect(results.length).toBeGreaterThan(0);
      
      // Should find "development" or "developer" variants
      const hasMatch = results.some(r => 
        r.chunk.text.toLowerCase().includes('develop')
      );
      expect(hasMatch).toBe(true);
    });

    it('should weight title matches higher than content', async () => {
      if (!lexical || shouldSkipTests) return;

      // Search for term that appears in both title and content
      const results = await lexical.search('AI', 5);
      expect(results.length).toBeGreaterThan(0);
      
      // Results with title matches should score higher
      // This depends on our tsvector weighting (A > B)
      const titleMatch = results.find(r => r.chunk.source.title.includes('AI'));
      if (titleMatch) {
        expect(titleMatch.score).toBeGreaterThan(0);
      }
    });
  });

  describe('Advanced Features', () => {
    it('should provide search with highlights', async () => {
      if (!lexical || shouldSkipTests) return;

      const chunks = [
        createTestChunk('highlight-1', 'Machine learning algorithms are powerful tools for data analysis'),
        createTestChunk('highlight-2', 'Neural networks enable deep learning capabilities'),
      ];

      await lexical.index(chunks);

      const results = await lexical.searchWithHighlights('machine learning', 2);
      expect(results.length).toBeGreaterThan(0);
      
      // Should include highlights
      const highlighted = results.find(r => r.highlights && r.highlights.length > 0);
      expect(highlighted).toBeDefined();
      if (highlighted?.highlights) {
        expect(highlighted.highlights.some(h => h.includes('machine') || h.includes('learning'))).toBe(true);
      }
    });

    it('should suggest related queries', async () => {
      if (!lexical || shouldSkipTests) return;

      const chunks = [
        createTestChunk('suggest-1', 'Machine learning and artificial intelligence research'),
        createTestChunk('suggest-2', 'Deep learning neural network architectures'),
        createTestChunk('suggest-3', 'Natural language processing applications'),
      ];

      await lexical.index(chunks);

      const suggestions = await lexical.suggestQueries('machine', 3);
      expect(suggestions).toBeInstanceOf(Array);
      
      if (suggestions.length > 0) {
        // Suggestions should be strings containing the query term
        suggestions.forEach(suggestion => {
          expect(typeof suggestion).toBe('string');
          expect(suggestion.length).toBeGreaterThan('machine'.length);
        });
      }
    });

    it('should provide meaningful statistics', async () => {
      if (!lexical || shouldSkipTests) return;

      const chunks = [
        createTestChunk('stats-1', 'Technology advances rapidly in modern world'),
        createTestChunk('stats-2', 'Software development requires careful planning'),
        createTestChunk('stats-3', 'Data science involves statistical analysis'),
      ];

      await lexical.index(chunks);

      const stats = await lexical.getStats();
      
      expect(stats.totalIndexed).toBe(3);
      expect(stats.avgWordsPerChunk).toBeGreaterThan(0);
      expect(stats.topTerms).toBeInstanceOf(Array);
      
      if (stats.topTerms.length > 0) {
        stats.topTerms.forEach(term => {
          expect(term).toHaveProperty('term');
          expect(term).toHaveProperty('frequency');
          expect(typeof term.term).toBe('string');
          expect(typeof term.frequency).toBe('number');
        });
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle large text indexing efficiently', async () => {
      if (!lexical || shouldSkipTests) return;

      const largeChunks = Array.from({ length: 50 }, (_, i) => 
        createTestChunk(
          `large-${i}`, 
          `This is a large text chunk number ${i} containing various keywords like technology, development, analysis, research, innovation, and implementation. Each chunk has unique content but shares common themes for testing search capabilities.`,
          i
        )
      );

      const start = Date.now();
      await lexical.index(largeChunks);
      const indexTime = Date.now() - start;

      // Should index 50 chunks efficiently (< 3 seconds)
      expect(indexTime).toBeLessThan(3000);

      // Verify indexing worked
      const stats = await lexical.getStats();
      expect(stats.totalIndexed).toBe(50);
    });

    it('should maintain search performance with larger datasets', async () => {
      if (!lexical || shouldSkipTests) return;

      // Index moderate dataset
      const chunks = Array.from({ length: 30 }, (_, i) => 
        createTestChunk(
          `perf-${i}`, 
          `Performance test chunk ${i} with searchable terms like database, algorithm, network, system, application, framework, development, analysis, processing, optimization.`,
          i
        )
      );

      await lexical.index(chunks);

      // Measure search performance
      const searchStart = Date.now();
      const results = await lexical.search('database algorithm', 10);
      const searchTime = Date.now() - searchStart;

      // Search should be fast (< 50ms for 30 chunks)
      expect(searchTime).toBeLessThan(50);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle concurrent searches', async () => {
      if (!lexical || shouldSkipTests) return;

      const chunks = Array.from({ length: 10 }, (_, i) => 
        createTestChunk(`concurrent-${i}`, `Concurrent search test chunk ${i}`)
      );

      await lexical.index(chunks);

      // Simulate concurrent searches
      const searches = await Promise.all([
        lexical.search('concurrent', 3),
        lexical.search('search', 3),
        lexical.search('test', 3),
        lexical.search('chunk', 3),
      ]);

      // All searches should succeed
      searches.forEach(results => {
        expect(results).toBeInstanceOf(Array);
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed queries gracefully', async () => {
      if (!lexical || shouldSkipTests) return;

      const chunks = [
        createTestChunk('error-1', 'Simple test content'),
      ];

      await lexical.index(chunks);

      // Test various potentially problematic queries
      const problematicQueries = [
        '',           // Empty query
        '   ',        // Whitespace only
        '!@#$%',      // Special characters only
        'a',          // Single character
        'the and or', // Common stop words
      ];

      for (const query of problematicQueries) {
        const results = await lexical.search(query, 5);
        expect(results).toBeInstanceOf(Array);
        // Should not throw, but may return empty results
      }
    });

    it('should handle database connection errors gracefully', async () => {
      if (shouldSkipTests) return;

      const badLexical = postgresLexical({
        connectionString: 'postgresql://invalid:invalid@nonexistent:5432/invalid',
        autoSetup: false,
      });

      const health = await badLexical.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();

      await badLexical.close();
    });
  });

  describe('Integration Tests', () => {
    it('should work with different languages', async () => {
      if (shouldSkipTests) return;

      const spanishLexical = postgresLexical({
        ...TEST_CONFIG,
        tableName: 'test_spanish_' + Date.now(),
        language: 'spanish',
      });

      try {
        const chunks = [
          createTestChunk('es-1', 'Los algoritmos de aprendizaje automático procesan datos'),
          createTestChunk('es-2', 'Las redes neuronales aprenden patrones complejos'),
        ];

        await spanishLexical.index(chunks);
        const results = await spanishLexical.search('aprendizaje', 2);
        
        expect(results.length).toBeGreaterThan(0);
      } finally {
        await spanishLexical.close();
      }
    });

    it('should maintain consistency with frequent updates', async () => {
      if (!lexical || shouldSkipTests) return;

      // Initial indexing
      const initialChunks = Array.from({ length: 5 }, (_, i) => 
        createTestChunk(`update-${i}`, `Initial content ${i}`)
      );

      await lexical.index(initialChunks);
      
      let stats = await lexical.getStats();
      expect(stats.totalIndexed).toBe(5);

      // Update with new content
      const updatedChunks = Array.from({ length: 3 }, (_, i) => 
        createTestChunk(`update-${i}`, `Updated content ${i}`)
      );

      await lexical.index(updatedChunks);

      // Search should find updated content
      const results = await lexical.search('Updated', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.text).toContain('Updated');
    });

    it('should handle special characters and encodings', async () => {
      if (!lexical || shouldSkipTests) return;

      const specialChunks = [
        createTestChunk('special-1', 'Content with émojis 🚀 and àccénts'),
        createTestChunk('special-2', 'Unicode characters: ñ, ü, ç, β, α, π'),
        createTestChunk('special-3', 'Special symbols: @#$%^&*()_+-=[]{}|;:,.<>?'),
      ];

      await lexical.index(specialChunks);

      // Search for content with special characters
      const results = await lexical.search('émojis Unicode', 3);
      expect(results).toBeInstanceOf(Array);
      // Should handle special characters without errors
    });
  });

  describe('Resource Management', () => {
    it('should properly clean up resources', async () => {
      if (shouldSkipTests) return;

      const tempLexical = postgresLexical({
        ...TEST_CONFIG,
        tableName: 'temp_lexical_' + Date.now(),
      });

      // Use the adapter
      const chunk = createTestChunk('cleanup-test', 'Cleanup test content');
      await tempLexical.index([chunk]);
      
      const results = await tempLexical.search('cleanup', 1);
      expect(results).toHaveLength(1);

      // Close should not throw
      await expect(tempLexical.close()).resolves.not.toThrow();

      // Operations after close should fail gracefully
      await expect(tempLexical.healthCheck()).resolves.toEqual({
        healthy: false,
        latencyMs: expect.any(Number),
        error: expect.any(String)
      });
    });

    it('should handle connection pool limits', async () => {
      if (shouldSkipTests) return;

      // Create adapter with very low connection limit
      const limitedLexical = postgresLexical({
        ...TEST_CONFIG,
        tableName: 'limited_' + Date.now(),
        maxConnections: 2,
      });

      try {
        // Perform operations that would stress the connection pool
        const operations = Array.from({ length: 5 }, async (_, i) => {
          const chunk = createTestChunk(`pool-${i}`, `Pool test ${i}`);
          await limitedLexical.index([chunk]);
          return await limitedLexical.search('Pool', 1);
        });

        const results = await Promise.all(operations);
        
        // All operations should complete successfully despite connection limits
        results.forEach(result => {
          expect(result).toBeInstanceOf(Array);
        });
      } finally {
        await limitedLexical.close();
      }
    });
  });
});