# Orquel Minimal Node.js Example

This example demonstrates the basic usage of Orquel in a Node.js environment.

## Features Demonstrated

- Document ingestion and chunking
- Vector indexing with OpenAI embeddings
- Semantic search and retrieval
- Answer generation with citations

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

3. Run the example:
   ```bash
   pnpm dev
   ```

## What This Example Does

1. **Ingests** a sample Markdown document about Orquel
2. **Chunks** the content into manageable pieces
3. **Indexes** the chunks using OpenAI embeddings in memory
4. **Queries** the knowledge base with sample questions
5. **Generates** answers with context citations

## Code Structure

- `src/index.ts` - Main example code
- `.env.example` - Environment variables template
- `package.json` - Dependencies and scripts

## Next Steps

- Try modifying the sample content
- Experiment with different queries
- Explore other adapters (pgvector, Qdrant, etc.)
- Add your own documents to ingest