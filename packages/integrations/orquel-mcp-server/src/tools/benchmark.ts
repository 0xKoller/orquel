import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';
import { benchmarkVectorStore, generateBenchmarkData, type BenchmarkConfig } from '@orquel/core';

export const schema = z.object({
  benchmarkType: z.enum(['ingestion', 'search', 'full']).default('search').describe('Type of benchmark to run'),
  dataSize: z.enum(['small', 'medium', 'large']).default('medium').describe('Size of test dataset'),
  iterations: z.number().int().min(1).max(10).default(3).describe('Number of iterations to run'),
  concurrency: z.number().int().min(1).max(10).default(1).describe('Number of concurrent operations'),
  includeLatencyDistribution: z.boolean().default(true).describe('Include latency percentile analysis'),
  compareAdapters: z.boolean().default(false).describe('Compare different adapter configurations'),
  warmup: z.boolean().default(true).describe('Run warmup iterations before benchmarking'),
});

export const metadata = {
  name: 'benchmark',
  description: 'Performance benchmarking and analysis for Orquel components with detailed metrics',
  tags: ['performance', 'benchmarking', 'analysis', 'optimization'],
};

export default async function benchmark(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    const config = (orq as any).config;

    let response = `# Orquel Performance Benchmark\n\n`;
    response += `**Configuration:**\n`;
    response += `• Benchmark type: ${params.benchmarkType}\n`;
    response += `• Data size: ${params.dataSize}\n`;
    response += `• Iterations: ${params.iterations}\n`;
    response += `• Concurrency: ${params.concurrency}\n`;
    response += `• Warmup: ${params.warmup ? 'enabled' : 'disabled'}\n\n`;

    response += `**Environment:**\n`;
    response += `• Vector store: ${config.vector.name}\n`;
    response += `• Embeddings: ${config.embeddings.name}\n`;
    response += `• Lexical store: ${config.lexical?.name || 'none'}\n`;
    response += `• Node.js: ${process.version}\n`;
    response += `• Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n\n`;

    // Determine benchmark data size
    const dataSizes = {
      small: { chunks: 100, queries: 10 },
      medium: { chunks: 500, queries: 25 },
      large: { chunks: 1000, queries: 50 },
    };
    
    const { chunks: chunkCount, queries: queryCount } = dataSizes[params.dataSize];
    
    // Generate benchmark data
    response += `## Data Generation\n\n`;
    response += `Generating ${chunkCount} chunks and ${queryCount} queries for testing...\n\n`;
    
    const benchmarkData = await generateBenchmarkData({
      chunkCount,
      queryCount,
      contentType: 'mixed',
    });

    // Warmup phase
    if (params.warmup) {
      response += `## Warmup Phase\n\n`;
      response += `Running warmup operations...\n`;
      
      try {
        // Small warmup operations
        const warmupChunks = benchmarkData.chunks.slice(0, 10);
        await orq.index(warmupChunks);
        await orq.query(benchmarkData.queries[0].text, { k: 5 });
        
        response += `✅ Warmup completed\n\n`;
      } catch (error) {
        response += `⚠️  Warmup failed: ${error}\n\n`;
      }
    }

    const benchmarkResults: any = {};

    // Ingestion Benchmark
    if (params.benchmarkType === 'ingestion' || params.benchmarkType === 'full') {
      response += `## Ingestion Benchmark\n\n`;
      
      const ingestionResults = [];
      
      for (let iteration = 1; iteration <= params.iterations; iteration++) {
        response += `Running ingestion iteration ${iteration}/${params.iterations}...\n`;
        
        const startTime = Date.now();
        
        try {
          // Clear the store first
          if (config.vector.clear) {
            await config.vector.clear();
          }
          
          // Benchmark ingestion
          const chunks = benchmarkData.chunks.slice();
          
          // Split into batches for concurrency testing
          const batchSize = Math.ceil(chunks.length / params.concurrency);
          const batches = [];
          
          for (let i = 0; i < chunks.length; i += batchSize) {
            batches.push(chunks.slice(i, i + batchSize));
          }
          
          const batchPromises = batches.map(async (batch) => {
            return orq.index(batch);
          });
          
          await Promise.all(batchPromises);
          
          const totalTime = Date.now() - startTime;
          const throughput = chunks.length / (totalTime / 1000);
          
          ingestionResults.push({
            iteration,
            totalTime,
            throughput,
            chunksProcessed: chunks.length,
          });
          
          response += `• Iteration ${iteration}: ${totalTime}ms, ${throughput.toFixed(1)} chunks/sec\n`;
          
        } catch (error) {
          response += `• Iteration ${iteration}: Error - ${error}\n`;
          ingestionResults.push({
            iteration,
            error: String(error),
          });
        }
      }
      
      // Calculate ingestion statistics
      const validResults = ingestionResults.filter(r => !r.error);
      if (validResults.length > 0) {
        const avgTime = validResults.reduce((sum, r) => sum + r.totalTime, 0) / validResults.length;
        const avgThroughput = validResults.reduce((sum, r) => sum + r.throughput, 0) / validResults.length;
        
        response += `\n**Ingestion Summary:**\n`;
        response += `• Average time: ${avgTime.toFixed(0)}ms\n`;
        response += `• Average throughput: ${avgThroughput.toFixed(1)} chunks/sec\n`;
        response += `• Success rate: ${(validResults.length / params.iterations * 100).toFixed(1)}%\n\n`;
        
        benchmarkResults.ingestion = {
          avgTime,
          avgThroughput,
          successRate: validResults.length / params.iterations,
        };
      }
    }

    // Search Benchmark
    if (params.benchmarkType === 'search' || params.benchmarkType === 'full') {
      response += `## Search Benchmark\n\n`;
      
      // Ensure we have some data to search
      if (params.benchmarkType === 'search') {
        response += `Indexing test data for search benchmark...\n`;
        await orq.index(benchmarkData.chunks);
        response += `✅ Test data indexed\n\n`;
      }
      
      const searchResults = [];
      
      // Test different search configurations
      const searchConfigs = [
        { name: 'Vector-only', hybrid: false, k: 10 },
        ...(config.lexical ? [
          { name: 'Hybrid (70/30)', hybrid: true, k: 10 },
          { name: 'Hybrid (50/50)', hybrid: true, k: 10 },
        ] : []),
      ];
      
      for (const searchConfig of searchConfigs) {
        response += `### ${searchConfig.name} Search\n\n`;
        
        const configResults = [];
        
        for (let iteration = 1; iteration <= params.iterations; iteration++) {
          const iterationResults = [];
          
          // Test with concurrent queries
          const queryPromises = benchmarkData.queries.slice(0, queryCount).map(async (query, index) => {
            const startTime = Date.now();
            
            try {
              const { results } = await orq.query(query.text, {
                k: searchConfig.k,
                hybrid: searchConfig.hybrid,
              });
              
              const latency = Date.now() - startTime;
              
              return {
                queryIndex: index,
                latency,
                resultCount: results.length,
                avgScore: results.length > 0 
                  ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
                  : 0,
              };
            } catch (error) {
              return {
                queryIndex: index,
                latency: Date.now() - startTime,
                error: String(error),
              };
            }
          });
          
          const queryResults = await Promise.all(queryPromises);
          iterationResults.push(...queryResults);
          configResults.push(...iterationResults);
        }
        
        // Calculate statistics
        const validResults = configResults.filter(r => !r.error);
        
        if (validResults.length > 0) {
          const latencies = validResults.map(r => r.latency).sort((a, b) => a - b);
          const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
          const p50 = latencies[Math.floor(latencies.length * 0.5)];
          const p95 = latencies[Math.floor(latencies.length * 0.95)];
          const p99 = latencies[Math.floor(latencies.length * 0.99)];
          
          response += `**Results:**\n`;
          response += `• Total queries: ${configResults.length}\n`;
          response += `• Success rate: ${(validResults.length / configResults.length * 100).toFixed(1)}%\n`;
          response += `• Average latency: ${avgLatency.toFixed(1)}ms\n`;
          
          if (params.includeLatencyDistribution) {
            response += `• P50 latency: ${p50}ms\n`;
            response += `• P95 latency: ${p95}ms\n`;
            response += `• P99 latency: ${p99}ms\n`;
          }
          
          const avgScore = validResults.reduce((sum, r) => sum + r.avgScore, 0) / validResults.length;
          response += `• Average relevance score: ${avgScore.toFixed(3)}\n`;
          
          const qps = validResults.length / (params.iterations * (Math.max(...latencies) / 1000));
          response += `• Queries per second: ${qps.toFixed(1)}\n\n`;
          
          benchmarkResults[searchConfig.name.toLowerCase().replace(/[^a-z]/g, '_')] = {
            avgLatency,
            p50,
            p95,
            p99,
            avgScore,
            qps,
            successRate: validResults.length / configResults.length,
          };
        }
      }
    }

    // Performance Analysis
    response += `## Performance Analysis\n\n`;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    response += `**Memory Usage:**\n`;
    response += `• Heap used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n`;
    response += `• Heap total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB\n`;
    response += `• RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB\n\n`;
    
    // Recommendations based on results
    response += `## Recommendations\n\n`;
    
    if (benchmarkResults.ingestion?.avgThroughput < 50) {
      response += `📈 **Ingestion Performance**: Consider increasing batch sizes or using connection pooling.\n`;
    }
    
    if (benchmarkResults.vector_only?.avgLatency > 500) {
      response += `⚡ **Search Latency**: High search latency detected. Consider vector index optimization or caching.\n`;
    }
    
    if (config.lexical && benchmarkResults.hybrid_70_30?.avgLatency > benchmarkResults.vector_only?.avgLatency * 2) {
      response += `🔄 **Hybrid Search**: Hybrid search adds significant latency. Evaluate if the accuracy gain justifies the performance cost.\n`;
    }
    
    response += `💡 **General Tips:**\n`;
    response += `• Monitor performance regularly as data size grows\n`;
    response += `• Use connection pooling for database-backed stores\n`;
    response += `• Consider caching for frequently accessed queries\n`;
    response += `• Optimize vector dimensions based on your use case\n`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error running benchmark: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}