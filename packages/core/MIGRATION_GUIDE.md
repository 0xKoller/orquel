# Orquel v0.2.0 Migration Guide

This guide helps you migrate from Orquel v0.1.x to v0.2.0, which introduces PostgreSQL + pgvector as the production storage backend alongside comprehensive hybrid search capabilities.

## Overview of Changes

### New in v0.2.0
- **PostgreSQL + pgvector adapter** for production-grade vector storage
- **PostgreSQL lexical search adapter** using full-text search (tsvector)
- **Hybrid search algorithms** (Reciprocal Rank Fusion, weighted combination)
- **Performance benchmarking suite** for adapter comparison
- **Next.js template** for production RAG applications
- **Enhanced testing infrastructure** with Docker containers

### Breaking Changes
- Adapter initialization patterns updated for better performance
- Search result format now includes `source` field (`vector`, `lexical`, `hybrid`)
- Configuration options expanded for hybrid search weighting

## Migration Steps

### 1. Update Dependencies

```bash
# Update to v0.2.0
npm install @orquel/core@^0.2.0

# Add new PostgreSQL adapters
npm install @orquel/store-pgvector@^0.2.0
npm install @orquel/lexical-postgres@^0.2.0

# If using in-memory adapters (still supported)
npm install @orquel/store-memory@^0.2.0
npm install @orquel/lexical-memory@^0.2.0
```

### 2. Database Setup (PostgreSQL)

#### Install PostgreSQL with pgvector

**Using Docker (Recommended):**
```bash
# Use the official pgvector image
docker run -d \
  --name orquel-postgres \
  -e POSTGRES_DB=orquel \
  -e POSTGRES_USER=orquel \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  pgvector/pgvector:pg15
```

**Manual Installation:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-15 postgresql-15-pgvector

# macOS with Homebrew
brew install postgresql pgvector

# Start PostgreSQL and enable extension
psql -c "CREATE EXTENSION vector;"
```

#### Initialize Database Schema

```javascript
// scripts/setup-database.js
const { PgVectorStoreAdapter } = require('@orquel/store-pgvector');
const { PostgresLexicalAdapter } = require('@orquel/lexical-postgres');

async function setupDatabase() {
  const vectorStore = new PgVectorStoreAdapter({
    connectionString: process.env.DATABASE_URL,
    tableName: 'vector_chunks',
    dimensions: 1536, // Match your embedding model
  });

  const lexicalStore = new PostgresLexicalAdapter({
    connectionString: process.env.DATABASE_URL,
    tableName: 'lexical_chunks',
  });

  // Initialize tables and indexes
  await vectorStore.init();
  await lexicalStore.init();
  
  console.log('Database setup complete');
}

setupDatabase();
```

### 3. Update Code

#### Before (v0.1.x)
```typescript
import { Orquel } from '@orquel/core';
import { MemoryVectorStore } from '@orquel/store-memory';
import { OpenAIEmbeddings } from '@orquel/embeddings-openai';

const orquel = new Orquel({
  vectorStore: new MemoryVectorStore(),
  embeddings: new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
});

// Simple search
const results = await orquel.search('machine learning', { limit: 5 });
```

#### After (v0.2.0)
```typescript
import { hybridSearch } from '@orquel/core';
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';
import { OpenAIEmbeddingsAdapter } from '@orquel/embeddings-openai';

// Initialize adapters
const vectorStore = new PgVectorStoreAdapter({
  connectionString: process.env.DATABASE_URL,
  tableName: 'vector_chunks',
  dimensions: 1536,
});

const lexicalStore = new PostgresLexicalAdapter({
  connectionString: process.env.DATABASE_URL,
  tableName: 'lexical_chunks',
});

const embeddings = new OpenAIEmbeddingsAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

// Hybrid search with enhanced results
const queryEmbedding = await embeddings.embed('machine learning');
const results = await hybridSearch({
  query: 'machine learning',
  queryEmbedding,
  vectorStore,
  lexicalStore,
  limit: 5,
  denseWeight: 0.7,    // Vector search weight
  lexicalWeight: 0.3,  // Full-text search weight
  method: 'rrf',       // Reciprocal Rank Fusion
});

// Results now include source information
results.forEach(result => {
  console.log(`Score: ${result.score}, Source: ${result.source}`);
  console.log(`Content: ${result.chunk.content}`);
});
```

### 4. Configuration Updates

#### Environment Variables
```bash
# v0.1.x
OPENAI_API_KEY=your_key

# v0.2.0 (additional)
DATABASE_URL=postgresql://user:password@localhost:5432/orquel
DENSE_WEIGHT=0.7
LEXICAL_WEIGHT=0.3
HYBRID_METHOD=rrf
```

#### Search Configuration
```typescript
// v0.2.0 hybrid search options
const searchConfig = {
  denseWeight: 0.7,      // Vector similarity weight (0-1)
  lexicalWeight: 0.3,    // Full-text search weight (0-1)
  method: 'rrf',         // 'rrf' or 'weighted'
  k: 60,                 // RRF parameter (when method='rrf')
};
```

### 5. Performance Optimizations

#### Connection Pooling
```typescript
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';

const vectorStore = new PgVectorStoreAdapter({
  connectionString: process.env.DATABASE_URL,
  tableName: 'vector_chunks',
  dimensions: 1536,
  poolConfig: {
    max: 20,              // Maximum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
```

#### Indexing Strategy
```sql
-- Optimize for vector similarity search
CREATE INDEX CONCURRENTLY vector_chunks_embedding_idx 
ON vector_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Optimize for full-text search
CREATE INDEX CONCURRENTLY lexical_chunks_search_vector_idx 
ON lexical_chunks USING gin(search_vector);

-- Metadata queries
CREATE INDEX CONCURRENTLY vector_chunks_metadata_idx 
ON vector_chunks USING gin(metadata);
```

## Common Migration Issues

### 1. Embedding Dimension Mismatch
```typescript
// Error: Embedding dimension mismatch
// Solution: Ensure dimensions match your model

const vectorStore = new PgVectorStoreAdapter({
  dimensions: 1536, // text-embedding-3-small
  // dimensions: 3072, // text-embedding-3-large
});
```

### 2. Connection String Format
```bash
# Incorrect
DATABASE_URL=postgres://localhost:5432/orquel

# Correct
DATABASE_URL=postgresql://user:password@localhost:5432/orquel
```

### 3. Missing pgvector Extension
```sql
-- Run this in your PostgreSQL database
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 4. Memory Usage with Large Datasets
```typescript
// Use batch processing for large ingestion
const batchSize = 100;
const chunks = [...]; // Your document chunks

for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  await vectorStore.upsert(batch);
  await lexicalStore.upsert(batch);
  
  // Optional: Add delay to prevent overwhelming the database
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

## Testing Your Migration

### 1. Benchmark Performance
```typescript
import { benchmarkVectorStore } from '@orquel/core';

const results = await benchmarkVectorStore(vectorStore, {
  chunkCount: 1000,
  queryCount: 100,
  dimensions: 1536,
});

console.log(`Average query time: ${results.averageQueryTime}ms`);
console.log(`Throughput: ${results.queriesPerSecond} QPS`);
```

### 2. Validate Search Quality
```typescript
// Compare hybrid vs individual search methods
const testQuery = 'artificial intelligence applications';
const queryEmbedding = await embeddings.embed(testQuery);

const vectorResults = await vectorStore.search(queryEmbedding, 5);
const lexicalResults = await lexicalStore.search(testQuery, 5);
const hybridResults = await hybridSearch({
  query: testQuery,
  queryEmbedding,
  vectorStore,
  lexicalStore,
  limit: 5,
  method: 'rrf',
});

console.log('Vector only:', vectorResults.length);
console.log('Lexical only:', lexicalResults.length);
console.log('Hybrid:', hybridResults.length);
```

### 3. Load Testing
```bash
# Use the included Next.js template for load testing
cd packages/create-orquel-app/templates/nextjs-rag
npm install
npm run docker:dev
npm run db:setup

# Test API endpoints
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "limit": 10}'
```

## Rollback Plan

If you need to rollback to v0.1.x:

1. **Backup your data** before migration
2. **Keep v0.1.x dependencies** available:
```bash
npm install @orquel/core@^0.1.0 --save-exact
```

3. **Export data from PostgreSQL**:
```typescript
// Export script
const chunks = await vectorStore.getAllChunks();
const backup = JSON.stringify(chunks, null, 2);
fs.writeFileSync('orquel-backup.json', backup);
```

4. **Restore to memory store**:
```typescript
const backup = JSON.parse(fs.readFileSync('orquel-backup.json', 'utf8'));
const memoryStore = new MemoryVectorStore();
await memoryStore.upsert(backup);
```

## Support

- **GitHub Issues**: [Report migration issues](https://github.com/orquel/orquel/issues)
- **Documentation**: [Full v0.2.0 docs](https://orquel.dev/docs/v0.2.0)
- **Community**: [Discord server](https://discord.gg/orquel)

---

For additional help with specific migration scenarios, please check our [troubleshooting guide](./TROUBLESHOOTING.md) or reach out to the community.