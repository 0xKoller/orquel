/**
 * A chunk of text with metadata for retrieval and indexing
 */
interface Chunk {
    /** Unique identifier for the chunk */
    id: string;
    /** The text content of the chunk */
    text: string;
    /** Metadata about the chunk */
    metadata: {
        /** Source document information */
        source: IngestSource;
        /** Index of this chunk within the source document */
        chunkIndex: number;
        /** Number of tokens (optional) */
        tokens?: number;
        /** Content hash for deduplication */
        hash: string;
    };
}
/**
 * Information about a source document being ingested
 */
interface IngestSource {
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
interface EmbeddingsAdapter {
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
 * Adapter for storing and searching vector embeddings
 */
interface VectorStoreAdapter {
    /** Human-readable name of the adapter */
    name: string;
    /**
     * Insert or update chunks with their embeddings
     * @param rows - Array of chunks with their embedding vectors
     */
    upsert(rows: Array<Chunk & {
        embedding: number[];
    }>): Promise<void>;
    /**
     * Search for similar vectors
     * @param query - Query embedding vector
     * @param k - Number of results to return
     * @returns Promise resolving to array of chunks with similarity scores
     */
    searchByVector(query: number[], k: number): Promise<Array<{
        chunk: Chunk;
        score: number;
    }>>;
}
/**
 * Adapter for traditional keyword-based text search
 */
interface LexicalAdapter {
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
     * @returns Promise resolving to array of chunks with relevance scores
     */
    search(text: string, k: number): Promise<Array<{
        chunk: Chunk;
        score: number;
    }>>;
}
/**
 * Adapter for improving search result relevance through reranking
 */
interface RerankerAdapter {
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
interface AnswerAdapter {
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
 * Configuration for creating an Orquel instance
 */
interface OrquelConfig {
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
    /** Optional custom chunking function */
    chunker?: (text: string) => Chunk[];
}
/**
 * Arguments for the ingest operation
 */
interface IngestArgs {
    /** Information about the source document */
    source: IngestSource;
    /** Document content as string or buffer */
    content: string | Buffer;
}
/**
 * Options for query operations
 */
interface QueryOptions {
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
interface AnswerOptions {
    /** Number of top chunks to use as context (default: 4) */
    topK?: number;
}
/**
 * Main Orquel orchestrator interface
 */
interface Orquel {
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
    query(q: string, opts?: QueryOptions): Promise<{
        results: Array<{
            chunk: Chunk;
            score: number;
        }>;
    }>;
    /**
     * Generate an answer to a question using retrieved context
     * @param q - Question string
     * @param opts - Optional answer generation configuration
     * @returns Promise resolving to answer and context chunks used
     */
    answer(q: string, opts?: AnswerOptions): Promise<{
        answer: string;
        contexts: Chunk[];
    }>;
}

/**
 * Create a new Orquel instance with the specified configuration
 *
 * @param config - Configuration object specifying adapters and options
 * @returns Configured Orquel instance
 *
 * @example
 * ```typescript
 * import { createOrquel } from '@orquel/core';
 * import { openAIEmbeddings } from '@orquel/embeddings-openai';
 * import { memoryStore } from '@orquel/store-memory';
 *
 * const orq = createOrquel({
 *   embeddings: openAIEmbeddings(),
 *   vector: memoryStore(),
 * });
 * ```
 */
declare function createOrquel(config: OrquelConfig): Orquel;

interface ChunkerOptions {
    maxChunkSize?: number;
    overlap?: number;
    respectMarkdownHeadings?: boolean;
}
/**
 * Default text chunking function with intelligent splitting
 *
 * Features:
 * - Configurable chunk size and overlap
 * - Markdown heading awareness
 * - Word boundary preservation
 * - Content deduplication by hash
 *
 * @param text - Input text to chunk
 * @param source - Source document information
 * @param options - Chunking configuration options
 * @returns Array of text chunks with metadata
 *
 * @example
 * ```typescript
 * const chunks = defaultChunker(
 *   '# Title\nContent here...',
 *   { title: 'My Doc', kind: 'md' },
 *   { maxChunkSize: 1000, overlap: 100 }
 * );
 * ```
 */
declare function defaultChunker(text: string, source: IngestSource, options?: ChunkerOptions): Chunk[];

export { type AnswerAdapter, type AnswerOptions, type Chunk, type ChunkerOptions, type EmbeddingsAdapter, type IngestArgs, type IngestSource, type LexicalAdapter, type Orquel, type OrquelConfig, type QueryOptions, type RerankerAdapter, type VectorStoreAdapter, createOrquel, defaultChunker };
