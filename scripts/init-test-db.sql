-- Initialize test database with required extensions and permissions
-- This script runs automatically when the PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For similarity search
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- For composite indexes

-- Create test schemas
CREATE SCHEMA IF NOT EXISTS test_orquel;
CREATE SCHEMA IF NOT EXISTS integration_tests;

-- Grant permissions to test user
GRANT ALL PRIVILEGES ON DATABASE orquel_test TO test;
GRANT ALL PRIVILEGES ON SCHEMA test_orquel TO test;
GRANT ALL PRIVILEGES ON SCHEMA integration_tests TO test;
GRANT ALL PRIVILEGES ON SCHEMA public TO test;

-- Create a test data table for benchmarking
CREATE TABLE IF NOT EXISTS benchmark_chunks (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(384),  -- Smaller dimension for faster tests
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test data
INSERT INTO benchmark_chunks (content, embedding) VALUES 
('This is a sample text chunk for testing purposes.', array_fill(0.1, ARRAY[384])::vector),
('Another test chunk with different content for evaluation.', array_fill(0.2, ARRAY[384])::vector),
('Vector search testing requires diverse sample data.', array_fill(0.3, ARRAY[384])::vector);

-- Log successful initialization
INSERT INTO pg_stat_statements_info VALUES ('test_db_initialized', current_timestamp)
ON CONFLICT DO NOTHING;