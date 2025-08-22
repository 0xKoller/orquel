# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orquel is a TypeScript-first, open-source toolkit for building knowledge bases and retrieval-augmented generation (RAG) systems. It provides core primitives to ingest, chunk, index, and query text with an adapter-driven architecture.

**Key Concepts:**
- **Adapter-driven architecture**: Swap embeddings, vector stores, rerankers, and answerers via adapters
- **Composable design**: Mix and match components (embeddings, vector DBs, lexical search, rerankers)
- **TypeScript-first**: Strict typing throughout the codebase
- **Package-based structure**: Modular packages for core functionality and adapters

## Architecture

The project follows a modular package architecture:

- `@orquel/core` – Core orchestrator and TypeScript types
- `@orquel/embeddings-*` – Embedding adapter packages (e.g., OpenAI)
- `@orquel/store-*` – Vector store adapter packages (e.g., memory store)
- `@orquel/answer-*` – Answer generation adapter packages
- `orquel` – Meta package with CLI wizard
- `create-orquel-app` – Project scaffolding tool

## Current Repository State

**Note**: This repository currently contains only documentation (README.md and LICENSE). The actual implementation appears to be in development or distributed across separate repositories for each package.

## Getting Started Commands

Based on the README, these are the key commands for users:

```bash
# Install the meta package
npm i orquel
npx orquel setup

# Scaffold a new project
npx create-orquel-app@latest
```

## Development Notes

- The project emphasizes TypeScript-first development
- Follows adapter pattern for all major components
- Designed for minimal, ergonomic API surface
- MIT licensed with focus on developer experience