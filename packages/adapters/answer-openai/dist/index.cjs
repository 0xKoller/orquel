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
  openAIAnswerer: () => openAIAnswerer
});
module.exports = __toCommonJS(index_exports);
var import_openai = __toESM(require("openai"), 1);
var DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context. 
Follow these guidelines:
- Answer based only on the provided context
- If the context doesn't contain enough information, say so
- Be concise but comprehensive
- Use the same language as the question
- Include relevant details from the context`;
function openAIAnswerer(options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    model = "gpt-4",
    temperature = 0.1,
    maxTokens = 1e3,
    maxRetries = 3,
    systemPrompt = DEFAULT_SYSTEM_PROMPT
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
  return {
    name: `openai-${model}`,
    async answer(args) {
      const { query, contexts } = args;
      if (contexts.length === 0) {
        return "I don't have enough context to answer your question.";
      }
      const contextText = contexts.map((chunk, i) => `[${i + 1}] ${chunk.text.trim()}`).join("\n\n");
      const userPrompt = `Context:
${contextText}

Question: ${query}

Answer:`;
      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false
        });
        const answer = response.choices[0]?.message?.content?.trim();
        if (!answer) {
          throw new Error("No answer generated");
        }
        return answer;
      } catch (error) {
        throw new Error(
          `Failed to generate answer: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  openAIAnswerer
});
//# sourceMappingURL=index.cjs.map