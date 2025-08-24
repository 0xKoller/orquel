import type {
  Orquel,
  OrquelConfig,
  IngestArgs,
  QueryOptions,
  AnswerOptions,
  Chunk,
  SearchResult,
} from './types.js';
import { defaultChunker } from './chunker.js';
import { OrquelUtils } from './utils.js';
import { mergeHybridResults, analyzeHybridOverlap } from './hybrid.js';

/**
 * Create a new Orquel instance with the specified configuration
 * 
 * @param config - Configuration object specifying adapters and options
 * @returns Configured Orquel instance
 * 
 * @example
 * ```typescript
 * import { createOrquel } from '@orquel/core';
 * import { openAIEmbeddings } from '@orquel/embeddings-openai';
 * import { memoryStore } from '@orquel/store-memory';
 * 
 * const orq = createOrquel({
 *   embeddings: openAIEmbeddings(),
 *   vector: memoryStore(),
 *   debug: true  // Enable debugging features
 * });
 * ```
 */
export function createOrquel(config: OrquelConfig): Orquel {
  const chunker = config.chunker || ((text: string) => 
    defaultChunker(text, { title: 'Unknown' })
  );
  const debug = config.debug ?? false;

  if (debug) {
    console.log('🐛 Orquel Debug Mode Enabled');
    console.log('📋 Configuration:');
    console.log(`  • Embeddings: ${config.embeddings.name}`);
    console.log(`  • Vector Store: ${config.vector.name}`);
    console.log(`  • Lexical: ${config.lexical?.name || 'none'}`);
    console.log(`  • Reranker: ${config.reranker?.name || 'none'}`);
    console.log(`  • Answerer: ${config.answerer?.name || 'none'}`);
  }

  return {
    async ingest(args: IngestArgs) {
      if (debug) {
        console.log(`🔄 Ingesting: "${args.source.title}"`);
        console.log(`📝 Content length: ${typeof args.content === 'string' ? args.content.length : args.content.byteLength} ${typeof args.content === 'string' ? 'characters' : 'bytes'}`);
      }

      const content = typeof args.content === 'string' 
        ? args.content 
        : args.content.toString('utf-8');
      
      const chunks = chunker(content);
      
      if (debug) {
        console.log(`✂️  Chunked into ${chunks.length} pieces`);
        if (chunks.length > 0) {
          console.log(`📏 Chunk size range: ${Math.min(...chunks.map(c => c.text.length))}-${Math.max(...chunks.map(c => c.text.length))} characters`);
        }
      }
      
      // Update chunks with proper source info
      const updatedChunks = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          source: args.source,
        },
      }));

      // Validate chunks in debug mode
      if (debug && updatedChunks.length > 0) {
        try {
          OrquelUtils.validateChunk(updatedChunks[0]);
          console.log('✅ Chunk structure validation passed');
        } catch (error) {
          console.warn('⚠️  Chunk validation warning:', error);
        }
      }

      return {
        sourceId: args.source.title,
        chunks: updatedChunks,
      };
    },

    async index(chunks: Chunk[]) {
      if (debug) {
        console.log(`📚 Indexing ${chunks.length} chunks...`);
      }

      // Embed all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await config.embeddings.embed(texts);
      
      if (debug) {
        console.log(`🧠 Generated ${embeddings.length} embeddings (${config.embeddings.dim}D)`);
      }
      
      // Prepare rows for vector store
      const rows = chunks.map((chunk, i) => ({
        chunk,
        embedding: embeddings[i]!,
      }));

      // Index in vector store
      await config.vector.upsert(rows);

      // Index in lexical store if available
      if (config.lexical) {
        await config.lexical.index(chunks);
        if (debug) {
          console.log(`🔤 Indexed in lexical store: ${config.lexical.name}`);
        }
      }

      if (debug) {
        console.log('✅ Indexing completed');
      }
    },

    async query(q: string, opts: QueryOptions = {}) {
      if (debug) {
        console.log(`🔍 Querying: "${q}"`);
        console.log(`⚙️  Options: k=${opts.k || 10}, hybrid=${opts.hybrid ?? !!config.lexical}, rerank=${opts.rerank ?? !!config.reranker}`);
      }

      const { k = 10, hybrid = !!config.lexical, rerank = !!config.reranker } = opts;
      
      let results: SearchResult[] = [];

      if (hybrid && config.lexical) {
        if (debug) {
          console.log('🔄 Using hybrid search (dense + lexical)');
        }
        // Hybrid search: combine dense and lexical
        const [queryEmbedding] = await config.embeddings.embed([q]);
        const denseResults = await config.vector.searchByVector(queryEmbedding!, k);
        const lexicalResults = await config.lexical.search(q, k);
        
        if (debug) {
          console.log(`📊 Dense results: ${denseResults.length}, Lexical results: ${lexicalResults.length}`);
        }
        
        // Analyze overlap if debug mode is enabled
        if (debug) {
          const overlap = analyzeHybridOverlap(denseResults, lexicalResults);
          console.log(`🔄 Search overlap: ${overlap.overlapCount} shared, ${overlap.denseOnlyCount} dense-only, ${overlap.lexicalOnlyCount} lexical-only`);
          console.log(`📊 Complementary score: ${(overlap.complementaryScore * 100).toFixed(1)}%`);
        }
        
        // Merge results using configured hybrid options
        const hybridOptions = config.hybrid || {};
        results = mergeHybridResults(denseResults, lexicalResults, { ...hybridOptions, k });
      } else {
        if (debug) {
          console.log('🔄 Using dense-only search');
        }
        // Dense-only search
        const [queryEmbedding] = await config.embeddings.embed([q]);
        results = await config.vector.searchByVector(queryEmbedding!, k);
      }

      // Apply reranking if available
      if (rerank && config.reranker && results.length > 0) {
        if (debug) {
          console.log(`🎯 Applying reranking with ${config.reranker.name}`);
        }
        const chunks = results.map(r => r.chunk);
        const rerankedIndices = await config.reranker.rerank(q, chunks);
        results = rerankedIndices.map(idx => results[idx]!);
      }

      if (debug) {
        console.log(`📋 Final results: ${results.length}`);
        if (results.length > 0) {
          OrquelUtils.inspectQueryResults(results);
        }
      }

      return { results };
    },

    async answer(q: string, opts: AnswerOptions = {}) {
      if (debug) {
        console.log(`💬 Generating answer for: "${q}"`);
        console.log(`⚙️  Options: topK=${opts.topK || 4}`);
      }

      const { topK = 4 } = opts;
      
      if (!config.answerer) {
        throw new Error('No answerer configured');
      }

      // Get relevant contexts
      const { results } = await this.query(q, { k: topK });
      const contexts = results.map(r => r.chunk);

      if (debug) {
        console.log(`📚 Using ${contexts.length} contexts for answer generation`);
        console.log(`🤖 Generating answer with ${config.answerer.name}...`);
        console.log('📝 Context summary:', OrquelUtils.summarizeContexts(contexts));
      }

      // Generate answer
      const answer = await config.answerer.answer({
        query: q,
        contexts,
      });

      if (debug) {
        console.log(`✅ Answer generated (${answer.length} characters)`);
        if (answer.length > 150) {
          console.log(`📖 Answer preview: "${answer.substring(0, 150)}..."`);
        } else {
          console.log(`📖 Full answer: "${answer}"`);
        }
      }

      return { answer, contexts };
    },
  };
}

