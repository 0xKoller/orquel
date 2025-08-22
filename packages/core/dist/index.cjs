"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createOrquel: () => createOrquel,
  defaultChunker: () => defaultChunker
});
module.exports = __toCommonJS(index_exports);

// src/chunker.ts
var import_node_crypto = require("crypto");
var DEFAULT_OPTIONS = {
  maxChunkSize: 1200,
  overlap: 150,
  respectMarkdownHeadings: true
};
function defaultChunker(text, source, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalized = normalizeText(text);
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
  const hash = (0, import_node_crypto.createHash)("sha256").update(text).digest("hex").slice(0, 16);
  return {
    id: `${source.title}-${chunkIndex}-${hash}`,
    text,
    metadata: {
      source,
      chunkIndex,
      hash
    }
  };
}
function deduplicateChunks(chunks) {
  const seen = /* @__PURE__ */ new Set();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.metadata.hash)) {
      return false;
    }
    seen.add(chunk.metadata.hash);
    return true;
  });
}

// src/orquel.ts
function createOrquel(config) {
  const chunker = config.chunker || ((text) => defaultChunker(text, { title: "Unknown" }));
  return {
    async ingest(args) {
      const content = typeof args.content === "string" ? args.content : args.content.toString("utf-8");
      const chunks = chunker(content);
      const updatedChunks = chunks.map((chunk) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          source: args.source
        }
      }));
      return {
        sourceId: args.source.title,
        chunks: updatedChunks
      };
    },
    async index(chunks) {
      const texts = chunks.map((chunk) => chunk.text);
      const embeddings = await config.embeddings.embed(texts);
      const rows = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i]
      }));
      await config.vector.upsert(rows);
      if (config.lexical) {
        await config.lexical.index(chunks);
      }
    },
    async query(q, opts = {}) {
      const { k = 10, hybrid = !!config.lexical, rerank = !!config.reranker } = opts;
      let results = [];
      if (hybrid && config.lexical) {
        const [queryEmbedding] = await config.embeddings.embed([q]);
        const denseResults = await config.vector.searchByVector(queryEmbedding, k);
        const lexicalResults = await config.lexical.search(q, k);
        results = mergeHybridResults(denseResults, lexicalResults, k);
      } else {
        const [queryEmbedding] = await config.embeddings.embed([q]);
        results = await config.vector.searchByVector(queryEmbedding, k);
      }
      if (rerank && config.reranker && results.length > 0) {
        const chunks = results.map((r) => r.chunk);
        const rerankedIndices = await config.reranker.rerank(q, chunks);
        results = rerankedIndices.map((idx) => results[idx]);
      }
      return { results };
    },
    async answer(q, opts = {}) {
      const { topK = 4 } = opts;
      if (!config.answerer) {
        throw new Error("No answerer configured");
      }
      const { results } = await this.query(q, { k: topK });
      const contexts = results.map((r) => r.chunk);
      const answer = await config.answerer.answer({
        query: q,
        contexts
      });
      return { answer, contexts };
    }
  };
}
function mergeHybridResults(denseResults, lexicalResults, k, denseWeight = 0.65, lexicalWeight = 0.35) {
  const normalizedDense = normalizeScores(denseResults);
  const normalizedLexical = normalizeScores(lexicalResults);
  const scoreMap = /* @__PURE__ */ new Map();
  for (const result of normalizedDense) {
    scoreMap.set(result.chunk.id, {
      chunk: result.chunk,
      score: result.score * denseWeight
    });
  }
  for (const result of normalizedLexical) {
    const existing = scoreMap.get(result.chunk.id);
    if (existing) {
      existing.score += result.score * lexicalWeight;
    } else {
      scoreMap.set(result.chunk.id, {
        chunk: result.chunk,
        score: result.score * lexicalWeight
      });
    }
  }
  return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score).slice(0, k);
}
function normalizeScores(results) {
  if (results.length === 0) return results;
  const scores = results.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  if (range === 0) {
    return results.map((r) => ({ ...r, score: 1 }));
  }
  return results.map((r) => ({
    ...r,
    score: (r.score - min) / range
  }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createOrquel,
  defaultChunker
});
//# sourceMappingURL=index.cjs.map