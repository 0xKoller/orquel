import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  analysisType: z.enum(['overview', 'content', 'performance', 'health', 'all']).default('overview').describe('Type of analysis to perform'),
  includeContentSample: z.boolean().default(false).describe('Include sample content in the analysis'),
  includeMetrics: z.boolean().default(true).describe('Include performance and usage metrics'),
  contentAnalysisDepth: z.enum(['basic', 'detailed']).default('basic').describe('Depth of content analysis'),
});

export const metadata = {
  name: 'analyze-kb',
  description: 'Comprehensive analysis of the Orquel knowledge base including statistics, health, and content insights',
  tags: ['analytics', 'knowledge-base', 'statistics', 'health'],
};

export default async function analyzeKb(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    const config = (orq as any).config;

    let response = `# Knowledge Base Analysis\n\n`;
    response += `**Analysis Type:** ${params.analysisType}\n`;
    response += `**Generated at:** ${new Date().toISOString()}\n\n`;

    // System Configuration
    response += `## System Configuration\n\n`;
    response += `• **Vector Store:** ${config.vector.name}\n`;
    response += `• **Embeddings:** ${config.embeddings.name} (${config.embeddings.dim}D)\n`;
    response += `• **Lexical Search:** ${config.lexical?.name || 'Not configured'}\n`;
    response += `• **Reranker:** ${config.reranker?.name || 'Not configured'}\n`;
    response += `• **Answer Generator:** ${config.answerer?.name || 'Not configured'}\n\n`;

    // Overview Analysis
    if (params.analysisType === 'overview' || params.analysisType === 'all') {
      response += `## Overview Statistics\n\n`;
      
      try {
        // Get stats from vector store if available (PostgreSQL adapter)
        let stats = null;
        if (config.vector.getStats) {
          stats = await config.vector.getStats();
        }

        if (stats) {
          response += `**Storage Statistics:**\n`;
          response += `• Total chunks: ${stats.totalChunks.toLocaleString()}\n`;
          response += `• Unique sources: ${stats.totalSources.toLocaleString()}\n`;
          response += `• Last updated: ${stats.lastUpdated ? stats.lastUpdated.toISOString() : 'Unknown'}\n`;
          
          if (stats.totalChunks > 0) {
            const avgChunksPerSource = stats.totalChunks / stats.totalSources;
            response += `• Average chunks per source: ${avgChunksPerSource.toFixed(1)}\n`;
          }
          response += `\n`;
        } else {
          // Fallback: try to get sample data to estimate size
          try {
            const { results } = await orq.query('', { k: 1000 }); // Broad search to get many results
            
            if (results.length === 0) {
              response += `**Storage Status:** Knowledge base appears to be empty\n`;
              response += `• Use the 'ingest' tool to add content\n\n`;
            } else {
              // Estimate based on search results
              const uniqueSources = new Set(results.map(r => r.chunk.source.title));
              
              response += `**Storage Statistics (Estimated):**\n`;
              response += `• Searchable chunks: ${results.length}+ (may be more)\n`;
              response += `• Unique sources: ${uniqueSources.size}+\n`;
              response += `• Average chunks per source: ${(results.length / uniqueSources.size).toFixed(1)}+\n\n`;
            }
          } catch (error) {
            response += `⚠️  Unable to retrieve storage statistics: ${error}\n\n`;
          }
        }

        // System resources
        const memUsage = process.memoryUsage();
        response += `**System Resources:**\n`;
        response += `• Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB total\n`;
        response += `• Node.js version: ${process.version}\n`;
        response += `• Uptime: ${Math.round(process.uptime())} seconds\n\n`;

      } catch (error) {
        response += `⚠️  Error retrieving overview statistics: ${error}\n\n`;
      }
    }

    // Content Analysis
    if (params.analysisType === 'content' || params.analysisType === 'all') {
      response += `## Content Analysis\n\n`;
      
      try {
        // Sample content from the knowledge base
        const sampleQueries = [
          '', // Broad query
          'the', // Common word
          'information', // General term
          'data', // Technical term
        ];

        const allResults = [];
        for (const query of sampleQueries) {
          try {
            const { results } = await orq.query(query, { k: 50 });
            allResults.push(...results);
          } catch (error) {
            // Continue with other queries
          }
        }

        if (allResults.length > 0) {
          // Deduplicate by chunk ID
          const uniqueChunks = new Map();
          allResults.forEach(result => {
            if (!uniqueChunks.has(result.chunk.id)) {
              uniqueChunks.set(result.chunk.id, result.chunk);
            }
          });

          const chunks = Array.from(uniqueChunks.values());
          
          // Analyze content types
          const contentTypes = new Map<string, number>();
          const sources = new Map<string, { count: number, totalLength: number }>();
          let totalTextLength = 0;
          const textLengths: number[] = [];

          chunks.forEach(chunk => {
            const kind = chunk.source.kind || 'unknown';
            contentTypes.set(kind, (contentTypes.get(kind) || 0) + 1);
            
            const sourceTitle = chunk.source.title;
            const sourceInfo = sources.get(sourceTitle) || { count: 0, totalLength: 0 };
            sourceInfo.count++;
            sourceInfo.totalLength += chunk.text.length;
            sources.set(sourceTitle, sourceInfo);
            
            totalTextLength += chunk.text.length;
            textLengths.push(chunk.text.length);
          });

          response += `**Content Distribution:**\n`;
          
          // Content types
          if (contentTypes.size > 0) {
            response += `• Content types:\n`;
            Array.from(contentTypes.entries())
              .sort(([,a], [,b]) => b - a)
              .forEach(([type, count]) => {
                response += `  - ${type}: ${count} chunks\n`;
              });
          }

          // Text length statistics
          if (textLengths.length > 0) {
            textLengths.sort((a, b) => a - b);
            const avgLength = totalTextLength / textLengths.length;
            const medianLength = textLengths[Math.floor(textLengths.length / 2)];
            const minLength = Math.min(...textLengths);
            const maxLength = Math.max(...textLengths);
            
            response += `• Chunk size statistics:\n`;
            response += `  - Average: ${avgLength.toFixed(0)} characters\n`;
            response += `  - Median: ${medianLength} characters\n`;
            response += `  - Range: ${minLength} - ${maxLength} characters\n`;
          }

          // Top sources by content volume
          if (sources.size > 0) {
            response += `• Top sources by content:\n`;
            Array.from(sources.entries())
              .sort(([,a], [,b]) => b.totalLength - a.totalLength)
              .slice(0, 5)
              .forEach(([title, info]) => {
                response += `  - "${title}": ${info.count} chunks, ${info.totalLength.toLocaleString()} characters\n`;
              });
          }

          // Content samples
          if (params.includeContentSample && chunks.length > 0) {
            response += `\n**Content Samples:**\n`;
            const sampleChunks = chunks.slice(0, 3);
            sampleChunks.forEach((chunk, index) => {
              const preview = chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : '');
              response += `${index + 1}. **${chunk.source.title}**\n`;
              response += `   "${preview}"\n\n`;
            });
          }

        } else {
          response += `No content found for analysis. The knowledge base may be empty.\n`;
        }
        
        response += `\n`;
        
      } catch (error) {
        response += `⚠️  Error during content analysis: ${error}\n\n`;
      }
    }

    // Performance Analysis
    if (params.analysisType === 'performance' || params.analysisType === 'all') {
      response += `## Performance Analysis\n\n`;
      
      try {
        // Quick performance tests
        const performanceTests = [
          { name: 'Simple query', query: 'test', k: 5 },
          { name: 'Complex query', query: 'artificial intelligence machine learning', k: 10 },
          { name: 'Broad query', query: 'information data', k: 20 },
        ];

        response += `**Query Performance:**\n`;
        
        for (const test of performanceTests) {
          const startTime = Date.now();
          try {
            const { results } = await orq.query(test.query, { k: test.k });
            const latency = Date.now() - startTime;
            
            response += `• ${test.name}: ${latency}ms, ${results.length} results\n`;
          } catch (error) {
            response += `• ${test.name}: Error - ${error}\n`;
          }
        }

        // Test hybrid search if available
        if (config.lexical) {
          response += `\n**Hybrid Search Performance:**\n`;
          
          const startTime = Date.now();
          try {
            const { results } = await orq.query('information', { k: 10, hybrid: true });
            const latency = Date.now() - startTime;
            
            response += `• Hybrid query: ${latency}ms, ${results.length} results\n`;
          } catch (error) {
            response += `• Hybrid query: Error - ${error}\n`;
          }
        }

        response += `\n`;
        
      } catch (error) {
        response += `⚠️  Error during performance analysis: ${error}\n\n`;
      }
    }

    // Health Check
    if (params.analysisType === 'health' || params.analysisType === 'all') {
      response += `## Health Check\n\n`;
      
      const healthChecks = [];
      
      // Vector store health
      try {
        if (config.vector.healthCheck) {
          const health = await config.vector.healthCheck();
          healthChecks.push({
            component: 'Vector Store',
            healthy: health.healthy,
            latency: health.latencyMs,
            details: health.error || 'OK',
          });
        } else {
          // Basic connectivity test
          const startTime = Date.now();
          await orq.query('health-check', { k: 1 });
          const latency = Date.now() - startTime;
          
          healthChecks.push({
            component: 'Vector Store',
            healthy: true,
            latency,
            details: 'Basic connectivity OK',
          });
        }
      } catch (error) {
        healthChecks.push({
          component: 'Vector Store',
          healthy: false,
          latency: null,
          details: String(error),
        });
      }

      // Embeddings health
      try {
        const startTime = Date.now();
        await config.embeddings.embed(['health check']);
        const latency = Date.now() - startTime;
        
        healthChecks.push({
          component: 'Embeddings',
          healthy: true,
          latency,
          details: 'OK',
        });
      } catch (error) {
        healthChecks.push({
          component: 'Embeddings',
          healthy: false,
          latency: null,
          details: String(error),
        });
      }

      // Lexical search health
      if (config.lexical) {
        try {
          const startTime = Date.now();
          await config.lexical.search('health check', 1);
          const latency = Date.now() - startTime;
          
          healthChecks.push({
            component: 'Lexical Search',
            healthy: true,
            latency,
            details: 'OK',
          });
        } catch (error) {
          healthChecks.push({
            component: 'Lexical Search',
            healthy: false,
            latency: null,
            details: String(error),
          });
        }
      }

      // Answer generation health
      if (config.answerer) {
        try {
          const startTime = Date.now();
          const { answer } = await orq.answer('What is a health check?', { topK: 1 });
          const latency = Date.now() - startTime;
          
          healthChecks.push({
            component: 'Answer Generation',
            healthy: answer.length > 0,
            latency,
            details: answer.length > 0 ? 'OK' : 'Empty response',
          });
        } catch (error) {
          healthChecks.push({
            component: 'Answer Generation',
            healthy: false,
            latency: null,
            details: String(error),
          });
        }
      }

      // Display health check results
      response += `| Component | Status | Latency | Details |\n`;
      response += `|-----------|--------|---------|----------|\n`;
      
      healthChecks.forEach(check => {
        const status = check.healthy ? '✅ Healthy' : '❌ Unhealthy';
        const latency = check.latency ? `${check.latency}ms` : 'N/A';
        const details = check.details.length > 50 ? check.details.substring(0, 50) + '...' : check.details;
        
        response += `| ${check.component} | ${status} | ${latency} | ${details} |\n`;
      });

      const healthyCount = healthChecks.filter(c => c.healthy).length;
      const overallHealth = healthyCount / healthChecks.length;
      
      response += `\n**Overall Health:** ${(overallHealth * 100).toFixed(1)}% (${healthyCount}/${healthChecks.length} components healthy)\n\n`;

      if (overallHealth < 1.0) {
        response += `⚠️  **Issues Detected:**\n`;
        healthChecks.filter(c => !c.healthy).forEach(check => {
          response += `• ${check.component}: ${check.details}\n`;
        });
        response += `\n`;
      }
    }

    // Recommendations
    response += `## Recommendations\n\n`;
    
    // Based on the analysis, provide recommendations
    try {
      const { results } = await orq.query('', { k: 1 });
      
      if (results.length === 0) {
        response += `📥 **Get Started:**\n`;
        response += `• Your knowledge base is empty\n`;
        response += `• Use the 'ingest' tool to add documents\n`;
        response += `• Start with a few representative documents\n\n`;
      } else {
        response += `🎯 **Optimization Opportunities:**\n`;
        response += `• Run 'benchmark' tool to identify performance bottlenecks\n`;
        response += `• Use 'optimize-search' tool to tune hybrid search weights\n`;
        response += `• Consider adding more diverse content types\n`;
        
        if (!config.lexical) {
          response += `• Enable lexical search for better keyword matching\n`;
        }
        
        if (!config.answerer) {
          response += `• Configure answer generation for Q&A functionality\n`;
        }
        
        response += `\n`;
      }
    } catch (error) {
      // Continue without recommendations
    }

    response += `💡 **Maintenance Tips:**\n`;
    response += `• Run health checks regularly\n`;
    response += `• Monitor memory usage and performance\n`;
    response += `• Keep embeddings and content in sync\n`;
    response += `• Consider periodic reindexing for large knowledge bases\n`;

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
          text: `Error analyzing knowledge base: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}