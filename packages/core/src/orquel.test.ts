import { describe, it, expect, vi } from 'vitest';
import { createOrquel } from './orquel.js';
import type { 
  EmbeddingsAdapter, 
  VectorStoreAdapter, 
  AnswerAdapter,
  Chunk 
} from './types.js';

// Mock adapters for testing
const createMockEmbeddings = (): EmbeddingsAdapter => ({
  name: 'mock-embeddings',
  dim: 384,
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]),
});

const createMockVectorStore = (): VectorStoreAdapter => ({
  name: 'mock-vector-store',
  upsert: vi.fn().mockResolvedValue(undefined),
  searchByVector: vi.fn().mockResolvedValue([
    {
      chunk: {
        id: 'test-chunk-1',
        text: 'Test content',
        metadata: {
          source: { title: 'Test' },
          chunkIndex: 0,
          hash: 'abc123',
        },
      },
      score: 0.9,
    },
  ]),
});

const createMockAnswerer = (): AnswerAdapter => ({
  name: 'mock-answerer',
  answer: vi.fn().mockResolvedValue('Test answer'),
});

describe('createOrquel', () => {
  it('should create an Orquel instance with required adapters', () => {
    const embeddings = createMockEmbeddings();
    const vector = createMockVectorStore();

    const orq = createOrquel({
      embeddings,
      vector,
    });

    expect(orq).toBeDefined();
    expect(typeof orq.ingest).toBe('function');
    expect(typeof orq.index).toBe('function');
    expect(typeof orq.query).toBe('function');
    expect(typeof orq.answer).toBe('function');
  });

  describe('ingest', () => {
    it('should ingest text content and return chunks', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const orq = createOrquel({ embeddings, vector });

      const result = await orq.ingest({
        source: { title: 'Test Doc', kind: 'md' },
        content: '# Test\nThis is test content.',
      });

      expect(result.sourceId).toBe('Test Doc');
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].text).toContain('Test');
      expect(result.chunks[0].metadata.source.title).toBe('Test Doc');
    });

    it('should handle buffer content', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const orq = createOrquel({ embeddings, vector });

      const content = Buffer.from('Test content', 'utf-8');
      const result = await orq.ingest({
        source: { title: 'Buffer Doc' },
        content,
      });

      expect(result.chunks[0].text).toBe('Test content');
    });
  });

  describe('index', () => {
    it('should index chunks using embeddings and vector store', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const orq = createOrquel({ embeddings, vector });

      const chunks: Chunk[] = [
        {
          id: 'test-1',
          text: 'First chunk',
          metadata: {
            source: { title: 'Test' },
            chunkIndex: 0,
            hash: 'hash1',
          },
        },
        {
          id: 'test-2',
          text: 'Second chunk',
          metadata: {
            source: { title: 'Test' },
            chunkIndex: 1,
            hash: 'hash2',
          },
        },
      ];

      await orq.index(chunks);

      expect(embeddings.embed).toHaveBeenCalledWith(['First chunk', 'Second chunk']);
      expect(vector.upsert).toHaveBeenCalledWith([
        { ...chunks[0], embedding: [0.1, 0.2, 0.3] },
        { ...chunks[1], embedding: [0.4, 0.5, 0.6] },
      ]);
    });
  });

  describe('query', () => {
    it('should perform dense search by default', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const orq = createOrquel({ embeddings, vector });

      const result = await orq.query('test query');

      expect(embeddings.embed).toHaveBeenCalledWith(['test query']);
      expect(vector.searchByVector).toHaveBeenCalledWith([0.1, 0.2, 0.3], 10);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBe(0.9);
    });

    it('should respect k parameter', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const orq = createOrquel({ embeddings, vector });

      await orq.query('test query', { k: 5 });

      expect(vector.searchByVector).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5);
    });
  });

  describe('answer', () => {
    it('should generate answers using the answerer adapter', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const answerer = createMockAnswerer();
      const orq = createOrquel({ embeddings, vector, answerer });

      const result = await orq.answer('What is this about?');

      expect(result.answer).toBe('Test answer');
      expect(result.contexts).toHaveLength(1);
      expect(answerer.answer).toHaveBeenCalledWith({
        query: 'What is this about?',
        contexts: expect.any(Array),
      });
    });

    it('should throw error if no answerer is configured', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const orq = createOrquel({ embeddings, vector });

      await expect(orq.answer('test question')).rejects.toThrow(
        'No answerer configured'
      );
    });

    it('should use topK parameter for context retrieval', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const answerer = createMockAnswerer();
      const orq = createOrquel({ embeddings, vector, answerer });

      await orq.answer('test question', { topK: 8 });

      expect(vector.searchByVector).toHaveBeenCalledWith([0.1, 0.2, 0.3], 8);
    });
  });

  describe('end-to-end workflow', () => {
    it('should support complete ingest -> index -> query -> answer flow', async () => {
      const embeddings = createMockEmbeddings();
      const vector = createMockVectorStore();
      const answerer = createMockAnswerer();
      const orq = createOrquel({ embeddings, vector, answerer });

      // Ingest
      const { chunks } = await orq.ingest({
        source: { title: 'E2E Test', kind: 'md' },
        content: '# Test Document\nThis is a test document for end-to-end testing.',
      });

      expect(chunks).toHaveLength(1);

      // Index
      await orq.index(chunks);
      expect(vector.upsert).toHaveBeenCalled();

      // Query
      const queryResult = await orq.query('test document');
      expect(queryResult.results).toHaveLength(1);

      // Answer
      const answerResult = await orq.answer('What is this document about?');
      expect(answerResult.answer).toBe('Test answer');
      expect(answerResult.contexts).toHaveLength(1);
    });
  });
});