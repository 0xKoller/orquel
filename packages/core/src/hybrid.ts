import type { SearchResult, HybridSearchOptions } from './types.js';

/**
 * Reciprocal Rank Fusion (RRF) algorithm for combining search results
 * 
 * RRF is particularly effective for hybrid search as it:
 * - Doesn't require score calibration between different search systems
 * - Is robust to score distribution differences
 * - Performs well across different domains
 * 
 * Formula: RRF(d) = Σ(1 / (k + rank(d)))
 * where k is a constant (typically 60) and rank(d) is the rank of document d in each ranking
 */
export function reciprocalRankFusion(
  denseResults: SearchResult[],
  lexicalResults: SearchResult[],
  k: number = 10,
  rffConstant: number = 60
): SearchResult[] {
  // Create maps for efficient rank lookup
  const denseRanks = new Map<string, number>();
  const lexicalRanks = new Map<string, number>();
  
  // Build rank maps
  denseResults.forEach((result, index) => {
    denseRanks.set(result.chunk.id, index + 1); // 1-indexed ranks
  });
  
  lexicalResults.forEach((result, index) => {
    lexicalRanks.set(result.chunk.id, index + 1); // 1-indexed ranks
  });
  
  // Collect all unique chunks
  const allChunkIds = new Set([
    ...denseResults.map(r => r.chunk.id),
    ...lexicalResults.map(r => r.chunk.id),
  ]);
  
  // Calculate RRF scores
  const rrfResults: Array<{ id: string; score: number; chunk: SearchResult['chunk']; rank: number }> = [];
  
  for (const chunkId of allChunkIds) {
    let rrfScore = 0;
    let chunk: SearchResult['chunk'] | null = null;
    
    // Add contribution from dense results
    const denseRank = denseRanks.get(chunkId);
    if (denseRank !== undefined) {
      rrfScore += 1 / (rffConstant + denseRank);
      chunk = denseResults.find(r => r.chunk.id === chunkId)?.chunk || null;
    }
    
    // Add contribution from lexical results
    const lexicalRank = lexicalRanks.get(chunkId);
    if (lexicalRank !== undefined) {
      rrfScore += 1 / (rffConstant + lexicalRank);
      if (!chunk) {
        chunk = lexicalResults.find(r => r.chunk.id === chunkId)?.chunk || null;
      }
    }
    
    if (chunk) {
      rrfResults.push({ id: chunkId, score: rrfScore, chunk, rank: 0 });
    }
  }
  
  // Sort by RRF score (descending) and assign final ranks
  rrfResults.sort((a, b) => b.score - a.score);
  
  return rrfResults.slice(0, k).map((result, index) => ({
    chunk: result.chunk,
    score: result.score,
    rank: index + 1,
  }));
}

/**
 * Weighted score combination for hybrid search
 * Normalizes scores and combines them with configurable weights
 */
export function weightedScoreCombination(
  denseResults: SearchResult[],
  lexicalResults: SearchResult[],
  k: number = 10,
  denseWeight: number = 0.7,
  lexicalWeight: number = 0.3
): SearchResult[] {
  // Normalize scores to [0, 1]
  const normalizedDense = normalizeScores(denseResults);
  const normalizedLexical = normalizeScores(lexicalResults);

  // Create a map of chunk ID to combined result
  const scoreMap = new Map<string, SearchResult>();

  // Add dense results
  for (const result of normalizedDense) {
    scoreMap.set(result.chunk.id, {
      ...result,
      score: result.score * denseWeight,
    });
  }

  // Add/merge lexical results
  for (const result of normalizedLexical) {
    const existing = scoreMap.get(result.chunk.id);
    if (existing) {
      existing.score += result.score * lexicalWeight;
    } else {
      scoreMap.set(result.chunk.id, {
        ...result,
        score: result.score * lexicalWeight,
      });
    }
  }

  // Sort by combined score and take top k
  const sortedResults = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  // Update ranks
  return sortedResults.map((result, index) => ({
    ...result,
    rank: index + 1,
  }));
}

/**
 * Min-Max normalization: scales scores to [0, 1] range
 */
function normalizeScoresMinMax(results: SearchResult[]): SearchResult[] {
  if (results.length === 0) return results;

  const scores = results.map(r => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  // Handle edge case where all scores are the same
  if (max === min) {
    return results.map(result => ({ ...result, score: 1 }));
  }

  return results.map(result => ({
    ...result,
    score: (result.score - min) / (max - min),
  }));
}

/**
 * Z-score normalization: normalizes to zero mean and unit variance
 */
function normalizeScoresZScore(results: SearchResult[]): SearchResult[] {
  if (results.length === 0) return results;
  if (results.length === 1) return results.map(r => ({ ...r, score: 1 }));

  const scores = results.map(r => r.score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  
  // Handle edge case where standard deviation is 0
  if (stdDev === 0) {
    return results.map(result => ({ ...result, score: 1 }));
  }

  // Convert z-scores to [0, 1] range using sigmoid function
  return results.map(result => {
    const zScore = (result.score - mean) / stdDev;
    const normalizedScore = 1 / (1 + Math.exp(-zScore)); // Sigmoid function
    return { ...result, score: normalizedScore };
  });
}

/**
 * Normalize scores using the specified method
 */
export function normalizeScores(
  results: SearchResult[],
  method: 'minmax' | 'zscore' = 'minmax'
): SearchResult[] {
  switch (method) {
    case 'minmax':
      return normalizeScoresMinMax(results);
    case 'zscore':
      return normalizeScoresZScore(results);
    default:
      return normalizeScoresMinMax(results);
  }
}

/**
 * Merge hybrid search results using the specified algorithm
 */
export function mergeHybridResults(
  denseResults: SearchResult[],
  lexicalResults: SearchResult[],
  options: HybridSearchOptions & { k: number }
): SearchResult[] {
  const {
    k = 10,
    denseWeight = 0.7,
    lexicalWeight = 0.3,
    normalizationMethod = 'rrf',
  } = options;

  switch (normalizationMethod) {
    case 'rrf':
      return reciprocalRankFusion(denseResults, lexicalResults, k);
    case 'minmax':
    case 'zscore':
      return weightedScoreCombination(
        denseResults,
        lexicalResults,
        k,
        denseWeight,
        lexicalWeight
      );
    default:
      return reciprocalRankFusion(denseResults, lexicalResults, k);
  }
}

/**
 * Analyze the overlap between dense and lexical results
 * Useful for understanding search performance and tuning weights
 */
export function analyzeHybridOverlap(
  denseResults: SearchResult[],
  lexicalResults: SearchResult[]
): {
  denseOnlyCount: number;
  lexicalOnlyCount: number;
  overlapCount: number;
  overlapPercentage: number;
  complementaryScore: number; // How well the methods complement each other
} {
  const denseIds = new Set(denseResults.map(r => r.chunk.id));
  const lexicalIds = new Set(lexicalResults.map(r => r.chunk.id));
  
  const overlapIds = new Set([...denseIds].filter(id => lexicalIds.has(id)));
  
  const denseOnlyCount = denseIds.size - overlapIds.size;
  const lexicalOnlyCount = lexicalIds.size - overlapIds.size;
  const overlapCount = overlapIds.size;
  
  const totalUnique = denseIds.size + lexicalIds.size - overlapIds.size;
  const overlapPercentage = totalUnique > 0 ? (overlapCount / totalUnique) * 100 : 0;
  
  // Complementary score: higher when methods find different relevant results
  // Range: 0 (complete overlap) to 1 (no overlap)
  const complementaryScore = totalUnique > 0 ? (denseOnlyCount + lexicalOnlyCount) / totalUnique : 0;
  
  return {
    denseOnlyCount,
    lexicalOnlyCount,
    overlapCount,
    overlapPercentage,
    complementaryScore,
  };
}