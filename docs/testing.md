# Testing Guide

Orquel employs a comprehensive testing strategy to ensure reliability, performance, and maintainability across all components. This guide covers testing methodologies, patterns, and best practices.

## Overview

Orquel's testing architecture includes:

- **Unit Tests**: Core functionality and adapters (76 tests total)
- **Integration Tests**: End-to-end workflows with real and mock adapters  
- **Evaluation Tests**: RAG system performance measurement
- **Example Validation**: CI/CD checks to prevent API drift
- **Performance Tests**: Benchmarking and regression detection

## Test Structure

```
packages/
├── core/src/
│   ├── orquel.test.ts        # Main orchestrator tests
│   ├── chunker.test.ts       # Text chunking tests  
│   ├── utils.test.ts         # Utility function tests
│   └── evaluation.test.ts    # RAG evaluation tests
├── adapters/
│   ├── store-memory/src/index.test.ts      # Memory store tests
│   ├── embeddings-openai/src/index.test.ts # OpenAI embeddings tests
│   └── answer-openai/src/index.test.ts     # OpenAI answer tests
└── examples/                 # Example validation tests
```

## Running Tests

### All Tests
```bash
# Run all tests across packages
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test --watch
```

### Package-Specific Tests
```bash
# Core package only
cd packages/core && pnpm test

# Specific adapter
cd packages/adapters/store-memory && pnpm test

# Examples validation
pnpm validate-examples
```

### Test Categories
```bash
# Unit tests only
pnpm test --testNamePattern="unit"

# Integration tests only  
pnpm test --testNamePattern="integration"

# Evaluation tests only
pnpm test --testNamePattern="evaluation"
```

## Testing Patterns

### 1. Mock Adapters

For testing without external dependencies:

```typescript
import { vi } from 'vitest';
import type { EmbeddingsAdapter, VectorStoreAdapter } from '@orquel/core';

// Mock embeddings adapter
const createMockEmbeddings = (): EmbeddingsAdapter => ({
  name: 'mock-embeddings',
  dim: 384,
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]),
});

// Mock vector store adapter
const createMockVectorStore = (): VectorStoreAdapter => ({
  name: 'mock-vector-store',
  upsert: vi.fn().mockResolvedValue(undefined),
  searchByVector: vi.fn().mockResolvedValue([
    {
      chunk: {
        id: 'test-chunk',
        text: 'Test content',
        metadata: {
          source: { title: 'Test Document' },
          chunkIndex: 0,
          hash: 'abc123',
        },
      },
      score: 0.9,
    },
  ]),
});
```

### 2. Integration Testing

Testing complete workflows with real adapters:

```typescript
import { createOrquel } from '@orquel/core';
import { memoryStore } from '@orquel/store-memory';

describe('Integration Tests', () => {
  it('should complete full RAG workflow', async () => {
    const orq = createOrquel({
      embeddings: createMockEmbeddings(),
      vector: memoryStore(), // Real memory store
    });

    // Ingest document
    const { chunks } = await orq.ingest({
      source: { title: 'Integration Test' },
      content: '# Test Document\nThis is test content.',
    });

    // Index chunks
    await orq.index(chunks);

    // Query
    const { results } = await orq.query('test content');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.text).toContain('test content');
  });
});
```

### 3. Evaluation Testing

Testing RAG system performance:

```typescript
import { RAGEvaluator } from '@orquel/core';

describe('RAG Evaluation', () => {
  it('should evaluate system performance', async () => {
    const evaluator = new RAGEvaluator(orq);
    
    const groundTruth = [{
      query: 'What is Argentina?',
      relevantChunkIds: ['geography-argentina-1'],
      expectedAnswer: 'Argentina is a country in South America',
    }];

    const metrics = await evaluator.evaluate(groundTruth);
    
    expect(metrics.precision).toBeGreaterThanOrEqual(0);
    expect(metrics.recall).toBeGreaterThanOrEqual(0);
    expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
  });
});
```

### 4. Error Handling Tests

Testing graceful failure scenarios:

```typescript
describe('Error Handling', () => {
  it('should handle API failures gracefully', async () => {
    const failingEmbeddings = {
      name: 'failing-embeddings',
      dim: 384,
      embed: vi.fn().mockRejectedValue(new Error('API Error')),
    };

    const orq = createOrquel({
      embeddings: failingEmbeddings,
      vector: memoryStore(),
    });

    await expect(orq.query('test')).rejects.toThrow('API Error');
  });

  it('should provide helpful error messages', async () => {
    const orq = createOrquel({
      embeddings: createMockEmbeddings(),
      vector: memoryStore(),
    });

    // Test without answerer
    await expect(orq.answer('test')).rejects.toThrow('No answerer configured');
  });
});
```

## Best Practices

### 1. Test Organization

```typescript
describe('ComponentName', () => {
  describe('method/feature group', () => {
    it('should perform specific behavior', () => {
      // Test implementation
    });
  });

  describe('error scenarios', () => {
    it('should handle specific error case', () => {
      // Error test
    });
  });

  describe('edge cases', () => {
    it('should handle boundary conditions', () => {
      // Edge case test
    });
  });
});
```

### 2. Async Testing

```typescript
// ✅ Good: Proper async/await
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

// ✅ Good: Testing promises
it('should reject with error', async () => {
  await expect(failingFunction()).rejects.toThrow('Expected error');
});

// ❌ Bad: Missing await
it('should handle async operations', () => {
  const result = asyncFunction(); // Returns Promise, not result
  expect(result).toBe('expected'); // Will fail
});
```

### 3. Mock Management

```typescript
describe('Component with mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clear mock call history
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore original implementations
  });

  it('should use mocks correctly', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    // Use mock
    const result = await mockFn();
    
    // Verify mock was called
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result).toBe('result');
  });
});
```

### 4. Data Management

```typescript
// ✅ Good: Fresh data for each test
beforeEach(() => {
  testData = createFreshTestData();
});

// ✅ Good: Isolated test state
it('should not affect other tests', () => {
  const localData = { ...testData };
  localData.modified = true;
  // Test with local data
});

// ❌ Bad: Shared mutable state
let sharedData = { count: 0 };

it('first test', () => {
  sharedData.count++; // Affects other tests
});
```

## Advanced Testing Techniques

### 1. Property-Based Testing

```typescript
import { fc } from 'fast-check';

it('should handle arbitrary chunk sizes', () => {
  fc.assert(fc.property(
    fc.integer({ min: 100, max: 2000 }), // Chunk size
    fc.string({ minLength: 1000 }), // Content
    (chunkSize, content) => {
      const chunks = defaultChunker(content, source, { maxChunkSize: chunkSize });
      
      // Properties that should always hold
      expect(chunks.every(chunk => chunk.text.length <= chunkSize)).toBe(true);
      expect(chunks.every(chunk => chunk.id)).toBeDefined();
      expect(chunks.every(chunk => chunk.metadata)).toBeDefined();
    }
  ));
});
```

### 2. Snapshot Testing

```typescript
it('should generate consistent chunk structure', () => {
  const chunks = defaultChunker(sampleContent, source);
  
  // Remove dynamic fields for snapshot consistency
  const snapshot = chunks.map(chunk => ({
    ...chunk,
    id: chunk.id.replace(/hash-[a-f0-9]+/, 'hash-DYNAMIC'),
    metadata: {
      ...chunk.metadata,
      hash: 'DYNAMIC_HASH',
    },
  }));
  
  expect(snapshot).toMatchSnapshot();
});
```

### 3. Performance Testing

```typescript
it('should complete within performance bounds', async () => {
  const startTime = performance.now();
  
  await performanceIntensiveOperation();
  
  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(1000); // Should complete within 1 second
});

it('should handle large datasets efficiently', async () => {
  const largeDataset = generateLargeDataset(10000);
  
  const startTime = performance.now();
  const result = await processDataset(largeDataset);
  const duration = performance.now() - startTime;
  
  expect(result).toBeDefined();
  expect(duration).toBeLessThan(5000); // Should process 10k items in <5s
});
```

## Test Data Strategies

### 1. Fixture Data

```typescript
// test-fixtures.ts
export const sampleChunks = [
  {
    id: 'geography-argentina-1',
    text: 'Argentina is a country in South America.',
    metadata: {
      source: { title: 'Geography of Argentina' },
      chunkIndex: 0,
      hash: 'abc123',
    },
  },
  // More fixtures...
];

export const sampleGroundTruth = [
  {
    query: 'What is Argentina?',
    relevantChunkIds: ['geography-argentina-1'],
    expectedAnswer: 'Argentina is a country in South America',
  },
  // More ground truth...
];
```

### 2. Factory Functions

```typescript
// test-factories.ts
export const createTestChunk = (
  id: string,
  text: string,
  title: string = 'Test Document'
): Chunk => ({
  id,
  text,
  metadata: {
    source: { title },
    chunkIndex: 0,
    hash: `hash-${id}`,
  },
});

export const createTestQueryResult = (
  chunk: Chunk,
  score: number
): QueryResult => ({
  chunk,
  score,
});
```

### 3. Builders Pattern

```typescript
export class ChunkBuilder {
  private chunk: Partial<Chunk> = {};

  id(id: string): ChunkBuilder {
    this.chunk.id = id;
    return this;
  }

  text(text: string): ChunkBuilder {
    this.chunk.text = text;
    return this;
  }

  fromSource(title: string): ChunkBuilder {
    this.chunk.metadata = {
      ...this.chunk.metadata,
      source: { title },
      chunkIndex: 0,
      hash: 'test-hash',
    };
    return this;
  }

  build(): Chunk {
    if (!this.chunk.id || !this.chunk.text || !this.chunk.metadata) {
      throw new Error('Incomplete chunk data');
    }
    return this.chunk as Chunk;
  }
}

// Usage
const chunk = new ChunkBuilder()
  .id('test-chunk')
  .text('Test content')
  .fromSource('Test Document')
  .build();
```

## Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run tests
        run: pnpm test --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Local Testing Commands

```bash
# Quick test run (no coverage)
pnpm test:quick

# Full test suite with coverage
pnpm test:full

# Test specific pattern
pnpm test --testNamePattern="embeddings"

# Debug failing test
pnpm test --testNamePattern="failing-test" --verbose

# Watch mode for development
pnpm test:watch
```

## Debugging Tests

### 1. Verbose Output

```bash
# See detailed test output
pnpm test --verbose

# See console logs in tests  
pnpm test --verbose --silent=false
```

### 2. Test Debugging

```typescript
import { debug } from 'console';

it('should debug test behavior', async () => {
  const input = 'test input';
  debug('Input:', input); // Will show in verbose mode
  
  const result = await processInput(input);
  debug('Result:', result);
  
  expect(result).toBe('expected');
});
```

### 3. Isolated Test Runs

```bash
# Run single test file
pnpm test src/chunker.test.ts

# Run specific test case
pnpm test --testNamePattern="should chunk text correctly"

# Run tests in specific directory
pnpm test packages/core/src/
```

## Coverage Analysis

### Understanding Coverage Reports

```bash
# Generate coverage report
pnpm test --coverage

# Open HTML coverage report
open coverage/index.html
```

### Coverage Metrics

- **Statements**: Percentage of code statements executed
- **Branches**: Percentage of conditional branches taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

### Coverage Goals

| Component | Statements | Branches | Functions | Lines |
|-----------|------------|----------|-----------|-------|
| Core      | >95%       | >90%     | >95%      | >95%  |
| Adapters  | >90%       | >85%     | >90%      | >90%  |
| Utils     | >95%       | >90%     | >95%      | >95%  |

## Performance Regression Testing

### Benchmark Tests

```typescript
describe('Performance Benchmarks', () => {
  it('should maintain chunking performance', async () => {
    const content = generateLargeContent(10000); // 10k characters
    
    const startTime = performance.now();
    const chunks = defaultChunker(content, source);
    const duration = performance.now() - startTime;
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Should complete in <100ms
  });

  it('should maintain search performance', async () => {
    const store = memoryStore();
    const chunks = generateManyChunks(1000); // 1k chunks
    
    // Setup
    await store.upsert(chunks);
    
    // Benchmark search
    const startTime = performance.now();
    const results = await store.searchByVector(queryVector, 10);
    const duration = performance.now() - startTime;
    
    expect(results.length).toBe(10);
    expect(duration).toBeLessThan(50); // Should search in <50ms
  });
});
```

## Contributing to Tests

### Test Requirements

1. **Coverage**: New features must have >90% test coverage
2. **Documentation**: Tests should serve as documentation
3. **Isolation**: Tests must not depend on external services
4. **Performance**: Tests should complete quickly (<5s total)
5. **Reliability**: Tests must be deterministic

### Code Review Checklist

- [ ] Tests cover happy path scenarios
- [ ] Tests cover error conditions
- [ ] Tests cover edge cases
- [ ] Tests are well-documented
- [ ] Tests use appropriate mocking
- [ ] Tests are performant
- [ ] Tests follow naming conventions

### Writing Effective Tests

1. **Descriptive Names**: Test names should clearly explain what is being tested
2. **AAA Pattern**: Arrange, Act, Assert structure
3. **Single Responsibility**: Each test should verify one specific behavior
4. **Clear Assertions**: Use specific, meaningful assertions
5. **Minimal Setup**: Only include necessary setup code

```typescript
// ✅ Good test structure
describe('OrquelUtils', () => {
  describe('getChunkTitle', () => {
    it('should return title from chunk metadata', () => {
      // Arrange
      const chunk = createTestChunk('test', 'content', 'Test Title');
      
      // Act
      const title = OrquelUtils.getChunkTitle(chunk);
      
      // Assert
      expect(title).toBe('Test Title');
    });

    it('should return fallback for missing title', () => {
      // Arrange
      const chunk = { ...createTestChunk('test', 'content'), 
        metadata: { ...createTestChunk('test', 'content').metadata, 
          source: { title: undefined as any } } };
      
      // Act
      const title = OrquelUtils.getChunkTitle(chunk);
      
      // Assert
      expect(title).toBe('Unknown Document');
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Tests timeout**: Increase timeout or optimize async operations
2. **Flaky tests**: Remove dependencies on timing or external state
3. **Memory leaks**: Ensure proper cleanup in afterEach hooks
4. **Mock issues**: Verify mock setup and cleanup between tests

### Getting Help

- Check existing test patterns in the codebase
- Review test failures in CI for common issues  
- Consult the team for complex testing scenarios
- Use the debugging techniques outlined above

This comprehensive testing approach ensures Orquel maintains high quality and reliability as it evolves.