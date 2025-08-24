// src/chunker.ts
import { createHash } from "crypto";
var DEFAULT_OPTIONS = {
  maxChunkSize: 1200,
  overlap: 150,
  respectMarkdownHeadings: true
};
function defaultChunker(text, source, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalized = normalizeText(text);
  if (normalized.length === 0) {
    return [];
  }
  if (normalized.length <= opts.maxChunkSize) {
    return [createChunk(normalized, source, 0)];
  }
  const chunks = [];
  let chunkIndex = 0;
  if (opts.respectMarkdownHeadings && source.kind === "md") {
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
function normalizeText(text) {
  return text.trim().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}
function splitByMarkdownHeadings(text) {
  const sections = [];
  const lines = text.split("\n");
  let currentSection = "";
  for (const line of lines) {
    if (line.match(/^#{1,6}\s/)) {
      if (currentSection.trim()) {
        sections.push(currentSection.trim());
      }
      currentSection = line + "\n";
    } else {
      currentSection += line + "\n";
    }
  }
  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }
  return sections.filter((s) => s.length > 0);
}
function splitTextIntoChunks(text, maxSize, overlap) {
  if (text.length <= maxSize) {
    return [text];
  }
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxSize;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }
    const breakPoint = findBreakPoint(text, start, end);
    chunks.push(text.slice(start, breakPoint));
    start = Math.max(start + 1, breakPoint - overlap);
  }
  return chunks;
}
function findBreakPoint(text, start, end) {
  for (let i = end - 1; i > start + (end - start) * 0.7; i--) {
    if (text[i] === "." && text[i + 1] === " ") {
      return i + 1;
    }
  }
  for (let i = end - 1; i > start + (end - start) * 0.5; i--) {
    if (text[i] === " ") {
      return i;
    }
  }
  return end;
}
function createChunk(text, source, chunkIndex) {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  return {
    id: `${source.title}-${chunkIndex}-${hash}`,
    text,
    index: chunkIndex,
    hash,
    source: {
      title: source.title,
      ...source.kind && { kind: source.kind }
    },
    metadata: {}
  };
}
function deduplicateChunks(chunks) {
  const seen = /* @__PURE__ */ new Set();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.hash)) {
      return false;
    }
    seen.add(chunk.hash);
    return true;
  });
}

// src/utils.ts
var OrquelUtils = class {
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
  static getChunkTitle(chunk) {
    const title = chunk.metadata?.source?.title;
    if (!title) {
      console.warn("Warning: Chunk missing source title, using fallback");
      return "Unknown Document";
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
  static getUniqueSourceTitles(chunks) {
    const titles = chunks.map((chunk) => chunk.metadata?.source?.title).filter((title) => Boolean(title));
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
  static formatSearchResults(results) {
    if (results.length === 0) {
      return "No results found";
    }
    return results.map((result, index) => {
      const title = this.getChunkTitle(result.chunk);
      const score = result.score.toFixed(3);
      return `${index + 1}. ${title} (${score})`;
    }).join("\n");
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
  static validateChunk(chunk) {
    if (!chunk || typeof chunk !== "object") {
      throw new Error("Chunk must be an object");
    }
    const c = chunk;
    if (typeof c.id !== "string") {
      throw new Error("Chunk must have a string id");
    }
    if (typeof c.text !== "string") {
      throw new Error("Chunk must have a string text property");
    }
    if (!c.metadata || typeof c.metadata !== "object") {
      throw new Error("Chunk must have a metadata object");
    }
    if (!c.metadata.source || typeof c.metadata.source !== "object") {
      throw new Error("Chunk metadata must have a source object");
    }
    if (typeof c.metadata.source.title !== "string") {
      throw new Error("Chunk metadata.source must have a string title");
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
  static inspectChunk(chunk) {
    console.log("\u{1F50D} Chunk inspection:");
    console.log(`\u2022 ID: ${chunk.id}`);
    console.log(`\u2022 Text length: ${chunk.text.length} characters`);
    console.log(`\u2022 Source: "${this.getChunkTitle(chunk)}"`);
    console.log(`\u2022 Chunk index: ${chunk.metadata?.chunkIndex ?? "unknown"}`);
    console.log(`\u2022 Has hash: ${chunk.metadata?.hash ? "yes" : "no"}`);
    if (chunk.text.length > 100) {
      console.log(`\u2022 Text preview: "${chunk.text.substring(0, 100)}..."`);
    } else {
      console.log(`\u2022 Full text: "${chunk.text}"`);
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
  static inspectQueryResults(results) {
    console.log("\u{1F4CA} Query results inspection:");
    console.log(`\u2022 Result count: ${results.length}`);
    if (results.length > 0) {
      console.log(`\u2022 Score range: ${results[results.length - 1].score.toFixed(3)} - ${results[0].score.toFixed(3)}`);
      console.log("\u2022 Sources found:");
      const sources = this.getUniqueSourceTitles(results.map((r) => r.chunk));
      sources.forEach((source) => console.log(`  - ${source}`));
      console.log("\u2022 Sample result:");
      this.inspectChunk(results[0].chunk);
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
  static summarizeContexts(contexts) {
    const sources = this.getUniqueSourceTitles(contexts);
    const chunkCount = contexts.length;
    const sourceCount = sources.length;
    if (chunkCount === 0) {
      return "No contexts used";
    }
    const sourceList = sources.join(", ");
    return `Based on ${chunkCount} chunk${chunkCount === 1 ? "" : "s"} from ${sourceCount} source${sourceCount === 1 ? "" : "s"}: ${sourceList}`;
  }
};

// src/hybrid.ts
function reciprocalRankFusion(denseResults, lexicalResults, k = 10, rffConstant = 60) {
  const denseRanks = /* @__PURE__ */ new Map();
  const lexicalRanks = /* @__PURE__ */ new Map();
  denseResults.forEach((result, index) => {
    denseRanks.set(result.chunk.id, index + 1);
  });
  lexicalResults.forEach((result, index) => {
    lexicalRanks.set(result.chunk.id, index + 1);
  });
  const allChunkIds = /* @__PURE__ */ new Set([
    ...denseResults.map((r) => r.chunk.id),
    ...lexicalResults.map((r) => r.chunk.id)
  ]);
  const rrfResults = [];
  for (const chunkId of allChunkIds) {
    let rrfScore = 0;
    let chunk = null;
    const denseRank = denseRanks.get(chunkId);
    if (denseRank !== void 0) {
      rrfScore += 1 / (rffConstant + denseRank);
      chunk = denseResults.find((r) => r.chunk.id === chunkId)?.chunk || null;
    }
    const lexicalRank = lexicalRanks.get(chunkId);
    if (lexicalRank !== void 0) {
      rrfScore += 1 / (rffConstant + lexicalRank);
      if (!chunk) {
        chunk = lexicalResults.find((r) => r.chunk.id === chunkId)?.chunk || null;
      }
    }
    if (chunk) {
      rrfResults.push({ id: chunkId, score: rrfScore, chunk, rank: 0 });
    }
  }
  rrfResults.sort((a, b) => b.score - a.score);
  return rrfResults.slice(0, k).map((result, index) => ({
    chunk: result.chunk,
    score: result.score,
    rank: index + 1
  }));
}
function weightedScoreCombination(denseResults, lexicalResults, k = 10, denseWeight = 0.7, lexicalWeight = 0.3) {
  const normalizedDense = normalizeScores(denseResults);
  const normalizedLexical = normalizeScores(lexicalResults);
  const scoreMap = /* @__PURE__ */ new Map();
  for (const result of normalizedDense) {
    scoreMap.set(result.chunk.id, {
      ...result,
      score: result.score * denseWeight
    });
  }
  for (const result of normalizedLexical) {
    const existing = scoreMap.get(result.chunk.id);
    if (existing) {
      existing.score += result.score * lexicalWeight;
    } else {
      scoreMap.set(result.chunk.id, {
        ...result,
        score: result.score * lexicalWeight
      });
    }
  }
  const sortedResults = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score).slice(0, k);
  return sortedResults.map((result, index) => ({
    ...result,
    rank: index + 1
  }));
}
function normalizeScoresMinMax(results) {
  if (results.length === 0) return results;
  const scores = results.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max === min) {
    return results.map((result) => ({ ...result, score: 1 }));
  }
  return results.map((result) => ({
    ...result,
    score: (result.score - min) / (max - min)
  }));
}
function normalizeScoresZScore(results) {
  if (results.length === 0) return results;
  if (results.length === 1) return results.map((r) => ({ ...r, score: 1 }));
  const scores = results.map((r) => r.score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) {
    return results.map((result) => ({ ...result, score: 1 }));
  }
  return results.map((result) => {
    const zScore = (result.score - mean) / stdDev;
    const normalizedScore = 1 / (1 + Math.exp(-zScore));
    return { ...result, score: normalizedScore };
  });
}
function normalizeScores(results, method = "minmax") {
  switch (method) {
    case "minmax":
      return normalizeScoresMinMax(results);
    case "zscore":
      return normalizeScoresZScore(results);
    default:
      return normalizeScoresMinMax(results);
  }
}
function mergeHybridResults(denseResults, lexicalResults, options) {
  const {
    k = 10,
    denseWeight = 0.7,
    lexicalWeight = 0.3,
    normalizationMethod = "rrf"
  } = options;
  switch (normalizationMethod) {
    case "rrf":
      return reciprocalRankFusion(denseResults, lexicalResults, k);
    case "minmax":
    case "zscore":
      return weightedScoreCombination(
        denseResults,
        lexicalResults,
        k,
        denseWeight,
        lexicalWeight
      );
    default:
      return reciprocalRankFusion(denseResults, lexicalResults, k);
  }
}
function analyzeHybridOverlap(denseResults, lexicalResults) {
  const denseIds = new Set(denseResults.map((r) => r.chunk.id));
  const lexicalIds = new Set(lexicalResults.map((r) => r.chunk.id));
  const overlapIds = new Set([...denseIds].filter((id) => lexicalIds.has(id)));
  const denseOnlyCount = denseIds.size - overlapIds.size;
  const lexicalOnlyCount = lexicalIds.size - overlapIds.size;
  const overlapCount = overlapIds.size;
  const totalUnique = denseIds.size + lexicalIds.size - overlapIds.size;
  const overlapPercentage = totalUnique > 0 ? overlapCount / totalUnique * 100 : 0;
  const complementaryScore = totalUnique > 0 ? (denseOnlyCount + lexicalOnlyCount) / totalUnique : 0;
  return {
    denseOnlyCount,
    lexicalOnlyCount,
    overlapCount,
    overlapPercentage,
    complementaryScore
  };
}

// src/orquel.ts
function createOrquel(config) {
  const chunker = config.chunker || ((text) => defaultChunker(text, { title: "Unknown" }));
  const debug = config.debug ?? false;
  if (debug) {
    console.log("\u{1F41B} Orquel Debug Mode Enabled");
    console.log("\u{1F4CB} Configuration:");
    console.log(`  \u2022 Embeddings: ${config.embeddings.name}`);
    console.log(`  \u2022 Vector Store: ${config.vector.name}`);
    console.log(`  \u2022 Lexical: ${config.lexical?.name || "none"}`);
    console.log(`  \u2022 Reranker: ${config.reranker?.name || "none"}`);
    console.log(`  \u2022 Answerer: ${config.answerer?.name || "none"}`);
  }
  return {
    async ingest(args) {
      if (debug) {
        console.log(`\u{1F504} Ingesting: "${args.source.title}"`);
        console.log(`\u{1F4DD} Content length: ${typeof args.content === "string" ? args.content.length : args.content.byteLength} ${typeof args.content === "string" ? "characters" : "bytes"}`);
      }
      const content = typeof args.content === "string" ? args.content : args.content.toString("utf-8");
      const chunks = chunker(content);
      if (debug) {
        console.log(`\u2702\uFE0F  Chunked into ${chunks.length} pieces`);
        if (chunks.length > 0) {
          console.log(`\u{1F4CF} Chunk size range: ${Math.min(...chunks.map((c) => c.text.length))}-${Math.max(...chunks.map((c) => c.text.length))} characters`);
        }
      }
      const updatedChunks = chunks.map((chunk) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          source: args.source
        }
      }));
      if (debug && updatedChunks.length > 0) {
        try {
          OrquelUtils.validateChunk(updatedChunks[0]);
          console.log("\u2705 Chunk structure validation passed");
        } catch (error) {
          console.warn("\u26A0\uFE0F  Chunk validation warning:", error);
        }
      }
      return {
        sourceId: args.source.title,
        chunks: updatedChunks
      };
    },
    async index(chunks) {
      if (debug) {
        console.log(`\u{1F4DA} Indexing ${chunks.length} chunks...`);
      }
      const texts = chunks.map((chunk) => chunk.text);
      const embeddings = await config.embeddings.embed(texts);
      if (debug) {
        console.log(`\u{1F9E0} Generated ${embeddings.length} embeddings (${config.embeddings.dim}D)`);
      }
      const rows = chunks.map((chunk, i) => ({
        chunk,
        embedding: embeddings[i]
      }));
      await config.vector.upsert(rows);
      if (config.lexical) {
        await config.lexical.index(chunks);
        if (debug) {
          console.log(`\u{1F524} Indexed in lexical store: ${config.lexical.name}`);
        }
      }
      if (debug) {
        console.log("\u2705 Indexing completed");
      }
    },
    async query(q, opts = {}) {
      if (debug) {
        console.log(`\u{1F50D} Querying: "${q}"`);
        console.log(`\u2699\uFE0F  Options: k=${opts.k || 10}, hybrid=${opts.hybrid ?? !!config.lexical}, rerank=${opts.rerank ?? !!config.reranker}`);
      }
      const { k = 10, hybrid = !!config.lexical, rerank = !!config.reranker } = opts;
      let results = [];
      if (hybrid && config.lexical) {
        if (debug) {
          console.log("\u{1F504} Using hybrid search (dense + lexical)");
        }
        const [queryEmbedding] = await config.embeddings.embed([q]);
        const denseResults = await config.vector.searchByVector(queryEmbedding, k);
        const lexicalResults = await config.lexical.search(q, k);
        if (debug) {
          console.log(`\u{1F4CA} Dense results: ${denseResults.length}, Lexical results: ${lexicalResults.length}`);
        }
        if (debug) {
          const overlap = analyzeHybridOverlap(denseResults, lexicalResults);
          console.log(`\u{1F504} Search overlap: ${overlap.overlapCount} shared, ${overlap.denseOnlyCount} dense-only, ${overlap.lexicalOnlyCount} lexical-only`);
          console.log(`\u{1F4CA} Complementary score: ${(overlap.complementaryScore * 100).toFixed(1)}%`);
        }
        const hybridOptions = config.hybrid || {};
        results = mergeHybridResults(denseResults, lexicalResults, { ...hybridOptions, k });
      } else {
        if (debug) {
          console.log("\u{1F504} Using dense-only search");
        }
        const [queryEmbedding] = await config.embeddings.embed([q]);
        results = await config.vector.searchByVector(queryEmbedding, k);
      }
      if (rerank && config.reranker && results.length > 0) {
        if (debug) {
          console.log(`\u{1F3AF} Applying reranking with ${config.reranker.name}`);
        }
        const chunks = results.map((r) => r.chunk);
        const rerankedIndices = await config.reranker.rerank(q, chunks);
        results = rerankedIndices.map((idx) => results[idx]);
      }
      if (debug) {
        console.log(`\u{1F4CB} Final results: ${results.length}`);
        if (results.length > 0) {
          OrquelUtils.inspectQueryResults(results);
        }
      }
      return { results };
    },
    async answer(q, opts = {}) {
      if (debug) {
        console.log(`\u{1F4AC} Generating answer for: "${q}"`);
        console.log(`\u2699\uFE0F  Options: topK=${opts.topK || 4}`);
      }
      const { topK = 4 } = opts;
      if (!config.answerer) {
        throw new Error("No answerer configured");
      }
      const { results } = await this.query(q, { k: topK });
      const contexts = results.map((r) => r.chunk);
      if (debug) {
        console.log(`\u{1F4DA} Using ${contexts.length} contexts for answer generation`);
        console.log(`\u{1F916} Generating answer with ${config.answerer.name}...`);
        console.log("\u{1F4DD} Context summary:", OrquelUtils.summarizeContexts(contexts));
      }
      const answer = await config.answerer.answer({
        query: q,
        contexts
      });
      if (debug) {
        console.log(`\u2705 Answer generated (${answer.length} characters)`);
        if (answer.length > 150) {
          console.log(`\u{1F4D6} Answer preview: "${answer.substring(0, 150)}..."`);
        } else {
          console.log(`\u{1F4D6} Full answer: "${answer}"`);
        }
      }
      return { answer, contexts };
    }
  };
}

// src/evaluation.ts
var RAGEvaluator = class {
  orquel;
  constructor(orquel) {
    this.orquel = orquel;
  }
  /**
   * Evaluate the RAG system against ground truth queries
   * 
   * @example
   * ```typescript
   * const evaluator = new RAGEvaluator(orq);
   * 
   * const groundTruth = [
   *   {
   *     query: "What is the capital of Argentina?",
   *     relevantChunkIds: ["argentina-geography-1", "argentina-cities-2"],
   *     expectedAnswer: "Buenos Aires",
   *     expectedKeywords: ["Buenos Aires", "capital"]
   *   }
   * ];
   * 
   * const metrics = await evaluator.evaluate(groundTruth);
   * console.log(`F1 Score: ${metrics.f1Score.toFixed(3)}`);
   * ```
   */
  async evaluate(groundTruthQueries, config = {}) {
    const {
      k = 10,
      hybrid = false,
      rerank = false,
      evaluateAnswers = false
    } = config;
    const queryResults = [];
    let totalResponseTime = 0;
    for (const groundTruth of groundTruthQueries) {
      const startTime = Date.now();
      try {
        const { results } = await this.orquel.query(groundTruth.query, {
          k,
          hybrid,
          rerank
        });
        const responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;
        const retrievedChunkIds = results.map((r) => r.chunk.id);
        const evaluation = this.evaluateQuery(
          groundTruth.query,
          retrievedChunkIds,
          groundTruth.relevantChunkIds,
          results
        );
        let answer;
        let answerScore;
        if (evaluateAnswers && groundTruth.expectedAnswer) {
          try {
            const answerResult = await this.orquel.answer(groundTruth.query);
            answer = answerResult.answer;
            answerScore = this.evaluateAnswer(
              answer,
              groundTruth.expectedAnswer,
              groundTruth.expectedKeywords
            );
          } catch (answerError) {
            console.warn(`Answer generation failed for query "${groundTruth.query}":`, answerError);
          }
        }
        const result = {
          ...evaluation,
          responseTime
        };
        if (answer !== void 0) {
          result.answer = answer;
        }
        if (answerScore !== void 0) {
          result.answerScore = answerScore;
        }
        queryResults.push(result);
      } catch (error) {
        console.warn(`Failed to evaluate query "${groundTruth.query}":`, error);
        queryResults.push({
          query: groundTruth.query,
          retrievedChunkIds: [],
          relevantChunkIds: groundTruth.relevantChunkIds,
          precision: 0,
          recall: 0,
          f1Score: 0,
          reciprocalRank: 0,
          dcg: 0,
          ndcg: 0,
          hasRelevantResult: false,
          responseTime: Date.now() - startTime
        });
      }
    }
    return this.aggregateMetrics(queryResults, totalResponseTime);
  }
  /**
   * Evaluate a single query against ground truth
   */
  evaluateQuery(query, retrievedChunkIds, relevantChunkIds, results) {
    const relevantSet = new Set(relevantChunkIds);
    const retrievedRelevant = retrievedChunkIds.filter((id) => relevantSet.has(id));
    const precision = retrievedChunkIds.length > 0 ? retrievedRelevant.length / retrievedChunkIds.length : 0;
    const recall = relevantChunkIds.length > 0 ? retrievedRelevant.length / relevantChunkIds.length : 0;
    const f1Score = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    let reciprocalRank = 0;
    for (let i = 0; i < retrievedChunkIds.length; i++) {
      if (relevantSet.has(retrievedChunkIds[i])) {
        reciprocalRank = 1 / (i + 1);
        break;
      }
    }
    const { dcg, ndcg } = this.calculateNDCG(retrievedChunkIds, relevantChunkIds);
    const hasRelevantResult = retrievedRelevant.length > 0;
    return {
      query,
      retrievedChunkIds,
      relevantChunkIds,
      precision,
      recall,
      f1Score,
      reciprocalRank,
      dcg,
      ndcg,
      hasRelevantResult,
      responseTime: 0
      // Will be set by caller
    };
  }
  /**
   * Calculate Discounted Cumulative Gain and Normalized DCG
   */
  calculateNDCG(retrievedChunkIds, relevantChunkIds) {
    const relevantSet = new Set(relevantChunkIds);
    let dcg = 0;
    for (let i = 0; i < retrievedChunkIds.length; i++) {
      const relevance = relevantSet.has(retrievedChunkIds[i]) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2);
    }
    let idcg = 0;
    for (let i = 0; i < Math.min(relevantChunkIds.length, retrievedChunkIds.length); i++) {
      idcg += 1 / Math.log2(i + 2);
    }
    const ndcg = idcg > 0 ? dcg / idcg : 0;
    return { dcg, ndcg };
  }
  /**
   * Evaluate answer quality against expected answer
   */
  evaluateAnswer(actualAnswer, expectedAnswer, expectedKeywords) {
    if (!actualAnswer) {
      return 0;
    }
    let score = 0;
    const actualLower = actualAnswer.toLowerCase();
    const expectedLower = expectedAnswer.toLowerCase();
    const actualWords = new Set(actualLower.split(/\s+/));
    const expectedWords = new Set(expectedLower.split(/\s+/));
    const intersection = new Set([...actualWords].filter((w) => expectedWords.has(w)));
    const union = /* @__PURE__ */ new Set([...actualWords, ...expectedWords]);
    if (union.size > 0) {
      score += intersection.size / union.size * 0.5;
    }
    if (expectedKeywords) {
      let keywordScore = 0;
      for (const keyword of expectedKeywords) {
        if (actualLower.includes(keyword.toLowerCase())) {
          keywordScore++;
        }
      }
      score += keywordScore / expectedKeywords.length * 0.5;
    }
    return Math.min(score, 1);
  }
  /**
   * Aggregate individual query results into overall metrics
   */
  aggregateMetrics(queryResults, totalResponseTime) {
    if (queryResults.length === 0) {
      return {
        precision: 0,
        recall: 0,
        f1Score: 0,
        mrr: 0,
        ndcg: 0,
        hitRate: 0,
        avgResponseTime: 0
      };
    }
    const totalQueries = queryResults.length;
    const precision = queryResults.reduce((sum, r) => sum + r.precision, 0) / totalQueries;
    const recall = queryResults.reduce((sum, r) => sum + r.recall, 0) / totalQueries;
    const f1Score = queryResults.reduce((sum, r) => sum + r.f1Score, 0) / totalQueries;
    const mrr = queryResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / totalQueries;
    const ndcg = queryResults.reduce((sum, r) => sum + r.ndcg, 0) / totalQueries;
    const hitRate = queryResults.filter((r) => r.hasRelevantResult).length / totalQueries;
    const avgResponseTime = totalResponseTime / totalQueries;
    return {
      precision,
      recall,
      f1Score,
      mrr,
      ndcg,
      hitRate,
      avgResponseTime
    };
  }
  /**
   * Generate detailed evaluation report
   */
  async generateReport(groundTruthQueries, config = {}) {
    const metrics = await this.evaluate(groundTruthQueries, config);
    const { k = 10, hybrid = false, rerank = false } = config;
    const report = `
# RAG System Evaluation Report

## Configuration
- **Retrieval K**: ${k}
- **Hybrid Search**: ${hybrid ? "Enabled" : "Disabled"}
- **Reranking**: ${rerank ? "Enabled" : "Disabled"}
- **Total Queries**: ${groundTruthQueries.length}

## Overall Performance

| Metric | Score | Description |
|--------|-------|-------------|
| **Precision** | ${metrics.precision.toFixed(3)} | Fraction of retrieved chunks that are relevant |
| **Recall** | ${metrics.recall.toFixed(3)} | Fraction of relevant chunks that were retrieved |
| **F1 Score** | ${metrics.f1Score.toFixed(3)} | Harmonic mean of precision and recall |
| **MRR** | ${metrics.mrr.toFixed(3)} | Mean Reciprocal Rank of first relevant result |
| **NDCG** | ${metrics.ndcg.toFixed(3)} | Normalized Discounted Cumulative Gain |
| **Hit Rate** | ${(metrics.hitRate * 100).toFixed(1)}% | Percentage of queries with \u22651 relevant result |
| **Avg Response Time** | ${metrics.avgResponseTime.toFixed(1)}ms | Average query response time |

## Performance Interpretation

### Quality Assessment
${this.getPerformanceAssessment(metrics)}

### Recommendations
${this.getRecommendations(metrics)}

## Benchmarking Context

For reference, typical RAG system performance ranges:
- **Good**: Precision > 0.7, Recall > 0.6, F1 > 0.65
- **Acceptable**: Precision > 0.5, Recall > 0.4, F1 > 0.45
- **Needs Improvement**: F1 < 0.45

---
*Generated by Orquel RAG Evaluator*
`.trim();
    return report;
  }
  /**
   * Get performance assessment based on metrics
   */
  getPerformanceAssessment(metrics) {
    const { precision, recall, f1Score, hitRate } = metrics;
    if (f1Score >= 0.7) {
      return "\u{1F7E2} **Excellent**: Your RAG system is performing very well with high precision and recall.";
    } else if (f1Score >= 0.55) {
      return "\u{1F7E1} **Good**: Your RAG system shows solid performance with room for optimization.";
    } else if (f1Score >= 0.4) {
      return "\u{1F7E0} **Fair**: Your RAG system is functional but would benefit from improvements.";
    } else {
      return "\u{1F534} **Needs Improvement**: Your RAG system requires significant optimization.";
    }
  }
  /**
   * Get recommendations based on metrics
   */
  getRecommendations(metrics) {
    const recommendations = [];
    const { precision, recall, f1Score, hitRate, avgResponseTime } = metrics;
    if (precision < 0.6) {
      recommendations.push("\u2022 **Low Precision**: Consider improving chunk quality, using reranking, or refining embedding model");
    }
    if (recall < 0.5) {
      recommendations.push("\u2022 **Low Recall**: Try increasing k parameter, using hybrid search, or improving chunking strategy");
    }
    if (hitRate < 0.8) {
      recommendations.push("\u2022 **Low Hit Rate**: Consider expanding knowledge base coverage or improving query understanding");
    }
    if (avgResponseTime > 2e3) {
      recommendations.push("\u2022 **Slow Response**: Optimize vector search, consider caching, or use faster embedding models");
    }
    if (precision > 0.8 && recall < 0.5) {
      recommendations.push("\u2022 **High Precision, Low Recall**: Increase retrieval breadth with higher k or hybrid search");
    }
    if (recall > 0.8 && precision < 0.5) {
      recommendations.push("\u2022 **High Recall, Low Precision**: Add reranking or improve chunk relevance filtering");
    }
    return recommendations.length > 0 ? recommendations.join("\n") : "\u2022 Your system is well-balanced. Consider A/B testing different configurations for marginal gains.";
  }
};
function createSampleEvaluationDataset() {
  return [
    {
      query: "What is Argentina?",
      relevantChunkIds: ["geography-argentina-1", "overview-argentina-1"],
      expectedAnswer: "Argentina is a country in South America",
      expectedKeywords: ["country", "South America", "Argentina"]
    },
    {
      query: "What is the capital of Argentina?",
      relevantChunkIds: ["cities-argentina-1", "buenos-aires-1"],
      expectedAnswer: "Buenos Aires is the capital of Argentina",
      expectedKeywords: ["Buenos Aires", "capital"]
    },
    {
      query: "Tell me about Argentine culture",
      relevantChunkIds: ["culture-argentina-1", "traditions-argentina-1", "arts-argentina-1"],
      expectedAnswer: "Argentine culture is influenced by European immigration",
      expectedKeywords: ["culture", "European", "traditions"]
    },
    {
      query: "What foods are popular in Argentina?",
      relevantChunkIds: ["food-argentina-1", "cuisine-argentina-1", "gastronomy-argentina-1"],
      expectedAnswer: "Argentina is famous for beef, empanadas, and mate",
      expectedKeywords: ["beef", "empanadas", "mate", "asado"]
    }
  ];
}

// src/benchmark.ts
function generateTestChunks(count, dimensions) {
  const chunks = [];
  const sampleTexts = [
    "Machine learning algorithms process vast amounts of data to identify patterns and make predictions.",
    "Database systems provide structured storage and efficient retrieval of information using SQL queries.",
    "Web development frameworks simplify the creation of dynamic user interfaces and server-side applications.",
    "Cloud computing platforms enable scalable deployment of applications with global availability and reliability.",
    "Artificial intelligence research focuses on creating systems that can perform tasks requiring human-like intelligence.",
    "Software architecture patterns help organize code for maintainability, scalability, and testability.",
    "Data analysis techniques extract meaningful insights from raw information to support decision making.",
    "Network protocols ensure reliable communication between distributed systems across the internet.",
    "Security measures protect digital assets from unauthorized access and malicious attacks.",
    "User experience design prioritizes intuitive interfaces that enhance user satisfaction and engagement."
  ];
  for (let i = 0; i < count; i++) {
    const textIndex = i % sampleTexts.length;
    const baseText = sampleTexts[textIndex];
    chunks.push({
      chunk: {
        id: `benchmark-chunk-${i}`,
        text: `${baseText} This is chunk number ${i} with unique content for testing purposes.`,
        index: i,
        hash: `hash-${i}`,
        source: {
          title: `Benchmark Document ${Math.floor(i / 10)}`,
          kind: "md"
        },
        metadata: {
          benchmarkId: i,
          category: ["ai", "database", "web", "cloud", "security"][i % 5]
        }
      },
      embedding: generateRandomEmbedding(dimensions)
    });
  }
  return chunks;
}
function generateRandomEmbedding(dimensions) {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}
function generateSearchQueries(count) {
  const queryTexts = [
    "machine learning algorithms",
    "database query optimization",
    "web application security",
    "cloud computing scalability",
    "artificial intelligence research",
    "software architecture patterns",
    "data analysis techniques",
    "network communication protocols",
    "user interface design",
    "system performance monitoring"
  ];
  const queries = [];
  for (let i = 0; i < count; i++) {
    const text = queryTexts[i % queryTexts.length] + ` query ${i}`;
    queries.push({
      text,
      embedding: generateRandomEmbedding(1536)
      // Default to OpenAI dimensions
    });
  }
  return queries;
}
function measureMemory() {
  if (typeof process !== "undefined" && process.memoryUsage) {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
  }
  return 0;
}
async function benchmarkVectorStore(adapter, config) {
  const metrics = [];
  const startMemory = measureMemory();
  console.log(`\u{1F52C} Benchmarking ${adapter.name}...`);
  for (const chunkCount of config.chunkCounts) {
    console.log(`  \u{1F4CA} Testing with ${chunkCount} chunks...`);
    const testChunks = generateTestChunks(chunkCount, config.dimensions);
    const queries = generateSearchQueries(config.searchQueries);
    if (config.warmupRuns && config.warmupRuns > 0) {
      const warmupChunks = generateTestChunks(Math.min(100, chunkCount), config.dimensions);
      for (let i = 0; i < config.warmupRuns; i++) {
        await adapter.upsert(warmupChunks.slice(0, 10));
        await adapter.searchByVector(queries[0]?.embedding || [], config.k);
      }
      await adapter.clear();
    }
    const upsertTimes = [];
    for (let run = 0; run < config.runs; run++) {
      await adapter.clear();
      const start = performance.now();
      await adapter.upsert(testChunks);
      const end = performance.now();
      upsertTimes.push(end - start);
    }
    const avgUpsertTime = upsertTimes.reduce((sum, time) => sum + time, 0) / upsertTimes.length;
    metrics.push({
      operation: "upsert",
      itemCount: chunkCount,
      duration: avgUpsertTime,
      throughput: chunkCount / (avgUpsertTime / 1e3),
      memoryMB: measureMemory(),
      metadata: {
        minTime: Math.min(...upsertTimes),
        maxTime: Math.max(...upsertTimes),
        stdDev: Math.sqrt(upsertTimes.reduce((sum, time) => sum + Math.pow(time - avgUpsertTime, 2), 0) / upsertTimes.length)
      }
    });
    const searchTimes = [];
    for (let run = 0; run < config.runs; run++) {
      for (const query of queries) {
        const start = performance.now();
        const results = await adapter.searchByVector(query.embedding, config.k);
        const end = performance.now();
        searchTimes.push(end - start);
        if (results.length === 0 && chunkCount > 0) {
          console.warn(`  \u26A0\uFE0F No results returned for search with ${chunkCount} chunks`);
        }
      }
    }
    const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
    metrics.push({
      operation: "search",
      itemCount: chunkCount,
      duration: avgSearchTime,
      throughput: 1e3 / avgSearchTime,
      // Searches per second
      memoryMB: measureMemory(),
      metadata: {
        queriesPerRun: queries.length,
        minTime: Math.min(...searchTimes),
        maxTime: Math.max(...searchTimes),
        p95Time: searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)]
      }
    });
  }
  const peakMemory = Math.max(...metrics.map((m) => m.memoryMB || 0));
  const avgUpsertThroughput = metrics.filter((m) => m.operation === "upsert").reduce((sum, m) => sum + m.throughput, 0) / metrics.filter((m) => m.operation === "upsert").length;
  const avgSearchLatency = metrics.filter((m) => m.operation === "search").reduce((sum, m) => sum + m.duration, 0) / metrics.filter((m) => m.operation === "search").length;
  let recommendation = "";
  if (avgUpsertThroughput > 1e3) {
    recommendation = "Excellent performance for production use";
  } else if (avgUpsertThroughput > 100) {
    recommendation = "Good performance for most applications";
  } else {
    recommendation = "Suitable for development and small-scale use";
  }
  if (avgSearchLatency > 100) {
    recommendation += ". Consider optimizing for search latency.";
  }
  return {
    adapterName: adapter.name,
    config,
    metrics,
    summary: {
      avgUpsertThroughput,
      avgSearchLatency,
      peakMemoryMB: peakMemory,
      recommendation
    },
    timestamp: /* @__PURE__ */ new Date()
  };
}
async function benchmarkLexicalStore(adapter, config) {
  const metrics = [];
  console.log(`\u{1F52C} Benchmarking lexical adapter ${adapter.name}...`);
  for (const chunkCount of config.chunkCounts) {
    console.log(`  \u{1F4CA} Testing with ${chunkCount} chunks...`);
    const testChunks = generateTestChunks(chunkCount, config.dimensions).map((c) => c.chunk);
    const queries = generateSearchQueries(config.searchQueries);
    const indexTimes = [];
    for (let run = 0; run < config.runs; run++) {
      const start = performance.now();
      await adapter.index(testChunks);
      const end = performance.now();
      indexTimes.push(end - start);
    }
    const avgIndexTime = indexTimes.reduce((sum, time) => sum + time, 0) / indexTimes.length;
    metrics.push({
      operation: "index",
      itemCount: chunkCount,
      duration: avgIndexTime,
      throughput: chunkCount / (avgIndexTime / 1e3),
      memoryMB: measureMemory()
    });
    const searchTimes = [];
    for (let run = 0; run < config.runs; run++) {
      for (const query of queries) {
        const start = performance.now();
        const results = await adapter.search(query.text, config.k);
        const end = performance.now();
        searchTimes.push(end - start);
      }
    }
    const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
    metrics.push({
      operation: "search",
      itemCount: chunkCount,
      duration: avgSearchTime,
      throughput: 1e3 / avgSearchTime,
      memoryMB: measureMemory()
    });
  }
  const avgIndexThroughput = metrics.filter((m) => m.operation === "index").reduce((sum, m) => sum + m.throughput, 0) / metrics.filter((m) => m.operation === "index").length;
  const avgSearchLatency = metrics.filter((m) => m.operation === "search").reduce((sum, m) => sum + m.duration, 0) / metrics.filter((m) => m.operation === "search").length;
  return {
    adapterName: adapter.name,
    config,
    metrics,
    summary: {
      avgUpsertThroughput: avgIndexThroughput,
      avgSearchLatency,
      recommendation: avgSearchLatency < 50 ? "Excellent lexical search performance" : "Good lexical search performance"
    },
    timestamp: /* @__PURE__ */ new Date()
  };
}
function compareResults(results) {
  const bestPerformers = {};
  const ratios = {};
  const operations = ["upsert", "search", "index"];
  for (const operation of operations) {
    let bestThroughput = 0;
    let bestAdapter = "";
    for (const result of results) {
      const opMetrics = result.metrics.filter((m) => m.operation === operation);
      if (opMetrics.length > 0) {
        const avgThroughput = opMetrics.reduce((sum, m) => sum + m.throughput, 0) / opMetrics.length;
        if (avgThroughput > bestThroughput) {
          bestThroughput = avgThroughput;
          bestAdapter = result.adapterName;
        }
      }
    }
    if (bestAdapter) {
      bestPerformers[operation] = bestAdapter;
    }
  }
  for (const result1 of results) {
    ratios[result1.adapterName] = {};
    for (const result2 of results) {
      if (result1.adapterName !== result2.adapterName) {
        const ratio1 = result1.summary.avgUpsertThroughput / result2.summary.avgUpsertThroughput;
        const ratiosForAdapter = ratios[result1.adapterName];
        if (ratiosForAdapter) {
          ratiosForAdapter[result2.adapterName] = ratio1;
        }
      }
    }
  }
  const recommendations = {
    development: results.find((r) => r.adapterName.includes("memory"))?.adapterName || results[0]?.adapterName + " (fast iteration)",
    production: bestPerformers.upsert || results[0]?.adapterName || "unknown",
    largescale: bestPerformers.search || results[0]?.adapterName || "unknown"
  };
  return {
    results,
    analysis: {
      bestPerformers,
      ratios,
      recommendations
    }
  };
}
function generateReport(comparison) {
  const { results, analysis } = comparison;
  let report = "# Orquel Performance Benchmark Report\n\n";
  report += `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}

`;
  report += "## Summary\n\n";
  report += "| Adapter | Avg Upsert Throughput | Avg Search Latency | Peak Memory | Recommendation |\n";
  report += "|---------|----------------------|-------------------|-------------|----------------|\n";
  for (const result of results) {
    const throughput = result.summary.avgUpsertThroughput.toFixed(1);
    const latency = result.summary.avgSearchLatency.toFixed(2);
    const memory = result.summary.peakMemoryMB?.toFixed(1) || "N/A";
    const rec = result.summary.recommendation;
    report += `| ${result.adapterName} | ${throughput} items/s | ${latency}ms | ${memory}MB | ${rec} |
`;
  }
  report += "\n## Best Performers\n\n";
  for (const [operation, adapter] of Object.entries(analysis.bestPerformers)) {
    report += `- **${operation}**: ${adapter}
`;
  }
  report += "\n## Recommendations\n\n";
  report += `- **Development**: ${analysis.recommendations.development}
`;
  report += `- **Production**: ${analysis.recommendations.production}
`;
  report += `- **Large Scale**: ${analysis.recommendations.largescale}
`;
  report += "\n## Detailed Metrics\n\n";
  for (const result of results) {
    report += `### ${result.adapterName}

`;
    for (const metric of result.metrics) {
      report += `**${metric.operation}** (${metric.itemCount} items):
`;
      report += `- Duration: ${metric.duration.toFixed(2)}ms
`;
      report += `- Throughput: ${metric.throughput.toFixed(2)} ops/s
`;
      if (metric.memoryMB) {
        report += `- Memory: ${metric.memoryMB.toFixed(1)}MB
`;
      }
      report += "\n";
    }
  }
  return report;
}
var DEFAULT_BENCHMARK_CONFIG = {
  chunkCounts: [10, 50, 100, 500],
  dimensions: 1536,
  // OpenAI text-embedding-3-small
  searchQueries: 5,
  k: 10,
  runs: 3,
  warmupRuns: 1
};
var COMPREHENSIVE_BENCHMARK_CONFIG = {
  chunkCounts: [100, 500, 1e3, 5e3, 1e4],
  dimensions: 1536,
  searchQueries: 20,
  k: 10,
  runs: 5,
  warmupRuns: 3
};
export {
  COMPREHENSIVE_BENCHMARK_CONFIG,
  DEFAULT_BENCHMARK_CONFIG,
  OrquelUtils,
  RAGEvaluator,
  analyzeHybridOverlap,
  benchmarkLexicalStore,
  benchmarkVectorStore,
  compareResults,
  createOrquel,
  createSampleEvaluationDataset,
  defaultChunker,
  generateReport,
  generateSearchQueries,
  generateTestChunks,
  mergeHybridResults,
  normalizeScores,
  reciprocalRankFusion,
  weightedScoreCombination
};
//# sourceMappingURL=index.js.map