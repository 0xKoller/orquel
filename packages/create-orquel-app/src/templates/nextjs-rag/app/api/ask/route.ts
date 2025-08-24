import { NextRequest, NextResponse } from 'next/server';
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';
import { OpenAIEmbeddingsAdapter } from '@orquel/embeddings-openai';
import { OpenAIAnswerAdapter } from '@orquel/answer-openai';
import { hybridSearch } from '@orquel/core';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const askSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  context_limit: z.number().min(1).max(20).default(5),
  dense_weight: z.number().min(0).max(1).default(0.7),
  lexical_weight: z.number().min(0).max(1).default(0.3),
  hybrid_method: z.enum(['rrf', 'weighted']).default('rrf'),
  stream: z.boolean().default(false),
  model: z.string().default('gpt-4o-mini'),
  system_prompt: z.string().optional(),
});

let vectorStore: PgVectorStoreAdapter | null = null;
let lexicalStore: PostgresLexicalAdapter | null = null;
let embeddings: OpenAIEmbeddingsAdapter | null = null;
let answerer: OpenAIAnswerAdapter | null = null;

function initializeAdapters() {
  if (!vectorStore || !lexicalStore || !embeddings || !answerer) {
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

    answerer = new OpenAIAnswerAdapter({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    });
  }
  
  return { vectorStore, lexicalStore, embeddings, answerer };
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
    const { 
      question, 
      context_limit, 
      dense_weight, 
      lexical_weight, 
      hybrid_method,
      stream,
      model,
      system_prompt,
    } = askSchema.parse(body);

    const { vectorStore, lexicalStore, embeddings, answerer } = initializeAdapters();

    // Generate query embedding
    const queryEmbedding = await embeddings.embed(question);

    // Perform hybrid search to get context
    const searchResults = await hybridSearch({
      query: question,
      queryEmbedding,
      vectorStore,
      lexicalStore,
      limit: context_limit,
      denseWeight: dense_weight,
      lexicalWeight: lexical_weight,
      method: hybrid_method,
    });

    // Prepare context from search results
    const context = searchResults
      .map((result, index) => `[${index + 1}] ${result.chunk.content}`)
      .join('\n\n');

    // Generate answer using the context
    const defaultSystemPrompt = `You are a helpful AI assistant. Answer the user's question based on the provided context. If the context doesn't contain enough information to answer the question, say so clearly. Be accurate and concise.

Context:
${context}`;

    const finalSystemPrompt = system_prompt || defaultSystemPrompt;

    if (stream) {
      // For streaming responses
      const stream = await answerer.streamAnswer({
        question,
        context,
        systemPrompt: finalSystemPrompt,
        model,
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // For non-streaming responses
      const answer = await answerer.answer({
        question,
        context,
        systemPrompt: finalSystemPrompt,
        model,
      });

      return NextResponse.json({
        success: true,
        answer,
        question,
        context_used: searchResults.map(result => ({
          id: result.chunk.id,
          content: result.chunk.content.substring(0, 200) + '...',
          score: result.score,
          source: result.source,
        })),
        search_params: {
          context_limit,
          dense_weight,
          lexical_weight,
          hybrid_method,
        },
      });
    }

  } catch (error) {
    console.error('Ask API error:', error);
    
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