import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  query: z.string().describe('Search query to find relevant content in the knowledge base'),
  k: z.number().int().min(1).max(50).default(10).describe('Number of results to return (1-50)'),
  hybrid: z.boolean().default(true).describe('Enable hybrid search combining vector and lexical search'),
  rerank: z.boolean().default(true).describe('Apply reranking to improve result relevance'),
  includeScores: z.boolean().default(true).describe('Include relevance scores in results'),
  includeMetadata: z.boolean().default(false).describe('Include chunk metadata in results'),
});

export const metadata = {
  name: 'query',
  description: 'Search the Orquel knowledge base for relevant content using hybrid vector and lexical search',
  tags: ['search', 'retrieval', 'knowledge-base'],
};

export default async function query(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    
    const { results } = await orq.query(params.query, {
      k: params.k,
      hybrid: params.hybrid,
      rerank: params.rerank,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No results found for query: "${params.query}"\n\n` +
                  'Try:\n' +
                  '• Using different keywords or phrases\n' +
                  '• Broadening your search terms\n' +
                  '• Checking if relevant content has been ingested\n' +
                  '• Using the list-sources tool to see available content',
          },
        ],
      };
    }

    // Format results
    let response = `Found ${results.length} relevant results for: "${params.query}"\n\n`;
    
    if (params.hybrid) {
      response += `🔄 Hybrid Search: Combined vector similarity + lexical matching\n`;
    } else {
      response += `🧠 Vector Search: Semantic similarity matching\n`;
    }
    
    if (params.rerank) {
      response += `🎯 Reranking: Applied for improved relevance\n`;
    }
    
    response += `\n`;

    results.forEach((result, index) => {
      const rank = index + 1;
      const chunk = result.chunk;
      
      response += `## Result ${rank}${params.includeScores ? ` (Score: ${result.score.toFixed(3)})` : ''}\n`;
      response += `**Source:** ${chunk.source.title}${chunk.source.kind ? ` (${chunk.source.kind})` : ''}\n`;
      response += `**Content:**\n${chunk.text}\n`;
      
      if (params.includeMetadata && chunk.metadata && Object.keys(chunk.metadata).length > 0) {
        response += `**Metadata:**\n`;
        Object.entries(chunk.metadata).forEach(([key, value]) => {
          if (key !== 'source') { // Avoid duplicating source info
            response += `• ${key}: ${JSON.stringify(value)}\n`;
          }
        });
      }
      
      response += `\n---\n\n`;
    });

    // Add search tips
    response += `💡 **Search Tips:**\n`;
    response += `• Use "answer" tool to get AI-generated responses with citations\n`;
    response += `• Try different values for k (${params.k}) to get more/fewer results\n`;
    response += `• Toggle hybrid search for different result types\n`;

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
          text: `Error searching knowledge base: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}