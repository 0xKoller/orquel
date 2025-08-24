import type { VectorStoreAdapter, LexicalSearchAdapter, SearchResult } from './types';

/**
 * Search optimization utilities and adaptive algorithms
 */

export interface SearchOptimizationConfig {
  /** Enable adaptive weight adjustment based on query types */
  adaptiveWeights?: boolean;
  /** Learning rate for weight adjustment (0-1) */
  learningRate?: number;
  /** Minimum number of queries before adaptation starts */
  adaptationThreshold?: number;
  /** Enable query result caching */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Enable performance monitoring */
  enableMonitoring?: boolean;
}

export interface QueryPattern {
  query: string;
  queryType: 'factual' | 'conceptual' | 'procedural' | 'unknown';
  optimalWeights: [number, number]; // [dense, lexical]
  confidence: number;
  sampleCount: number;
}

export interface PerformanceStats {
  avgLatency: number;
  p95Latency: number;
  throughput: number; // queries per second
  cacheHitRate: number;
  errorRate: number;
}

/**
 * Adaptive search optimizer that learns optimal weights for different query types
 */
export class SearchOptimizer {
  private queryPatterns = new Map<string, QueryPattern>();
  private performanceHistory: Array<{
    query: string;
    latency: number;
    timestamp: number;
    weights: [number, number];
    resultQuality: number;
  }> = [];
  
  private cache = new Map<string, {
    results: SearchResult[];
    timestamp: number;
  }>();
  
  constructor(private config: SearchOptimizationConfig = {}) {}
  
  /**
   * Classify query type to determine optimal search strategy
   */
  classifyQuery(query: string): 'factual' | 'conceptual' | 'procedural' | 'unknown' {
    const factualKeywords = ['what', 'when', 'where', 'who', 'which', 'how many', 'how much'];
    const conceptualKeywords = ['why', 'how does', 'explain', 'describe', 'compare', 'difference'];
    const proceduralKeywords = ['how to', 'steps', 'process', 'procedure', 'guide', 'tutorial'];
    
    const lowerQuery = query.toLowerCase();
    
    if (factualKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'factual';
    }
    
    if (conceptualKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'conceptual';
    }
    
    if (proceduralKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'procedural';
    }
    
    return 'unknown';
  }
  
  /**
   * Get optimal weights for a query based on learned patterns
   */
  getOptimalWeights(query: string): [number, number] {
    const queryType = this.classifyQuery(query);
    
    // Check for specific query pattern
    const pattern = this.queryPatterns.get(query);
    if (pattern && pattern.confidence > 0.7) {
      return pattern.optimalWeights;
    }
    
    // Use defaults based on query type
    switch (queryType) {
      case 'factual':
        return [0.3, 0.7]; // Favor lexical search for facts
      case 'conceptual':
        return [0.8, 0.2]; // Favor vector search for concepts
      case 'procedural':
        return [0.6, 0.4]; // Balanced approach for procedures
      default:
        return [0.7, 0.3]; // Default balanced weights
    }
  }
  
  /**
   * Update query pattern based on user feedback or result quality
   */
  updatePattern(
    query: string, 
    weights: [number, number], 
    qualityScore: number
  ): void {
    if (!this.config.adaptiveWeights) return;
    
    const queryType = this.classifyQuery(query);
    const existing = this.queryPatterns.get(query);
    
    if (existing) {
      // Update existing pattern with exponential moving average
      const alpha = this.config.learningRate || 0.1;
      existing.optimalWeights = [
        existing.optimalWeights[0] * (1 - alpha) + weights[0] * alpha,
        existing.optimalWeights[1] * (1 - alpha) + weights[1] * alpha,
      ];
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);
      existing.sampleCount++;
    } else {
      // Create new pattern
      this.queryPatterns.set(query, {
        query,
        queryType,
        optimalWeights: weights,
        confidence: 0.5,
        sampleCount: 1,
      });
    }
  }
  
  /**
   * Cached search with automatic optimization
   */
  async optimizedSearch(
    query: string,
    queryEmbedding: number[],
    vectorStore: VectorStoreAdapter,
    lexicalStore: LexicalSearchAdapter,
    options: {
      limit?: number;
      customWeights?: [number, number];
      bypassCache?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, customWeights, bypassCache = false } = options;
    
    // Check cache first
    if (this.config.enableCaching && !bypassCache) {
      const cached = this.getCachedResults(query);
      if (cached) {
        return cached.slice(0, limit);
      }
    }
    
    // Get optimal weights
    const weights = customWeights || this.getOptimalWeights(query);
    const startTime = performance.now();
    
    try {
      // Perform parallel searches
      const [vectorResults, lexicalResults] = await Promise.all([
        vectorStore.search(queryEmbedding, limit * 2), // Get more for fusion
        lexicalStore.search(query, limit * 2),
      ]);
      
      // Apply fusion algorithm (simplified RRF)
      const fusedResults = this.fuseResults(
        vectorResults,
        lexicalResults,
        weights,
        limit
      );
      
      const latency = performance.now() - startTime;
      
      // Cache results
      if (this.config.enableCaching) {
        this.cacheResults(query, fusedResults);
      }
      
      // Record performance
      if (this.config.enableMonitoring) {
        this.recordPerformance(query, latency, weights, 0.8); // Assume good quality
      }
      
      return fusedResults;
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      if (this.config.enableMonitoring) {
        this.recordPerformance(query, latency, weights, 0.0);
      }
      
      throw error;
    }
  }
  
  /**
   * Fuse vector and lexical search results using optimized RRF
   */
  private fuseResults(
    vectorResults: SearchResult[],
    lexicalResults: SearchResult[],
    weights: [number, number],
    limit: number
  ): SearchResult[] {
    const [denseWeight, lexicalWeight] = weights;
    const k = 60; // RRF parameter
    const scoreMap = new Map<string, {
      chunk: any;
      score: number;
      sources: Set<string>;
    }>();
    
    // Process vector results
    vectorResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      scoreMap.set(result.chunk.id, {
        chunk: result.chunk,
        score: rrfScore * denseWeight,
        sources: new Set(['vector']),
      });
    });
    
    // Process lexical results
    lexicalResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(result.chunk.id);
      
      if (existing) {
        existing.score += rrfScore * lexicalWeight;
        existing.sources.add('lexical');
      } else {
        scoreMap.set(result.chunk.id, {
          chunk: result.chunk,
          score: rrfScore * lexicalWeight,
          sources: new Set(['lexical']),
        });
      }
    });
    
    // Sort by combined score and return top results
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        chunk: item.chunk,
        score: item.score,
        source: item.sources.size > 1 ? 'hybrid' : Array.from(item.sources)[0],
      }));
  }
  
  /**
   * Get cached search results
   */
  private getCachedResults(query: string): SearchResult[] | null {
    const cached = this.cache.get(query);
    if (!cached) return null;
    
    const ttl = this.config.cacheTtlMs || 5 * 60 * 1000; // 5 minutes default
    const isExpired = Date.now() - cached.timestamp > ttl;
    
    if (isExpired) {
      this.cache.delete(query);
      return null;
    }
    
    return cached.results;
  }
  
  /**
   * Cache search results
   */
  private cacheResults(query: string, results: SearchResult[]): void {
    this.cache.set(query, {
      results: [...results], // Clone to avoid mutations
      timestamp: Date.now(),
    });
    
    // Cleanup old cache entries (simple LRU)
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Record performance metrics
   */
  private recordPerformance(
    query: string,
    latency: number,
    weights: [number, number],
    qualityScore: number
  ): void {
    this.performanceHistory.push({
      query,
      latency,
      timestamp: Date.now(),
      weights,
      resultQuality: qualityScore,
    });
    
    // Keep only recent history (last 10000 queries)
    if (this.performanceHistory.length > 10000) {
      this.performanceHistory.shift();
    }
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindowMs?: number): PerformanceStats {
    let history = this.performanceHistory;
    
    if (timeWindowMs) {
      const cutoff = Date.now() - timeWindowMs;
      history = history.filter(h => h.timestamp > cutoff);
    }
    
    if (history.length === 0) {
      return {
        avgLatency: 0,
        p95Latency: 0,
        throughput: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }
    
    const latencies = history.map(h => h.latency).sort((a, b) => a - b);
    const timeSpan = (history[history.length - 1].timestamp - history[0].timestamp) / 1000;
    
    return {
      avgLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)],
      throughput: history.length / Math.max(timeSpan, 1),
      cacheHitRate: 0, // TODO: implement cache hit tracking
      errorRate: history.filter(h => h.resultQuality === 0).length / history.length,
    };
  }
  
  /**
   * Export learned patterns for persistence
   */
  exportPatterns(): Record<string, QueryPattern> {
    return Object.fromEntries(this.queryPatterns);
  }
  
  /**
   * Import previously learned patterns
   */
  importPatterns(patterns: Record<string, QueryPattern>): void {
    this.queryPatterns.clear();
    Object.entries(patterns).forEach(([query, pattern]) => {
      this.queryPatterns.set(query, pattern);
    });
  }
  
  /**
   * Clear all cached data and patterns
   */
  clearAll(): void {
    this.queryPatterns.clear();
    this.performanceHistory.length = 0;
    this.cache.clear();
  }
}

/**
 * Query preprocessing for better search performance
 */
export class QueryPreprocessor {
  private static stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
    'have', 'had', 'what', 'said', 'each', 'which', 'she', 'do',
    'how', 'their', 'if', 'up', 'out', 'many', 'then', 'them',
  ]);
  
  /**
   * Clean and normalize query text
   */
  static normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Extract key terms from query
   */
  static extractKeyTerms(query: string, minLength = 2): string[] {
    const normalized = this.normalizeQuery(query);
    return normalized
      .split(/\s+/)
      .filter(term => 
        term.length >= minLength && 
        !this.stopWords.has(term) &&
        !/^\d+$/.test(term) // Skip pure numbers
      );
  }
  
  /**
   * Expand query with synonyms (simple implementation)
   */
  static expandQuery(query: string): string {
    const synonymMap: Record<string, string[]> = {
      'ml': ['machine learning', 'artificial intelligence'],
      'ai': ['artificial intelligence', 'machine learning'],
      'db': ['database', 'data storage'],
      'api': ['application programming interface', 'web service'],
      // Add more synonyms as needed
    };
    
    let expanded = query;
    Object.entries(synonymMap).forEach(([term, synonyms]) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(expanded)) {
        expanded += ' ' + synonyms.join(' ');
      }
    });
    
    return expanded;
  }
  
  /**
   * Generate query variations for better recall
   */
  static generateVariations(query: string): string[] {
    const variations = [query];
    const normalized = this.normalizeQuery(query);
    
    if (normalized !== query) {
      variations.push(normalized);
    }
    
    const expanded = this.expandQuery(query);
    if (expanded !== query) {
      variations.push(expanded);
    }
    
    // Generate partial queries for long inputs
    if (query.split(' ').length > 5) {
      const keyTerms = this.extractKeyTerms(query);
      if (keyTerms.length >= 3) {
        variations.push(keyTerms.slice(0, 3).join(' '));
      }
    }
    
    return variations;
  }
}

/**
 * Search result quality assessment
 */
export class QualityAssessor {
  /**
   * Score search results based on various quality metrics
   */
  static assessResultQuality(
    query: string,
    results: SearchResult[],
    options: {
      diversityWeight?: number;
      relevanceWeight?: number;
      coverageWeight?: number;
    } = {}
  ): number {
    const {
      diversityWeight = 0.3,
      relevanceWeight = 0.5,
      coverageWeight = 0.2,
    } = options;
    
    if (results.length === 0) return 0;
    
    const diversityScore = this.calculateDiversity(results);
    const relevanceScore = this.calculateRelevance(query, results);
    const coverageScore = this.calculateCoverage(query, results);
    
    return (
      diversityScore * diversityWeight +
      relevanceScore * relevanceWeight +
      coverageScore * coverageWeight
    );
  }
  
  private static calculateDiversity(results: SearchResult[]): number {
    if (results.length <= 1) return 1;
    
    // Simple diversity based on content similarity
    const contents = results.map(r => r.chunk.content.toLowerCase());
    let similaritySum = 0;
    let comparisons = 0;
    
    for (let i = 0; i < contents.length; i++) {
      for (let j = i + 1; j < contents.length; j++) {
        const similarity = this.calculateStringSimilarity(contents[i], contents[j]);
        similaritySum += similarity;
        comparisons++;
      }
    }
    
    const avgSimilarity = comparisons > 0 ? similaritySum / comparisons : 0;
    return 1 - avgSimilarity; // Higher diversity = lower similarity
  }
  
  private static calculateRelevance(query: string, results: SearchResult[]): number {
    const queryTerms = QueryPreprocessor.extractKeyTerms(query);
    if (queryTerms.length === 0) return 0;
    
    const relevanceScores = results.map(result => {
      const content = result.chunk.content.toLowerCase();
      const matches = queryTerms.filter(term => content.includes(term)).length;
      return matches / queryTerms.length;
    });
    
    return relevanceScores.reduce((sum, score) => sum + score, 0) / results.length;
  }
  
  private static calculateCoverage(query: string, results: SearchResult[]): number {
    const queryTerms = QueryPreprocessor.extractKeyTerms(query);
    if (queryTerms.length === 0) return 1;
    
    const coveredTerms = new Set<string>();
    
    results.forEach(result => {
      const content = result.chunk.content.toLowerCase();
      queryTerms.forEach(term => {
        if (content.includes(term)) {
          coveredTerms.add(term);
        }
      });
    });
    
    return coveredTerms.size / queryTerms.length;
  }
  
  private static calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
}