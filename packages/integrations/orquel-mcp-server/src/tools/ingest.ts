import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  title: z.string().describe('Title or name of the document to ingest'),
  content: z.string().describe('Text content of the document to ingest'),
  kind: z.enum(['md', 'txt', 'pdf', 'docx', 'html']).optional().describe('Document type/format'),
  url: z.string().url().optional().describe('Source URL if available'),
  author: z.string().optional().describe('Document author'),
  metadata: z.record(z.any()).optional().describe('Additional metadata as key-value pairs'),
});

export const metadata = {
  name: 'ingest',
  description: 'Ingest a document into the Orquel knowledge base for retrieval and search',
  tags: ['knowledge-base', 'ingestion', 'documents'],
};

export default async function ingest(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    
    const source = {
      title: params.title,
      kind: params.kind,
      url: params.url,
      author: params.author,
      createdAt: new Date(),
    };

    // Ingest the document
    const { sourceId, chunks } = await orq.ingest({
      source,
      content: params.content,
    });

    // Index the chunks
    await orq.index(chunks);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully ingested "${params.title}" into knowledge base.\n\n` +
                `• Source ID: ${sourceId}\n` +
                `• Chunks created: ${chunks.length}\n` +
                `• Content length: ${params.content.length} characters\n` +
                `• Document type: ${params.kind || 'auto-detected'}\n` +
                `${params.author ? `• Author: ${params.author}\n` : ''}` +
                `${params.url ? `• Source URL: ${params.url}\n` : ''}` +
                `\nThe document is now searchable and can be queried using the 'query' or 'answer' tools.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error ingesting document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}