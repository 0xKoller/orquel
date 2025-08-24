import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  includeStats: z.boolean().default(true).describe('Include statistics about each source'),
  sortBy: z.enum(['title', 'created', 'chunks']).default('title').describe('Sort sources by title, creation date, or chunk count'),
  limit: z.number().int().min(1).max(100).default(50).describe('Maximum number of sources to return'),
});

export const metadata = {
  name: 'list-sources',
  description: 'List all available sources in the Orquel knowledge base with metadata and statistics',
  tags: ['knowledge-base', 'management', 'sources'],
};

export default async function listSources(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    
    // Get stats from vector store if available (PostgreSQL adapter has getStats method)
    let statsInfo = null;
    const vectorStore = (orq as any).config?.vector;
    
    if (vectorStore && typeof vectorStore.getStats === 'function') {
      try {
        statsInfo = await vectorStore.getStats();
      } catch (error) {
        // Stats not available, continue without them
      }
    }

    // For now, we'll need to query the store to get source information
    // This is a simplified implementation - in practice, you'd want to maintain
    // a sources registry or query the database directly
    
    let response = `# Knowledge Base Sources\n\n`;
    
    if (statsInfo) {
      response += `## Overall Statistics\n`;
      response += `• Total chunks: ${statsInfo.totalChunks}\n`;
      response += `• Total sources: ${statsInfo.totalSources}\n`;
      response += `• Last updated: ${statsInfo.lastUpdated ? statsInfo.lastUpdated.toISOString() : 'Unknown'}\n\n`;
    }

    // Try to get some sample data to show sources
    try {
      // Query for a broad term to get diverse results
      const { results } = await orq.query('', { k: params.limit });
      
      if (results.length === 0) {
        response += `No sources found in the knowledge base.\n\n`;
        response += `Use the 'ingest' tool to add documents to the knowledge base.`;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      }

      // Group chunks by source
      const sourceMap = new Map<string, {
        title: string;
        kind?: string;
        url?: string;
        chunks: number;
        metadata: any;
      }>();

      results.forEach(result => {
        const source = result.chunk.source;
        const key = source.title;
        
        if (!sourceMap.has(key)) {
          sourceMap.set(key, {
            title: source.title,
            kind: source.kind,
            url: (result.chunk.metadata as any)?.source?.url,
            chunks: 0,
            metadata: result.chunk.metadata,
          });
        }
        
        const sourceInfo = sourceMap.get(key)!;
        sourceInfo.chunks++;
      });

      // Convert to array and sort
      let sources = Array.from(sourceMap.values());
      
      switch (params.sortBy) {
        case 'chunks':
          sources.sort((a, b) => b.chunks - a.chunks);
          break;
        case 'created':
          // Sort by metadata creation date if available
          sources.sort((a, b) => {
            const aDate = (a.metadata as any)?.source?.createdAt || new Date(0);
            const bDate = (b.metadata as any)?.source?.createdAt || new Date(0);
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          });
          break;
        default:
          sources.sort((a, b) => a.title.localeCompare(b.title));
      }

      response += `## Sources (${sources.length} found)\n\n`;
      
      sources.forEach((source, index) => {
        response += `### ${index + 1}. ${source.title}\n`;
        
        if (source.kind) {
          response += `• Type: ${source.kind}\n`;
        }
        
        if (params.includeStats) {
          response += `• Chunks: ${source.chunks}\n`;
        }
        
        if (source.url) {
          response += `• URL: ${source.url}\n`;
        }
        
        // Add creation date if available
        const createdAt = (source.metadata as any)?.source?.createdAt;
        if (createdAt) {
          response += `• Created: ${new Date(createdAt).toISOString().split('T')[0]}\n`;
        }
        
        response += `\n`;
      });

      response += `---\n\n`;
      response += `💡 **Tips:**\n`;
      response += `• Use 'query' tool to search within these sources\n`;
      response += `• Use 'answer' tool to get AI responses with source citations\n`;
      response += `• Use 'ingest' tool to add new sources\n`;

    } catch (queryError) {
      // Fallback if query fails
      response += `Unable to retrieve source details. The knowledge base may be empty or experiencing issues.\n\n`;
      response += `Error: ${queryError instanceof Error ? queryError.message : String(queryError)}\n\n`;
      response += `Use the 'ingest' tool to add documents to the knowledge base.`;
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
          text: `Error listing sources: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}