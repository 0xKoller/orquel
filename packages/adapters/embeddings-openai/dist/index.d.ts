import { EmbeddingsAdapter } from '@orquel/core';

interface OpenAIEmbeddingsOptions {
    apiKey?: string;
    model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
    batchSize?: number;
    maxRetries?: number;
}
declare function openAIEmbeddings(options?: OpenAIEmbeddingsOptions): EmbeddingsAdapter;

export { type OpenAIEmbeddingsOptions, openAIEmbeddings };
