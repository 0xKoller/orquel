// src/index.ts
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
export {
  memoryStore
};
//# sourceMappingURL=index.js.map