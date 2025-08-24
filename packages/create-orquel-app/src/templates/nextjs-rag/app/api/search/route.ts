import { NextRequest, NextResponse } from 'next/server';
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';
import { OpenAIEmbeddingsAdapter } from '@orquel/embeddings-openai';
import { hybridSearch } from '@orquel/core';
import { rateLimit, RateLimitError } from '@/lib/rate-limit';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().min(1).max(50).default(10),
  dense_weight: z.number().min(0).max(1).default(0.7),
  lexical_weight: z.number().min(0).max(1).default(0.3),
  hybrid_method: z.enum(['rrf', 'weighted']).default('rrf'),
});

let vectorStore: PgVectorStoreAdapter | null = null;
let lexicalStore: PostgresLexicalAdapter | null = null;
let embeddings: OpenAIEmbeddingsAdapter | null = null;

function initializeAdapters() {
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
  
  return { vectorStore, lexicalStore, embeddings };
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
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
    const { query, limit, dense_weight, lexical_weight, hybrid_method } = searchSchema.parse(body);

    const { vectorStore, lexicalStore, embeddings } = initializeAdapters();

    // Generate query embedding
    const queryEmbedding = await embeddings.embed(query);

    // Perform hybrid search
    const results = await hybridSearch({
      query,
      queryEmbedding,
      vectorStore,
      lexicalStore,
      limit,
      denseWeight: dense_weight,
      lexicalWeight: lexical_weight,
      method: hybrid_method,
    });

    return NextResponse.json({
      success: true,
      results: results.map(result => ({
        id: result.chunk.id,
        content: result.chunk.content,
        metadata: result.chunk.metadata,
        score: result.score,
        source: result.source,
      })),
      query,
      total_results: results.length,
      search_params: {
        limit,
        dense_weight,
        lexical_weight,
        hybrid_method,
      },
    }, {
      headers: rateLimitResult.headers,
    });

  } catch (error) {
    console.error('Search API error:', error);
    
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