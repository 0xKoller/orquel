# Orquel Design Document

This document explains the architectural decisions, design principles, and implementation details of Orquel.

## Design Principles

### 1. Small Core, Strong Interfaces

Orquel's core is minimal and focused on orchestration. All domain-specific functionality is implemented through well-defined adapter interfaces.

**Benefits:**
- Easy to test and maintain
- Clear separation of concerns
- Flexible and extensible

### 2. Adapter-Driven Architecture

Every major component (embeddings, vector stores, rerankers, answerers) is swappable through adapters.

```typescript
// Swap from development to production with one line
const vector = isDevelopment ? memoryStore() : pgvectorStore();
```

### 3. TypeScript-First

Strict typing throughout ensures excellent developer experience and catches errors at compile time.

### 4. Composability Over Configuration

Prefer explicit composition over implicit configuration files.

```typescript
// Explicit and clear
const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: pgvectorStore(),
  lexical: postgresLexical(),
  reranker: cohereReranker(),
});
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                    │
├─────────────────────────────────────────────────────────┤
│                  Orquel Orchestrator                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   Ingest    │ │    Index    │ │    Query    │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
├─────────────────────────────────────────────────────────┤
│                    Adapter Layer                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │  Embeddings  │ │ Vector Store │ │   Answerer   │     │
│ │   Adapter    │ │   Adapter    │ │   Adapter    │     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
├─────────────────────────────────────────────────────────┤
│                 Implementation Layer                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │   OpenAI     │ │   pgvector   │ │   OpenAI     │     │
│ │  Embeddings  │ │    Store     │ │   Answerer   │     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Core Workflows

### 1. Ingestion and Chunking

**Goal:** Convert documents into searchable chunks

```typescript
const { chunks } = await orq.ingest({
  source: { title: 'Doc', kind: 'md' },
  content: markdownContent
});
```

**Process:**
1. Normalize text (whitespace, encoding)
2. Apply chunking strategy (size-based, heading-aware)
3. Generate unique IDs and metadata
4. Deduplicate by content hash

**Chunking Strategy:**
- Default: 1200 characters with 150 character overlap
- Markdown-aware: Split on headings first, then by size
- UTF-8 safe: Never split in the middle of multi-byte characters

### 2. Indexing

**Goal:** Make chunks searchable

```typescript
await orq.index(chunks);
```

**Process:**
1. Generate embeddings for all chunks
2. Store in vector database
3. Optionally index in lexical search engine
4. Handle failures gracefully (retry, partial success)

### 3. Retrieval

**Goal:** Find relevant chunks for a query

```typescript
const { results } = await orq.query('question', { 
  k: 10, 
  hybrid: true, 
  rerank: true 
});
```

**Dense Retrieval:**
- Embed query using same model as corpus
- Cosine similarity search in vector space
- Return top-k most similar chunks

**Lexical Retrieval:**
- Traditional keyword-based search
- TF-IDF, BM25, or PostgreSQL full-text search
- Language-specific stemming and stop words

**Hybrid Merge:**
- Normalize scores to [0, 1] range
- Weighted combination: 65% dense + 35% lexical
- Re-rank by combined score

**Reranking:**
- Take top-K from initial retrieval
- Use cross-encoder model for better relevance
- Cohere Rerank or local BGE models

### 4. Answer Generation

**Goal:** Generate contextual answers with citations

```typescript
const { answer, contexts } = await orq.answer('question');
```

**Process:**
1. Retrieve relevant contexts
2. Format as prompt with question
3. Generate answer using LLM
4. Return answer with source contexts

## Hybrid Search Mathematics

### Score Normalization

Convert raw scores to [0, 1] range:

```
normalized_score = (score - min_score) / (max_score - min_score)
```

### Weighted Combination

Combine dense and lexical scores:

```
final_score = (dense_score * 0.65) + (lexical_score * 0.35)
```

These weights can be tuned based on your data and use case.

## Error Handling Strategy

### Graceful Degradation

```typescript
// If reranker fails, continue without reranking
try {
  rerankedResults = await reranker.rerank(query, results);
} catch (error) {
  console.warn('Reranker failed, using original results:', error);
  rerankedResults = results;
}
```

### Retry Logic

```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

### Partial Failures

```typescript
// Continue indexing even if some chunks fail
const results = await Promise.allSettled(
  chunks.map(chunk => embedAndStore(chunk))
);

const succeeded = results.filter(r => r.status === 'fulfilled').length;
const failed = results.filter(r => r.status === 'rejected').length;

console.log(`Indexed ${succeeded}/${chunks.length} chunks (${failed} failed)`);
```

## Performance Considerations

### Embedding Batching

```typescript
// Process embeddings in batches to avoid rate limits
for (let i = 0; i < texts.length; i += batchSize) {
  const batch = texts.slice(i, i + batchSize);
  const embeddings = await embeddingsAdapter.embed(batch);
  results.push(...embeddings);
}
```

### Connection Pooling

Vector stores should use connection pooling for production workloads:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
});
```

### Caching

Consider caching for expensive operations:

```typescript
const embeddingCache = new Map<string, number[]>();

async function cachedEmbed(text: string): Promise<number[]> {
  const key = createHash('sha256').update(text).digest('hex');
  
  if (embeddingCache.has(key)) {
    return embeddingCache.get(key)!;
  }
  
  const [embedding] = await embeddings.embed([text]);
  embeddingCache.set(key, embedding);
  return embedding;
}
```

## Security Considerations

### Input Validation

```typescript
function validateChunk(chunk: Chunk): void {
  if (!chunk.id || typeof chunk.id !== 'string') {
    throw new Error('Invalid chunk ID');
  }
  
  if (!chunk.text || typeof chunk.text !== 'string') {
    throw new Error('Invalid chunk text');
  }
  
  if (chunk.text.length > MAX_CHUNK_SIZE) {
    throw new Error('Chunk too large');
  }
}
```

### SQL Injection Prevention

Use parameterized queries in vector store adapters:

```typescript
// Good
await client.query(
  'SELECT * FROM chunks WHERE id = $1',
  [chunkId]
);

// Bad - vulnerable to injection
await client.query(
  `SELECT * FROM chunks WHERE id = '${chunkId}'`
);
```

### API Key Protection

Never log or expose API keys:

```typescript
function sanitizeConfig(config: any): any {
  const sanitized = { ...config };
  if (sanitized.apiKey) {
    sanitized.apiKey = '[REDACTED]';
  }
  return sanitized;
}
```

## Future Considerations

### Multi-Modal Support

The adapter pattern naturally extends to multi-modal content:

```typescript
interface MultiModalEmbeddingsAdapter {
  name: string;
  embedText(text: string): Promise<number[]>;
  embedImage(image: Buffer): Promise<number[]>;
  embedAudio(audio: Buffer): Promise<number[]>;
}
```

### Streaming

Support for streaming responses:

```typescript
interface StreamingAnswerAdapter {
  answerStream(args: AnswerArgs): AsyncGenerator<string, void, unknown>;
}
```

### Federation

Multiple vector stores for different content types:

```typescript
const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: federatedStore({
    documents: pgvectorStore(),
    code: qdrantStore(),
    images: pineconeStore(),
  }),
});
```

This design enables Orquel to grow and adapt while maintaining simplicity and performance.