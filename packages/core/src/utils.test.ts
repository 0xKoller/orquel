import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrquelUtils } from './utils.js';
import type { Chunk, QueryResult } from './types.js';

describe('OrquelUtils', () => {
  // Mock console to test warning outputs
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  const createTestChunk = (id: string, title: string, text: string, chunkIndex = 0): Chunk => ({
    id,
    text,
    metadata: {
      source: { title, kind: 'md' },
      chunkIndex,
      hash: `hash-${id}`,
    },
  });

  const createTestQueryResult = (chunk: Chunk, score: number): QueryResult => ({
    chunk,
    score,
  });

  describe('getChunkTitle', () => {
    it('should extract title from chunk metadata', () => {
      const chunk = createTestChunk('test', 'Test Document', 'Content');
      
      const title = OrquelUtils.getChunkTitle(chunk);
      
      expect(title).toBe('Test Document');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should return fallback for missing title', () => {
      const chunk: Chunk = {
        id: 'test',
        text: 'Content',
        metadata: {
          source: { title: undefined as any },
          chunkIndex: 0,
          hash: 'hash',
        },
      };
      
      const title = OrquelUtils.getChunkTitle(chunk);
      
      expect(title).toBe('Unknown Document');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: Chunk missing source title, using fallback');
    });

    it('should return fallback for null title', () => {
      const chunk: Chunk = {
        id: 'test',
        text: 'Content',
        metadata: {
          source: { title: null as any },
          chunkIndex: 0,
          hash: 'hash',
        },
      };
      
      const title = OrquelUtils.getChunkTitle(chunk);
      
      expect(title).toBe('Unknown Document');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should return fallback for empty string title', () => {
      const chunk = createTestChunk('test', '', 'Content');
      
      const title = OrquelUtils.getChunkTitle(chunk);
      
      expect(title).toBe('Unknown Document');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle missing metadata gracefully', () => {
      const chunk: Chunk = {
        id: 'test',
        text: 'Content',
        metadata: undefined as any,
      };
      
      const title = OrquelUtils.getChunkTitle(chunk);
      
      expect(title).toBe('Unknown Document');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('getUniqueSourceTitles', () => {
    it('should extract unique titles from chunks', () => {
      const chunks = [
        createTestChunk('1', 'Document A', 'Content 1'),
        createTestChunk('2', 'Document B', 'Content 2'),
        createTestChunk('3', 'Document A', 'Content 3'), // Duplicate title
        createTestChunk('4', 'Document C', 'Content 4'),
      ];
      
      const titles = OrquelUtils.getUniqueSourceTitles(chunks);
      
      expect(titles).toEqual(['Document A', 'Document B', 'Document C']);
      expect(titles).toHaveLength(3);
    });

    it('should handle empty chunks array', () => {
      const titles = OrquelUtils.getUniqueSourceTitles([]);
      
      expect(titles).toEqual([]);
    });

    it('should filter out undefined and null titles', () => {
      const chunks: Chunk[] = [
        createTestChunk('1', 'Valid Title', 'Content 1'),
        {
          id: '2',
          text: 'Content 2',
          metadata: {
            source: { title: undefined as any },
            chunkIndex: 0,
            hash: 'hash-2',
          },
        },
        {
          id: '3',
          text: 'Content 3',
          metadata: {
            source: { title: null as any },
            chunkIndex: 0,
            hash: 'hash-3',
          },
        },
        createTestChunk('4', 'Another Valid Title', 'Content 4'),
      ];
      
      const titles = OrquelUtils.getUniqueSourceTitles(chunks);
      
      expect(titles).toEqual(['Valid Title', 'Another Valid Title']);
    });

    it('should filter out empty string titles', () => {
      const chunks = [
        createTestChunk('1', 'Valid Title', 'Content 1'),
        createTestChunk('2', '', 'Content 2'),
        createTestChunk('3', 'Another Valid Title', 'Content 3'),
      ];
      
      const titles = OrquelUtils.getUniqueSourceTitles(chunks);
      
      expect(titles).toEqual(['Valid Title', 'Another Valid Title']);
    });

    it('should preserve order of first occurrence', () => {
      const chunks = [
        createTestChunk('1', 'First', 'Content 1'),
        createTestChunk('2', 'Second', 'Content 2'),
        createTestChunk('3', 'Third', 'Content 3'),
        createTestChunk('4', 'Second', 'Content 4'), // Duplicate
        createTestChunk('5', 'First', 'Content 5'), // Duplicate
      ];
      
      const titles = OrquelUtils.getUniqueSourceTitles(chunks);
      
      expect(titles).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('formatSearchResults', () => {
    it('should format search results with titles and scores', () => {
      const results: QueryResult[] = [
        createTestQueryResult(createTestChunk('1', 'Document A', 'Content 1'), 0.847),
        createTestQueryResult(createTestChunk('2', 'Document B', 'Content 2'), 0.782),
        createTestQueryResult(createTestChunk('3', 'Document C', 'Content 3'), 0.756),
      ];
      
      const formatted = OrquelUtils.formatSearchResults(results);
      
      expect(formatted).toBe(
        '1. Document A (0.847)\n2. Document B (0.782)\n3. Document C (0.756)'
      );
    });

    it('should handle empty results', () => {
      const formatted = OrquelUtils.formatSearchResults([]);
      
      expect(formatted).toBe('No results found');
    });

    it('should format single result', () => {
      const results: QueryResult[] = [
        createTestQueryResult(createTestChunk('1', 'Single Doc', 'Content'), 0.95),
      ];
      
      const formatted = OrquelUtils.formatSearchResults(results);
      
      expect(formatted).toBe('1. Single Doc (0.950)');
    });

    it('should handle missing titles gracefully', () => {
      const chunkWithoutTitle: Chunk = {
        id: 'no-title',
        text: 'Content',
        metadata: {
          source: { title: undefined as any },
          chunkIndex: 0,
          hash: 'hash',
        },
      };
      
      const results: QueryResult[] = [
        createTestQueryResult(chunkWithoutTitle, 0.5),
      ];
      
      const formatted = OrquelUtils.formatSearchResults(results);
      
      expect(formatted).toBe('1. Unknown Document (0.500)');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should format scores to 3 decimal places', () => {
      const results: QueryResult[] = [
        createTestQueryResult(createTestChunk('1', 'Doc', 'Content'), 0.123456789),
        createTestQueryResult(createTestChunk('2', 'Doc2', 'Content'), 1.0),
        createTestQueryResult(createTestChunk('3', 'Doc3', 'Content'), 0.1),
      ];
      
      const formatted = OrquelUtils.formatSearchResults(results);
      
      expect(formatted).toContain('0.123');
      expect(formatted).toContain('1.000');
      expect(formatted).toContain('0.100');
    });
  });

  describe('validateChunk', () => {
    it('should validate a correct chunk', () => {
      const validChunk = createTestChunk('test', 'Test Doc', 'Content');
      
      expect(() => OrquelUtils.validateChunk(validChunk)).not.toThrow();
    });

    it('should throw for non-object input', () => {
      expect(() => OrquelUtils.validateChunk(null)).toThrow('Chunk must be an object');
      expect(() => OrquelUtils.validateChunk(undefined)).toThrow('Chunk must be an object');
      expect(() => OrquelUtils.validateChunk('string')).toThrow('Chunk must be an object');
      expect(() => OrquelUtils.validateChunk(123)).toThrow('Chunk must be an object');
    });

    it('should throw for missing id', () => {
      const chunk = { text: 'Content', metadata: { source: { title: 'Test' }, chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk must have a string id');
    });

    it('should throw for non-string id', () => {
      const chunk = { id: 123, text: 'Content', metadata: { source: { title: 'Test' }, chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk must have a string id');
    });

    it('should throw for missing text', () => {
      const chunk = { id: 'test', metadata: { source: { title: 'Test' }, chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk must have a string text property');
    });

    it('should throw for non-string text', () => {
      const chunk = { id: 'test', text: 123, metadata: { source: { title: 'Test' }, chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk must have a string text property');
    });

    it('should throw for missing metadata', () => {
      const chunk = { id: 'test', text: 'Content' };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk must have a metadata object');
    });

    it('should throw for non-object metadata', () => {
      const chunk = { id: 'test', text: 'Content', metadata: 'not-object' };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk must have a metadata object');
    });

    it('should throw for missing source', () => {
      const chunk = { id: 'test', text: 'Content', metadata: { chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk metadata must have a source object');
    });

    it('should throw for non-object source', () => {
      const chunk = { id: 'test', text: 'Content', metadata: { source: 'not-object', chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk metadata must have a source object');
    });

    it('should throw for missing title in source', () => {
      const chunk = { id: 'test', text: 'Content', metadata: { source: {}, chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk metadata.source must have a string title');
    });

    it('should throw for non-string title', () => {
      const chunk = { id: 'test', text: 'Content', metadata: { source: { title: 123 }, chunkIndex: 0, hash: 'hash' } };
      
      expect(() => OrquelUtils.validateChunk(chunk)).toThrow('Chunk metadata.source must have a string title');
    });

    it('should validate chunk with complex metadata', () => {
      const complexChunk: Chunk = {
        id: 'complex',
        text: 'Complex content',
        metadata: {
          source: {
            title: 'Complex Document',
            kind: 'pdf',
            author: 'Author Name',
            url: 'https://example.com/doc.pdf',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          chunkIndex: 5,
          tokens: 150,
          hash: 'complex-hash',
        },
      };
      
      expect(() => OrquelUtils.validateChunk(complexChunk)).not.toThrow();
    });
  });

  describe('inspectChunk', () => {
    it('should log chunk inspection details', () => {
      const chunk = createTestChunk('test-123', 'Test Document', 'This is test content for inspection');
      chunk.metadata.chunkIndex = 5;
      chunk.metadata.hash = 'abc123def';
      chunk.metadata.tokens = 25;
      
      OrquelUtils.inspectChunk(chunk);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Chunk inspection:');
      expect(consoleLogSpy).toHaveBeenCalledWith('• ID: test-123');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Text length: 35 characters');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Source: \"Test Document\"');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Chunk index: 5');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Has hash: yes');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Full text: \"This is test content for inspection\"');
    });

    it('should show preview for long text', () => {
      const longText = 'A'.repeat(150);
      const chunk = createTestChunk('long', 'Long Document', longText);
      
      OrquelUtils.inspectChunk(chunk);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('• Text length: 150 characters');
      expect(consoleLogSpy).toHaveBeenCalledWith(`• Text preview: \"${'A'.repeat(100)}...\"`);
    });

    it('should handle missing optional metadata', () => {
      const chunk: Chunk = {
        id: 'minimal',
        text: 'Minimal content',
        metadata: {
          source: { title: 'Minimal Doc' },
          chunkIndex: undefined as any,
          hash: '',
        },
      };
      
      OrquelUtils.inspectChunk(chunk);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('• Chunk index: unknown');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Has hash: no');
    });

    it('should handle missing title gracefully', () => {
      const chunk: Chunk = {
        id: 'no-title',
        text: 'Content',
        metadata: {
          source: { title: undefined as any },
          chunkIndex: 0,
          hash: 'hash',
        },
      };
      
      OrquelUtils.inspectChunk(chunk);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('• Source: \"Unknown Document\"');
    });
  });

  describe('inspectQueryResults', () => {
    it('should inspect query results with multiple results', () => {
      const results: QueryResult[] = [
        createTestQueryResult(createTestChunk('1', 'Document A', 'Content A'), 0.95),
        createTestQueryResult(createTestChunk('2', 'Document B', 'Content B'), 0.80),
        createTestQueryResult(createTestChunk('3', 'Document A', 'More content'), 0.75),
      ];
      
      OrquelUtils.inspectQueryResults(results);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('📊 Query results inspection:');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Result count: 3');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Score range: 0.750 - 0.950');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Sources found:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Document A');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Document B');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Sample result:');
    });

    it('should handle empty results', () => {
      OrquelUtils.inspectQueryResults([]);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('📊 Query results inspection:');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Result count: 0');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringMatching(/Score range/));
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringMatching(/Sources found/));
    });

    it('should handle single result', () => {
      const results: QueryResult[] = [
        createTestQueryResult(createTestChunk('1', 'Single Doc', 'Single content'), 0.88),
      ];
      
      OrquelUtils.inspectQueryResults(results);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('• Result count: 1');
      expect(consoleLogSpy).toHaveBeenCalledWith('• Score range: 0.880 - 0.880');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Single Doc');
    });
  });

  describe('summarizeContexts', () => {
    it('should summarize contexts with multiple sources', () => {
      const contexts: Chunk[] = [
        createTestChunk('1', 'Geography of Argentina', 'Content 1'),
        createTestChunk('2', 'Culture of Argentina', 'Content 2'),
        createTestChunk('3', 'Geography of Argentina', 'More content'),
      ];
      
      const summary = OrquelUtils.summarizeContexts(contexts);
      
      expect(summary).toBe('Based on 3 chunks from 2 sources: Geography of Argentina, Culture of Argentina');
    });

    it('should handle single chunk from single source', () => {
      const contexts: Chunk[] = [
        createTestChunk('1', 'Single Document', 'Single content'),
      ];
      
      const summary = OrquelUtils.summarizeContexts(contexts);
      
      expect(summary).toBe('Based on 1 chunk from 1 source: Single Document');
    });

    it('should handle empty contexts', () => {
      const summary = OrquelUtils.summarizeContexts([]);
      
      expect(summary).toBe('No contexts used');
    });

    it('should handle multiple chunks from same source', () => {
      const contexts: Chunk[] = [
        createTestChunk('1', 'Same Document', 'Chunk 1'),
        createTestChunk('2', 'Same Document', 'Chunk 2'),
        createTestChunk('3', 'Same Document', 'Chunk 3'),
      ];
      
      const summary = OrquelUtils.summarizeContexts(contexts);
      
      expect(summary).toBe('Based on 3 chunks from 1 source: Same Document');
    });

    it('should filter out invalid titles', () => {
      const contexts: Chunk[] = [
        createTestChunk('1', 'Valid Document', 'Content 1'),
        {
          id: '2',
          text: 'Content 2',
          metadata: {
            source: { title: undefined as any },
            chunkIndex: 0,
            hash: 'hash-2',
          },
        },
        createTestChunk('3', 'Another Valid Document', 'Content 3'),
      ];
      
      const summary = OrquelUtils.summarizeContexts(contexts);
      
      expect(summary).toBe('Based on 3 chunks from 2 sources: Valid Document, Another Valid Document');
    });
  });
});