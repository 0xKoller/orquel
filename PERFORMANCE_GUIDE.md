# Orquel v0.2.0 Performance Guide

This guide provides comprehensive performance optimization strategies for Orquel v0.2.0, focusing on PostgreSQL + pgvector deployments and hybrid search optimization.

## Performance Overview

Orquel v0.2.0 introduces significant performance improvements:

- **PostgreSQL + pgvector**: Production-grade vector storage with HNSW indexing
- **Hybrid search**: Combines vector similarity and full-text search for better relevance
- **Connection pooling**: Efficient database connection management
- **Batch processing**: Optimized ingestion for large document sets
- **Comprehensive benchmarking**: Built-in performance measurement tools

## Benchmarking Your Setup

### 1. Built-in Benchmark Suite

Use the included benchmark tools to measure your performance:

```typescript
import { 
  benchmarkVectorStore, 
  benchmarkLexicalStore,
  benchmarkHybridSearch 
} from '@orquel/core';
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';

// Benchmark vector search
const vectorResults = await benchmarkVectorStore(vectorStore, {
  chunkCount: 10000,      // Number of chunks to test with
  queryCount: 1000,       // Number of queries to run
  dimensions: 1536,       // Embedding dimensions
  batchSize: 100,         // Batch size for ingestion
});

console.log('Vector Search Results:');
console.log(`Average query time: ${vectorResults.averageQueryTime}ms`);
console.log(`95th percentile: ${vectorResults.p95QueryTime}ms`);
console.log(`Throughput: ${vectorResults.queriesPerSecond} QPS`);
console.log(`Memory usage: ${vectorResults.memoryUsage}MB`);

// Benchmark lexical search
const lexicalResults = await benchmarkLexicalStore(lexicalStore, {
  chunkCount: 10000,
  queryCount: 1000,
  avgChunkLength: 500,
});

// Benchmark hybrid search
const hybridResults = await benchmarkHybridSearch({
  vectorStore,
  lexicalStore,
  embeddings,
  chunkCount: 10000,
  queryCount: 500,
  hybridMethods: ['rrf', 'weighted'],
});
```

### 2. Production Benchmark Script

Create a comprehensive benchmark script:

```typescript
// scripts/benchmark.ts
import { performance } from 'perf_hooks';

async function runProductionBenchmark() {
  const testSizes = [1000, 5000, 10000, 50000, 100000];
  const results = [];

  for (const size of testSizes) {
    console.log(`\n=== Benchmarking with ${size} chunks ===`);
    
    const startTime = performance.now();
    
    // Ingestion benchmark
    const ingestionTime = await benchmarkIngestion(size);
    
    // Search benchmarks
    const searchResults = await Promise.all([
      benchmarkVectorSearch(size),
      benchmarkLexicalSearch(size),
      benchmarkHybridSearch(size),
    ]);
    
    const totalTime = performance.now() - startTime;
    
    results.push({
      chunkCount: size,
      ingestionTime,
      vectorSearch: searchResults[0],
      lexicalSearch: searchResults[1],
      hybridSearch: searchResults[2],
      totalTime,
    });
  }

  // Generate report
  generateBenchmarkReport(results);
}

async function benchmarkIngestion(chunkCount: number) {
  const chunks = generateTestChunks(chunkCount);
  const batchSize = 100;
  
  const start = performance.now();
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    await Promise.all([
      vectorStore.upsert(batch),
      lexicalStore.upsert(batch),
    ]);
  }
  
  return performance.now() - start;
}

runProductionBenchmark().catch(console.error);
```

## Database Optimization

### 1. PostgreSQL Configuration

Optimize `postgresql.conf` for vector workloads:

```bash
# Memory settings (adjust based on your server)
shared_buffers = 2GB                      # 25% of total RAM
effective_cache_size = 6GB                # 75% of total RAM
work_mem = 256MB                          # For sorting/hashing operations
maintenance_work_mem = 1GB                # For index building

# Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# Checkpoint settings (reduce I/O spikes)
checkpoint_completion_target = 0.9
checkpoint_timeout = 10min
max_wal_size = 4GB
min_wal_size = 1GB

# Parallel query settings
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_worker_processes = 8

# Vector-specific settings
random_page_cost = 1.1                    # For SSD storage
effective_io_concurrency = 200            # For SSD storage

# Statistics
default_statistics_target = 100           # Better query planning
```

### 2. Index Optimization

#### HNSW Index Parameters

```sql
-- Optimize for different use cases

-- High recall, slower search (recommended for production)
CREATE INDEX vector_chunks_embedding_idx 
ON vector_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Faster search, lower recall
CREATE INDEX vector_chunks_embedding_idx_fast 
ON vector_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 8, ef_construction = 32);

-- Very high recall, slowest search
CREATE INDEX vector_chunks_embedding_idx_accurate 
ON vector_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 128);
```

#### Index Maintenance

```sql
-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_stat_user_indexes 
WHERE tablename LIKE '%chunks'
ORDER BY idx_scan DESC;

-- Rebuild indexes if needed
REINDEX INDEX CONCURRENTLY vector_chunks_embedding_idx;

-- Update statistics for better query planning
ANALYZE vector_chunks;
ANALYZE lexical_chunks;
```

### 3. Connection Pool Tuning

```typescript
const optimalPoolConfig = {
  // Connection limits (tune based on your server)
  max: 20,                        // Max concurrent connections
  min: 5,                         // Keep connections warm
  
  // Timeouts (balance responsiveness vs resource usage)
  idleTimeoutMillis: 30000,       // Close idle connections
  connectionTimeoutMillis: 5000,  // Connection establishment timeout
  statementTimeout: 60000,        // Query timeout
  
  // Advanced settings
  maxUses: 7500,                  // Recreate connections periodically
  testOnBorrow: true,             // Validate connections
  
  // Monitoring
  log: (message, logLevel) => {
    if (logLevel === 'error') {
      console.error('Pool error:', message);
    }
  },
};
```

## Search Performance Optimization

### 1. Vector Search Tuning

#### Query-time Parameters

```typescript
// Balance speed vs accuracy
const searchConfig = {
  efSearch: 100,          // Higher = better recall, slower search
  useIndex: true,         // Always use index for large datasets
  
  // Prefiltering (if metadata filtering is needed)
  preFilter: {
    metadata: { category: 'technical' },
    limit: 1000,          // Filter before vector search
  },
};

const results = await vectorStore.search(
  queryEmbedding, 
  10, 
  searchConfig
);
```

#### Embedding Model Selection

```typescript
// Performance vs quality trade-offs

// text-embedding-3-small: 1536 dims, fastest
const fastEmbeddings = new OpenAIEmbeddingsAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

// text-embedding-3-large: 3072 dims, highest quality
const accurateEmbeddings = new OpenAIEmbeddingsAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-large', 
  dimensions: 3072,
});

// Reduced dimensions for even faster search
const compactEmbeddings = new OpenAIEmbeddingsAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-large',
  dimensions: 1024,  // Reduced from 3072
});
```

### 2. Lexical Search Optimization

#### Full-text Search Configuration

```sql
-- Optimize text search configuration
-- Create custom configuration for your domain
CREATE TEXT SEARCH CONFIGURATION orquel_config (COPY = english);

-- Add domain-specific dictionaries
CREATE TEXT SEARCH DICTIONARY tech_dict (
  TEMPLATE = simple,
  STOPWORDS = tech_stopwords
);

ALTER TEXT SEARCH CONFIGURATION orquel_config
ALTER MAPPING FOR asciiword WITH tech_dict, english_stem;
```

#### Search Index Tuning

```sql
-- Multi-column indexes for filtered searches
CREATE INDEX lexical_chunks_filtered_idx 
ON lexical_chunks USING gin(search_vector, (metadata->>'category'));

-- Partial indexes for common filters
CREATE INDEX lexical_chunks_recent_idx 
ON lexical_chunks USING gin(search_vector)
WHERE created_at > NOW() - INTERVAL '30 days';
```

### 3. Hybrid Search Optimization

#### Algorithm Selection

```typescript
// Choose algorithm based on your needs

// Reciprocal Rank Fusion (RRF) - generally better quality
const rrfResults = await hybridSearch({
  query: 'machine learning',
  queryEmbedding,
  vectorStore,
  lexicalStore,
  method: 'rrf',
  k: 60,              // Lower k = more aggressive fusion
  denseWeight: 0.7,
  lexicalWeight: 0.3,
});

// Weighted combination - faster, simpler
const weightedResults = await hybridSearch({
  query: 'machine learning',
  queryEmbedding,
  vectorStore,
  lexicalStore,
  method: 'weighted',
  denseWeight: 0.6,   // Adjust based on your data
  lexicalWeight: 0.4,
});
```

#### Weight Optimization

Run A/B tests to find optimal weights:

```typescript
async function optimizeHybridWeights(testQueries: string[]) {
  const weightCombinations = [
    [0.8, 0.2], [0.7, 0.3], [0.6, 0.4], 
    [0.5, 0.5], [0.4, 0.6], [0.3, 0.7]
  ];
  
  const results = [];
  
  for (const [denseWeight, lexicalWeight] of weightCombinations) {
    const scores = [];
    
    for (const query of testQueries) {
      const queryEmbedding = await embeddings.embed(query);
      const searchResults = await hybridSearch({
        query,
        queryEmbedding,
        vectorStore,
        lexicalStore,
        denseWeight,
        lexicalWeight,
        method: 'rrf',
      });
      
      // Calculate relevance scores (you'll need ground truth)
      const relevanceScore = calculateRelevance(searchResults, query);
      scores.push(relevanceScore);
    }
    
    results.push({
      weights: [denseWeight, lexicalWeight],
      avgRelevance: scores.reduce((a, b) => a + b) / scores.length,
      scores,
    });
  }
  
  // Find optimal weights
  const optimal = results.reduce((best, current) => 
    current.avgRelevance > best.avgRelevance ? current : best
  );
  
  console.log('Optimal weights:', optimal.weights);
  return optimal;
}
```

## Application-Level Optimizations

### 1. Caching Strategies

#### Embedding Cache

```typescript
import Redis from 'ioredis';

class EmbeddingCache {
  private redis: Redis;
  private ttl = 24 * 60 * 60; // 24 hours
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }
  
  async getEmbedding(text: string): Promise<number[] | null> {
    const key = `embedding:${this.hashText(text)}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = `embedding:${this.hashText(text)}`;
    await this.redis.setex(key, this.ttl, JSON.stringify(embedding));
  }
  
  private hashText(text: string): string {
    return require('crypto').createHash('sha256').update(text).digest('hex');
  }
}

// Usage
const embeddingCache = new EmbeddingCache(process.env.REDIS_URL);

class CachedEmbeddingsAdapter {
  constructor(
    private embeddings: OpenAIEmbeddingsAdapter,
    private cache: EmbeddingCache
  ) {}
  
  async embed(text: string): Promise<number[]> {
    let embedding = await this.cache.getEmbedding(text);
    
    if (!embedding) {
      embedding = await this.embeddings.embed(text);
      await this.cache.setEmbedding(text, embedding);
    }
    
    return embedding;
  }
}
```

#### Query Result Cache

```typescript
class SearchResultCache {
  private redis: Redis;
  private ttl = 5 * 60; // 5 minutes
  
  async cacheResults(query: string, results: any[]): Promise<void> {
    const key = `search:${this.hashQuery(query)}`;
    await this.redis.setex(key, this.ttl, JSON.stringify(results));
  }
  
  async getCachedResults(query: string): Promise<any[] | null> {
    const key = `search:${this.hashQuery(query)}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  private hashQuery(query: string): string {
    return require('crypto')
      .createHash('sha256')
      .update(query.toLowerCase().trim())
      .digest('hex');
  }
}
```

### 2. Batch Processing Optimization

#### Optimal Batch Sizes

```typescript
class OptimizedIngestion {
  private vectorStore: PgVectorStoreAdapter;
  private lexicalStore: PostgresLexicalAdapter;
  private embeddings: OpenAIEmbeddingsAdapter;
  
  async ingestDocuments(chunks: DocumentChunk[]) {
    const batchSize = this.calculateOptimalBatchSize(chunks);
    console.log(`Using batch size: ${batchSize}`);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Process embeddings in parallel
      const embeddings = await this.batchEmbeddings(batch);
      
      // Prepare data
      const vectorData = batch.map((chunk, idx) => ({
        ...chunk,
        embedding: embeddings[idx],
      }));
      
      // Store in parallel
      await Promise.all([
        this.vectorStore.upsert(vectorData),
        this.lexicalStore.upsert(batch),
      ]);
      
      // Progress reporting
      console.log(`Processed ${i + batch.length}/${chunks.length} chunks`);
      
      // Rate limiting for external APIs
      if (i + batchSize < chunks.length) {
        await this.delay(100); // 100ms delay
      }
    }
  }
  
  private calculateOptimalBatchSize(chunks: DocumentChunk[]): number {
    const avgChunkSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length;
    
    // Adjust batch size based on content length
    if (avgChunkSize < 200) return 200;
    if (avgChunkSize < 500) return 100;
    if (avgChunkSize < 1000) return 50;
    return 25;
  }
  
  private async batchEmbeddings(chunks: DocumentChunk[]): Promise<number[][]> {
    const batchSize = 100; // OpenAI batch limit
    const results: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await this.embeddings.embedBatch(
        batch.map(chunk => chunk.content)
      );
      results.push(...embeddings);
    }
    
    return results;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Memory Management

#### Streaming for Large Datasets

```typescript
import { Transform } from 'stream';

class ChunkProcessor extends Transform {
  private buffer: DocumentChunk[] = [];
  private batchSize: number;
  
  constructor(batchSize = 100) {
    super({ objectMode: true });
    this.batchSize = batchSize;
  }
  
  _transform(chunk: DocumentChunk, encoding: string, callback: Function) {
    this.buffer.push(chunk);
    
    if (this.buffer.length >= this.batchSize) {
      this.push(this.buffer.splice(0, this.batchSize));
    }
    
    callback();
  }
  
  _flush(callback: Function) {
    if (this.buffer.length > 0) {
      this.push(this.buffer);
    }
    callback();
  }
}

// Usage for large document processing
async function processLargeDataset(documentStream: NodeJS.ReadableStream) {
  const processor = new ChunkProcessor(100);
  
  documentStream
    .pipe(processor)
    .on('data', async (batch: DocumentChunk[]) => {
      await ingestBatch(batch);
    })
    .on('end', () => {
      console.log('Processing complete');
    })
    .on('error', (error) => {
      console.error('Processing error:', error);
    });
}
```

## Monitoring and Observability

### 1. Performance Metrics Collection

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  async measureOperation<T>(
    operationName: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      this.recordMetric(operationName, performance.now() - start);
      return result;
    } catch (error) {
      this.recordMetric(`${operationName}_error`, performance.now() - start);
      throw error;
    }
  }
  
  private recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }
  
  getStats(operationName: string) {
    const durations = this.metrics.get(operationName) || [];
    if (durations.length === 0) return null;
    
    durations.sort((a, b) => a - b);
    
    return {
      count: durations.length,
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
    };
  }
  
  generateReport(): void {
    console.log('\n=== Performance Report ===');
    
    for (const [operation, _] of this.metrics) {
      const stats = this.getStats(operation);
      if (stats) {
        console.log(`${operation}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
      }
    }
  }
}

// Usage
const monitor = new PerformanceMonitor();

const results = await monitor.measureOperation('hybrid_search', async () => {
  return hybridSearch({
    query: 'test query',
    queryEmbedding,
    vectorStore,
    lexicalStore,
  });
});
```

### 2. Database Performance Monitoring

```sql
-- Create monitoring views
CREATE VIEW search_performance AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time,
  rows / calls as avg_rows
FROM pg_stat_statements 
WHERE query LIKE '%vector_chunks%' OR query LIKE '%lexical_chunks%'
ORDER BY mean_time DESC;

-- Monitor connection usage
CREATE VIEW connection_stats AS
SELECT 
  state,
  count(*) as connection_count,
  max(now() - state_change) as max_duration
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY state;

-- Check index effectiveness
CREATE VIEW index_effectiveness AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Performance Troubleshooting

### Common Issues and Solutions

#### 1. Slow Vector Searches

**Symptoms**: High query latency, timeout errors

**Diagnosis**:
```sql
-- Check if HNSW index is being used
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, embedding <=> $1 as distance 
FROM vector_chunks 
ORDER BY embedding <=> $1 
LIMIT 10;
```

**Solutions**:
- Ensure HNSW index exists and has optimal parameters
- Increase `ef_search` parameter for better recall
- Consider using multiple smaller indexes for very large datasets

#### 2. Memory Issues

**Symptoms**: Out of memory errors, slow performance

**Diagnosis**:
```sql
SELECT 
  name,
  setting,
  unit,
  context 
FROM pg_settings 
WHERE name IN ('shared_buffers', 'work_mem', 'maintenance_work_mem');
```

**Solutions**:
- Increase `work_mem` for sort operations
- Use streaming processing for large batch operations
- Implement connection pooling limits

#### 3. Index Bloat

**Symptoms**: Degrading performance over time

**Diagnosis**:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_tables 
WHERE tablename LIKE '%chunks';
```

**Solutions**:
- Regular `VACUUM` and `ANALYZE`
- Consider `REINDEX CONCURRENTLY` for heavily updated tables
- Monitor and clean up old data

### Performance Best Practices Summary

1. **Database Configuration**
   - Optimize PostgreSQL settings for your hardware
   - Use appropriate HNSW index parameters
   - Enable connection pooling

2. **Search Optimization**
   - Choose embedding models based on speed/accuracy tradeoffs
   - Optimize hybrid search weights for your data
   - Implement result caching for common queries

3. **Application Design**
   - Use batch processing for ingestion
   - Implement proper error handling and retries
   - Monitor performance metrics continuously

4. **Monitoring**
   - Track query performance over time
   - Monitor database resource usage
   - Set up alerts for performance degradation

---

For specific performance issues not covered here, check the [troubleshooting guide](./TROUBLESHOOTING.md) or reach out to the community.