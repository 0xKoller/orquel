import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  confirm: z.boolean().describe('Confirmation flag - must be true to proceed with clearing the knowledge base'),
  sourceFilter: z.string().optional().describe('Optional filter to clear only specific sources (partial title match)'),
  dryRun: z.boolean().default(false).describe('Preview what would be cleared without actually clearing'),
});

export const metadata = {
  name: 'clear',
  description: 'Clear all content from the Orquel knowledge base (requires confirmation)',
  tags: ['knowledge-base', 'management', 'admin', 'destructive'],
};

export default async function clear(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    
    if (!params.confirm && !params.dryRun) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️  **WARNING: Destructive Operation**\n\n` +
                  `This will permanently delete all content from the knowledge base.\n\n` +
                  `To proceed, call this tool again with: { "confirm": true }\n\n` +
                  `Or use: { "dryRun": true } to preview what would be cleared.\n\n` +
                  `💡 **Alternative**: Use "sourceFilter" to clear only specific sources.`,
          },
        ],
      };
    }

    // Get current state for reporting
    let currentStats = null;
    const vectorStore = (orq as any).config?.vector;
    
    if (vectorStore && typeof vectorStore.getStats === 'function') {
      try {
        currentStats = await vectorStore.getStats();
      } catch (error) {
        // Stats not available
      }
    }

    if (params.dryRun) {
      let response = `## Dry Run: Clear Knowledge Base Preview\n\n`;
      
      if (currentStats) {
        response += `**Current State:**\n`;
        response += `• Total chunks: ${currentStats.totalChunks}\n`;
        response += `• Total sources: ${currentStats.totalSources}\n`;
        response += `• Last updated: ${currentStats.lastUpdated ? currentStats.lastUpdated.toISOString() : 'Unknown'}\n\n`;
      }

      if (params.sourceFilter) {
        response += `**Filter Applied:** "${params.sourceFilter}"\n`;
        response += `Only sources matching this filter would be cleared.\n\n`;
      } else {
        response += `**Scope:** All content would be cleared\n\n`;
      }
      
      response += `**What would happen:**\n`;
      response += `• All vector embeddings would be deleted\n`;
      response += `• All lexical search indexes would be cleared (if configured)\n`;
      response += `• All chunk metadata would be removed\n`;
      response += `• The knowledge base would be empty\n\n`;
      response += `To actually clear the knowledge base, run with: { "confirm": true }`;

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    // Perform the actual clearing
    let response = `## Clearing Knowledge Base\n\n`;
    
    if (currentStats) {
      response += `**Before clearing:**\n`;
      response += `• Total chunks: ${currentStats.totalChunks}\n`;
      response += `• Total sources: ${currentStats.totalSources}\n\n`;
    }

    if (params.sourceFilter) {
      // Selective clearing by source (this would require custom implementation)
      response += `⚠️  Source-filtered clearing not yet implemented.\n\n`;
      response += `Currently, only full knowledge base clearing is supported.\n`;
      response += `Use { "sourceFilter": null, "confirm": true } to clear everything.`;
      
      return {
        content: [{ type: 'text', text: response }],
      };
    }

    // Clear vector store
    if (vectorStore && typeof vectorStore.clear === 'function') {
      await vectorStore.clear();
      response += `✅ Vector store cleared\n`;
    }

    // Clear lexical store if available
    const lexicalStore = (orq as any).config?.lexical;
    if (lexicalStore && typeof lexicalStore.clear === 'function') {
      try {
        await lexicalStore.clear();
        response += `✅ Lexical store cleared\n`;
      } catch (error) {
        response += `⚠️  Lexical store clearing failed: ${error}\n`;
      }
    }

    response += `\n**Knowledge base successfully cleared!**\n\n`;
    response += `The knowledge base is now empty and ready for new content.\n`;
    response += `Use the 'ingest' tool to add documents.\n\n`;
    response += `Cleared at: ${new Date().toISOString()}`;

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
          text: `Error clearing knowledge base: ${error instanceof Error ? error.message : String(error)}\n\n` +
                `This might be due to:\n` +
                `• Database connection issues\n` +
                `• Permission problems\n` +
                `• Store adapter limitations\n\n` +
                `Check your Orquel configuration and try again.`,
        },
      ],
      isError: true,
    };
  }
}