import type {
  Orquel,
  OrquelConfig,
  IngestArgs,
  QueryOptions,
  AnswerOptions,
  Chunk,
} from './types.js';
import { defaultChunker } from './chunker.js';

export function createOrquel(config: OrquelConfig): Orquel {
  const chunker = config.chunker || ((text: string) => 
    defaultChunker(text, { title: 'Unknown' })
  );

  return {
    async ingest(args: IngestArgs) {
      const content = typeof args.content === 'string' 
        ? args.content 
        : args.content.toString('utf-8');
      
      const chunks = chunker(content);
      
      // Update chunks with proper source info
      const updatedChunks = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          source: args.source,
        },
      }));

      return {
        sourceId: args.source.title,
        chunks: updatedChunks,
      };
    },

    async index(chunks: Chunk[]) {
      // Embed all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await config.embeddings.embed(texts);
      
      // Prepare rows for vector store
      const rows = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      // Index in vector store
      await config.vector.upsert(rows);

      // Index in lexical store if available
      if (config.lexical) {
        await config.lexical.index(chunks);
      }
    },

    async query(q: string, opts: QueryOptions = {}) {
      const { k = 10, hybrid = !!config.lexical, rerank = !!config.reranker } = opts;
      
      let results: Array<{ chunk: Chunk; score: number }> = [];

      if (hybrid && config.lexical) {
        // Hybrid search: combine dense and lexical
        const [queryEmbedding] = await config.embeddings.embed([q]);
        const denseResults = await config.vector.searchByVector(queryEmbedding, k);
        const lexicalResults = await config.lexical.search(q, k);
        
        // Merge and normalize scores
        results = mergeHybridResults(denseResults, lexicalResults, k);
      } else {
        // Dense-only search
        const [queryEmbedding] = await config.embeddings.embed([q]);
        results = await config.vector.searchByVector(queryEmbedding, k);
      }

      // Apply reranking if available
      if (rerank && config.reranker && results.length > 0) {
        const chunks = results.map(r => r.chunk);
        const rerankedIndices = await config.reranker.rerank(q, chunks);
        results = rerankedIndices.map(idx => results[idx]);
      }

      return { results };
    },

    async answer(q: string, opts: AnswerOptions = {}) {
      const { topK = 4 } = opts;
      
      if (!config.answerer) {
        throw new Error('No answerer configured');
      }

      // Get relevant contexts
      const { results } = await this.query(q, { k: topK });
      const contexts = results.map(r => r.chunk);

      // Generate answer
      const answer = await config.answerer.answer({
        query: q,
        contexts,
      });

      return { answer, contexts };
    },
  };
}

function mergeHybridResults(
  denseResults: Array<{ chunk: Chunk; score: number }>,
  lexicalResults: Array<{ chunk: Chunk; score: number }>,
  k: number,
  denseWeight = 0.65,
  lexicalWeight = 0.35
): Array<{ chunk: Chunk; score: number }> {
  // Normalize scores to [0, 1]
  const normalizedDense = normalizeScores(denseResults);
  const normalizedLexical = normalizeScores(lexicalResults);

  // Create a map of chunk ID to combined score
  const scoreMap = new Map<string, { chunk: Chunk; score: number }>();

  // Add dense results
  for (const result of normalizedDense) {
    scoreMap.set(result.chunk.id, {
      chunk: result.chunk,
      score: result.score * denseWeight,
    });
  }

  // Add/merge lexical results
  for (const result of normalizedLexical) {
    const existing = scoreMap.get(result.chunk.id);
    if (existing) {
      existing.score += result.score * lexicalWeight;
    } else {
      scoreMap.set(result.chunk.id, {
        chunk: result.chunk,
        score: result.score * lexicalWeight,
      });
    }
  }

  // Sort by combined score and take top k
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function normalizeScores(
  results: Array<{ chunk: Chunk; score: number }>
): Array<{ chunk: Chunk; score: number }> {
  if (results.length === 0) return results;

  const scores = results.map(r => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;

  if (range === 0) {
    return results.map(r => ({ ...r, score: 1 }));
  }

  return results.map(r => ({
    ...r,
    score: (r.score - min) / range,
  }));
}