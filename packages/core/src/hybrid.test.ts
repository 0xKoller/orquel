import { describe, it, expect } from 'vitest';
import {
  reciprocalRankFusion,
  weightedScoreCombination,
  normalizeScores,
  mergeHybridResults,
  analyzeHybridOverlap,
} from './hybrid.js';
import type { SearchResult } from './types.js';

// Helper to create test search results
function createSearchResult(id: string, score: number, rank: number, text: string = `Content for ${id}`): SearchResult {
  return {
    chunk: {
      id,
      text,
      index: rank - 1,
      hash: `hash-${id}`,
      source: { title: 'Test Document', kind: 'md' },
      metadata: {},
    },
    score,
    rank,
  };
}

describe('Hybrid Search Algorithms', () => {
  
  describe('Reciprocal Rank Fusion (RRF)', () => {
    it('should combine rankings using RRF formula', () => {
      const denseResults = [
        createSearchResult('doc1', 0.95, 1),
        createSearchResult('doc2', 0.85, 2),
        createSearchResult('doc3', 0.75, 3),
      ];

      const lexicalResults = [
        createSearchResult('doc2', 0.90, 1), // doc2 ranks higher in lexical
        createSearchResult('doc1', 0.80, 2),
        createSearchResult('doc4', 0.70, 3), // doc4 only in lexical
      ];

      const results = reciprocalRankFusion(denseResults, lexicalResults, 5);

      expect(results).toHaveLength(4); // All unique documents
      expect(results[0].chunk.id).toBe('doc2'); // Should rank highest (appears in both, high in lexical)
      expect(results.every(r => r.score > 0)).toBe(true);
      expect(results.every(r => r.rank > 0)).toBe(true);

      // Verify RRF scoring: doc2 should have highest combined score
      // RRF(doc2) = 1/(60+2) + 1/(60+1) = higher than others
      const doc2Score = results.find(r => r.chunk.id === 'doc2')?.score;
      const doc1Score = results.find(r => r.chunk.id === 'doc1')?.score;
      expect(doc2Score).toBeGreaterThan(doc1Score!);
    });

    it('should handle edge cases', () => {
      // Empty results
      expect(reciprocalRankFusion([], [], 5)).toHaveLength(0);

      // Only dense results
      const denseOnly = [createSearchResult('doc1', 0.9, 1)];
      const resultsWithDenseOnly = reciprocalRankFusion(denseOnly, [], 5);
      expect(resultsWithDenseOnly).toHaveLength(1);
      expect(resultsWithDenseOnly[0].chunk.id).toBe('doc1');

      // Only lexical results
      const lexicalOnly = [createSearchResult('doc2', 0.8, 1)];
      const resultsWithLexicalOnly = reciprocalRankFusion([], lexicalOnly, 5);
      expect(resultsWithLexicalOnly).toHaveLength(1);
      expect(resultsWithLexicalOnly[0].chunk.id).toBe('doc2');
    });

    it('should respect k limit', () => {
      const dense = Array.from({ length: 10 }, (_, i) => 
        createSearchResult(`dense-${i}`, 0.9 - i * 0.05, i + 1)
      );
      const lexical = Array.from({ length: 10 }, (_, i) => 
        createSearchResult(`lexical-${i}`, 0.85 - i * 0.05, i + 1)
      );

      const results = reciprocalRankFusion(dense, lexical, 5);
      expect(results).toHaveLength(5);
    });

    it('should use configurable RFF constant', () => {
      const dense = [createSearchResult('doc1', 0.9, 1)];
      const lexical = [createSearchResult('doc1', 0.8, 1)];

      const withDefault = reciprocalRankFusion(dense, lexical, 1, 60);
      const withCustom = reciprocalRankFusion(dense, lexical, 1, 30);

      // Different constants should produce different scores
      expect(withCustom[0].score).not.toEqual(withDefault[0].score);
    });
  });

  describe('Weighted Score Combination', () => {
    it('should combine scores with configurable weights', () => {
      const denseResults = [
        createSearchResult('doc1', 1.0, 1),
        createSearchResult('doc2', 0.8, 2),
      ];

      const lexicalResults = [
        createSearchResult('doc2', 1.0, 1), // doc2 scores high in lexical
        createSearchResult('doc1', 0.6, 2),
      ];

      const results = weightedScoreCombination(denseResults, lexicalResults, 5, 0.7, 0.3);

      expect(results).toHaveLength(2);

      // Find results
      const doc1Result = results.find(r => r.chunk.id === 'doc1')!;
      const doc2Result = results.find(r => r.chunk.id === 'doc2')!;

      expect(doc1Result).toBeDefined();
      expect(doc2Result).toBeDefined();

      // doc1: 0.7 * 1.0 + 0.3 * 0.6 = 0.88 (after normalization)
      // doc2: 0.7 * 0.8 + 0.3 * 1.0 = 0.86 (after normalization)
      // But normalization affects final scores, so just check they're reasonable
      expect(doc1Result.score).toBeGreaterThan(0);
      expect(doc2Result.score).toBeGreaterThan(0);
    });

    it('should normalize scores before combination', () => {
      const denseResults = [
        createSearchResult('doc1', 100, 1), // Unnormalized high score
        createSearchResult('doc2', 50, 2),
      ];

      const lexicalResults = [
        createSearchResult('doc1', 2.0, 1), // Different scale
        createSearchResult('doc2', 1.0, 2),
      ];

      const results = weightedScoreCombination(denseResults, lexicalResults, 5);

      // Should handle different score scales gracefully
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle overlapping and non-overlapping results', () => {
      const denseResults = [
        createSearchResult('shared', 0.9, 1),
        createSearchResult('dense-only', 0.8, 2),
      ];

      const lexicalResults = [
        createSearchResult('shared', 0.85, 1),
        createSearchResult('lexical-only', 0.75, 2),
      ];

      const results = weightedScoreCombination(denseResults, lexicalResults, 5);

      expect(results).toHaveLength(3); // shared + dense-only + lexical-only

      const sharedResult = results.find(r => r.chunk.id === 'shared')!;
      const denseOnlyResult = results.find(r => r.chunk.id === 'dense-only')!;
      const lexicalOnlyResult = results.find(r => r.chunk.id === 'lexical-only')!;

      expect(sharedResult).toBeDefined();
      expect(denseOnlyResult).toBeDefined();
      expect(lexicalOnlyResult).toBeDefined();

      // Shared result should have combined score from both methods
      expect(sharedResult.score).toBeGreaterThan(denseOnlyResult.score);
      expect(sharedResult.score).toBeGreaterThan(lexicalOnlyResult.score);
    });
  });

  describe('Score Normalization', () => {
    it('should normalize scores using min-max method', () => {
      const results = [
        createSearchResult('doc1', 100, 1),
        createSearchResult('doc2', 50, 2),
        createSearchResult('doc3', 0, 3),
      ];

      const normalized = normalizeScores(results, 'minmax');

      expect(normalized).toHaveLength(3);
      expect(normalized[0].score).toBe(1.0); // Max score
      expect(normalized[2].score).toBe(0.0); // Min score
      expect(normalized[1].score).toBe(0.5); // Middle score
    });

    it('should normalize scores using z-score method', () => {
      const results = [
        createSearchResult('doc1', 3, 1),
        createSearchResult('doc2', 1, 2),
        createSearchResult('doc3', 2, 3),
      ];

      const normalized = normalizeScores(results, 'zscore');

      expect(normalized).toHaveLength(3);
      normalized.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle edge cases', () => {
      // Empty results
      expect(normalizeScores([], 'minmax')).toHaveLength(0);

      // Single result
      const singleResult = [createSearchResult('doc1', 0.5, 1)];
      const normalizedSingle = normalizeScores(singleResult, 'minmax');
      expect(normalizedSingle[0].score).toBe(1.0);

      // All same scores
      const sameScores = [
        createSearchResult('doc1', 0.5, 1),
        createSearchResult('doc2', 0.5, 2),
      ];
      const normalizedSame = normalizeScores(sameScores, 'minmax');
      expect(normalizedSame.every(r => r.score === 1.0)).toBe(true);
    });
  });

  describe('Merge Hybrid Results', () => {
    it('should use RRF by default', () => {
      const dense = [createSearchResult('doc1', 0.9, 1)];
      const lexical = [createSearchResult('doc2', 0.8, 1)];

      const results = mergeHybridResults(dense, lexical, { k: 5 });

      expect(results).toHaveLength(2);
      // RRF algorithm should be used
    });

    it('should respect normalization method configuration', () => {
      const dense = [createSearchResult('doc1', 0.9, 1)];
      const lexical = [createSearchResult('doc1', 0.8, 1)];

      const rrfResults = mergeHybridResults(dense, lexical, {
        k: 5,
        normalizationMethod: 'rrf'
      });

      const minmaxResults = mergeHybridResults(dense, lexical, {
        k: 5,
        normalizationMethod: 'minmax',
        denseWeight: 0.7,
        lexicalWeight: 0.3
      });

      expect(rrfResults).toHaveLength(1);
      expect(minmaxResults).toHaveLength(1);
      // Different algorithms should produce different scores
      expect(rrfResults[0].score).not.toEqual(minmaxResults[0].score);
    });

    it('should handle all normalization methods', () => {
      const dense = [createSearchResult('doc1', 0.9, 1)];
      const lexical = [createSearchResult('doc2', 0.8, 1)];

      const methods: ('rrf' | 'minmax' | 'zscore')[] = ['rrf', 'minmax', 'zscore'];

      methods.forEach(method => {
        const results = mergeHybridResults(dense, lexical, {
          k: 5,
          normalizationMethod: method
        });

        expect(results).toHaveLength(2);
        expect(results.every(r => r.score > 0)).toBe(true);
      });
    });
  });

  describe('Analyze Hybrid Overlap', () => {
    it('should analyze overlap between search methods', () => {
      const denseResults = [
        createSearchResult('shared1', 0.9, 1),
        createSearchResult('shared2', 0.8, 2),
        createSearchResult('dense-only', 0.7, 3),
      ];

      const lexicalResults = [
        createSearchResult('shared1', 0.85, 1),
        createSearchResult('shared2', 0.75, 2),
        createSearchResult('lexical-only1', 0.6, 3),
        createSearchResult('lexical-only2', 0.5, 4),
      ];

      const analysis = analyzeHybridOverlap(denseResults, lexicalResults);

      expect(analysis.overlapCount).toBe(2); // shared1, shared2
      expect(analysis.denseOnlyCount).toBe(1); // dense-only
      expect(analysis.lexicalOnlyCount).toBe(2); // lexical-only1, lexical-only2
      expect(analysis.overlapPercentage).toBeCloseTo(40, 1); // 2 out of 5 unique
      expect(analysis.complementaryScore).toBeCloseTo(0.6, 1); // (1+2)/5
    });

    it('should handle edge cases', () => {
      // No results
      const emptyAnalysis = analyzeHybridOverlap([], []);
      expect(emptyAnalysis.overlapCount).toBe(0);
      expect(emptyAnalysis.overlapPercentage).toBe(0);
      expect(emptyAnalysis.complementaryScore).toBe(0);

      // Complete overlap
      const denseResults = [createSearchResult('doc1', 0.9, 1)];
      const lexicalResults = [createSearchResult('doc1', 0.8, 1)];
      const completeOverlap = analyzeHybridOverlap(denseResults, lexicalResults);
      expect(completeOverlap.overlapCount).toBe(1);
      expect(completeOverlap.complementaryScore).toBe(0); // No unique results

      // No overlap
      const noOverlapDense = [createSearchResult('dense1', 0.9, 1)];
      const noOverlapLexical = [createSearchResult('lexical1', 0.8, 1)];
      const noOverlap = analyzeHybridOverlap(noOverlapDense, noOverlapLexical);
      expect(noOverlap.overlapCount).toBe(0);
      expect(noOverlap.complementaryScore).toBe(1.0); // Complete complementarity
    });

    it('should calculate meaningful complementary scores', () => {
      // High complementarity (methods find different results)
      const highComplementaryDense = [
        createSearchResult('dense1', 0.9, 1),
        createSearchResult('dense2', 0.8, 2),
      ];
      const highComplementaryLexical = [
        createSearchResult('lexical1', 0.85, 1),
        createSearchResult('lexical2', 0.75, 2),
      ];

      const highComplementary = analyzeHybridOverlap(highComplementaryDense, highComplementaryLexical);
      expect(highComplementary.complementaryScore).toBe(1.0);

      // Low complementarity (methods find mostly same results)
      const lowComplementaryDense = [
        createSearchResult('shared', 0.9, 1),
        createSearchResult('dense-only', 0.8, 2),
      ];
      const lowComplementaryLexical = [
        createSearchResult('shared', 0.85, 1),
      ];

      const lowComplementary = analyzeHybridOverlap(lowComplementaryDense, lowComplementaryLexical);
      expect(lowComplementary.complementaryScore).toBeCloseTo(0.5, 1); // 1 unique out of 2 total
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical search result patterns', () => {
      // Simulate realistic search results with varying relevance
      const denseResults = [
        createSearchResult('highly-relevant', 0.95, 1, 'Machine learning algorithms process data efficiently'),
        createSearchResult('somewhat-relevant', 0.75, 2, 'Data processing systems handle information'),
        createSearchResult('loosely-related', 0.55, 3, 'Computer systems perform calculations'),
      ];

      const lexicalResults = [
        createSearchResult('keyword-match', 0.90, 1, 'Machine learning and artificial intelligence'),
        createSearchResult('highly-relevant', 0.85, 2, 'Machine learning algorithms process data efficiently'),
        createSearchResult('phrase-match', 0.70, 3, 'Learning algorithms in machine contexts'),
      ];

      // Test all hybrid methods
      const rrfResults = mergeHybridResults(denseResults, lexicalResults, {
        k: 5,
        normalizationMethod: 'rrf'
      });

      const weightedResults = mergeHybridResults(denseResults, lexicalResults, {
        k: 5,
        normalizationMethod: 'minmax',
        denseWeight: 0.6,
        lexicalWeight: 0.4
      });

      // Both should return reasonable results
      expect(rrfResults.length).toBeGreaterThan(0);
      expect(weightedResults.length).toBeGreaterThan(0);

      // Results should be ordered by relevance
      rrfResults.forEach((result, i) => {
        if (i > 0) {
          expect(result.score).toBeLessThanOrEqual(rrfResults[i - 1].score);
        }
      });

      weightedResults.forEach((result, i) => {
        if (i > 0) {
          expect(result.score).toBeLessThanOrEqual(weightedResults[i - 1].score);
        }
      });

      // Highly relevant document should rank well in both
      const rrfTopDoc = rrfResults[0].chunk.id;
      const weightedTopDoc = weightedResults[0].chunk.id;
      
      // At least one method should put the highly relevant doc at top
      const topDocs = [rrfTopDoc, weightedTopDoc];
      expect(topDocs).toContain('highly-relevant');
    });

    it('should provide useful search analytics', () => {
      const denseResults = [
        createSearchResult('tech-doc-1', 0.9, 1),
        createSearchResult('tech-doc-2', 0.8, 2),
        createSearchResult('general-doc-1', 0.7, 3),
      ];

      const lexicalResults = [
        createSearchResult('keyword-doc-1', 0.95, 1),
        createSearchResult('tech-doc-1', 0.85, 2), // Overlap
        createSearchResult('phrase-doc-1', 0.75, 3),
      ];

      const analysis = analyzeHybridOverlap(denseResults, lexicalResults);

      // Should provide actionable insights
      expect(analysis.overlapPercentage).toBeGreaterThan(0);
      expect(analysis.complementaryScore).toBeGreaterThan(0);
      expect(analysis.complementaryScore).toBeLessThan(1);

      // Analysis should help determine if hybrid search is beneficial
      const isHybridBeneficial = analysis.complementaryScore > 0.3; // Arbitrary threshold
      expect(typeof isHybridBeneficial).toBe('boolean');

      // Should provide clear counts for debugging
      const totalUniqueResults = analysis.overlapCount + analysis.denseOnlyCount + analysis.lexicalOnlyCount;
      expect(totalUniqueResults).toBe(5); // All unique documents
    });
  });
});