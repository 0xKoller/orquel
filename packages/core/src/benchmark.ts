/**
 * Performance benchmarking utilities for Orquel
 * 
 * This module provides comprehensive performance testing tools to:
 * - Measure adapter performance across different scales
 * - Compare memory store vs PostgreSQL performance
 * - Benchmark hybrid search algorithms
 * - Generate performance reports and recommendations
 */

import type { 
  VectorStoreAdapter, 
  LexicalAdapter, 
  EmbeddingsAdapter,
  SearchResult, 
  ChunkWithEmbedding,
  Chunk 
} from './types.js';

export interface BenchmarkConfig {
  /** Number of chunks to test with */
  chunkCounts: number[];
  /** Vector dimensions for testing */
  dimensions: number;
  /** Number of search queries to run */
  searchQueries: number;
  /** k value for search results */
  k: number;
  /** Number of runs to average */
  runs: number;
  /** Warm-up runs before measurement */
  warmupRuns?: number;
}

export interface PerformanceMetrics {
  /** Operation name */
  operation: string;
  /** Number of items processed */
  itemCount: number;
  /** Time in milliseconds */
  duration: number;
  /** Items per second */
  throughput: number;
  /** Memory usage in MB (if available) */
  memoryMB?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface BenchmarkResult {
  /** Adapter name being tested */
  adapterName: string;
  /** Test configuration used */
  config: BenchmarkConfig;
  /** Performance metrics for each operation */
  metrics: PerformanceMetrics[];
  /** Overall summary statistics */
  summary: {
    avgUpsertThroughput: number;
    avgSearchLatency: number;
    peakMemoryMB?: number;
    recommendation: string;
  };
  /** Timestamp when benchmark was run */
  timestamp: Date;
}

export interface ComparisonResult {
  /** Results being compared */
  results: BenchmarkResult[];
  /** Performance comparison analysis */
  analysis: {
    /** Which adapter performed best for each operation */
    bestPerformers: Record<string, string>;
    /** Performance ratios (how many times faster/slower) */
    ratios: Record<string, Record<string, number>>;
    /** Recommendations based on use case */
    recommendations: {
      development: string;
      production: string;
      largescale: string;
    };
  };
}

/**
 * Generate realistic test chunks for benchmarking
 */
export function generateTestChunks(count: number, dimensions: number): ChunkWithEmbedding[] {
  const chunks: ChunkWithEmbedding[] = [];
  
  const sampleTexts = [
    "Machine learning algorithms process vast amounts of data to identify patterns and make predictions.",
    "Database systems provide structured storage and efficient retrieval of information using SQL queries.",
    "Web development frameworks simplify the creation of dynamic user interfaces and server-side applications.",
    "Cloud computing platforms enable scalable deployment of applications with global availability and reliability.",
    "Artificial intelligence research focuses on creating systems that can perform tasks requiring human-like intelligence.",
    "Software architecture patterns help organize code for maintainability, scalability, and testability.",
    "Data analysis techniques extract meaningful insights from raw information to support decision making.",
    "Network protocols ensure reliable communication between distributed systems across the internet.",
    "Security measures protect digital assets from unauthorized access and malicious attacks.",
    "User experience design prioritizes intuitive interfaces that enhance user satisfaction and engagement."
  ];
  
  for (let i = 0; i < count; i++) {
    const textIndex = i % sampleTexts.length;
    const baseText = sampleTexts[textIndex];
    
    chunks.push({
      chunk: {
        id: `benchmark-chunk-${i}`,
        text: `${baseText} This is chunk number ${i} with unique content for testing purposes.`,
        index: i,
        hash: `hash-${i}`,
        source: {
          title: `Benchmark Document ${Math.floor(i / 10)}`,
          kind: 'md',
        },
        metadata: {
          benchmarkId: i,
          category: ['ai', 'database', 'web', 'cloud', 'security'][i % 5],
        },
      },
      embedding: generateRandomEmbedding(dimensions),
    });
  }
  
  return chunks;
}

/**
 * Generate random embedding vector for testing
 */
function generateRandomEmbedding(dimensions: number): number[] {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}

/**
 * Generate realistic search queries for benchmarking
 */
export function generateSearchQueries(count: number): { text: string; embedding: number[] }[] {
  const queryTexts = [
    "machine learning algorithms",
    "database query optimization", 
    "web application security",
    "cloud computing scalability",
    "artificial intelligence research",
    "software architecture patterns",
    "data analysis techniques",
    "network communication protocols",
    "user interface design",
    "system performance monitoring"
  ];
  
  const queries: { text: string; embedding: number[] }[] = [];
  
  for (let i = 0; i < count; i++) {
    const text = queryTexts[i % queryTexts.length] + ` query ${i}`;
    queries.push({
      text,
      embedding: generateRandomEmbedding(1536), // Default to OpenAI dimensions
    });
  }
  
  return queries;
}

/**
 * Measure memory usage (Node.js specific)
 */
function measureMemory(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // Convert to MB
  }
  return 0;
}

/**
 * Run performance benchmark on a vector store adapter
 */
export async function benchmarkVectorStore(
  adapter: VectorStoreAdapter,
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const metrics: PerformanceMetrics[] = [];
  const startMemory = measureMemory();
  
  console.log(`🔬 Benchmarking ${adapter.name}...`);
  
  for (const chunkCount of config.chunkCounts) {
    console.log(`  📊 Testing with ${chunkCount} chunks...`);
    
    // Generate test data
    const testChunks = generateTestChunks(chunkCount, config.dimensions);
    const queries = generateSearchQueries(config.searchQueries);
    
    // Warm-up runs
    if (config.warmupRuns && config.warmupRuns > 0) {
      const warmupChunks = generateTestChunks(Math.min(100, chunkCount), config.dimensions);
      for (let i = 0; i < config.warmupRuns; i++) {
        await adapter.upsert(warmupChunks.slice(0, 10));
        await adapter.searchByVector(queries[0]?.embedding || [], config.k);
      }
      await adapter.clear();
    }
    
    // Benchmark upsert operations
    const upsertTimes: number[] = [];
    for (let run = 0; run < config.runs; run++) {
      await adapter.clear();
      
      const start = performance.now();
      await adapter.upsert(testChunks);
      const end = performance.now();
      
      upsertTimes.push(end - start);
    }
    
    const avgUpsertTime = upsertTimes.reduce((sum, time) => sum + time, 0) / upsertTimes.length;
    metrics.push({
      operation: 'upsert',
      itemCount: chunkCount,
      duration: avgUpsertTime,
      throughput: chunkCount / (avgUpsertTime / 1000),
      memoryMB: measureMemory(),
      metadata: {
        minTime: Math.min(...upsertTimes),
        maxTime: Math.max(...upsertTimes),
        stdDev: Math.sqrt(upsertTimes.reduce((sum, time) => sum + Math.pow(time - avgUpsertTime, 2), 0) / upsertTimes.length)
      }
    });
    
    // Benchmark search operations
    const searchTimes: number[] = [];
    for (let run = 0; run < config.runs; run++) {
      for (const query of queries) {
        const start = performance.now();
        const results = await adapter.searchByVector(query.embedding, config.k);
        const end = performance.now();
        
        searchTimes.push(end - start);
        
        // Verify results
        if (results.length === 0 && chunkCount > 0) {
          console.warn(`  ⚠️ No results returned for search with ${chunkCount} chunks`);
        }
      }
    }
    
    const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
    metrics.push({
      operation: 'search',
      itemCount: chunkCount,
      duration: avgSearchTime,
      throughput: 1000 / avgSearchTime, // Searches per second
      memoryMB: measureMemory(),
      metadata: {
        queriesPerRun: queries.length,
        minTime: Math.min(...searchTimes),
        maxTime: Math.max(...searchTimes),
        p95Time: searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)]
      }
    });
  }
  
  const peakMemory = Math.max(...metrics.map(m => m.memoryMB || 0));
  const avgUpsertThroughput = metrics
    .filter(m => m.operation === 'upsert')
    .reduce((sum, m) => sum + m.throughput, 0) / 
    metrics.filter(m => m.operation === 'upsert').length;
    
  const avgSearchLatency = metrics
    .filter(m => m.operation === 'search')
    .reduce((sum, m) => sum + m.duration, 0) /
    metrics.filter(m => m.operation === 'search').length;
  
  // Generate recommendation
  let recommendation = '';
  if (avgUpsertThroughput > 1000) {
    recommendation = 'Excellent performance for production use';
  } else if (avgUpsertThroughput > 100) {
    recommendation = 'Good performance for most applications';
  } else {
    recommendation = 'Suitable for development and small-scale use';
  }
  
  if (avgSearchLatency > 100) {
    recommendation += '. Consider optimizing for search latency.';
  }
  
  return {
    adapterName: adapter.name,
    config,
    metrics,
    summary: {
      avgUpsertThroughput,
      avgSearchLatency,
      peakMemoryMB: peakMemory,
      recommendation,
    },
    timestamp: new Date(),
  };
}

/**
 * Benchmark lexical search adapter
 */
export async function benchmarkLexicalStore(
  adapter: LexicalAdapter,
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const metrics: PerformanceMetrics[] = [];
  
  console.log(`🔬 Benchmarking lexical adapter ${adapter.name}...`);
  
  for (const chunkCount of config.chunkCounts) {
    console.log(`  📊 Testing with ${chunkCount} chunks...`);
    
    // Generate test data
    const testChunks = generateTestChunks(chunkCount, config.dimensions).map(c => c.chunk);
    const queries = generateSearchQueries(config.searchQueries);
    
    // Benchmark indexing
    const indexTimes: number[] = [];
    for (let run = 0; run < config.runs; run++) {
      const start = performance.now();
      await adapter.index(testChunks);
      const end = performance.now();
      
      indexTimes.push(end - start);
    }
    
    const avgIndexTime = indexTimes.reduce((sum, time) => sum + time, 0) / indexTimes.length;
    metrics.push({
      operation: 'index',
      itemCount: chunkCount,
      duration: avgIndexTime,
      throughput: chunkCount / (avgIndexTime / 1000),
      memoryMB: measureMemory(),
    });
    
    // Benchmark search
    const searchTimes: number[] = [];
    for (let run = 0; run < config.runs; run++) {
      for (const query of queries) {
        const start = performance.now();
        const results = await adapter.search(query.text, config.k);
        const end = performance.now();
        
        searchTimes.push(end - start);
      }
    }
    
    const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
    metrics.push({
      operation: 'search',
      itemCount: chunkCount,
      duration: avgSearchTime,
      throughput: 1000 / avgSearchTime,
      memoryMB: measureMemory(),
    });
  }
  
  const avgIndexThroughput = metrics
    .filter(m => m.operation === 'index')
    .reduce((sum, m) => sum + m.throughput, 0) / 
    metrics.filter(m => m.operation === 'index').length;
    
  const avgSearchLatency = metrics
    .filter(m => m.operation === 'search')
    .reduce((sum, m) => sum + m.duration, 0) /
    metrics.filter(m => m.operation === 'search').length;
  
  return {
    adapterName: adapter.name,
    config,
    metrics,
    summary: {
      avgUpsertThroughput: avgIndexThroughput,
      avgSearchLatency,
      recommendation: avgSearchLatency < 50 ? 'Excellent lexical search performance' : 'Good lexical search performance',
    },
    timestamp: new Date(),
  };
}

/**
 * Compare performance between multiple adapters
 */
export function compareResults(results: BenchmarkResult[]): ComparisonResult {
  const bestPerformers: Record<string, string> = {};
  const ratios: Record<string, Record<string, number>> = {};
  
  // Find best performers for each operation
  const operations = ['upsert', 'search', 'index'];
  
  for (const operation of operations) {
    let bestThroughput = 0;
    let bestAdapter = '';
    
    for (const result of results) {
      const opMetrics = result.metrics.filter(m => m.operation === operation);
      if (opMetrics.length > 0) {
        const avgThroughput = opMetrics.reduce((sum, m) => sum + m.throughput, 0) / opMetrics.length;
        if (avgThroughput > bestThroughput) {
          bestThroughput = avgThroughput;
          bestAdapter = result.adapterName;
        }
      }
    }
    
    if (bestAdapter) {
      bestPerformers[operation] = bestAdapter;
    }
  }
  
  // Calculate performance ratios
  for (const result1 of results) {
    ratios[result1.adapterName] = {};
    
    for (const result2 of results) {
      if (result1.adapterName !== result2.adapterName) {
        const ratio1 = result1.summary.avgUpsertThroughput / result2.summary.avgUpsertThroughput;
        const ratiosForAdapter = ratios[result1.adapterName];
        if (ratiosForAdapter) {
          ratiosForAdapter[result2.adapterName] = ratio1;
        }
      }
    }
  }
  
  // Generate recommendations
  const recommendations = {
    development: results.find(r => r.adapterName.includes('memory'))?.adapterName || 
                results[0]?.adapterName + ' (fast iteration)',
    production: bestPerformers.upsert || results[0]?.adapterName || 'unknown',
    largescale: bestPerformers.search || results[0]?.adapterName || 'unknown',
  };
  
  return {
    results,
    analysis: {
      bestPerformers,
      ratios,
      recommendations,
    },
  };
}

/**
 * Generate a formatted benchmark report
 */
export function generateReport(comparison: ComparisonResult): string {
  const { results, analysis } = comparison;
  
  let report = '# Orquel Performance Benchmark Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Summary table
  report += '## Summary\n\n';
  report += '| Adapter | Avg Upsert Throughput | Avg Search Latency | Peak Memory | Recommendation |\n';
  report += '|---------|----------------------|-------------------|-------------|----------------|\n';
  
  for (const result of results) {
    const throughput = result.summary.avgUpsertThroughput.toFixed(1);
    const latency = result.summary.avgSearchLatency.toFixed(2);
    const memory = result.summary.peakMemoryMB?.toFixed(1) || 'N/A';
    const rec = result.summary.recommendation;
    
    report += `| ${result.adapterName} | ${throughput} items/s | ${latency}ms | ${memory}MB | ${rec} |\n`;
  }
  
  report += '\n## Best Performers\n\n';
  for (const [operation, adapter] of Object.entries(analysis.bestPerformers)) {
    report += `- **${operation}**: ${adapter}\n`;
  }
  
  report += '\n## Recommendations\n\n';
  report += `- **Development**: ${analysis.recommendations.development}\n`;
  report += `- **Production**: ${analysis.recommendations.production}\n`;
  report += `- **Large Scale**: ${analysis.recommendations.largescale}\n`;
  
  report += '\n## Detailed Metrics\n\n';
  for (const result of results) {
    report += `### ${result.adapterName}\n\n`;
    
    for (const metric of result.metrics) {
      report += `**${metric.operation}** (${metric.itemCount} items):\n`;
      report += `- Duration: ${metric.duration.toFixed(2)}ms\n`;
      report += `- Throughput: ${metric.throughput.toFixed(2)} ops/s\n`;
      if (metric.memoryMB) {
        report += `- Memory: ${metric.memoryMB.toFixed(1)}MB\n`;
      }
      report += '\n';
    }
  }
  
  return report;
}

/**
 * Default benchmark configuration for quick testing
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  chunkCounts: [10, 50, 100, 500],
  dimensions: 1536, // OpenAI text-embedding-3-small
  searchQueries: 5,
  k: 10,
  runs: 3,
  warmupRuns: 1,
};

/**
 * Comprehensive benchmark configuration for thorough testing
 */
export const COMPREHENSIVE_BENCHMARK_CONFIG: BenchmarkConfig = {
  chunkCounts: [100, 500, 1000, 5000, 10000],
  dimensions: 1536,
  searchQueries: 20,
  k: 10,
  runs: 5,
  warmupRuns: 3,
};