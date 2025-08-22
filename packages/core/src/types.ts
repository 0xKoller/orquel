export interface Chunk {
  id: string;
  text: string;
  metadata: {
    source: IngestSource;
    chunkIndex: number;
    tokens?: number;
    hash: string;
  };
}

export interface IngestSource {
  title: string;
  kind?: 'md' | 'txt' | 'pdf' | 'docx' | 'html';
  url?: string;
  author?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmbeddingsAdapter {
  name: string;
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorStoreAdapter {
  name: string;
  upsert(rows: Array<Chunk & { embedding: number[] }>): Promise<void>;
  searchByVector(
    query: number[],
    k: number
  ): Promise<Array<{ chunk: Chunk; score: number }>>;
}

export interface LexicalAdapter {
  name: string;
  index(chunks: Chunk[]): Promise<void>;
  search(
    text: string,
    k: number
  ): Promise<Array<{ chunk: Chunk; score: number }>>;
}

export interface RerankerAdapter {
  name: string;
  rerank(query: string, passages: Chunk[]): Promise<number[]>;
}

export interface AnswerAdapter {
  name: string;
  answer(args: {
    query: string;
    contexts: Chunk[];
  }): Promise<string>;
}

export interface OrquelConfig {
  embeddings: EmbeddingsAdapter;
  vector: VectorStoreAdapter;
  lexical?: LexicalAdapter;
  reranker?: RerankerAdapter;
  answerer?: AnswerAdapter;
  chunker?: (text: string) => Chunk[];
}

export interface IngestArgs {
  source: IngestSource;
  content: string | Buffer;
}

export interface QueryOptions {
  k?: number;
  hybrid?: boolean;
  rerank?: boolean;
}

export interface AnswerOptions {
  topK?: number;
}

export interface Orquel {
  ingest(args: IngestArgs): Promise<{
    sourceId: string;
    chunks: Chunk[];
  }>;
  
  index(chunks: Chunk[]): Promise<void>;
  
  query(
    q: string,
    opts?: QueryOptions
  ): Promise<{
    results: Array<{ chunk: Chunk; score: number }>;
  }>;
  
  answer(
    q: string,
    opts?: AnswerOptions
  ): Promise<{
    answer: string;
    contexts: Chunk[];
  }>;
}