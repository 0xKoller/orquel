# Getting Started with Orquel

Orquel is a TypeScript-first, open-source toolkit for building knowledge bases and retrieval-augmented generation (RAG) systems. This guide will help you get up and running quickly.

## Installation

### Option 1: Add to Existing Project

```bash
npm install orquel
npx orquel setup
```

The setup wizard will guide you through selecting and installing the right adapters for your needs.

### Option 2: Create New Project

```bash
npx create-orquel-app@latest my-rag-app
cd my-rag-app
npm run dev
```

## Quick Example

```typescript
import { createOrquel } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { memoryStore } from '@orquel/store-memory';
import { openAIAnswerer } from '@orquel/answer-openai';

// Create Orquel instance
const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
});

async function main() {
  // Ingest a document
  const { chunks } = await orq.ingest({
    source: { title: 'My Document' },
    content: '# Hello World\nThis is my first Orquel document.'
  });

  // Index the chunks
  await orq.index(chunks);

  // Ask a question
  const { answer } = await orq.answer('What is this document about?');
  console.log(answer);
}
```

## Core Concepts

### Adapters

Orquel uses an adapter pattern for maximum flexibility:

- **Embeddings**: Convert text to vector representations (OpenAI, local models)
- **Vector Stores**: Store and search embeddings (Memory, pgvector, Qdrant)
- **Lexical Search**: Traditional text search (PostgreSQL FTS, Typesense)
- **Rerankers**: Improve search relevance (Cohere, BGE)
- **Answerers**: Generate responses (OpenAI GPT, local LLMs)

### Workflow

1. **Ingest**: Parse and chunk your documents
2. **Index**: Create embeddings and store in vector database
3. **Query**: Search for relevant content
4. **Answer**: Generate responses with citations

## Environment Setup

Most adapters require API keys or connection strings:

```bash
# OpenAI (for embeddings and answering)
OPENAI_API_KEY=your_key_here

# Database connections (if using pgvector)
DATABASE_URL=postgresql://user:pass@localhost/db

# Vector databases (if using Qdrant)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_key_here
```

## Available Adapters

### Embeddings
- `@orquel/embeddings-openai` - OpenAI text embeddings

### Vector Stores
- `@orquel/store-memory` - In-memory storage (development)
- `@orquel/store-pgvector` - PostgreSQL with pgvector extension
- `@orquel/store-qdrant` - Qdrant vector database

### Answerers
- `@orquel/answer-openai` - OpenAI GPT models

## Production Considerations

### Vector Stores

For production workloads, use a persistent vector store:

```typescript
// PostgreSQL with pgvector
import { pgvectorStore } from '@orquel/store-pgvector';

const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: pgvectorStore({
    connectionString: process.env.DATABASE_URL
  }),
  answerer: openAIAnswerer(),
});
```

### Hybrid Search

Combine dense and lexical search for better results:

```typescript
import { postgresLexical } from '@orquel/lexical-postgres';

const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: pgvectorStore({ connectionString: process.env.DATABASE_URL }),
  lexical: postgresLexical({ connectionString: process.env.DATABASE_URL }),
  answerer: openAIAnswerer(),
});

// Enable hybrid search
const { results } = await orq.query('my question', { hybrid: true });
```

### Reranking

Improve search quality with reranking:

```typescript
import { cohereReranker } from '@orquel/rerank-cohere';

const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: pgvectorStore({ connectionString: process.env.DATABASE_URL }),
  reranker: cohereReranker({ apiKey: process.env.COHERE_API_KEY }),
  answerer: openAIAnswerer(),
});

// Enable reranking
const { results } = await orq.query('my question', { rerank: true });
```

## Next Steps

- Check out the [examples](../examples/) for complete working applications
- Read the [adapter development guide](./adapters.md) to build custom adapters
- Explore the [design document](./design.md) for architectural details
- Join our community for support and updates