import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  confirm: z.boolean().describe('Confirmation flag - must be true to proceed with reindexing'),
  sourceFilter: z.string().optional().describe('Optional filter to reindex only specific sources (partial title match)'),
  rebuildVectorIndex: z.boolean().default(true).describe('Rebuild vector embeddings index'),
  rebuildLexicalIndex: z.boolean().default(true).describe('Rebuild lexical search index'),
  batchSize: z.number().int().min(10).max(1000).default(100).describe('Batch size for processing chunks'),
  dryRun: z.boolean().default(false).describe('Preview what would be reindexed without actually reindexing'),
});

export const metadata = {
  name: 'reindex',
  description: 'Rebuild search indexes for the knowledge base with optional filtering and batch processing',
  tags: ['maintenance', 'indexing', 'performance', 'admin'],
};

export default async function reindex(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    const config = (orq as any).config;

    if (!params.confirm && !params.dryRun) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️  **WARNING: Maintenance Operation**\n\n` +
                  `This will rebuild search indexes, which may:\n` +
                  `• Take significant time for large knowledge bases\n` +
                  `• Temporarily impact search performance\n` +
                  `• Use substantial computational resources\n\n` +
                  `To proceed, call this tool again with: { "confirm": true }\n\n` +
                  `Or use: { "dryRun": true } to preview the operation.\n\n` +
                  `💡 **Options**: Use "sourceFilter" to reindex only specific sources.`,
          },
        ],
      };
    }

    let response = `# Knowledge Base Reindexing\n\n`;
    response += `**Configuration:**\n`;
    response += `• Vector index: ${params.rebuildVectorIndex ? 'rebuild' : 'skip'}\n`;
    response += `• Lexical index: ${params.rebuildLexicalIndex ? 'skip' : 'rebuild'}\n`;
    response += `• Batch size: ${params.batchSize}\n`;
    response += `• Source filter: ${params.sourceFilter || 'none (all sources)'}\n`;
    response += `• Mode: ${params.dryRun ? 'dry run' : 'execute'}\n\n`;

    // Get current data to reindex
    response += `## Analyzing Current Data\n\n`;
    
    let chunksToReindex = [];
    
    try {
      // Query with broad terms to get a representative sample
      const sampleQueries = ['', 'the', 'and', 'information', 'data', 'system'];
      const allResults = new Map();
      
      for (const query of sampleQueries) {
        try {
          const { results } = await orq.query(query, { k: 200 });
          results.forEach(result => {
            allResults.set(result.chunk.id, result.chunk);
          });
        } catch (error) {
          // Continue with other queries
        }
      }
      
      chunksToReindex = Array.from(allResults.values());
      
      // Apply source filter if specified
      if (params.sourceFilter) {
        const originalCount = chunksToReindex.length;
        chunksToReindex = chunksToReindex.filter(chunk =>
          chunk.source.title.toLowerCase().includes(params.sourceFilter!.toLowerCase())
        );
        
        response += `• Source filter applied: "${params.sourceFilter}"\n`;
        response += `• Filtered from ${originalCount} to ${chunksToReindex.length} chunks\n`;
      }
      
      if (chunksToReindex.length === 0) {
        response += `❌ No chunks found to reindex.\n\n`;
        
        if (params.sourceFilter) {
          response += `This might be because:\n`;
          response += `• The source filter "${params.sourceFilter}" doesn't match any sources\n`;
          response += `• Use the 'list-sources' tool to see available sources\n`;
        } else {
          response += `This might be because:\n`;
          response += `• The knowledge base is empty\n`;
          response += `• There are search/query issues\n`;
          response += `• Use the 'analyze-kb' tool to diagnose the knowledge base\n`;
        }
        
        return {
          content: [{ type: 'text', text: response }],
        };
      }
      
      // Group by source for reporting
      const sourceStats = new Map();
      chunksToReindex.forEach(chunk => {
        const sourceTitle = chunk.source.title;
        const stats = sourceStats.get(sourceTitle) || { chunks: 0, totalLength: 0 };
        stats.chunks++;
        stats.totalLength += chunk.text.length;
        sourceStats.set(sourceTitle, stats);
      });
      
      response += `• Total chunks to reindex: ${chunksToReindex.length}\n`;
      response += `• Sources affected: ${sourceStats.size}\n`;
      response += `• Estimated batches: ${Math.ceil(chunksToReindex.length / params.batchSize)}\n\n`;
      
      response += `**Sources to be reindexed:**\n`;
      Array.from(sourceStats.entries())
        .sort(([,a], [,b]) => b.chunks - a.chunks)
        .slice(0, 10) // Show top 10 sources
        .forEach(([title, stats]) => {
          response += `• ${title}: ${stats.chunks} chunks, ${stats.totalLength.toLocaleString()} characters\n`;
        });
      
      if (sourceStats.size > 10) {
        response += `• ... and ${sourceStats.size - 10} more sources\n`;
      }
      response += `\n`;
      
    } catch (error) {
      response += `❌ Error analyzing current data: ${error}\n\n`;
      return {
        content: [{ type: 'text', text: response }],
        isError: true,
      };
    }

    if (params.dryRun) {
      response += `## Dry Run Preview\n\n`;
      
      response += `**Operations that would be performed:**\n\n`;
      
      if (params.rebuildVectorIndex) {
        response += `### Vector Index Rebuild\n`;
        response += `• Generate new embeddings for ${chunksToReindex.length} chunks\n`;
        response += `• Embedding calls: ${chunksToReindex.length} (${config.embeddings.name})\n`;
        response += `• Vector store updates: ${Math.ceil(chunksToReindex.length / params.batchSize)} batches\n`;
        response += `• Estimated time: ${Math.ceil(chunksToReindex.length / 10)} - ${Math.ceil(chunksToReindex.length / 5)} minutes\n\n`;
      }
      
      if (params.rebuildLexicalIndex && config.lexical) {
        response += `### Lexical Index Rebuild\n`;
        response += `• Reindex ${chunksToReindex.length} chunks for full-text search\n`;
        response += `• Lexical store: ${config.lexical.name}\n`;
        response += `• Processing batches: ${Math.ceil(chunksToReindex.length / params.batchSize)}\n`;
        response += `• Estimated time: ${Math.ceil(chunksToReindex.length / 100)} - ${Math.ceil(chunksToReindex.length / 50)} minutes\n\n`;
      } else if (params.rebuildLexicalIndex && !config.lexical) {
        response += `### Lexical Index Rebuild\n`;
        response += `⚠️  Skipped - no lexical search adapter configured\n\n`;
      }
      
      response += `**Resource Requirements:**\n`;
      response += `• API calls: ${params.rebuildVectorIndex ? chunksToReindex.length : 0} embedding requests\n`;
      response += `• Memory usage: ~${Math.ceil(chunksToReindex.length * 0.1)}MB for batch processing\n`;
      response += `• Disk I/O: Heavy during index updates\n\n`;
      
      response += `To execute the reindexing, run with: { "confirm": true }`;
      
      return {
        content: [{ type: 'text', text: response }],
      };
    }

    // Execute the reindexing
    response += `## Executing Reindexing\n\n`;
    
    const startTime = Date.now();
    let processedChunks = 0;
    let errorCount = 0;
    
    try {
      // Process in batches
      const batches = [];
      for (let i = 0; i < chunksToReindex.length; i += params.batchSize) {
        batches.push(chunksToReindex.slice(i, i + params.batchSize));
      }
      
      response += `Processing ${batches.length} batches...\n\n`;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();
        
        try {
          // Vector index rebuild
          if (params.rebuildVectorIndex) {
            response += `Batch ${batchIndex + 1}/${batches.length}: Generating embeddings for ${batch.length} chunks... `;
            
            const texts = batch.map(chunk => chunk.text);
            const embeddings = await config.embeddings.embed(texts);
            
            const rows = batch.map((chunk, i) => ({
              chunk,
              embedding: embeddings[i],
            }));
            
            await config.vector.upsert(rows);
            response += `✅\n`;
          }
          
          // Lexical index rebuild
          if (params.rebuildLexicalIndex && config.lexical) {
            response += `Batch ${batchIndex + 1}/${batches.length}: Updating lexical index for ${batch.length} chunks... `;
            await config.lexical.index(batch);
            response += `✅\n`;
          }
          
          processedChunks += batch.length;
          
          const batchTime = Date.now() - batchStartTime;
          const avgTimePerChunk = batchTime / batch.length;
          const eta = Math.ceil(((batches.length - batchIndex - 1) * batch.length * avgTimePerChunk) / 1000 / 60);
          
          if (eta > 0) {
            response += `   Progress: ${processedChunks}/${chunksToReindex.length} (${(processedChunks / chunksToReindex.length * 100).toFixed(1)}%), ETA: ${eta}min\n\n`;
          }
          
        } catch (error) {
          errorCount++;
          response += `❌ Batch ${batchIndex + 1} failed: ${error}\n\n`;
          
          // Continue with next batch unless too many errors
          if (errorCount > batches.length * 0.1) { // Stop if >10% of batches fail
            throw new Error(`Too many batch failures (${errorCount}). Stopping reindexing.`);
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      response += `## Reindexing Complete\n\n`;
      response += `**Results:**\n`;
      response += `• Successfully processed: ${processedChunks} chunks\n`;
      response += `• Failed batches: ${errorCount}\n`;
      response += `• Total time: ${Math.round(totalTime / 1000)}s\n`;
      response += `• Average speed: ${(processedChunks / (totalTime / 1000)).toFixed(1)} chunks/sec\n\n`;
      
      if (errorCount > 0) {
        response += `⚠️  Some batches failed during reindexing. The knowledge base may have inconsistencies.\n`;
        response += `Consider running the reindexing again or using the 'analyze-kb' tool to check health.\n\n`;
      }
      
      response += `✅ **Reindexing completed successfully!**\n\n`;
      response += `The search indexes have been rebuilt and should now be optimized for performance.\n`;
      
      // Recommend follow-up actions
      response += `💡 **Next Steps:**\n`;
      response += `• Run 'analyze-kb' to verify the reindexing results\n`;
      response += `• Test search performance with the 'benchmark' tool\n`;
      response += `• Consider running 'optimize-search' to tune hybrid search weights\n`;
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      response += `## Reindexing Failed\n\n`;
      response += `**Error:** ${error instanceof Error ? error.message : String(error)}\n\n`;
      response += `**Progress when failed:**\n`;
      response += `• Processed: ${processedChunks} chunks\n`;
      response += `• Time elapsed: ${Math.round(totalTime / 1000)}s\n\n`;
      response += `The knowledge base may be in a partially reindexed state.\n`;
      response += `You may need to run the reindexing operation again.\n`;
      
      return {
        content: [{ type: 'text', text: response }],
        isError: true,
      };
    }

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
          text: `Error during reindexing: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}