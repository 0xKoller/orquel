import { NextRequest, NextResponse } from 'next/server';
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';
import { OpenAIEmbeddingsAdapter } from '@orquel/embeddings-openai';
import { TextChunker } from '@orquel/core';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const ingestSchema = z.object({
  documents: z.array(z.object({
    id: z.string().optional(),
    content: z.string().min(1, 'Content is required'),
    metadata: z.record(z.any()).optional(),
  })).min(1, 'At least one document is required'),
  chunk_size: z.number().min(100).max(2000).default(512),
  chunk_overlap: z.number().min(0).max(500).default(100),
  batch_size: z.number().min(1).max(100).default(20),
});

let vectorStore: PgVectorStoreAdapter | null = null;
let lexicalStore: PostgresLexicalAdapter | null = null;
let embeddings: OpenAIEmbeddingsAdapter | null = null;
let chunker: TextChunker | null = null;

function initializeAdapters(chunkSize: number, chunkOverlap: number) {
  if (!vectorStore || !lexicalStore || !embeddings) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    vectorStore = new PgVectorStoreAdapter({
      connectionString: process.env.DATABASE_URL,
      tableName: 'vector_chunks',
      dimensions: 1536,
    });

    lexicalStore = new PostgresLexicalAdapter({
      connectionString: process.env.DATABASE_URL,
      tableName: 'lexical_chunks',
    });

    embeddings = new OpenAIEmbeddingsAdapter({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    });
  }

  // Always create a new chunker with current settings
  chunker = new TextChunker({
    chunkSize,
    chunkOverlap,
  });
  
  return { vectorStore, lexicalStore, embeddings, chunker };
}

async function processBatch(chunks: any[], vectorStore: PgVectorStoreAdapter, lexicalStore: PostgresLexicalAdapter, embeddings: OpenAIEmbeddingsAdapter) {
  // Generate embeddings for the batch
  const embeddings_batch = await Promise.all(
    chunks.map(chunk => embeddings.embed(chunk.content))
  );

  // Add embeddings to chunks
  const chunksWithEmbeddings = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings_batch[index],
  }));

  // Store in both vector and lexical stores
  await Promise.all([
    vectorStore.upsert(chunksWithEmbeddings),
    lexicalStore.upsert(chunks),
  ]);

  return chunksWithEmbeddings.length;
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (stricter for ingest)
    const rateLimitResult = rateLimit(request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
        },
        { 
          status: 429,
          headers: rateLimitResult.headers,
        }
      );
    }

    const body = await request.json();
    const { documents, chunk_size, chunk_overlap, batch_size } = ingestSchema.parse(body);

    const { vectorStore, lexicalStore, embeddings, chunker } = initializeAdapters(chunk_size, chunk_overlap);

    let totalChunks = 0;
    const processedDocuments: any[] = [];

    // Process each document
    for (const document of documents) {
      const documentId = document.id || uuidv4();
      
      // Chunk the document
      const chunks = chunker.chunk(document.content);
      
      // Create chunk objects with metadata
      const chunkObjects = chunks.map((chunkContent, index) => ({
        id: `${documentId}-chunk-${index}`,
        content: chunkContent,
        metadata: {
          ...document.metadata,
          document_id: documentId,
          chunk_index: index,
          total_chunks: chunks.length,
          ingested_at: new Date().toISOString(),
        },
      }));

      // Process chunks in batches
      const batches = [];
      for (let i = 0; i < chunkObjects.length; i += batch_size) {
        batches.push(chunkObjects.slice(i, i + batch_size));
      }

      let documentChunkCount = 0;
      for (const batch of batches) {
        const batchCount = await processBatch(batch, vectorStore, lexicalStore, embeddings);
        documentChunkCount += batchCount;
        totalChunks += batchCount;
      }

      processedDocuments.push({
        id: documentId,
        original_content_length: document.content.length,
        chunks_created: documentChunkCount,
        metadata: document.metadata,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Documents ingested successfully',
      summary: {
        documents_processed: documents.length,
        total_chunks_created: totalChunks,
        chunk_settings: {
          chunk_size,
          chunk_overlap,
          batch_size,
        },
      },
      processed_documents: processedDocuments,
    });

  } catch (error) {
    console.error('Ingest API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { vectorStore, lexicalStore } = initializeAdapters(512, 100);

    // Get statistics from both stores
    const [vectorStats, lexicalStats] = await Promise.all([
      vectorStore.getStats?.() || { total: 'N/A' },
      lexicalStore.getStats?.() || { total: 'N/A' },
    ]);

    return NextResponse.json({
      success: true,
      statistics: {
        vector_store: vectorStats,
        lexical_store: lexicalStats,
        last_updated: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Ingest stats error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch ingestion statistics',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}