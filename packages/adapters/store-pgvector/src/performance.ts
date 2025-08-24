import { Pool, PoolClient } from 'pg';
import { performance } from 'perf_hooks';

/**
 * Performance monitoring utilities for PostgreSQL adapter
 */

export interface PerformanceMetrics {
  queryTime: number;
  connectionTime: number;
  resultCount: number;
  timestamp: number;
  operation: string;
  success: boolean;
  error?: string;
}

export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  poolUtilization: number; // percentage
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }
  
  getMetrics(operation?: string, timeWindow?: number): PerformanceMetrics[] {
    let filtered = this.metrics;
    
    if (operation) {
      filtered = filtered.filter(m => m.operation === operation);
    }
    
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filtered = filtered.filter(m => m.timestamp > cutoff);
    }
    
    return filtered;
  }
  
  getStats(operation?: string, timeWindow?: number) {
    const metrics = this.getMetrics(operation, timeWindow);
    if (metrics.length === 0) return null;
    
    const queryTimes = metrics.map(m => m.queryTime);
    const successful = metrics.filter(m => m.success);
    
    queryTimes.sort((a, b) => a - b);
    
    return {
      count: metrics.length,
      successRate: (successful.length / metrics.length) * 100,
      queryTime: {
        avg: queryTimes.reduce((sum, t) => sum + t, 0) / queryTimes.length,
        min: queryTimes[0],
        max: queryTimes[queryTimes.length - 1],
        p50: queryTimes[Math.floor(queryTimes.length * 0.5)],
        p95: queryTimes[Math.floor(queryTimes.length * 0.95)],
        p99: queryTimes[Math.floor(queryTimes.length * 0.99)],
      },
      totalResults: metrics.reduce((sum, m) => sum + m.resultCount, 0),
      errors: metrics.filter(m => !m.success).map(m => m.error).filter(Boolean),
    };
  }
  
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const timestamp = Date.now();
    
    try {
      const result = await fn();
      const queryTime = performance.now() - startTime;
      
      this.recordMetric({
        operation,
        queryTime,
        connectionTime: 0, // Will be set by connection wrapper
        resultCount: Array.isArray(result) ? result.length : 1,
        timestamp,
        success: true,
      });
      
      return result;
    } catch (error) {
      const queryTime = performance.now() - startTime;
      
      this.recordMetric({
        operation,
        queryTime,
        connectionTime: 0,
        resultCount: 0,
        timestamp,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }
}

export class OptimizedPool extends Pool {
  private monitor: PerformanceMonitor;
  private connectionMetrics = new Map<PoolClient, number>();
  
  constructor(config: any, monitor: PerformanceMonitor) {
    super(config);
    this.monitor = monitor;
    
    // Monitor pool events
    this.on('connect', (client) => {
      this.connectionMetrics.set(client, Date.now());
    });
    
    this.on('remove', (client) => {
      this.connectionMetrics.delete(client);
    });
    
    this.on('error', (error) => {
      console.error('Pool error:', error);
    });
  }
  
  async connect(): Promise<PoolClient> {
    const startTime = performance.now();
    
    try {
      const client = await super.connect();
      const connectionTime = performance.now() - startTime;
      
      // Wrap client release to track connection usage
      const originalRelease = client.release.bind(client);
      client.release = (err?: Error | boolean) => {
        this.connectionMetrics.delete(client);
        return originalRelease(err);
      };
      
      return client;
    } catch (error) {
      const connectionTime = performance.now() - startTime;
      
      this.monitor.recordMetric({
        operation: 'pool_connect',
        queryTime: 0,
        connectionTime,
        resultCount: 0,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }
  
  getPoolMetrics(): PoolMetrics {
    return {
      totalConnections: this.totalCount,
      idleConnections: this.idleCount,
      waitingClients: this.waitingCount,
      poolUtilization: (this.totalCount / (this.options.max || 10)) * 100,
    };
  }
  
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = performance.now();
    
    try {
      const client = await this.connect();
      
      try {
        await client.query('SELECT 1');
        const latencyMs = performance.now() - startTime;
        
        return { healthy: true, latencyMs };
      } finally {
        client.release();
      }
    } catch (error) {
      const latencyMs = performance.now() - startTime;
      
      return {
        healthy: false,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Connection pool factory with optimal defaults
 */
export function createOptimizedPool(connectionString: string, options: {
  maxConnections?: number;
  minConnections?: number;
  monitor?: PerformanceMonitor;
} = {}): OptimizedPool {
  const {
    maxConnections = 20,
    minConnections = 5,
    monitor = new PerformanceMonitor(),
  } = options;
  
  const poolConfig = {
    connectionString,
    max: maxConnections,
    min: minConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeout: 60000,
    
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false, // Adjust based on your setup
    } : false,
    
    // Connection optimization
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    
    // Error handling
    exitOnIdle: false,
  };
  
  return new OptimizedPool(poolConfig, monitor);
}

/**
 * Prepared statement manager for better performance
 */
export class PreparedStatementManager {
  private statements = new Map<string, string>();
  private client: PoolClient;
  
  constructor(client: PoolClient) {
    this.client = client;
  }
  
  async prepare(name: string, sql: string, paramTypes?: string[]): Promise<void> {
    if (this.statements.has(name)) {
      return; // Already prepared
    }
    
    const prepareSQL = paramTypes 
      ? `PREPARE ${name} (${paramTypes.join(', ')}) AS ${sql}`
      : `PREPARE ${name} AS ${sql}`;
    
    await this.client.query(prepareSQL);
    this.statements.set(name, sql);
  }
  
  async execute(name: string, params: any[] = []): Promise<any> {
    if (!this.statements.has(name)) {
      throw new Error(`Prepared statement '${name}' not found`);
    }
    
    const executeSQL = `EXECUTE ${name}${params.length > 0 ? `(${params.map(() => '$?').join(', ')})` : ''}`;
    return this.client.query(executeSQL, params);
  }
  
  async deallocate(name?: string): Promise<void> {
    if (name) {
      await this.client.query(`DEALLOCATE ${name}`);
      this.statements.delete(name);
    } else {
      await this.client.query('DEALLOCATE ALL');
      this.statements.clear();
    }
  }
  
  getStatements(): string[] {
    return Array.from(this.statements.keys());
  }
}

/**
 * Batch operation utilities
 */
export class BatchProcessor {
  static async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize?: number;
      concurrency?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = 100,
      concurrency = 1,
      onProgress,
    } = options;
    
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    const results: R[] = [];
    let processed = 0;
    
    if (concurrency <= 1) {
      // Sequential processing
      for (const batch of batches) {
        const batchResults = await processor(batch);
        results.push(...batchResults);
        processed += batch.length;
        onProgress?.(processed, items.length);
      }
    } else {
      // Parallel processing with limited concurrency
      const semaphore = new Array(concurrency).fill(null);
      const batchPromises = batches.map(async (batch, index) => {
        // Wait for available slot
        await Promise.race(semaphore.filter(Boolean));
        
        const promise = processor(batch).then(batchResults => {
          results.splice(index * batchSize, 0, ...batchResults);
          processed += batch.length;
          onProgress?.(processed, items.length);
          return batchResults;
        });
        
        semaphore[index % concurrency] = promise;
        return promise;
      });
      
      await Promise.all(batchPromises);
    }
    
    return results;
  }
}

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  static optimizeVectorSearch(
    sql: string,
    options: {
      useIndex?: boolean;
      efSearch?: number;
      prefilter?: boolean;
    } = {}
  ): string {
    const {
      useIndex = true,
      efSearch = 100,
      prefilter = false,
    } = options;
    
    let optimizedSQL = sql;
    
    // Set ef_search parameter for HNSW
    if (useIndex && efSearch) {
      optimizedSQL = `SET hnsw.ef_search = ${efSearch}; ${optimizedSQL}`;
    }
    
    // Add index hints if needed
    if (useIndex) {
      optimizedSQL = optimizedSQL.replace(
        /ORDER BY embedding/gi,
        '/* USE INDEX */ ORDER BY embedding'
      );
    }
    
    return optimizedSQL;
  }
  
  static addQueryPlan(sql: string): string {
    return `EXPLAIN (ANALYZE, BUFFERS) ${sql}`;
  }
  
  static parseQueryPlan(result: any): {
    executionTime: number;
    planningTime: number;
    indexUsed: boolean;
    bufferHits: number;
    bufferReads: number;
  } {
    const plan = result.rows[0]['QUERY PLAN'];
    
    // Parse execution stats (simplified)
    const executionTimeMatch = plan.match(/Execution Time: ([\d.]+) ms/);
    const planningTimeMatch = plan.match(/Planning Time: ([\d.]+) ms/);
    const indexMatch = plan.includes('Index Scan');
    const bufferMatch = plan.match(/Buffers: shared hit=(\d+).*read=(\d+)/);
    
    return {
      executionTime: executionTimeMatch ? parseFloat(executionTimeMatch[1]) : 0,
      planningTime: planningTimeMatch ? parseFloat(planningTimeMatch[1]) : 0,
      indexUsed: indexMatch,
      bufferHits: bufferMatch ? parseInt(bufferMatch[1]) : 0,
      bufferReads: bufferMatch ? parseInt(bufferMatch[2]) : 0,
    };
  }
}