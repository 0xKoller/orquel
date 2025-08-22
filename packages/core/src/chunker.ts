import type { Chunk, IngestSource } from './types.js';
import { createHash } from 'crypto';

export interface ChunkerOptions {
  maxChunkSize?: number;
  overlap?: number;
  respectMarkdownHeadings?: boolean;
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  maxChunkSize: 1200,
  overlap: 150,
  respectMarkdownHeadings: true,
};

export function defaultChunker(
  text: string,
  source: IngestSource,
  options: ChunkerOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Normalize text: trim whitespace, collapse repeated spaces, preserve code blocks
  const normalized = normalizeText(text);
  
  if (normalized.length <= opts.maxChunkSize) {
    return [createChunk(normalized, source, 0)];
  }

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  if (opts.respectMarkdownHeadings && source.kind === 'md') {
    const sections = splitByMarkdownHeadings(normalized);
    
    for (const section of sections) {
      if (section.length <= opts.maxChunkSize) {
        chunks.push(createChunk(section, source, chunkIndex++));
      } else {
        const subChunks = splitTextIntoChunks(section, opts.maxChunkSize, opts.overlap);
        for (const subChunk of subChunks) {
          chunks.push(createChunk(subChunk, source, chunkIndex++));
        }
      }
    }
  } else {
    const textChunks = splitTextIntoChunks(normalized, opts.maxChunkSize, opts.overlap);
    for (const chunk of textChunks) {
      chunks.push(createChunk(chunk, source, chunkIndex++));
    }
  }

  return deduplicateChunks(chunks);
}

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function splitByMarkdownHeadings(text: string): string[] {
  const sections: string[] = [];
  const lines = text.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    if (line.match(/^#{1,6}\s/)) {
      if (currentSection.trim()) {
        sections.push(currentSection.trim());
      }
      currentSection = line + '\n';
    } else {
      currentSection += line + '\n';
    }
  }
  
  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }
  
  return sections.filter(s => s.length > 0);
}

function splitTextIntoChunks(text: string, maxSize: number, overlap: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;
    
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Try to break at word boundary
    const breakPoint = findBreakPoint(text, start, end);
    chunks.push(text.slice(start, breakPoint));
    
    start = Math.max(start + 1, breakPoint - overlap);
  }

  return chunks;
}

function findBreakPoint(text: string, start: number, end: number): number {
  // Look for sentence boundary first
  for (let i = end - 1; i > start + (end - start) * 0.7; i--) {
    if (text[i] === '.' && text[i + 1] === ' ') {
      return i + 1;
    }
  }
  
  // Fall back to word boundary
  for (let i = end - 1; i > start + (end - start) * 0.5; i--) {
    if (text[i] === ' ') {
      return i;
    }
  }
  
  return end;
}

function createChunk(text: string, source: IngestSource, chunkIndex: number): Chunk {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
  
  return {
    id: `${source.title}-${chunkIndex}-${hash}`,
    text,
    metadata: {
      source,
      chunkIndex,
      hash,
    },
  };
}

function deduplicateChunks(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>();
  return chunks.filter(chunk => {
    if (seen.has(chunk.metadata.hash)) {
      return false;
    }
    seen.add(chunk.metadata.hash);
    return true;
  });
}