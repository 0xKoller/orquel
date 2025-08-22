# Orquel

[![Build Status](https://github.com/0xkoller/orquel/workflows/CI/badge.svg)](https://github.com/0xkoller/orquel/actions)
[![npm version](https://badge.fury.io/js/orquel.svg)](https://www.npmjs.com/package/orquel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)

> **Current Status: v0.1.0** - Production-ready core with essential adapters ✅

Make knowledge usable. **Anywhere**

**Ingest**. Turn any source into structured, searchable knowledge.

**Embed**. Choose your adapter, your model, your storage. Stay in control.

**Retrieve**. Query with speed, precision, and flexibility. No boilerplate.

**Build**. Power your agents, apps, and workflows with knowledge that just works.


---

## ✨ Why Orquel?

**Orquel** is a TypeScript‑first, open‑source toolkit for building knowledge bases and retrieval‑augmented generation (RAG) systems. It gives developers the core primitives to ingest, chunk, index, and query text, with an adapter‑driven architecture that makes it easy to swap embeddings, vector stores, rerankers, and answerers.
Today’s devs reinvent the wheel: writing chunkers, wiring embeddings, gluing vector stores, bolting on rerankers. **Orquel makes this process simple, composable, and consistent**.

* **DX First**: One‑command install or scaffold; strict TypeScript; minimal, ergonomic API.
* **Composable**: Swap any part—embeddings, vector DBs, lexical search, rerankers—via adapters.
* **OSS Core**: MIT‑licensed, batteries‑included defaults; production‑ready paths.
* **Extensible**: Build your own adapters with a clear interface.

---

## 🎯 Goal

The goal of Orquel is **to make knowledge bases easier**:

* Ingest any document (Markdown, PDF, DOCX, HTML…)
* Chunk it intelligently
* Index it in dense + lexical stores
* Retrieve hybrid results with rerankers
* Generate concise answers with citations

All with a few lines of code, in TypeScript.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- OpenAI API key (for embeddings and answers)

### Quick Start

#### Option 1: Add to existing project
```bash
npm install orquel
npx orquel setup
```

#### Option 2: Create new project  
```bash
npx create-orquel-app@latest my-rag-app
cd my-rag-app
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm run dev
```

### Minimal Example

```ts
import { createOrquel } from "@orquel/core";
import { openAIEmbeddings } from "@orquel/embeddings-openai";
import { memoryStore } from "@orquel/store-memory";
import { openAIAnswerer } from "@orquel/answer-openai";

const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
});

async function main() {
  // Ingest a document
  const { chunks } = await orq.ingest({ 
    source: { title: "Product Guide" }, 
    content: "# Features\nOur product has AI-powered search and analytics." 
  });
  
  // Index for search
  await orq.index(chunks);
  
  // Ask questions
  const { answer } = await orq.answer("What features does the product have?");
  console.log(answer);
  // Output: "The product has AI-powered search and analytics features."
}

main().catch(console.error);
```

**[📁 View more examples →](./examples/)**

---

## 📦 Packages

### Core & Tools
- ✅ **`@orquel/core`** – Core orchestrator, types, and chunking logic
- ✅ **`orquel`** – Meta package with CLI setup wizard  
- ✅ **`create-orquel-app`** – Project scaffolder with templates

### Adapters (v0.1.0)
- ✅ **`@orquel/embeddings-openai`** – OpenAI text embeddings (3-small, 3-large)
- ✅ **`@orquel/store-memory`** – In-memory vector storage (development)
- ✅ **`@orquel/answer-openai`** – GPT-4 answer generation with citations

### Coming Soon (v0.2+)
- 🚧 **`@orquel/store-pgvector`** – PostgreSQL + pgvector storage
- 🚧 **`@orquel/store-qdrant`** – Qdrant vector database
- 🚧 **`@orquel/lexical-postgres`** – PostgreSQL full-text search
- 📋 **`@orquel/rerank-cohere`** – Cohere reranking
- 📋 **`@orquel/ingest-pdf`** – PDF document parsing

### Examples & Integrations
- ✅ **Minimal Node.js** – Basic RAG implementation
- 📋 **Next.js API Routes** – Web application template  
- 📋 **MCP Server** – Model Context Protocol integration

## 🏗️ Architecture

Orquel uses an **adapter-driven architecture** that makes every component swappable:

```
┌─────────────────────────────────────────────────────────┐
│                 Your Application                        │
├─────────────────────────────────────────────────────────┤
│                Orquel Orchestrator                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │   ingest    │ │    index    │ │    query    │      │
│  │   & chunk   │ │ embeddings  │ │  & answer   │      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
├─────────────────────────────────────────────────────────┤
│                    Adapter Layer                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │  Embeddings  │ │ Vector Store │ │   Answerer   │    │
│ │   Adapter    │ │   Adapter    │ │   Adapter    │    │
│ └──────────────┘ └──────────────┘ └──────────────┘    │
├─────────────────────────────────────────────────────────┤
│               Implementation Layer                      │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │   OpenAI     │ │   Memory     │ │   OpenAI     │    │
│ │  Embeddings  │ │    Store     │ │   Answerer   │    │
│ └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- 🔄 **Composable** – Mix and match any adapters
- 🚀 **Upgradeable** – Swap development tools for production ones
- 🧪 **Testable** – Mock any component for testing
- 🎯 **Focused** – Each adapter has one responsibility

---

## 🗺️ Roadmap

### v0.1.0 (✅ Current)
**Foundation & Essential Adapters**
- [x] Core orchestrator with TypeScript-first API
- [x] Intelligent text chunking with Markdown support
- [x] OpenAI embeddings (text-embedding-3-small/large)
- [x] In-memory vector storage with cosine similarity
- [x] GPT-4 answer generation with context
- [x] CLI setup wizard and project scaffolder
- [x] Comprehensive documentation and examples

### v0.2.0 (🚧 Next)
**Production Storage & Search**
- [ ] PostgreSQL + pgvector adapter
- [ ] Qdrant vector database adapter  
- [ ] PostgreSQL full-text search (lexical)
- [ ] Hybrid search (dense + lexical)
- [ ] Performance optimizations and connection pooling
- [ ] Next.js template with API routes

### v0.3.0 (📋 Planned)
**Enhanced Retrieval & Local Models**
- [ ] Cohere reranking adapter
- [ ] Local ONNX embedding models (BGE, E5)
- [ ] Document parsers (PDF, DOCX, HTML)
- [ ] Advanced chunking strategies
- [ ] Multi-modal support foundations

### v0.4.0 (📋 Planned)
**Evaluation & Observability**
- [ ] Evaluation harness and golden datasets
- [ ] OpenTelemetry tracing integration
- [ ] Performance monitoring hooks
- [ ] Batch processing utilities
- [ ] CLI tools for data management

### v1.0.0 (📋 Goal)
**Production Ready**
- [ ] Stable, finalized APIs
- [ ] Comprehensive documentation site
- [ ] Production deployment templates
- [ ] Enterprise features (auth, multi-tenancy)
- [ ] Performance benchmarks and comparisons

---

## 🎯 Use Cases

**Documentation & Support**
```ts
// Build a help center that answers questions about your product
const docs = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: pgvectorStore({ connectionString: process.env.DATABASE_URL }),
  answerer: openAIAnswerer(),
});

await docs.ingest({ source: { title: "API Guide" }, content: apiDocs });
const { answer } = await docs.answer("How do I authenticate API requests?");
```

**Research & Analysis**  
```ts
// Analyze research papers and generate insights
const research = createOrquel({
  embeddings: openAIEmbeddings({ model: 'text-embedding-3-large' }),
  vector: qdrantStore({ url: process.env.QDRANT_URL }),
  reranker: cohereReranker(),
  answerer: openAIAnswerer({ model: 'gpt-4' }),
});
```

**Code Search & Understanding**
```ts
// Make your codebase searchable and explainable
const codebase = createOrquel({
  embeddings: localEmbeddings({ model: 'code-search-net' }),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
});
```

---

## 🛠️ Development

### Building Custom Adapters

Orquel's power comes from its adapter ecosystem. Building custom adapters is straightforward:

```ts
import type { EmbeddingsAdapter } from '@orquel/core';

export function customEmbeddings(): EmbeddingsAdapter {
  return {
    name: 'custom-embeddings',
    dim: 768,
    async embed(texts: string[]): Promise<number[][]> {
      // Your implementation here
      return await yourEmbeddingService.embed(texts);
    }
  };
}
```

**[📖 Read the adapter development guide →](./docs/adapters.md)**

### Local Development

```bash
git clone https://github.com/0xkoller/orquel.git
cd orquel
pnpm install
pnpm build
pnpm test
```

---

## 🤝 Contributing

We welcome contributions! Orquel is designed to be community-driven.

**Ways to contribute:**
- 🐛 **Bug reports** – [Open an issue](https://github.com/0xkoller/orquel/issues)
- 💡 **Feature requests** – [Start a discussion](https://github.com/0xkoller/orquel/discussions)
- 🔌 **Build adapters** – Extend Orquel's ecosystem
- 📖 **Improve docs** – Help others get started
- ✅ **Add tests** – Increase reliability

**Getting started:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-adapter`
3. Make your changes and add tests
4. Run `pnpm build && pnpm test`
5. Submit a pull request

**Need help?** Reach out:
- 💬 [GitHub Discussions](https://github.com/0xkoller/orquel/discussions)
- 🐦 [@0xKoller on Twitter](https://x.com/0xKoller)
- 📧 Direct message for questions

**Popular contribution ideas:**
- Adapters for other embedding models (Cohere, Voyage, etc.)
- Vector database adapters (Pinecone, Weaviate, etc.) 
- Document parsers (PDF, DOCX, Notion, etc.)
- Examples for specific frameworks (Express, FastAPI, etc.)

---

## 📜 License

MIT
