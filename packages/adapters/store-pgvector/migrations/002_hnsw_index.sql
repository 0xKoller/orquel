-- Migration: 002_hnsw_index.sql
-- Description: Add HNSW index option for better performance on large datasets
-- Created: 2024-01-24
-- Note: Requires PostgreSQL 14+ and pgvector 0.5.0+

-- Create HNSW index (alternative to IVFFlat for better accuracy)
-- Uncomment the following line if you want to use HNSW instead of IVFFlat:
-- CREATE INDEX IF NOT EXISTS orquel_chunks_embedding_hnsw_idx 
-- ON orquel_chunks USING hnsw (embedding vector_cosine_ops)
-- WITH (ef_construction = 200, m = 16);

-- Note: HNSW provides better recall but uses more memory
-- Use HNSW for datasets < 1M vectors, IVFFlat for larger datasets