import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  question: z.string().describe('Question to answer using the knowledge base'),
  topK: z.number().int().min(1).max(20).default(4).describe('Number of top chunks to use as context (1-20)'),
  includeSources: z.boolean().default(true).describe('Include source citations in the response'),
  includeContext: z.boolean().default(false).describe('Include the retrieved context chunks in the response'),
  streaming: z.boolean().default(false).describe('Enable streaming response (if supported by answerer)'),
});

export const metadata = {
  name: 'answer',
  description: 'Generate an AI answer to a question using relevant content from the knowledge base with citations',
  tags: ['qa', 'answer-generation', 'rag', 'knowledge-base'],
};

export default async function answer(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    
    // Check if answerer is configured
    if (!('answer' in orq)) {
      return {
        content: [
          {
            type: 'text',
            text: `Answer generation is not available - no answerer adapter configured.\n\n` +
                  `To use this feature, configure an answerer adapter (e.g., @orquel/answer-openai) in your Orquel setup.\n\n` +
                  `You can still use the 'query' tool to search for relevant content.`,
          },
        ],
      };
    }

    const result = await orq.answer(params.question, {
      topK: params.topK,
    });

    let response = `## Answer\n\n${result.answer}\n\n`;

    if (params.includeSources && result.contexts.length > 0) {
      response += `## Sources\n\n`;
      result.contexts.forEach((context, index) => {
        response += `${index + 1}. **${context.source.title}**${context.source.kind ? ` (${context.source.kind})` : ''}\n`;
        if (context.source.url) {
          response += `   URL: ${context.source.url}\n`;
        }
      });
      response += `\n`;
    }

    if (params.includeContext && result.contexts.length > 0) {
      response += `## Retrieved Context\n\n`;
      result.contexts.forEach((context, index) => {
        response += `### Context ${index + 1}\n`;
        response += `**Source:** ${context.source.title}\n`;
        response += `**Content:**\n${context.text}\n\n`;
      });
    }

    // Add metadata about the answer generation
    response += `---\n\n`;
    response += `**Answer Generation Details:**\n`;
    response += `• Context chunks used: ${result.contexts.length}\n`;
    response += `• Question: "${params.question}"\n`;
    response += `• Generated at: ${new Date().toISOString()}\n`;

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
          text: `Error generating answer: ${error instanceof Error ? error.message : String(error)}\n\n` +
                `This might be due to:\n` +
                `• No answerer adapter configured\n` +
                `• API key issues with the answerer service\n` +
                `• Empty knowledge base\n` +
                `• Network connectivity problems\n\n` +
                `Try using the 'query' tool first to verify content is available.`,
        },
      ],
      isError: true,
    };
  }
}