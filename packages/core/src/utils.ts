import type { Chunk, QueryResult } from './types.js';

/**
 * Utility functions for common Orquel operations
 * 
 * These utilities help prevent common mistakes and reduce boilerplate code
 * when working with Orquel data structures.
 * 
 * @example
 * ```typescript
 * import { OrquelUtils } from '@orquel/core';
 * 
 * // Get chunk title safely
 * const title = OrquelUtils.getChunkTitle(chunk);
 * 
 * // Format search results for display
 * const formatted = OrquelUtils.formatSearchResults(results);
 * console.log(formatted);
 * ```
 */
export class OrquelUtils {
  /**
   * Safely extract the title from a chunk's metadata
   * 
   * @example
   * ```typescript
   * const chunk: Chunk = { id: 'test', text: 'content', metadata: { source: { title: 'Test' }, chunkIndex: 0, hash: 'abc' } };
   * const title = OrquelUtils.getChunkTitle(chunk);
   * console.log(title); // "Document Title" or "Unknown Document"
   * ```
   * 
   * @param chunk - The chunk to extract the title from
   * @returns The title string, or "Unknown Document" if not available
   */
  static getChunkTitle(chunk: Chunk): string {
    const title = chunk.metadata?.source?.title;
    if (!title) {
      console.warn('Warning: Chunk missing source title, using fallback');
      return 'Unknown Document';
    }
    return title;
  }

  /**
   * Extract unique source titles from an array of chunks
   * 
   * @example
   * ```typescript
   * const contexts: Chunk[] = []; // Array of chunks
   * const sources = OrquelUtils.getUniqueSourceTitles(contexts);
   * sources.forEach(source => console.log(`• ${source}`));
   * ```
   * 
   * @param chunks - Array of chunks to extract titles from
   * @returns Array of unique source titles (excluding undefined/null)
   */
  static getUniqueSourceTitles(chunks: Chunk[]): string[] {
    const titles = chunks
      .map(chunk => chunk.metadata?.source?.title)
      .filter((title): title is string => Boolean(title));
    
    return [...new Set(titles)];
  }

  /**
   * Format search results for display with titles and scores
   * 
   * @example
   * ```typescript
   * const { results } = await orq.query("What is Argentina?");
   * const formatted = OrquelUtils.formatSearchResults(results);
   * console.log(formatted);
   * // Output:
   * // 1. Geography of Argentina (0.847)
   * // 2. History of Argentina (0.782)
   * // 3. Culture of Argentina (0.756)
   * ```
   * 
   * @param results - Array of query results to format
   * @returns Formatted string with numbered results, titles, and scores
   */
  static formatSearchResults(results: QueryResult[]): string {
    if (results.length === 0) {
      return 'No results found';
    }

    return results.map((result, index) => {
      const title = this.getChunkTitle(result.chunk);
      const score = result.score.toFixed(3);
      return `${index + 1}. ${title} (${score})`;
    }).join('\n');
  }

  /**
   * Validate chunk structure and provide helpful error messages
   * 
   * @example
   * ```typescript
   * try {
   *   OrquelUtils.validateChunk(chunk);
   *   console.log("Chunk is valid!");
   * } catch (error) {
   *   console.error("Chunk validation failed:", error.message);
   * }
   * ```
   * 
   * @param chunk - The chunk to validate
   * @throws Error if chunk structure is invalid
   */
  static validateChunk(chunk: unknown): asserts chunk is Chunk {
    if (!chunk || typeof chunk !== 'object') {
      throw new Error('Chunk must be an object');
    }

    const c = chunk as any;

    if (typeof c.id !== 'string') {
      throw new Error('Chunk must have a string id');
    }

    if (typeof c.text !== 'string') {
      throw new Error('Chunk must have a string text property');
    }

    if (!c.metadata || typeof c.metadata !== 'object') {
      throw new Error('Chunk must have a metadata object');
    }

    if (!c.metadata.source || typeof c.metadata.source !== 'object') {
      throw new Error('Chunk metadata must have a source object');
    }

    if (typeof c.metadata.source.title !== 'string') {
      throw new Error('Chunk metadata.source must have a string title');
    }
  }

  /**
   * Inspect chunk structure for debugging purposes
   * 
   * @example
   * ```typescript
   * OrquelUtils.inspectChunk(chunk);
   * // Console output:
   * // 🔍 Chunk inspection:
   * // • ID: chunk_123
   * // • Text length: 542 characters
   * // • Source: "Geography of Argentina"
   * // • Chunk index: 3
   * ```
   * 
   * @param chunk - The chunk to inspect
   */
  static inspectChunk(chunk: Chunk): void {
    console.log('🔍 Chunk inspection:');
    console.log(`• ID: ${chunk.id}`);
    console.log(`• Text length: ${chunk.text.length} characters`);
    console.log(`• Source: "${this.getChunkTitle(chunk)}"`);
    console.log(`• Chunk index: ${chunk.metadata?.chunkIndex ?? 'unknown'}`);
    console.log(`• Has hash: ${chunk.metadata?.hash ? 'yes' : 'no'}`);
    
    if (chunk.text.length > 100) {
      console.log(`• Text preview: "${chunk.text.substring(0, 100)}..."`);
    } else {
      console.log(`• Full text: "${chunk.text}"`);
    }
  }

  /**
   * Inspect query results structure for debugging
   * 
   * @example
   * ```typescript
   * const { results } = await orq.query("What is Argentina?");
   * OrquelUtils.inspectQueryResults(results);
   * ```
   * 
   * @param results - The query results to inspect
   */
  static inspectQueryResults(results: QueryResult[]): void {
    console.log('📊 Query results inspection:');
    console.log(`• Result count: ${results.length}`);
    
    if (results.length > 0) {
      console.log(`• Score range: ${results[results.length - 1]!.score.toFixed(3)} - ${results[0]!.score.toFixed(3)}`);
      console.log('• Sources found:');
      
      const sources = this.getUniqueSourceTitles(results.map(r => r.chunk));
      sources.forEach(source => console.log(`  - ${source}`));
      
      console.log('• Sample result:');
      this.inspectChunk(results[0]!.chunk);
    }
  }

  /**
   * Create a summary of contexts used in answer generation
   * 
   * @example
   * ```typescript
   * const { contexts } = await orq.answer("What is Argentina?");
   * const summary = OrquelUtils.summarizeContexts(contexts);
   * console.log(summary);
   * // "Based on 3 chunks from 2 sources: Geography of Argentina, Culture of Argentina"
   * ```
   * 
   * @param contexts - Array of chunks used as context
   * @returns Human-readable summary string
   */
  static summarizeContexts(contexts: Chunk[]): string {
    const sources = this.getUniqueSourceTitles(contexts);
    const chunkCount = contexts.length;
    const sourceCount = sources.length;
    
    if (chunkCount === 0) {
      return 'No contexts used';
    }

    const sourceList = sources.join(', ');
    return `Based on ${chunkCount} chunk${chunkCount === 1 ? '' : 's'} from ${sourceCount} source${sourceCount === 1 ? '' : 's'}: ${sourceList}`;
  }
}