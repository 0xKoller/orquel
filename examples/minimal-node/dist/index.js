import { createOrquel } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { memoryStore } from '@orquel/store-memory';
import { openAIAnswerer } from '@orquel/answer-openai';
const orq = createOrquel({
    embeddings: openAIEmbeddings(),
    vector: memoryStore(),
    answerer: openAIAnswerer(),
});
async function main() {
    console.log('🎯 Orquel Minimal Example');
    console.log('========================\n');
    // Ingest sample content
    const sampleContent = `# Orquel Documentation

Orquel is a TypeScript-first, open-source toolkit for building knowledge bases and retrieval-augmented generation (RAG) systems.

## Core Features

### Adapter-Driven Architecture
Orquel uses an adapter pattern that allows you to swap embeddings, vector stores, rerankers, and answerers without touching your application code.

### Composable Design
Mix and match components like embeddings providers, vector databases, lexical search engines, and rerankers to build the perfect RAG system for your needs.

### TypeScript-First
Built with strict TypeScript for excellent developer experience with comprehensive type safety and IntelliSense support.

### Production Ready
While it provides simple defaults like in-memory storage for development, Orquel supports production-grade solutions like pgvector, Qdrant, and enterprise search engines.

## Quick Start

1. Install the core package and desired adapters
2. Create an Orquel instance with your chosen adapters
3. Ingest your documents
4. Index the content
5. Query and get answers with citations

## Use Cases

- Documentation search and Q&A
- Customer support knowledge bases
- Research paper analysis
- Content recommendation systems
- Semantic search applications`;
    console.log('📄 Ingesting sample content...');
    const { chunks } = await orq.ingest({
        source: { title: 'Orquel Documentation', kind: 'md' },
        content: sampleContent
    });
    console.log(`✅ Created ${chunks.length} chunks\n`);
    // Index the chunks
    console.log('📚 Indexing chunks...');
    await orq.index(chunks);
    console.log('✅ Indexing complete\n');
    // Query examples
    const queries = [
        'What is Orquel?',
        'How does the adapter pattern work?',
        'What are the main features of Orquel?',
        'Is Orquel production ready?'
    ];
    for (const query of queries) {
        console.log(`❓ Question: ${query}`);
        // Get search results
        const { results } = await orq.query(query, { k: 3 });
        console.log(`🔍 Found ${results.length} relevant chunks`);
        // Generate answer
        const { answer, contexts } = await orq.answer(query, { topK: 3 });
        console.log(`💡 Answer: ${answer}`);
        console.log(`📖 Based on ${contexts.length} context chunks\n`);
    }
    console.log('🎉 Demo completed successfully!');
}
main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map