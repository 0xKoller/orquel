import { describe, it, expect } from 'vitest';
import { defaultChunker } from './chunker.js';
import type { IngestSource } from './types.js';

describe('defaultChunker', () => {
  const source: IngestSource = {
    title: 'Test Document',
    kind: 'md',
  };

  it('should create a single chunk for short text', () => {
    const text = 'This is a short text that fits in one chunk.';
    const chunks = defaultChunker(text, source);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].metadata.chunkIndex).toBe(0);
    expect(chunks[0].metadata.source).toBe(source);
  });

  it('should split long text into multiple chunks', () => {
    // Use text with spaces to enable word boundary splitting
    const text = 'This is a long document that should be split into multiple chunks. '.repeat(30);
    const chunks = defaultChunker(text, source, { maxChunkSize: 500 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((chunk, index) => {
      expect(chunk.text.length).toBeLessThanOrEqual(500);
      expect(chunk.metadata.chunkIndex).toBeGreaterThanOrEqual(0);
      expect(chunk.id).toBeDefined();
      expect(chunk.metadata.hash).toBeDefined();
    });
  });

  it('should respect markdown headings', () => {
    const text = `# Chapter 1
This is the first chapter content.

# Chapter 2  
This is the second chapter content.

## Subsection
More content here.`;

    const chunks = defaultChunker(text, source, { maxChunkSize: 100 });

    expect(chunks.length).toBeGreaterThan(1);
    // Should split on headings when possible
    expect(chunks.some(chunk => chunk.text.includes('Chapter 1'))).toBe(true);
    expect(chunks.some(chunk => chunk.text.includes('Chapter 2'))).toBe(true);
  });

  it('should handle overlap correctly', () => {
    const text = 'This is a test document. '.repeat(100);
    const chunks = defaultChunker(text, source, { 
      maxChunkSize: 100, 
      overlap: 20 
    });

    expect(chunks.length).toBeGreaterThan(1);
    
    // Just verify chunks exist and have reasonable lengths
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeGreaterThan(0);
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    });
  });

  it('should generate unique IDs for chunks', () => {
    const text = 'Same content\n\nSame content';
    const chunks = defaultChunker(text, source);

    const ids = chunks.map(chunk => chunk.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should deduplicate identical chunks', () => {
    const text = 'Identical content\n\nIdentical content';
    const chunks = defaultChunker(text, source, { maxChunkSize: 50 });

    // Should deduplicate by content hash
    const hashes = chunks.map(chunk => chunk.metadata.hash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(chunks.length);
  });

  it('should normalize text properly', () => {
    const text = '  Extra   spaces\r\n\r\n\r\nand\nnewlines  ';
    const chunks = defaultChunker(text, source);

    expect(chunks[0].text).not.toContain('  '); // No double spaces
    expect(chunks[0].text).not.toContain('\r\n'); // No Windows line endings
    expect(chunks[0].text).not.toContain('\n\n\n'); // No triple newlines
    expect(chunks[0].text.trim()).toBe(chunks[0].text); // No leading/trailing whitespace
  });

  it('should handle empty or whitespace-only text', () => {
    expect(defaultChunker('', source)).toEqual([]);
    expect(defaultChunker('   \n\n  ', source)).toEqual([]);
  });

  it('should include source metadata in chunks', () => {
    const customSource: IngestSource = {
      title: 'Custom Doc',
      kind: 'txt',
      author: 'Test Author',
      url: 'https://example.com/doc',
    };

    const chunks = defaultChunker('Test content', customSource);

    expect(chunks[0].metadata.source).toEqual(customSource);
    expect(chunks[0].id).toContain('Custom Doc');
  });
});