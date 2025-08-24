/**
 * A chunk of text with metadata for retrieval and indexing
 */
export interface Chunk {
  /** Unique identifier for the chunk */
  id: string;
  /** The text content of the chunk */
  text: string;
  /** Index of this chunk within the source document */
  index: number;
  /** Content hash for deduplication */
  hash: string;
  /** Source document information */
  source: {
    /** Title or name of the document */
    title: string;
    /** Document type/format */
    kind?: string;
  };
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Information about a source document being ingested
 * 
 * @example
 * ```typescript
 * const source: IngestSource = {
 *   title: "Geography of Argentina",
 *   kind: "md",
 *   author: "Content Team",
 *   createdAt: new Date()
 * };
 * 
 * const { chunks } = await orq.ingest({
 *   source,
 *   content: "# Argentina\nArgentina is a country..."
 * });
 * ```
 */
export interface IngestSource {
  /** Title or name of the document */
  title: string;
  /** Document type/format */
  kind?: 'md' | 'txt' | 'pdf' | 'docx' | 'html';
  /** Source URL if available */
  url?: string;
  /** Document author */
  author?: string;
  /** Creation date */
  createdAt?: Date;
  /** Last modification date */
  updatedAt?: Date;
}

/**
 * Adapter for converting text to vector embeddings
 */
export interface EmbeddingsAdapter {
  /** Human-readable name of the adapter */
  name: string;
  /** Dimension of the output vectors */
  dim: number;
  /** 
   * Convert an array of texts to embeddings
   * @param texts - Array of text strings to embed
   * @returns Promise resolving to array of embedding vectors
   */
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * A chunk with its embedding vector
 */
export interface ChunkWithEmbedding {
  chunk: Chunk;
  embedding: number[];
}

/**
 * Search result with chunk and relevance information
 */
export interface SearchResult {
  chunk: Chunk;
  score: number;
  rank: number;
}

/**
 * Adapter for storing and searching vector embeddings
 */
export interface VectorStoreAdapter {
  /** Human-readable name of the adapter */
  name: string;
  /**
   * Insert or update chunks with their embeddings
   * @param rows - Array of chunks with their embedding vectors
   */
  upsert(rows: ChunkWithEmbedding[]): Promise<void>;
  /**
   * Search for similar vectors
   * @param query - Query embedding vector
   * @param k - Number of results to return
   * @returns Promise resolving to search results
   */
  searchByVector(query: number[], k: number): Promise<SearchResult[]>;
  /**
   * Search for chunks by their IDs
   * @param ids - Array of chunk IDs to retrieve
   * @returns Promise resolving to search results
   */
  searchByIds(ids: string[]): Promise<SearchResult[]>;
  /**
   * Delete chunks by their IDs
   * @param ids - Array of chunk IDs to delete
   */
  delete(ids: string[]): Promise<void>;
  /**
   * Clear all chunks from the store
   */
  clear(): Promise<void>;
  /**
   * Close the adapter and clean up resources
   */
  close(): Promise<void>;
}

/**
 * Adapter for traditional keyword-based text search
 */
export interface LexicalAdapter {
  /** Human-readable name of the adapter */
  name: string;
  /**
   * Index chunks for lexical search
   * @param chunks - Array of chunks to index
   */
  index(chunks: Chunk[]): Promise<void>;
  /**
   * Search using keywords and text matching
   * @param text - Search query text
   * @param k - Number of results to return
   * @returns Promise resolving to search results
   */
  search(text: string, k: number): Promise<SearchResult[]>;
  /**
   * Close the adapter and clean up resources
   */
  close(): Promise<void>;
}

/**
 * Adapter for improving search result relevance through reranking
 */
export interface RerankerAdapter {
  /** Human-readable name of the adapter */
  name: string;
  /**
   * Rerank search results for better relevance
   * @param query - Original search query
   * @param passages - Array of chunks to rerank
   * @returns Promise resolving to array of indices in relevance order
   */
  rerank(query: string, passages: Chunk[]): Promise<number[]>;
}

/**
 * Adapter for generating answers from retrieved contexts
 */
export interface AnswerAdapter {
  /** Human-readable name of the adapter */
  name: string;
  /**
   * Generate an answer based on query and context chunks
   * @param args - Object containing query and context chunks
   * @returns Promise resolving to generated answer text
   */
  answer(args: {
    query: string;
    contexts: Chunk[];
  }): Promise<string>;
}

/**
 * Configuration options for hybrid search
 */
export interface HybridSearchOptions {
  /** Weight for dense (vector) search results (default: 0.7) */
  denseWeight?: number;
  /** Weight for lexical search results (default: 0.3) */
  lexicalWeight?: number;
  /** Score normalization method (default: 'rrf') */
  normalizationMethod?: 'rrf' | 'minmax' | 'zscore';
}

/**
 * Configuration for creating an Orquel instance
 * 
 * @example
 * ```typescript
 * const orq = createOrquel({
 *   embeddings: openAIEmbeddings(),
 *   vector: memoryStore(),
 *   answerer: openAIAnswerer(),
 *   debug: true  // Enable debugging features
 * });
 * ```
 */
export interface OrquelConfig {
  /** Embeddings adapter for converting text to vectors */
  embeddings: EmbeddingsAdapter;
  /** Vector store adapter for storing and searching embeddings */
  vector: VectorStoreAdapter;
  /** Optional lexical search adapter for keyword-based search */
  lexical?: LexicalAdapter;
  /** Optional reranker adapter for improving search relevance */
  reranker?: RerankerAdapter;
  /** Optional answer adapter for generating responses */
  answerer?: AnswerAdapter;
  /** Optional hybrid search configuration */
  hybrid?: HybridSearchOptions;
  /** Optional custom chunking function */
  chunker?: (text: string) => Chunk[];
  /** Enable debug mode with additional logging and validation (default: false) */
  debug?: boolean;
}

/**
 * Arguments for the ingest operation
 */
export interface IngestArgs {
  /** Information about the source document */
  source: IngestSource;
  /** Document content as string or buffer */
  content: string | Buffer;
}

/**
 * Options for query operations
 */
export interface QueryOptions {
  /** Number of results to return (default: 10) */
  k?: number;
  /** Whether to use hybrid search combining dense and lexical (default: false) */
  hybrid?: boolean;
  /** Whether to apply reranking to improve relevance (default: false) */
  rerank?: boolean;
}

/**
 * Options for answer generation
 */
export interface AnswerOptions {
  /** Number of top chunks to use as context (default: 4) */
  topK?: number;
}

/**
 * Result from a query operation containing a chunk and its relevance score
 */
export interface QueryResult {
  /** The matching chunk */
  chunk: Chunk;
  /** Relevance score (higher is more relevant) */
  score: number;
}

/**
 * Main Orquel orchestrator interface
 */
export interface Orquel {
  /**
   * Ingest a document and convert it to searchable chunks
   * @param args - Ingest arguments containing source info and content
   * @returns Promise resolving to source ID and generated chunks
   */
  ingest(args: IngestArgs): Promise<{
    sourceId: string;
    chunks: Chunk[];
  }>;
  
  /**
   * Index chunks in the vector store and optional lexical store
   * @param chunks - Array of chunks to index
   */
  index(chunks: Chunk[]): Promise<void>;
  
  /**
   * Search for relevant chunks using the configured adapters
   * @param q - Search query string
   * @param opts - Optional query configuration
   * @returns Promise resolving to search results with scores
   */
  query(
    q: string,
    opts?: QueryOptions
  ): Promise<{
    results: Array<{ chunk: Chunk; score: number }>;
  }>;
  
  /**
   * Generate an answer to a question using retrieved context
   * @param q - Question string
   * @param opts - Optional answer generation configuration
   * @returns Promise resolving to answer and context chunks used
   */
  answer(
    q: string,
    opts?: AnswerOptions
  ): Promise<{
    answer: string;
    contexts: Chunk[];
  }>;
}