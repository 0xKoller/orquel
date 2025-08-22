// src/index.ts
import OpenAI from "openai";
var MODEL_DIMENSIONS = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536
};
function openAIEmbeddings(options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    model = "text-embedding-3-small",
    batchSize = 100,
    maxRetries = 3
  } = options;
  if (!apiKey) {
    throw new Error(
      "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey option."
    );
  }
  const openai = new OpenAI({
    apiKey,
    maxRetries
  });
  const dim = MODEL_DIMENSIONS[model];
  return {
    name: `openai-${model}`,
    dim,
    async embed(texts) {
      if (texts.length === 0) {
        return [];
      }
      const results = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        try {
          const response = await openai.embeddings.create({
            model,
            input: batch,
            encoding_format: "float"
          });
          const embeddings = response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
          results.push(...embeddings);
        } catch (error) {
          throw new Error(
            `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
      return results;
    }
  };
}
export {
  openAIEmbeddings
};
//# sourceMappingURL=index.js.map