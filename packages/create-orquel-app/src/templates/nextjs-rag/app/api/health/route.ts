import { NextResponse } from 'next/server';
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';

export async function GET() {
  try {
    const checks = {
      database: false,
      vector_store: false,
      lexical_store: false,
      openai: false,
    };

    // Check database connection
    if (process.env.DATABASE_URL) {
      try {
        const vectorStore = new PgVectorStoreAdapter({
          connectionString: process.env.DATABASE_URL,
          tableName: 'vector_chunks',
          dimensions: 1536,
        });
        
        // Test connection by attempting to initialize
        await vectorStore.init?.();
        checks.database = true;
        checks.vector_store = true;
        
        const lexicalStore = new PostgresLexicalAdapter({
          connectionString: process.env.DATABASE_URL,
          tableName: 'lexical_chunks',
        });
        
        await lexicalStore.init?.();
        checks.lexical_store = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }
    }

    // Check OpenAI API key presence
    checks.openai = !!process.env.OPENAI_API_KEY;

    const allHealthy = Object.values(checks).every(check => check);
    const status = allHealthy ? 200 : 503;

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
    }, { status });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    }, { status: 500 });
  }
}