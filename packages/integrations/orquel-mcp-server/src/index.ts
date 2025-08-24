// Re-export everything from orquel-manager for easy usage
export * from './orquel-manager.js';

// Export types for configuration
export type { OrquelMcpConfig } from './orquel-manager.js';

// Re-export core Orquel types that users might need
export type {
  Orquel,
  OrquelConfig,
  IngestArgs,
  QueryOptions,
  AnswerOptions,
  Chunk,
  SearchResult,
  EmbeddingsAdapter,
  VectorStoreAdapter,
  LexicalAdapter,
  RerankerAdapter,
  AnswerAdapter,
} from '@orquel/core';