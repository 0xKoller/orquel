/**
 * A chunk of text with metadata for retrieval and indexing
 *
 * @example
 * ```typescript
 * // Access chunk properties correctly:
 * console.log(chunk.text);                           // The text content
 * console.log(chunk.metadata.source.title);         // Source document title
 * console.log(chunk.metadata.chunkIndex);           // Position in document
 *
 * // Common mistake - DON'T do this:
 * // console.log(chunk.source.title); // ❌ Wrong! source is inside metadata
 *
 * // Use utility for safe access:
 * import { OrquelUtils } from '@orquel/core';
 * const title = OrquelUtils.getChunkTitle(chunk);    // ✅ Safe way
 * ```
 */
interface Chunk {
    /** Unique identifier for the chunk */
    id: string;
    /** The text content of the chunk */
    text: string;
    /** Metadata about the chunk */
    metadata: {
        /** Source document information - access via chunk.metadata.source */
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
    /** Enable debug mode with additional logging and validation (default: false) */
    debug?: boolean;
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
 * Result from a query operation containing a chunk and its relevance score
 */
interface QueryResult {
    /** The matching chunk */
    chunk: Chunk;
    /** Relevance score (higher is more relevant) */
    score: number;
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
 *   debug: true  // Enable debugging features
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

/**
 * Utility functions for common Orquel operations
 *
 * These utilities help prevent common mistakes and reduce boilerplate code
 * when working with Orquel data structures.
 *
 * @example
 * ```typescript
 * import { OrquelUtils } from '@orquel/core';
 *
 * // Get chunk title safely
 * const title = OrquelUtils.getChunkTitle(chunk);
 *
 * // Format search results for display
 * const formatted = OrquelUtils.formatSearchResults(results);
 * console.log(formatted);
 * ```
 */
declare class OrquelUtils {
    /**
     * Safely extract the title from a chunk's metadata
     *
     * @example
     * ```typescript
     * const chunk: Chunk = { id: 'test', text: 'content', metadata: { source: { title: 'Test' }, chunkIndex: 0, hash: 'abc' } };
     * const title = OrquelUtils.getChunkTitle(chunk);
     * console.log(title); // "Document Title" or "Unknown Document"
     * ```
     *
     * @param chunk - The chunk to extract the title from
     * @returns The title string, or "Unknown Document" if not available
     */
    static getChunkTitle(chunk: Chunk): string;
    /**
     * Extract unique source titles from an array of chunks
     *
     * @example
     * ```typescript
     * const contexts: Chunk[] = []; // Array of chunks
     * const sources = OrquelUtils.getUniqueSourceTitles(contexts);
     * sources.forEach(source => console.log(`• ${source}`));
     * ```
     *
     * @param chunks - Array of chunks to extract titles from
     * @returns Array of unique source titles (excluding undefined/null)
     */
    static getUniqueSourceTitles(chunks: Chunk[]): string[];
    /**
     * Format search results for display with titles and scores
     *
     * @example
     * ```typescript
     * const { results } = await orq.query("What is Argentina?");
     * const formatted = OrquelUtils.formatSearchResults(results);
     * console.log(formatted);
     * // Output:
     * // 1. Geography of Argentina (0.847)
     * // 2. History of Argentina (0.782)
     * // 3. Culture of Argentina (0.756)
     * ```
     *
     * @param results - Array of query results to format
     * @returns Formatted string with numbered results, titles, and scores
     */
    static formatSearchResults(results: QueryResult[]): string;
    /**
     * Validate chunk structure and provide helpful error messages
     *
     * @example
     * ```typescript
     * try {
     *   OrquelUtils.validateChunk(chunk);
     *   console.log("Chunk is valid!");
     * } catch (error) {
     *   console.error("Chunk validation failed:", error.message);
     * }
     * ```
     *
     * @param chunk - The chunk to validate
     * @throws Error if chunk structure is invalid
     */
    static validateChunk(chunk: unknown): asserts chunk is Chunk;
    /**
     * Inspect chunk structure for debugging purposes
     *
     * @example
     * ```typescript
     * OrquelUtils.inspectChunk(chunk);
     * // Console output:
     * // 🔍 Chunk inspection:
     * // • ID: chunk_123
     * // • Text length: 542 characters
     * // • Source: "Geography of Argentina"
     * // • Chunk index: 3
     * ```
     *
     * @param chunk - The chunk to inspect
     */
    static inspectChunk(chunk: Chunk): void;
    /**
     * Inspect query results structure for debugging
     *
     * @example
     * ```typescript
     * const { results } = await orq.query("What is Argentina?");
     * OrquelUtils.inspectQueryResults(results);
     * ```
     *
     * @param results - The query results to inspect
     */
    static inspectQueryResults(results: QueryResult[]): void;
    /**
     * Create a summary of contexts used in answer generation
     *
     * @example
     * ```typescript
     * const { contexts } = await orq.answer("What is Argentina?");
     * const summary = OrquelUtils.summarizeContexts(contexts);
     * console.log(summary);
     * // "Based on 3 chunks from 2 sources: Geography of Argentina, Culture of Argentina"
     * ```
     *
     * @param contexts - Array of chunks used as context
     * @returns Human-readable summary string
     */
    static summarizeContexts(contexts: Chunk[]): string;
}

/**
 * Evaluation metrics for RAG system performance
 */
interface EvaluationMetrics {
    /** Precision: How many retrieved chunks are relevant */
    precision: number;
    /** Recall: How many relevant chunks were retrieved */
    recall: number;
    /** F1 Score: Harmonic mean of precision and recall */
    f1Score: number;
    /** Mean Reciprocal Rank: Average of reciprocal ranks of first relevant result */
    mrr: number;
    /** Normalized Discounted Cumulative Gain: Quality of ranking */
    ndcg: number;
    /** Hit Rate: Percentage of queries with at least one relevant result */
    hitRate: number;
    /** Average response time in milliseconds */
    avgResponseTime: number;
}
/**
 * A ground truth query with expected relevant chunks
 */
interface GroundTruthQuery {
    /** The query text */
    query: string;
    /** IDs of chunks that should be considered relevant */
    relevantChunkIds: string[];
    /** Optional: Expected answer text for answer evaluation */
    expectedAnswer?: string;
    /** Optional: Keywords that should appear in the answer */
    expectedKeywords?: string[];
}
/**
 * Results from evaluating a single query
 */
interface QueryEvaluationResult {
    query: string;
    retrievedChunkIds: string[];
    relevantChunkIds: string[];
    precision: number;
    recall: number;
    f1Score: number;
    reciprocalRank: number;
    dcg: number;
    ndcg: number;
    hasRelevantResult: boolean;
    responseTime: number;
    answer?: string;
    answerScore?: number;
}
/**
 * Configuration for evaluation runs
 */
interface EvaluationConfig {
    /** Number of results to retrieve for each query (k parameter) */
    k?: number;
    /** Whether to use hybrid search */
    hybrid?: boolean;
    /** Whether to use reranking */
    rerank?: boolean;
    /** Whether to evaluate answer generation */
    evaluateAnswers?: boolean;
    /** Custom relevance scoring function */
    relevanceScorer?: (query: string, chunk: Chunk) => number;
}
/**
 * Comprehensive evaluation harness for RAG systems
 */
declare class RAGEvaluator {
    private orquel;
    constructor(orquel: Orquel);
    /**
     * Evaluate the RAG system against ground truth queries
     *
     * @example
     * ```typescript
     * const evaluator = new RAGEvaluator(orq);
     *
     * const groundTruth = [
     *   {
     *     query: "What is the capital of Argentina?",
     *     relevantChunkIds: ["argentina-geography-1", "argentina-cities-2"],
     *     expectedAnswer: "Buenos Aires",
     *     expectedKeywords: ["Buenos Aires", "capital"]
     *   }
     * ];
     *
     * const metrics = await evaluator.evaluate(groundTruth);
     * console.log(`F1 Score: ${metrics.f1Score.toFixed(3)}`);
     * ```
     */
    evaluate(groundTruthQueries: GroundTruthQuery[], config?: EvaluationConfig): Promise<EvaluationMetrics>;
    /**
     * Evaluate a single query against ground truth
     */
    private evaluateQuery;
    /**
     * Calculate Discounted Cumulative Gain and Normalized DCG
     */
    private calculateNDCG;
    /**
     * Evaluate answer quality against expected answer
     */
    private evaluateAnswer;
    /**
     * Aggregate individual query results into overall metrics
     */
    private aggregateMetrics;
    /**
     * Generate detailed evaluation report
     */
    generateReport(groundTruthQueries: GroundTruthQuery[], config?: EvaluationConfig): Promise<string>;
    /**
     * Get performance assessment based on metrics
     */
    private getPerformanceAssessment;
    /**
     * Get recommendations based on metrics
     */
    private getRecommendations;
}
/**
 * Create a basic evaluation dataset for testing
 */
declare function createSampleEvaluationDataset(): GroundTruthQuery[];

export { type AnswerAdapter, type AnswerOptions, type Chunk, type ChunkerOptions, type EmbeddingsAdapter, type EvaluationConfig, type EvaluationMetrics, type GroundTruthQuery, type IngestArgs, type IngestSource, type LexicalAdapter, type Orquel, type OrquelConfig, OrquelUtils, type QueryEvaluationResult, type QueryOptions, type QueryResult, RAGEvaluator, type RerankerAdapter, type VectorStoreAdapter, createOrquel, createSampleEvaluationDataset, defaultChunker };
