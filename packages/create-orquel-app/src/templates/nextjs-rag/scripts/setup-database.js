#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Enable pgvector extension
    console.log('Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // Create vector chunks table
    console.log('Creating vector_chunks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vector_chunks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create lexical chunks table
    console.log('Creating lexical_chunks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lexical_chunks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes for better performance
    console.log('Creating performance indexes...');
    
    // Vector similarity search index (HNSW)
    await client.query(`
      CREATE INDEX IF NOT EXISTS vector_chunks_embedding_idx 
      ON vector_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);

    // Full-text search indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS lexical_chunks_search_vector_idx 
      ON lexical_chunks USING gin(search_vector);
    `);

    // Metadata indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS vector_chunks_metadata_idx 
      ON vector_chunks USING gin(metadata);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS lexical_chunks_metadata_idx 
      ON lexical_chunks USING gin(metadata);
    `);

    // Timestamp indexes for cleanup/maintenance
    await client.query(`
      CREATE INDEX IF NOT EXISTS vector_chunks_created_at_idx 
      ON vector_chunks(created_at);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS lexical_chunks_created_at_idx 
      ON lexical_chunks(created_at);
    `);

    // Create updated_at trigger for vector_chunks
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_vector_chunks_updated_at ON vector_chunks;
    `);

    await client.query(`
      CREATE TRIGGER update_vector_chunks_updated_at 
      BEFORE UPDATE ON vector_chunks 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_lexical_chunks_updated_at ON lexical_chunks;
    `);

    await client.query(`
      CREATE TRIGGER update_lexical_chunks_updated_at 
      BEFORE UPDATE ON lexical_chunks 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Database setup completed successfully!');
    
    // Print some stats
    const vectorCount = await client.query('SELECT COUNT(*) FROM vector_chunks');
    const lexicalCount = await client.query('SELECT COUNT(*) FROM lexical_chunks');
    
    console.log(`📊 Current database stats:`);
    console.log(`   Vector chunks: ${vectorCount.rows[0].count}`);
    console.log(`   Lexical chunks: ${lexicalCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Please add DATABASE_URL to your .env file');
  process.exit(1);
}

setupDatabase();