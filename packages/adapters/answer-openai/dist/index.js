// src/index.ts
import OpenAI from "openai";
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
  const openai = new OpenAI({
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
export {
  openAIAnswerer
};
//# sourceMappingURL=index.js.map