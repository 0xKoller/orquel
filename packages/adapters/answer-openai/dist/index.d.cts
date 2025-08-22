import { AnswerAdapter } from '@orquel/core';

interface OpenAIAnswererOptions {
    apiKey?: string;
    model?: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
    temperature?: number;
    maxTokens?: number;
    maxRetries?: number;
    systemPrompt?: string;
}
declare function openAIAnswerer(options?: OpenAIAnswererOptions): AnswerAdapter;

export { type OpenAIAnswererOptions, openAIAnswerer };
