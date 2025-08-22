# Building Custom Adapters

Orquel's adapter system allows you to integrate any embedding model, vector database, or AI service. This guide shows you how to build custom adapters.

## Adapter Interfaces

### EmbeddingsAdapter

Convert text to vector embeddings:

```typescript
interface EmbeddingsAdapter {
  name: string;
  dim: number; // Vector dimension
  embed(texts: string[]): Promise<number[][]>;
}
```

Example implementation:

```typescript
import { EmbeddingsAdapter } from '@orquel/core';

export function customEmbeddings(): EmbeddingsAdapter {
  return {
    name: 'custom-embeddings',
    dim: 768,
    
    async embed(texts: string[]): Promise<number[][]> {
      // Your embedding logic here
      const embeddings = await yourEmbeddingService.embed(texts);
      return embeddings;
    }
  };
}
```

### VectorStoreAdapter

Store and search vector embeddings:

```typescript
interface VectorStoreAdapter {
  name: string;
  upsert(rows: Array<Chunk & { embedding: number[] }>): Promise<void>;
  searchByVector(query: number[], k: number): Promise<Array<{ chunk: Chunk; score: number }>>;
}
```

Example implementation:

```typescript
import { VectorStoreAdapter, Chunk } from '@orquel/core';

export function customVectorStore(): VectorStoreAdapter {
  return {
    name: 'custom-vector-store',
    
    async upsert(rows: Array<Chunk & { embedding: number[] }>) {
      // Store vectors in your database
      for (const row of rows) {
        await yourDatabase.upsert(row.id, row.embedding, row);
      }
    },
    
    async searchByVector(query: number[], k: number) {
      const results = await yourDatabase.search(query, k);
      return results.map(result => ({
        chunk: result.chunk,
        score: result.similarity
      }));
    }
  };
}
```

### LexicalAdapter

Traditional text-based search:

```typescript
interface LexicalAdapter {
  name: string;
  index(chunks: Chunk[]): Promise<void>;
  search(text: string, k: number): Promise<Array<{ chunk: Chunk; score: number }>>;
}
```

### RerankerAdapter

Improve search relevance:

```typescript
interface RerankerAdapter {
  name: string;
  rerank(query: string, passages: Chunk[]): Promise<number[]>; // Returns indices
}
```

### AnswerAdapter

Generate answers from context:

```typescript
interface AnswerAdapter {
  name: string;
  answer(args: { query: string; contexts: Chunk[] }): Promise<string>;
}
```

## Best Practices

### Error Handling

Always handle errors gracefully:

```typescript
export function robustEmbeddings(): EmbeddingsAdapter {
  return {
    name: 'robust-embeddings',
    dim: 768,
    
    async embed(texts: string[]): Promise<number[][]> {
      try {
        return await yourService.embed(texts);
      } catch (error) {
        throw new Error(`Embedding failed: ${error.message}`);
      }
    }
  };
}
```

### Batching

Process large inputs efficiently:

```typescript
export function batchedEmbeddings(options: { batchSize?: number } = {}): EmbeddingsAdapter {
  const { batchSize = 100 } = options;
  
  return {
    name: 'batched-embeddings',
    dim: 768,
    
    async embed(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await yourService.embed(batch);
        results.push(...batchResults);
      }
      
      return results;
    }
  };
}
```

### Configuration

Make adapters configurable:

```typescript
interface CustomAdapterOptions {
  apiKey?: string;
  model?: string;
  timeout?: number;
}

export function customAdapter(options: CustomAdapterOptions = {}): EmbeddingsAdapter {
  const {
    apiKey = process.env.CUSTOM_API_KEY,
    model = 'default-model',
    timeout = 30000
  } = options;
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  return {
    name: `custom-${model}`,
    dim: 768,
    
    async embed(texts: string[]): Promise<number[][]> {
      // Use configuration
      return await yourService.embed(texts, { model, timeout });
    }
  };
}
```

## Testing Adapters

Use the provided test utilities:

```typescript
import { testEmbeddingsAdapter } from '@orquel/testkit';

describe('Custom Embeddings', () => {
  it('should embed text correctly', async () => {
    const adapter = customEmbeddings();
    await testEmbeddingsAdapter(adapter);
  });
});
```

## Publishing Adapters

### Package Structure

```
my-orquel-adapter/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Package.json

```json
{
  "name": "@my-org/orquel-adapter-custom",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "keywords": ["orquel", "adapter", "custom"],
  "dependencies": {
    "@orquel/core": "^0.1.0"
  }
}
```

### Documentation

Include clear documentation:

```typescript
/**
 * Custom embeddings adapter for Orquel
 * 
 * @example
 * ```typescript
 * import { customEmbeddings } from '@my-org/orquel-adapter-custom';
 * 
 * const adapter = customEmbeddings({
 *   apiKey: 'your-key',
 *   model: 'custom-model'
 * });
 * ```
 */
export function customEmbeddings(options?: CustomAdapterOptions): EmbeddingsAdapter {
  // Implementation
}
```

## Example: Local ONNX Embeddings

Here's a complete example using ONNX.js for local embeddings:

```typescript
import { EmbeddingsAdapter } from '@orquel/core';
import * as ort from 'onnxruntime-node';

interface ONNXEmbeddingsOptions {
  modelPath: string;
  tokenizerPath: string;
}

export function onnxEmbeddings(options: ONNXEmbeddingsOptions): EmbeddingsAdapter {
  let session: ort.InferenceSession;
  let tokenizer: any;
  
  const initialize = async () => {
    if (!session) {
      session = await ort.InferenceSession.create(options.modelPath);
      tokenizer = await loadTokenizer(options.tokenizerPath);
    }
  };
  
  return {
    name: 'onnx-embeddings',
    dim: 384, // BGE-small dimension
    
    async embed(texts: string[]): Promise<number[][]> {
      await initialize();
      
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        // Tokenize
        const tokens = tokenizer.encode(text);
        const inputIds = new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length]);
        const attentionMask = new ort.Tensor('int64', new BigInt64Array(tokens.length).fill(1n), [1, tokens.length]);
        
        // Run inference
        const feeds = { input_ids: inputIds, attention_mask: attentionMask };
        const output = await session.run(feeds);
        
        // Extract embeddings (mean pooling)
        const lastHiddenState = output.last_hidden_state.data as Float32Array;
        const embedding = meanPooling(lastHiddenState, tokens.length);
        embeddings.push(Array.from(embedding));
      }
      
      return embeddings;
    }
  };
}

function meanPooling(hiddenState: Float32Array, seqLength: number): Float32Array {
  const dim = hiddenState.length / seqLength;
  const pooled = new Float32Array(dim);
  
  for (let i = 0; i < dim; i++) {
    let sum = 0;
    for (let j = 0; j < seqLength; j++) {
      sum += hiddenState[j * dim + i];
    }
    pooled[i] = sum / seqLength;
  }
  
  return pooled;
}
```

## Contributing

We welcome adapter contributions! Please:

1. Follow the interfaces exactly
2. Include comprehensive tests
3. Add clear documentation
4. Submit a PR with examples

Popular adapters may be included in the official Orquel organization.