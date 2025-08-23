import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGEvaluator, createSampleEvaluationDataset } from './evaluation.js';
import type { Orquel, Chunk, GroundTruthQuery } from './types.js';

describe('RAGEvaluator', () => {
  let mockOrquel: Orquel;
  let evaluator: RAGEvaluator;

  const sampleChunks: Chunk[] = [
    {
      id: 'geography-argentina-1',
      text: 'Argentina is a country located in South America.',
      metadata: {
        source: { title: 'Geography of Argentina' },
        chunkIndex: 0,
        hash: 'hash-1',
      },
    },
    {
      id: 'cities-argentina-1', 
      text: 'Buenos Aires is the capital and largest city of Argentina.',
      metadata: {
        source: { title: 'Cities of Argentina' },
        chunkIndex: 0,
        hash: 'hash-2',
      },
    },
    {
      id: 'irrelevant-chunk-1',
      text: 'Brazil is another country in South America.',
      metadata: {
        source: { title: 'Other Countries' },
        chunkIndex: 0,
        hash: 'hash-3',
      },
    },
  ];

  beforeEach(() => {
    mockOrquel = {
      ingest: vi.fn(),
      index: vi.fn(),
      query: vi.fn(),
      answer: vi.fn(),
    };

    evaluator = new RAGEvaluator(mockOrquel);
  });

  describe('evaluation metrics calculation', () => {
    it('should calculate perfect precision and recall', async () => {
      // Mock perfect retrieval
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [
          { chunk: sampleChunks[0], score: 0.9 },
          { chunk: sampleChunks[1], score: 0.8 },
        ],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1', 'cities-argentina-1'],
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      expect(metrics.precision).toBe(1.0); // All retrieved chunks are relevant
      expect(metrics.recall).toBe(1.0); // All relevant chunks were retrieved
      expect(metrics.f1Score).toBe(1.0); // Perfect F1 score
      expect(metrics.hitRate).toBe(1.0); // 100% hit rate
    });

    it('should calculate partial precision and recall', async () => {
      // Mock partial retrieval (1 relevant, 1 irrelevant)
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [
          { chunk: sampleChunks[0], score: 0.9 }, // Relevant
          { chunk: sampleChunks[2], score: 0.7 }, // Irrelevant
        ],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1', 'cities-argentina-1'], // 2 relevant total
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      expect(metrics.precision).toBe(0.5); // 1 relevant out of 2 retrieved
      expect(metrics.recall).toBe(0.5); // 1 retrieved out of 2 relevant
      expect(metrics.f1Score).toBe(0.5); // Harmonic mean of 0.5 and 0.5
      expect(metrics.hitRate).toBe(1.0); // Still found at least one relevant
    });

    it('should calculate zero scores for no relevant results', async () => {
      // Mock retrieval with no relevant results
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [
          { chunk: sampleChunks[2], score: 0.9 }, // Irrelevant
        ],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      expect(metrics.precision).toBe(0); // No relevant chunks retrieved
      expect(metrics.recall).toBe(0); // No relevant chunks retrieved
      expect(metrics.f1Score).toBe(0); // No relevant results
      expect(metrics.hitRate).toBe(0); // No hits
    });

    it('should calculate Mean Reciprocal Rank correctly', async () => {
      // Mock retrieval where first result is irrelevant, second is relevant
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [
          { chunk: sampleChunks[2], score: 0.9 }, // Irrelevant (rank 1)
          { chunk: sampleChunks[0], score: 0.8 }, // Relevant (rank 2)
        ],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      expect(metrics.mrr).toBe(0.5); // 1/2 (reciprocal of rank 2)
    });

    it('should calculate NDCG correctly', async () => {
      // Mock retrieval with relevant result at rank 1
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [
          { chunk: sampleChunks[0], score: 0.9 }, // Relevant at rank 1
          { chunk: sampleChunks[2], score: 0.8 }, // Irrelevant at rank 2
        ],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      // DCG = 1/log2(2) = 1/1 = 1
      // IDCG = 1/log2(2) = 1 (for 1 relevant item at ideal position)
      // NDCG = DCG/IDCG = 1/1 = 1
      expect(metrics.ndcg).toBe(1.0);
    });

    it('should handle multiple queries and aggregate metrics', async () => {
      // Mock different performance for different queries
      mockOrquel.query = vi.fn()
        .mockResolvedValueOnce({
          results: [
            { chunk: sampleChunks[0], score: 0.9 }, // Perfect for query 1
          ],
        })
        .mockResolvedValueOnce({
          results: [
            { chunk: sampleChunks[2], score: 0.9 }, // Miss for query 2
          ],
        });

      const groundTruth: GroundTruthQuery[] = [
        {
          query: 'What is Argentina?',
          relevantChunkIds: ['geography-argentina-1'],
        },
        {
          query: 'Tell me about Buenos Aires',
          relevantChunkIds: ['cities-argentina-1'],
        },
      ];

      const metrics = await evaluator.evaluate(groundTruth);

      // Query 1: precision=1, recall=1, hit=true
      // Query 2: precision=0, recall=0, hit=false
      // Averages: precision=0.5, recall=0.5, hitRate=0.5
      expect(metrics.precision).toBe(0.5);
      expect(metrics.recall).toBe(0.5);
      expect(metrics.hitRate).toBe(0.5);
    });
  });

  describe('answer evaluation', () => {
    it('should evaluate answer quality with keyword matching', async () => {
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [{ chunk: sampleChunks[0], score: 0.9 }],
      });

      mockOrquel.answer = vi.fn().mockResolvedValue({
        answer: 'Argentina is a country in South America with Buenos Aires as its capital.',
        contexts: [sampleChunks[0]],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1'],
        expectedAnswer: 'Argentina is a country in South America',
        expectedKeywords: ['Argentina', 'country', 'South America'],
      }];

      const metrics = await evaluator.evaluate(groundTruth, { evaluateAnswers: true });

      // Should get high scores for matching keywords and content
      expect(metrics.precision).toBe(1.0);
    });

    it('should handle answer evaluation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [{ chunk: sampleChunks[0], score: 0.9 }],
      });

      mockOrquel.answer = vi.fn().mockRejectedValue(new Error('Answer generation failed'));

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1'],
        expectedAnswer: 'Argentina is a country',
      }];

      // Should not throw, should handle gracefully
      const metrics = await evaluator.evaluate(groundTruth, { evaluateAnswers: true });
      expect(metrics.precision).toBe(1.0); // Retrieval still works despite answer failure
      
      consoleSpy.mockRestore();
    });
  });

  describe('configuration options', () => {
    it('should pass configuration to query method', async () => {
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [{ chunk: sampleChunks[0], score: 0.9 }],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'Test query',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      await evaluator.evaluate(groundTruth, {
        k: 15,
        hybrid: true,
        rerank: true,
      });

      expect(mockOrquel.query).toHaveBeenCalledWith('Test query', {
        k: 15,
        hybrid: true,
        rerank: true,
      });
    });

    it('should use default configuration when not specified', async () => {
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [{ chunk: sampleChunks[0], score: 0.9 }],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'Test query',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      await evaluator.evaluate(groundTruth);

      expect(mockOrquel.query).toHaveBeenCalledWith('Test query', {
        k: 10,
        hybrid: false,
        rerank: false,
      });
    });
  });

  describe('error handling', () => {
    it('should handle query failures gracefully', async () => {
      mockOrquel.query = vi.fn()
        .mockResolvedValueOnce({
          results: [{ chunk: sampleChunks[0], score: 0.9 }],
        })
        .mockRejectedValueOnce(new Error('Query failed'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const groundTruth: GroundTruthQuery[] = [
        {
          query: 'Successful query',
          relevantChunkIds: ['geography-argentina-1'],
        },
        {
          query: 'Failing query',
          relevantChunkIds: ['cities-argentina-1'],
        },
      ];

      const metrics = await evaluator.evaluate(groundTruth);

      // Should still return metrics, with failed query scoring 0
      expect(metrics.precision).toBe(0.5); // (1 + 0) / 2
      expect(metrics.recall).toBe(0.5); // (1 + 0) / 2
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to evaluate query "Failing query":',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty ground truth gracefully', async () => {
      const metrics = await evaluator.evaluate([]);

      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1Score).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
    });
  });

  describe('report generation', () => {
    it('should generate comprehensive evaluation report', async () => {
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [
          { chunk: sampleChunks[0], score: 0.9 },
          { chunk: sampleChunks[1], score: 0.8 },
        ],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1', 'cities-argentina-1'],
      }];

      const report = await evaluator.generateReport(groundTruth, {
        k: 5,
        hybrid: true,
        rerank: false,
      });

      expect(report).toContain('RAG System Evaluation Report');
      expect(report).toContain('Retrieval K**: 5');
      expect(report).toContain('Hybrid Search**: Enabled');
      expect(report).toContain('Reranking**: Disabled');
      expect(report).toContain('Total Queries**: 1');
      expect(report).toContain('Precision');
      expect(report).toContain('Recall');
      expect(report).toContain('F1 Score');
      expect(report).toContain('Performance Interpretation');
      expect(report).toContain('Recommendations');
    });

    it('should provide appropriate performance assessment', async () => {
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [{ chunk: sampleChunks[0], score: 0.9 }],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'What is Argentina?',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      const report = await evaluator.generateReport(groundTruth);

      // With perfect performance, should get excellent assessment
      expect(report).toContain('🟢 **Excellent**');
    });
  });

  describe('sample dataset creation', () => {
    it('should create valid sample evaluation dataset', () => {
      const dataset = createSampleEvaluationDataset();

      expect(dataset).toHaveLength(4);
      expect(dataset[0]).toEqual({
        query: "What is Argentina?",
        relevantChunkIds: ["geography-argentina-1", "overview-argentina-1"],
        expectedAnswer: "Argentina is a country in South America",
        expectedKeywords: ["country", "South America", "Argentina"]
      });

      // Verify all entries have required fields
      dataset.forEach(entry => {
        expect(entry.query).toBeDefined();
        expect(entry.relevantChunkIds).toBeDefined();
        expect(Array.isArray(entry.relevantChunkIds)).toBe(true);
      });
    });
  });

  describe('performance metrics edge cases', () => {
    it('should handle division by zero in metrics calculation', async () => {
      // Mock empty results
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'Empty results query',
        relevantChunkIds: ['geography-argentina-1'],
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1Score).toBe(0);
      expect(metrics.mrr).toBe(0);
      expect(metrics.ndcg).toBe(0);
    });

    it('should handle ground truth with no relevant chunks', async () => {
      mockOrquel.query = vi.fn().mockResolvedValue({
        results: [{ chunk: sampleChunks[0], score: 0.9 }],
      });

      const groundTruth: GroundTruthQuery[] = [{
        query: 'Query with no relevant chunks',
        relevantChunkIds: [], // No relevant chunks
      }];

      const metrics = await evaluator.evaluate(groundTruth);

      expect(metrics.precision).toBe(0); // No relevant chunks to find
      expect(metrics.recall).toBe(0); // No relevant chunks to recall
      expect(metrics.f1Score).toBe(0);
    });
  });
});