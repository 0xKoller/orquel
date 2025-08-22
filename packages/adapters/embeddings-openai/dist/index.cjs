"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  openAIEmbeddings: () => openAIEmbeddings
});
module.exports = __toCommonJS(index_exports);
var import_openai = __toESM(require("openai"), 1);
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
  const openai = new import_openai.default({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  openAIEmbeddings
});
//# sourceMappingURL=index.cjs.map