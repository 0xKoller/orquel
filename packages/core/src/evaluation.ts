import type { Orquel, Chunk, QueryResult } from './types.js';

/**
 * Evaluation metrics for RAG system performance
 */
export interface EvaluationMetrics {
  /** Precision: How many retrieved chunks are relevant */
  precision: number;
  /** Recall: How many relevant chunks were retrieved */
  recall: number;
  /** F1 Score: Harmonic mean of precision and recall */
  f1Score: number;
  /** Mean Reciprocal Rank: Average of reciprocal ranks of first relevant result */
  mrr: number;
  /** Normalized Discounted Cumulative Gain: Quality of ranking */
  ndcg: number;
  /** Hit Rate: Percentage of queries with at least one relevant result */
  hitRate: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
}

/**
 * A ground truth query with expected relevant chunks
 */
export interface GroundTruthQuery {
  /** The query text */
  query: string;
  /** IDs of chunks that should be considered relevant */
  relevantChunkIds: string[];
  /** Optional: Expected answer text for answer evaluation */
  expectedAnswer?: string;
  /** Optional: Keywords that should appear in the answer */
  expectedKeywords?: string[];
}

/**
 * Results from evaluating a single query
 */
export interface QueryEvaluationResult {
  query: string;
  retrievedChunkIds: string[];
  relevantChunkIds: string[];
  precision: number;
  recall: number;
  f1Score: number;
  reciprocalRank: number;
  dcg: number;
  ndcg: number;
  hasRelevantResult: boolean;
  responseTime: number;
  answer?: string;
  answerScore?: number;
}

/**
 * Configuration for evaluation runs
 */
export interface EvaluationConfig {
  /** Number of results to retrieve for each query (k parameter) */
  k?: number;
  /** Whether to use hybrid search */
  hybrid?: boolean;
  /** Whether to use reranking */
  rerank?: boolean;
  /** Whether to evaluate answer generation */
  evaluateAnswers?: boolean;
  /** Custom relevance scoring function */
  relevanceScorer?: (query: string, chunk: Chunk) => number;
}

/**
 * Comprehensive evaluation harness for RAG systems
 */
export class RAGEvaluator {
  private orquel: Orquel;

  constructor(orquel: Orquel) {
    this.orquel = orquel;
  }

  /**
   * Evaluate the RAG system against ground truth queries
   * 
   * @example
   * ```typescript
   * const evaluator = new RAGEvaluator(orq);
   * 
   * const groundTruth = [
   *   {
   *     query: "What is the capital of Argentina?",
   *     relevantChunkIds: ["argentina-geography-1", "argentina-cities-2"],
   *     expectedAnswer: "Buenos Aires",
   *     expectedKeywords: ["Buenos Aires", "capital"]
   *   }
   * ];
   * 
   * const metrics = await evaluator.evaluate(groundTruth);
   * console.log(`F1 Score: ${metrics.f1Score.toFixed(3)}`);
   * ```
   */
  async evaluate(
    groundTruthQueries: GroundTruthQuery[],
    config: EvaluationConfig = {}
  ): Promise<EvaluationMetrics> {
    const {
      k = 10,
      hybrid = false,
      rerank = false,
      evaluateAnswers = false,
    } = config;

    const queryResults: QueryEvaluationResult[] = [];
    let totalResponseTime = 0;

    for (const groundTruth of groundTruthQueries) {
      const startTime = Date.now();

      try {
        // Perform retrieval
        const { results } = await this.orquel.query(groundTruth.query, {
          k,
          hybrid,
          rerank,
        });

        const responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;

        // Evaluate retrieval performance
        const retrievedChunkIds = results.map(r => r.chunk.id);
        const evaluation = this.evaluateQuery(
          groundTruth.query,
          retrievedChunkIds,
          groundTruth.relevantChunkIds,
          results
        );

        // Evaluate answer generation if requested
        let answer: string | undefined;
        let answerScore: number | undefined;

        if (evaluateAnswers && groundTruth.expectedAnswer) {
          try {
            const answerResult = await this.orquel.answer(groundTruth.query);
            answer = answerResult.answer;
            answerScore = this.evaluateAnswer(
              answer,
              groundTruth.expectedAnswer,
              groundTruth.expectedKeywords
            );
          } catch (answerError) {
            console.warn(`Answer generation failed for query "${groundTruth.query}":`, answerError);
            // Continue with undefined answer/answerScore
          }
        }

        const result: QueryEvaluationResult = {
          ...evaluation,
          responseTime,
        };
        
        if (answer !== undefined) {
          result.answer = answer;
        }
        if (answerScore !== undefined) {
          result.answerScore = answerScore;
        }
        
        queryResults.push(result);
      } catch (error) {
        console.warn(`Failed to evaluate query "${groundTruth.query}":`, error);
        
        // Record failed query with zero scores
        queryResults.push({
          query: groundTruth.query,
          retrievedChunkIds: [],
          relevantChunkIds: groundTruth.relevantChunkIds,
          precision: 0,
          recall: 0,
          f1Score: 0,
          reciprocalRank: 0,
          dcg: 0,
          ndcg: 0,
          hasRelevantResult: false,
          responseTime: Date.now() - startTime,
        });
      }
    }

    return this.aggregateMetrics(queryResults, totalResponseTime);
  }

  /**
   * Evaluate a single query against ground truth
   */
  private evaluateQuery(
    query: string,
    retrievedChunkIds: string[],
    relevantChunkIds: string[],
    results: QueryResult[]
  ): QueryEvaluationResult {
    const relevantSet = new Set(relevantChunkIds);
    const retrievedRelevant = retrievedChunkIds.filter(id => relevantSet.has(id));

    // Calculate precision and recall
    const precision = retrievedChunkIds.length > 0 
      ? retrievedRelevant.length / retrievedChunkIds.length 
      : 0;
    
    const recall = relevantChunkIds.length > 0 
      ? retrievedRelevant.length / relevantChunkIds.length 
      : 0;

    // Calculate F1 score
    const f1Score = precision + recall > 0 
      ? (2 * precision * recall) / (precision + recall) 
      : 0;

    // Calculate reciprocal rank (MRR)
    let reciprocalRank = 0;
    for (let i = 0; i < retrievedChunkIds.length; i++) {
      if (relevantSet.has(retrievedChunkIds[i]!)) {
        reciprocalRank = 1 / (i + 1);
        break;
      }
    }

    // Calculate NDCG
    const { dcg, ndcg } = this.calculateNDCG(retrievedChunkIds, relevantChunkIds);

    const hasRelevantResult = retrievedRelevant.length > 0;

    return {
      query,
      retrievedChunkIds,
      relevantChunkIds,
      precision,
      recall,
      f1Score,
      reciprocalRank,
      dcg,
      ndcg,
      hasRelevantResult,
      responseTime: 0, // Will be set by caller
    };
  }

  /**
   * Calculate Discounted Cumulative Gain and Normalized DCG
   */
  private calculateNDCG(
    retrievedChunkIds: string[],
    relevantChunkIds: string[]
  ): { dcg: number; ndcg: number } {
    const relevantSet = new Set(relevantChunkIds);

    // Calculate DCG
    let dcg = 0;
    for (let i = 0; i < retrievedChunkIds.length; i++) {
      const relevance = relevantSet.has(retrievedChunkIds[i]!) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2); // i+2 because log2(1) = 0
    }

    // Calculate ideal DCG (IDCG)
    let idcg = 0;
    for (let i = 0; i < Math.min(relevantChunkIds.length, retrievedChunkIds.length); i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    const ndcg = idcg > 0 ? dcg / idcg : 0;

    return { dcg, ndcg };
  }

  /**
   * Evaluate answer quality against expected answer
   */
  private evaluateAnswer(
    actualAnswer: string | undefined,
    expectedAnswer: string,
    expectedKeywords?: string[]
  ): number {
    if (!actualAnswer) {
      return 0;
    }
    
    let score = 0;
    const actualLower = actualAnswer.toLowerCase();
    const expectedLower = expectedAnswer.toLowerCase();

    // Basic similarity score (simple word overlap)
    const actualWords = new Set(actualLower.split(/\s+/));
    const expectedWords = new Set(expectedLower.split(/\s+/));
    const intersection = new Set([...actualWords].filter(w => expectedWords.has(w)));
    const union = new Set([...actualWords, ...expectedWords]);
    
    if (union.size > 0) {
      score += (intersection.size / union.size) * 0.5; // 50% weight for word overlap
    }

    // Check for expected keywords
    if (expectedKeywords) {
      let keywordScore = 0;
      for (const keyword of expectedKeywords) {
        if (actualLower.includes(keyword.toLowerCase())) {
          keywordScore++;
        }
      }
      score += (keywordScore / expectedKeywords.length) * 0.5; // 50% weight for keywords
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Aggregate individual query results into overall metrics
   */
  private aggregateMetrics(
    queryResults: QueryEvaluationResult[],
    totalResponseTime: number
  ): EvaluationMetrics {
    if (queryResults.length === 0) {
      return {
        precision: 0,
        recall: 0,
        f1Score: 0,
        mrr: 0,
        ndcg: 0,
        hitRate: 0,
        avgResponseTime: 0,
      };
    }

    const totalQueries = queryResults.length;

    // Average metrics
    const precision = queryResults.reduce((sum, r) => sum + r.precision, 0) / totalQueries;
    const recall = queryResults.reduce((sum, r) => sum + r.recall, 0) / totalQueries;
    const f1Score = queryResults.reduce((sum, r) => sum + r.f1Score, 0) / totalQueries;
    const mrr = queryResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / totalQueries;
    const ndcg = queryResults.reduce((sum, r) => sum + r.ndcg, 0) / totalQueries;

    // Hit rate (percentage of queries with at least one relevant result)
    const hitRate = queryResults.filter(r => r.hasRelevantResult).length / totalQueries;

    // Average response time
    const avgResponseTime = totalResponseTime / totalQueries;

    return {
      precision,
      recall,
      f1Score,
      mrr,
      ndcg,
      hitRate,
      avgResponseTime,
    };
  }

  /**
   * Generate detailed evaluation report
   */
  async generateReport(
    groundTruthQueries: GroundTruthQuery[],
    config: EvaluationConfig = {}
  ): Promise<string> {
    const metrics = await this.evaluate(groundTruthQueries, config);
    const { k = 10, hybrid = false, rerank = false } = config;

    const report = `
# RAG System Evaluation Report

## Configuration
- **Retrieval K**: ${k}
- **Hybrid Search**: ${hybrid ? 'Enabled' : 'Disabled'}
- **Reranking**: ${rerank ? 'Enabled' : 'Disabled'}
- **Total Queries**: ${groundTruthQueries.length}

## Overall Performance

| Metric | Score | Description |
|--------|-------|-------------|
| **Precision** | ${metrics.precision.toFixed(3)} | Fraction of retrieved chunks that are relevant |
| **Recall** | ${metrics.recall.toFixed(3)} | Fraction of relevant chunks that were retrieved |
| **F1 Score** | ${metrics.f1Score.toFixed(3)} | Harmonic mean of precision and recall |
| **MRR** | ${metrics.mrr.toFixed(3)} | Mean Reciprocal Rank of first relevant result |
| **NDCG** | ${metrics.ndcg.toFixed(3)} | Normalized Discounted Cumulative Gain |
| **Hit Rate** | ${(metrics.hitRate * 100).toFixed(1)}% | Percentage of queries with ≥1 relevant result |
| **Avg Response Time** | ${metrics.avgResponseTime.toFixed(1)}ms | Average query response time |

## Performance Interpretation

### Quality Assessment
${this.getPerformanceAssessment(metrics)}

### Recommendations
${this.getRecommendations(metrics)}

## Benchmarking Context

For reference, typical RAG system performance ranges:
- **Good**: Precision > 0.7, Recall > 0.6, F1 > 0.65
- **Acceptable**: Precision > 0.5, Recall > 0.4, F1 > 0.45
- **Needs Improvement**: F1 < 0.45

---
*Generated by Orquel RAG Evaluator*
`.trim();

    return report;
  }

  /**
   * Get performance assessment based on metrics
   */
  private getPerformanceAssessment(metrics: EvaluationMetrics): string {
    const { precision, recall, f1Score, hitRate } = metrics;

    if (f1Score >= 0.7) {
      return '🟢 **Excellent**: Your RAG system is performing very well with high precision and recall.';
    } else if (f1Score >= 0.55) {
      return '🟡 **Good**: Your RAG system shows solid performance with room for optimization.';
    } else if (f1Score >= 0.4) {
      return '🟠 **Fair**: Your RAG system is functional but would benefit from improvements.';
    } else {
      return '🔴 **Needs Improvement**: Your RAG system requires significant optimization.';
    }
  }

  /**
   * Get recommendations based on metrics
   */
  private getRecommendations(metrics: EvaluationMetrics): string {
    const recommendations: string[] = [];
    const { precision, recall, f1Score, hitRate, avgResponseTime } = metrics;

    if (precision < 0.6) {
      recommendations.push('• **Low Precision**: Consider improving chunk quality, using reranking, or refining embedding model');
    }

    if (recall < 0.5) {
      recommendations.push('• **Low Recall**: Try increasing k parameter, using hybrid search, or improving chunking strategy');
    }

    if (hitRate < 0.8) {
      recommendations.push('• **Low Hit Rate**: Consider expanding knowledge base coverage or improving query understanding');
    }

    if (avgResponseTime > 2000) {
      recommendations.push('• **Slow Response**: Optimize vector search, consider caching, or use faster embedding models');
    }

    if (precision > 0.8 && recall < 0.5) {
      recommendations.push('• **High Precision, Low Recall**: Increase retrieval breadth with higher k or hybrid search');
    }

    if (recall > 0.8 && precision < 0.5) {
      recommendations.push('• **High Recall, Low Precision**: Add reranking or improve chunk relevance filtering');
    }

    return recommendations.length > 0 
      ? recommendations.join('\n')
      : '• Your system is well-balanced. Consider A/B testing different configurations for marginal gains.';
  }
}

/**
 * Create a basic evaluation dataset for testing
 */
export function createSampleEvaluationDataset(): GroundTruthQuery[] {
  return [
    {
      query: "What is Argentina?",
      relevantChunkIds: ["geography-argentina-1", "overview-argentina-1"],
      expectedAnswer: "Argentina is a country in South America",
      expectedKeywords: ["country", "South America", "Argentina"]
    },
    {
      query: "What is the capital of Argentina?",
      relevantChunkIds: ["cities-argentina-1", "buenos-aires-1"],
      expectedAnswer: "Buenos Aires is the capital of Argentina",
      expectedKeywords: ["Buenos Aires", "capital"]
    },
    {
      query: "Tell me about Argentine culture",
      relevantChunkIds: ["culture-argentina-1", "traditions-argentina-1", "arts-argentina-1"],
      expectedAnswer: "Argentine culture is influenced by European immigration",
      expectedKeywords: ["culture", "European", "traditions"]
    },
    {
      query: "What foods are popular in Argentina?",
      relevantChunkIds: ["food-argentina-1", "cuisine-argentina-1", "gastronomy-argentina-1"],
      expectedAnswer: "Argentina is famous for beef, empanadas, and mate",
      expectedKeywords: ["beef", "empanadas", "mate", "asado"]
    }
  ];
}