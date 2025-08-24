# @orquel/mcp-server

MCP (Model Context Protocol) server integration for Orquel RAG toolkit. This package enables Claude Code and other MCP clients to directly query your Orquel knowledge bases.

## Features

- **🔧 Five Core MCP Tools**: ingest, query, answer, list-sources, clear
- **🚀 Multiple Transports**: HTTP and STDIO support via xmcp framework  
- **🔄 Hot Reloading**: Development mode with instant updates
- **⚡ Production Ready**: Rate limiting, error handling, logging
- **🔐 Secure**: Authentication middleware and request validation
- **📊 Hybrid Search**: Leverages Orquel's vector + lexical search capabilities

## Quick Start

### Installation

```bash
npm install @orquel/mcp-server
```

### Basic Usage

```bash
# Start MCP server with environment configuration
export OPENAI_API_KEY="your-key"
export DATABASE_URL="postgresql://..."
npx orquel-mcp serve

# Or with custom configuration
npx orquel-mcp serve --config ./orquel-mcp.config.js
```

### Configuration

Create `orquel-mcp.config.js`:

```javascript
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { openAIAnswerer } from '@orquel/answer-openai';

export default {
  orquel: {
    embeddings: openAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    vector: pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      dimensions: 1536,
    }),
    answerer: openAIAnswerer({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    debug: true,
  },
  server: {
    verbose: true,
    name: 'my-knowledge-base',
  },
};
```

## MCP Tools

### `ingest`
Ingest documents into the knowledge base.

**Parameters:**
- `title` (string): Document title
- `content` (string): Document content  
- `kind` (optional): Document type (md, txt, pdf, etc.)
- `url` (optional): Source URL
- `author` (optional): Author name
- `metadata` (optional): Additional metadata

**Example:**
```json
{
  "title": "Company Handbook",
  "content": "# Welcome to Acme Corp...",
  "kind": "md",
  "author": "HR Team"
}
```

### `query`
Search the knowledge base for relevant content.

**Parameters:**
- `query` (string): Search query
- `k` (optional, default: 10): Number of results
- `hybrid` (optional, default: true): Enable hybrid search
- `rerank` (optional, default: true): Apply reranking
- `includeScores` (optional, default: true): Include relevance scores
- `includeMetadata` (optional, default: false): Include metadata

**Example:**
```json
{
  "query": "What are the company vacation policies?",
  "k": 5,
  "hybrid": true
}
```

### `answer`
Generate AI answers with source citations.

**Parameters:**
- `question` (string): Question to answer
- `topK` (optional, default: 4): Context chunks to use
- `includeSources` (optional, default: true): Include citations
- `includeContext` (optional, default: false): Include retrieved context

**Example:**
```json
{
  "question": "How many vacation days do employees get?",
  "topK": 3,
  "includeSources": true
}
```

### `list-sources`
List all sources in the knowledge base.

**Parameters:**
- `includeStats` (optional, default: true): Include statistics
- `sortBy` (optional, default: "title"): Sort by title, created, or chunks
- `limit` (optional, default: 50): Maximum sources to return

### `clear`
Clear the knowledge base (requires confirmation).

**Parameters:**
- `confirm` (boolean): Must be true to proceed
- `sourceFilter` (optional): Filter to clear specific sources
- `dryRun` (optional, default: false): Preview without clearing

## CLI Commands

### `serve`
Start the MCP server:

```bash
# HTTP transport (default)
orquel-mcp serve --port 3001

# STDIO transport  
orquel-mcp serve --stdio

# With custom config
orquel-mcp serve --config ./my-config.js --verbose
```

### `tools`
List available MCP tools:

```bash
orquel-mcp tools
```

### `config`
Show configuration info:

```bash
# Show current config status
orquel-mcp config

# Show example configuration
orquel-mcp config --example
```

### `health`
Check server health:

```bash
orquel-mcp health
```

## Development

### Development Mode

```bash
# Install dependencies
pnpm install

# Start development server with hot reloading
pnpm dev

# Run in HTTP mode
pnpm serve
```

### Environment Variables

- `ORQUEL_CONFIG_PATH`: Path to configuration file
- `OPENAI_API_KEY`: OpenAI API key for embeddings/answers
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development/production)
- `ORQUEL_VERBOSE`: Enable verbose logging

## Integration with Claude Code

1. **Start the MCP server:**
   ```bash
   orquel-mcp serve --stdio
   ```

2. **Configure Claude Code** to use the MCP server (exact configuration depends on Claude Code's MCP integration)

3. **Use MCP tools** directly in Claude Code conversations:
   - Ingest documents into your knowledge base
   - Search and query content
   - Get AI-generated answers with citations

## Architecture

The MCP server is built on:
- **xmcp**: TypeScript MCP framework with hot reloading
- **Orquel Core**: RAG toolkit with adapter-driven architecture  
- **Zod**: Runtime type validation for MCP tool schemas
- **Commander**: CLI interface for server management

## Advanced Configuration

### Custom Adapters

```javascript
// Use different adapters for different use cases
export default {
  orquel: {
    embeddings: customEmbeddingsAdapter(),
    vector: customVectorStore(),
    lexical: customLexicalSearch(),
    reranker: customReranker(),
    answerer: customAnswerAdapter(),
  },
};
```

### Middleware Configuration

Customize the xmcp configuration for advanced middleware:

```javascript
// xmcp.config.ts
export default defineConfig({
  middleware: [
    {
      name: 'auth',
      enabled: true,
      config: {
        apiKey: process.env.MCP_API_KEY,
      },
    },
    {
      name: 'rateLimit',
      config: {
        windowMs: 60000,
        maxRequests: 50,
      },
    },
  ],
});
```

## License

MIT - see LICENSE file for details.