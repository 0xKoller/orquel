-- Migration: 001_initial_schema.sql
-- Description: Create initial schema for Orquel pgvector storage
-- Created: 2024-01-24

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chunks table
CREATE TABLE IF NOT EXISTS orquel_chunks (
    id TEXT PRIMARY KEY,
    source_title TEXT NOT NULL,
    source_kind TEXT,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536), -- Default to OpenAI text-embedding-3-small dimensions
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS orquel_chunks_source_title_idx ON orquel_chunks(source_title);
CREATE INDEX IF NOT EXISTS orquel_chunks_source_kind_idx ON orquel_chunks(source_kind);
CREATE INDEX IF NOT EXISTS orquel_chunks_content_hash_idx ON orquel_chunks(content_hash);
CREATE INDEX IF NOT EXISTS orquel_chunks_created_at_idx ON orquel_chunks(created_at);

-- Create vector similarity index (IVFFlat)
CREATE INDEX IF NOT EXISTS orquel_chunks_embedding_ivfflat_idx 
ON orquel_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_orquel_chunks_updated_at ON orquel_chunks;
CREATE TRIGGER update_orquel_chunks_updated_at
    BEFORE UPDATE ON orquel_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();