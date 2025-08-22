# Orquel

> **Orquel** is a TypeScript‑first, open‑source toolkit for building knowledge bases and retrieval‑augmented generation (RAG) systems. It gives developers the core primitives to ingest, chunk, index, and query text, with an adapter‑driven architecture that makes it easy to swap embeddings, vector stores, rerankers, and answerers.

---

## ✨ Why Orquel?

Modern apps need to make sense of unstructured information. Today’s devs reinvent the wheel: writing chunkers, wiring embeddings, gluing vector stores, bolting on rerankers. **Orquel makes this process simple, composable, and consistent**.

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

### Install (meta package)

```bash
npm i orquel
npx orquel setup
```

### Or scaffold a new project

```bash
npx create-orquel-app@latest
```

### Minimal usage

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

(async () => {
  const { chunks } = await orq.ingest({ source: { title: "Doc" }, content: "# Hello Orquel" });
  await orq.index(chunks);
  const { answer } = await orq.answer("What is Orquel?");
  console.log(answer);
})();
```

---

## 📦 Packages

* `@orquel/core` – core orchestrator & types
* `@orquel/embeddings-openai`, `@orquel/store-memory`, … – official adapters
* `orquel` – meta package with CLI wizard
* `create-orquel-app` – scaffolder for new projects
* Integrations: MCP server, Vercel AI SDK examples

---

## 🤝 Contributing

Just DM me [@0xKoller](https://x.com/0xKoller)

---

## 📜 License

MIT
