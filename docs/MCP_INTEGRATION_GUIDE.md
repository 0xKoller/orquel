# Orquel MCP Integration Guide

Complete guide for integrating Orquel with Claude Code and other MCP clients.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Claude Code Integration](#claude-code-integration)
6. [Available MCP Tools](#available-mcp-tools)
7. [Advanced Configuration](#advanced-configuration)
8. [Deployment Options](#deployment-options)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Overview

The Orquel MCP (Model Context Protocol) integration transforms your Orquel knowledge base into an MCP server that can be directly queried by Claude Code and other MCP clients. This enables seamless knowledge retrieval and Q&A capabilities directly within your AI assistant conversations.

### Key Features

- **🔧 11 MCP Tools**: From basic ingestion to advanced analytics
- **🚀 Multiple Transports**: STDIO for local use, HTTP for remote access
- **⚡ Hot Reloading**: Development mode with instant updates
- **🔐 Production Ready**: Authentication, rate limiting, error handling
- **📊 Advanced Analytics**: Semantic clustering, performance benchmarking
- **🔄 Hybrid Search**: Configurable vector + lexical search weights

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude Code   │◄──►│  Orquel MCP     │◄──►│   Knowledge     │
│   (MCP Client)  │    │     Server      │    │     Base        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Orquel Core    │
                       │   (Adapters)    │
                       └─────────────────┘
```

## Quick Start

### 1. Install Orquel v0.3.0

```bash
npm install orquel@latest
```

### 2. Set Up Environment

```bash
export OPENAI_API_KEY="your-openai-api-key"
export DATABASE_URL="postgresql://user:pass@localhost:5432/orquel"  # Optional
```

### 3. Start MCP Server

```bash
# For Claude Code integration (STDIO)
orquel mcp serve --stdio

# For HTTP access
orquel mcp serve --http --port 3001
```

### 4. Test the Server

```bash
orquel mcp health
orquel mcp tools
```

### 5. Configure Claude Code

In Claude Code, add the MCP server:
- Server command: `orquel mcp serve --stdio`
- Transport: STDIO

## Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL (recommended) or use memory storage
- OpenAI API key (or compatible embedding/LLM provider)

### Basic Installation

```bash
# Install Orquel with MCP support
npm install orquel@latest

# Install required adapters
npm install @orquel/embeddings-openai @orquel/store-memory
```

### Full Installation (with PostgreSQL)

```bash
# Install Orquel and PostgreSQL adapters
npm install orquel@latest
npm install @orquel/embeddings-openai @orquel/store-pgvector @orquel/lexical-postgres @orquel/answer-openai

# Set up PostgreSQL with pgvector extension
createdb orquel
psql orquel -c "CREATE EXTENSION vector;"
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/your-org/orquel.git
cd orquel

# Install dependencies
pnpm install

# Build packages
pnpm build

# Start development MCP server
pnpm --filter=@orquel/mcp-server dev
```

## Configuration

### Environment Variables

The simplest way to configure Orquel MCP server:

```bash
# Required for embeddings and answer generation
export OPENAI_API_KEY="sk-your-openai-api-key"

# Optional: PostgreSQL for persistent storage
export DATABASE_URL="postgresql://user:password@localhost:5432/orquel"

# Optional: Development mode
export NODE_ENV="development"
export ORQUEL_VERBOSE="true"
```

### Configuration File

For advanced setups, create `orquel-mcp.config.js`:

```javascript
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
import { openAIAnswerer } from '@orquel/answer-openai';

export default {
  orquel: {
    embeddings: openAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-large', // Higher quality
      dimensions: 3072,
    }),
    vector: pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      dimensions: 3072,
      indexType: 'hnsw', // Better for large datasets
      performanceOptions: {
        batchSize: 200,
        connectionTimeoutMs: 10000,
      },
    }),
    lexical: postgresLexical({
      connectionString: process.env.DATABASE_URL,
      enableFuzzySearch: true,
      enableStemming: true,
    }),
    answerer: openAIAnswerer({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
      temperature: 0.1, // More focused answers
    }),
    hybrid: {
      denseWeight: 0.7,
      lexicalWeight: 0.3,
      normalizationMethod: 'rrf',
    },
    debug: process.env.NODE_ENV === 'development',
  },
  server: {
    name: 'company-knowledge-base',
    verbose: true,
  },
};
```

Use the configuration:

```bash
orquel mcp serve --config orquel-mcp.config.js
```

### Generate Configuration

Create a sample configuration file:

```bash
orquel mcp config --generate --output ./my-orquel-config.js
```

## Claude Code Integration

### Step 1: Start MCP Server

```bash
# Start in STDIO mode for Claude Code
orquel mcp serve --stdio --verbose
```

### Step 2: Configure Claude Code

1. Open Claude Code settings
2. Go to MCP Servers section
3. Add new server:
   - **Name**: Orquel Knowledge Base
   - **Command**: `orquel mcp serve --stdio`
   - **Arguments**: `--verbose` (optional)
   - **Transport**: STDIO

### Step 3: Verify Connection

In Claude Code, try:

```
Can you list the available MCP tools?
```

Claude should respond with information about Orquel tools.

### Step 4: Basic Usage

```
# Ingest a document
Use the ingest tool to add this document to the knowledge base:
Title: "API Documentation"  
Content: "# REST API Guide\n\nOur API provides..."

# Search the knowledge base
Use the query tool to search for "authentication methods"

# Get AI answers with citations
Use the answer tool to answer: "How do I authenticate with the API?"
```

### Advanced Claude Code Usage

```
# Analyze knowledge base health
Use the analyze-kb tool with analysisType "all" to get comprehensive insights

# Optimize search performance  
Use the optimize-search tool with test queries: ["API auth", "rate limits", "webhooks"]

# Benchmark performance
Use the benchmark tool with benchmarkType "search" and dataSize "medium"
```

## Available MCP Tools

### Core Tools

#### `ingest`
Add documents to the knowledge base.

**Parameters:**
- `title` (string): Document title
- `content` (string): Document content  
- `kind?` (string): Document type (md, txt, pdf, etc.)
- `url?` (string): Source URL
- `author?` (string): Author name
- `metadata?` (object): Additional metadata

**Example:**
```json
{
  "title": "User Guide",
  "content": "# Getting Started\n\nWelcome to our platform...",
  "kind": "md",
  "author": "Documentation Team"
}
```

#### `query`
Search the knowledge base with hybrid vector/lexical search.

**Parameters:**
- `query` (string): Search query
- `k?` (number): Number of results (1-50, default: 10)
- `hybrid?` (boolean): Enable hybrid search (default: true)
- `rerank?` (boolean): Apply reranking (default: true)
- `includeScores?` (boolean): Include relevance scores (default: true)
- `includeMetadata?` (boolean): Include chunk metadata (default: false)

**Example:**
```json
{
  "query": "How to configure authentication?",
  "k": 5,
  "hybrid": true,
  "includeScores": true
}
```

#### `answer`
Generate AI answers with source citations.

**Parameters:**
- `question` (string): Question to answer
- `topK?` (number): Context chunks to use (1-20, default: 4)
- `includeSources?` (boolean): Include citations (default: true)
- `includeContext?` (boolean): Show retrieved context (default: false)

**Example:**
```json
{
  "question": "What are the system requirements?",
  "topK": 3,
  "includeSources": true
}
```

### Management Tools

#### `list-sources`
List all sources in the knowledge base.

#### `clear`
Clear the knowledge base (requires confirmation).

#### `reindex`
Rebuild search indexes for performance optimization.

### Advanced Tools

#### `hybrid-search`
Advanced hybrid search with configurable weights.

**Parameters:**
- `query` (string): Search query
- `denseWeight?` (number): Vector search weight (0-1, default: 0.7)
- `lexicalWeight?` (number): Lexical search weight (0-1, default: 0.3)
- `normalizationMethod?` (string): Score normalization (rrf, minmax, zscore)
- `showAnalytics?` (boolean): Show search analytics (default: true)

#### `optimize-search`
Auto-optimize hybrid search parameters.

**Parameters:**
- `testQueries` (string[]): Queries to optimize against (1-10)
- `optimizationGoal?` (string): Goal (precision, recall, balanced)
- `maxIterations?` (number): Optimization iterations (5-50, default: 20)

#### `benchmark`
Performance benchmarking with detailed metrics.

**Parameters:**
- `benchmarkType?` (string): Type (ingestion, search, full)
- `dataSize?` (string): Test size (small, medium, large)
- `iterations?` (number): Test iterations (1-10, default: 3)
- `concurrency?` (number): Concurrent operations (1-10, default: 1)

### Analytics Tools

#### `analyze-kb`
Comprehensive knowledge base analysis.

**Parameters:**
- `analysisType?` (string): Type (overview, content, performance, health, all)
- `includeContentSample?` (boolean): Include content samples
- `contentAnalysisDepth?` (string): Analysis depth (basic, detailed)

#### `semantic-clusters`
Analyze semantic clusters and knowledge gaps.

**Parameters:**
- `sampleSize?` (number): Chunks to analyze (50-1000, default: 200)
- `clusterCount?` (number): Target clusters (3-20, default: 8)
- `similarityThreshold?` (number): Cluster threshold (0.1-0.95, default: 0.6)
- `analyzeGaps?` (boolean): Identify knowledge gaps (default: true)

## Advanced Configuration

### Custom Adapters

```javascript
import { createCustomEmbeddings } from './my-embeddings.js';
import { createCustomVectorStore } from './my-vector-store.js';

export default {
  orquel: {
    embeddings: createCustomEmbeddings({
      apiKey: process.env.CUSTOM_API_KEY,
      endpoint: 'https://api.custom-embeddings.com',
    }),
    vector: createCustomVectorStore({
      connectionString: process.env.VECTOR_DB_URL,
      indexConfig: {
        metricType: 'cosine',
        efConstruction: 128,
      },
    }),
  },
};
```

### Multi-Tenant Setup

```javascript
export default {
  orquel: {
    embeddings: openAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
    vector: pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      tableName: `orquel_chunks_${process.env.TENANT_ID}`,
      dimensions: 1536,
    }),
  },
  server: {
    name: `orquel-${process.env.TENANT_ID}`,
    verbose: false,
  },
};
```

### Authentication Middleware

```javascript
// xmcp.config.ts (in MCP server package)
export default defineConfig({
  middleware: [
    {
      name: 'auth',
      enabled: true,
      config: {
        apiKey: process.env.MCP_API_KEY,
        allowedClients: ['claude-code', 'custom-client'],
      },
    },
  ],
});
```

## Deployment Options

### Local Development (STDIO)

Best for personal use with Claude Code:

```bash
orquel mcp serve --stdio --dev --verbose
```

### HTTP Server (Team/Organization)

For team access or web applications:

```bash
orquel mcp serve --http --port 3001 --config production.config.js
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .
RUN npm run build

# Start MCP server
EXPOSE 3001
CMD ["orquel", "mcp", "serve", "--http", "--port", "3001"]
```

### Vercel Serverless

```javascript
// api/mcp.js
import { createMcpHandler } from '@orquel/mcp-server/vercel';

export default createMcpHandler({
  orquel: {
    embeddings: openAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
    vector: pgvectorStore({ connectionString: process.env.DATABASE_URL }),
  },
});
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orquel-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orquel-mcp
  template:
    metadata:
      labels:
        app: orquel-mcp
    spec:
      containers:
      - name: orquel-mcp
        image: orquel/mcp-server:latest
        ports:
        - containerPort: 3001
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: orquel-secrets
              key: openai-api-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: orquel-secrets
              key: database-url
```

## Troubleshooting

### Common Issues

#### 1. "Configuration error: Missing adapters"

**Solution:**
```bash
# Install required adapters
npm install @orquel/embeddings-openai @orquel/store-memory

# Or for PostgreSQL
npm install @orquel/store-pgvector @orquel/lexical-postgres
```

#### 2. "OpenAI API key not found"

**Solution:**
```bash
export OPENAI_API_KEY="sk-your-actual-api-key"
orquel mcp health  # Verify
```

#### 3. "Database connection failed"

**Solution:**
```bash
# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Verify pgvector extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### 4. "Claude Code can't connect to MCP server"

**Solution:**
1. Ensure server is running: `orquel mcp serve --stdio`
2. Check Claude Code MCP configuration
3. Verify STDIO transport is selected
4. Check server logs for errors

#### 5. "Tools not working in Claude Code"

**Solution:**
```bash
# Test tools directly
orquel mcp health
orquel mcp tools

# Check specific tool
echo '{"query": "test"}' | orquel-mcp tools query
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
export ORQUEL_VERBOSE=true
export NODE_ENV=development
orquel mcp serve --stdio --verbose
```

### Health Checks

Regular health monitoring:

```bash
# Basic health check
orquel mcp health

# Comprehensive analysis
orquel mcp health --config ./orquel-mcp.config.js

# Test specific functionality
curl -X POST http://localhost:3001/mcp/tools \
  -H "Content-Type: application/json" \
  -d '{"tool": "analyze-kb", "params": {"analysisType": "health"}}'
```

### Performance Issues

#### Slow Query Performance

1. **Check indexes:**
   ```bash
   orquel mcp tools --detailed
   # Use benchmark tool to identify bottlenecks
   ```

2. **Optimize hybrid search weights:**
   ```bash
   # Use optimize-search tool with representative queries
   ```

3. **Database optimization:**
   ```sql
   -- PostgreSQL: Check index usage
   SELECT * FROM pg_stat_user_indexes WHERE relname = 'orquel_chunks';
   
   -- Analyze table statistics
   ANALYZE orquel_chunks;
   ```

#### Memory Issues

1. **Monitor usage:**
   ```bash
   # Use analyze-kb tool to check memory consumption
   ```

2. **Optimize batch sizes:**
   ```javascript
   // In configuration
   vector: pgvectorStore({
     performanceOptions: {
       batchSize: 50, // Reduce for lower memory usage
     },
   }),
   ```

## Best Practices

### Knowledge Base Management

1. **Structured Ingestion:**
   ```javascript
   // Good: Consistent metadata
   await ingest({
     title: "API Reference - Authentication",
     content: apiContent,
     kind: "md",
     author: "API Team",
     metadata: {
       version: "v2.1",
       category: "reference",
       lastUpdated: new Date().toISOString(),
     },
   });
   ```

2. **Regular Maintenance:**
   ```bash
   # Weekly health checks
   orquel mcp health
   
   # Monthly optimization
   orquel-mcp tools optimize-search --testQueries "common,query,patterns"
   
   # Quarterly reindexing (for large KBs)
   orquel-mcp tools reindex --confirm true --dryRun false
   ```

3. **Content Organization:**
   - Use consistent document titles and metadata
   - Maintain appropriate chunk sizes (300-800 characters)
   - Tag content by category, version, or team
   - Regular content audits and updates

### Performance Optimization

1. **Hybrid Search Tuning:**
   ```bash
   # Find optimal weights for your content
   orquel-mcp tools optimize-search --testQueries "query1,query2,query3"
   
   # Test different configurations
   orquel-mcp tools hybrid-search --query "test" --denseWeight 0.8 --lexicalWeight 0.2
   ```

2. **Database Optimization:**
   ```sql
   -- PostgreSQL: Optimize for your workload
   ALTER TABLE orquel_chunks SET (fillfactor = 80);
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orquel_source_title 
     ON orquel_chunks (source_title);
   ```

3. **Caching Strategy:**
   - Implement application-level caching for frequent queries
   - Use connection pooling for database connections
   - Consider Redis for session and query caching

### Security

1. **API Key Management:**
   ```bash
   # Use environment variables, never hardcode
   export OPENAI_API_KEY="sk-..."
   
   # Rotate keys regularly
   # Monitor API usage and set limits
   ```

2. **Database Security:**
   ```sql
   -- Create dedicated user with minimal privileges
   CREATE USER orquel_user WITH PASSWORD 'secure_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON orquel_chunks TO orquel_user;
   GRANT USAGE ON SCHEMA public TO orquel_user;
   ```

3. **Network Security:**
   - Use HTTPS for HTTP transport
   - Implement rate limiting
   - Monitor and log access patterns
   - Regular security audits

### Monitoring and Analytics

1. **Usage Tracking:**
   ```bash
   # Regular analytics
   orquel-mcp tools analyze-kb --analysisType "all"
   
   # Performance monitoring
   orquel-mcp tools benchmark --benchmarkType "search"
   ```

2. **Content Analysis:**
   ```bash
   # Identify knowledge gaps
   orquel-mcp tools semantic-clusters --analyzeGaps true
   
   # Content distribution analysis
   orquel-mcp tools analyze-kb --contentAnalysisDepth "detailed"
   ```

3. **Alerting:**
   - Set up monitoring for server health
   - Alert on high error rates or slow response times
   - Monitor database performance and disk usage
   - Track API usage and costs

---

## Next Steps

1. **Start with Basic Setup**: Follow the [Quick Start](#quick-start) guide
2. **Configure Claude Code**: Set up the [Claude Code Integration](#claude-code-integration)  
3. **Explore Tools**: Try different [MCP Tools](#available-mcp-tools) with your content
4. **Optimize Performance**: Use analytics and optimization tools
5. **Scale Up**: Move to production deployment when ready

For additional help:
- Check the [Troubleshooting](#troubleshooting) section
- Review [Best Practices](#best-practices) 
- Visit the GitHub repository for examples and community support