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
  memoryStore: () => memoryStore
});
module.exports = __toCommonJS(index_exports);
function memoryStore() {
  const chunks = [];
  return {
    name: "memory-store",
    async upsert(rows) {
      for (const row of rows) {
        const existingIndex = chunks.findIndex((c) => c.id === row.id);
        if (existingIndex >= 0) {
          chunks.splice(existingIndex, 1);
        }
        chunks.push({
          ...row,
          embedding: [...row.embedding]
          // Copy to avoid mutations
        });
      }
    },
    async searchByVector(query, k) {
      if (chunks.length === 0) {
        return [];
      }
      const similarities = chunks.map((chunk) => ({
        chunk: {
          id: chunk.id,
          text: chunk.text,
          metadata: chunk.metadata
        },
        score: cosineSimilarity(query, chunk.embedding)
      }));
      return similarities.sort((a, b) => b.score - a.score).slice(0, k);
    }
  };
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (normA * normB);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  memoryStore
});
//# sourceMappingURL=index.cjs.map