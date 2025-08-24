# Migration Guide: Orquel v0.2.0 → v0.3.0

Complete migration guide for upgrading to Orquel v0.3.0 with MCP integration.

## Overview

Orquel v0.3.0 introduces Model Context Protocol (MCP) server capabilities while maintaining full backward compatibility with v0.2.0. This means:

✅ **Your existing Orquel applications will continue to work unchanged**  
✅ **All v0.2.0 APIs remain available**  
✅ **Existing adapters and configurations are compatible**  
✅ **New MCP features are opt-in additions**

## What's New in v0.3.0

### Major Features

- **🔧 MCP Server Integration**: 11 MCP tools for Claude Code integration
- **🚀 Enhanced CLI**: New `orquel mcp` command suite
- **📊 Advanced Analytics**: Semantic clustering and knowledge gap analysis
- **⚡ Search Optimization**: ML-based parameter tuning
- **🔄 Hot Reloading**: Development mode for MCP tools
- **📈 Performance Benchmarking**: Comprehensive performance testing suite

### New Packages

- `@orquel/mcp-server`: MCP server implementation
- Enhanced `orquel` CLI with MCP commands

### New Dependencies

The MCP integration adds these optional dependencies:
- `xmcp`: TypeScript MCP framework
- `commander`: Enhanced CLI functionality  
- `zod`: Runtime type validation for MCP tools

## Migration Steps

### Step 1: Update Orquel

```bash
# Update to v0.3.0
npm update orquel

# Or with specific version
npm install orquel@^0.3.0
```

### Step 2: Verify Existing Functionality

Your existing code should work unchanged. Test your current setup:

```javascript
// This continues to work exactly as before
import { createOrquel } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';

const orq = createOrquel({
  embeddings: openAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
  vector: pgvectorStore({ 
    connectionString: process.env.DATABASE_URL,
    dimensions: 1536,
  }),
});

// All existing methods work unchanged
const { chunks } = await orq.ingest({ source: { title: "Test" }, content: "..." });
await orq.index(chunks);
const { results } = await orq.query("test query");
```

### Step 3: Optional MCP Integration

**Only proceed if you want MCP/Claude Code integration.**

#### Install MCP Server Package

```bash
npm install @orquel/mcp-server
```

#### Test MCP Server

```bash
# Check if MCP server works with your existing configuration
orquel mcp health

# List available MCP tools
orquel mcp tools
```

If you get configuration errors, see [Configuration Migration](#configuration-migration) below.

### Step 4: Configure Claude Code (Optional)

If you want to use Claude Code with your Orquel knowledge base:

```bash
# Start MCP server for Claude Code
orquel mcp serve --stdio
```

Then configure Claude Code to use the MCP server (see [MCP Integration Guide](./MCP_INTEGRATION_GUIDE.md) for details).

## Configuration Migration

### Current Configuration (v0.2.0)

If you have an existing Orquel configuration, it remains valid:

```javascript
// my-orquel-app.js (continues to work)
import { createOrquel } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';

const orq = createOrquel({
  embeddings: openAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
  vector: pgvectorStore({ 
    connectionString: process.env.DATABASE_URL,
    dimensions: 1536,
  }),
  hybrid: {
    denseWeight: 0.7,
    lexicalWeight: 0.3,
  },
  debug: true,
});
```

### MCP Configuration (v0.3.0)

For MCP server functionality, create a separate configuration:

```javascript
// orquel-mcp.config.js (new, optional)
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';

export default {
  orquel: {
    // Same configuration as before
    embeddings: openAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
    vector: pgvectorStore({ 
      connectionString: process.env.DATABASE_URL,
      dimensions: 1536,
    }),
    hybrid: {
      denseWeight: 0.7,
      lexicalWeight: 0.3,
    },
    debug: true,
  },
  server: {
    // New MCP-specific settings
    name: 'my-knowledge-base',
    verbose: true,
  },
};
```

### Configuration Sharing

To share configuration between your application and MCP server:

```javascript
// shared-config.js
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';

export const orquelConfig = {
  embeddings: openAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
  vector: pgvectorStore({ 
    connectionString: process.env.DATABASE_URL,
    dimensions: 1536,
  }),
  debug: process.env.NODE_ENV === 'development',
};

// my-app.js
import { createOrquel } from '@orquel/core';
import { orquelConfig } from './shared-config.js';

const orq = createOrquel(orquelConfig);

// orquel-mcp.config.js
import { orquelConfig } from './shared-config.js';

export default {
  orquel: orquelConfig,
  server: {
    name: 'my-app-kb',
    verbose: true,
  },
};
```

## API Changes

### Backward Compatible Changes

All existing APIs remain unchanged. These new features are available:

#### Enhanced Query Options

```javascript
// v0.2.0 (still works)
const { results } = await orq.query("search query", { k: 10, hybrid: true });

// v0.3.0 (new options available)
const { results } = await orq.query("search query", { 
  k: 10, 
  hybrid: true,
  rerank: true,        // New: explicit reranking control
  includeScores: true, // New: control score inclusion
});
```

#### New Utility Functions

```javascript
// v0.3.0 new utilities (imported separately)
import { 
  mergeHybridResults, 
  analyzeHybridOverlap,
  SearchOptimizer 
} from '@orquel/core';

// Advanced hybrid search control
const optimizer = new SearchOptimizer();
const optimizedResults = await optimizer.optimizedSearch(query, queryEmbedding, vectorStore, lexicalStore);
```

### MCP-Specific APIs

New MCP-related functions are in the `@orquel/mcp-server` package:

```javascript
import { 
  initializeOrquel, 
  getOrquelInstance,
  closeOrquel 
} from '@orquel/mcp-server';

// Initialize MCP server with configuration
initializeOrquel({
  orquel: orquelConfig,
  server: { name: 'my-server', verbose: true }
});

// Get the initialized instance
const orq = await getOrquelInstance();
```

## CLI Changes

### v0.2.0 CLI Commands (still available)

```bash
orquel setup    # Setup wizard (unchanged)
```

### v0.3.0 New CLI Commands

```bash
# MCP server commands (new)
orquel mcp serve          # Start MCP server
orquel mcp tools          # List MCP tools
orquel mcp health         # Health check
orquel mcp config         # Configuration management

# Backward compatibility
orquel serve              # Shorthand for 'orquel mcp serve'
```

## Database Schema Changes

### PostgreSQL Schema

No breaking changes to existing schemas. New optional features:

#### Enhanced Metadata (Optional)

The PostgreSQL adapter now supports richer metadata storage:

```sql
-- v0.2.0 schema (continues to work)
CREATE TABLE orquel_chunks (
  id TEXT PRIMARY KEY,
  source_title TEXT NOT NULL,
  source_kind TEXT,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- v0.3.0 enhancements (automatically applied)
ALTER TABLE orquel_chunks 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Trigger for updated_at (auto-created)
CREATE OR REPLACE FUNCTION update_updated_at_column()...
```

#### Performance Indexes (Optional)

New indexes for better performance (auto-created if needed):

```sql
-- Enhanced vector index configurations
CREATE INDEX IF NOT EXISTS orquel_chunks_embedding_idx 
  ON orquel_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (ef_construction = 64);

-- Metadata search support  
CREATE INDEX IF NOT EXISTS orquel_chunks_metadata_gin_idx
  ON orquel_chunks USING GIN (metadata);
```

### Data Migration

**No manual migration required.** Existing data works unchanged with v0.3.0.

Optional performance optimization:

```bash
# Reindex for improved performance (optional)
orquel mcp serve --config your-config.js &
sleep 5
orquel-mcp tools reindex --confirm true --dryRun false
```

## Troubleshooting Migration Issues

### Issue 1: MCP Server Won't Start

**Symptoms:**
```
❌ Configuration error: Missing adapters
```

**Solution:**
```bash
# Install MCP server package
npm install @orquel/mcp-server

# Verify configuration
orquel mcp health
```

### Issue 2: Performance Degradation

**Symptoms:** Slower queries after upgrade

**Solution:**
```bash
# Run performance benchmark
orquel-mcp tools benchmark --benchmarkType search

# Optimize search parameters
orquel-mcp tools optimize-search --testQueries "your,common,queries"

# Reindex if needed
orquel-mcp tools reindex --confirm true
```

### Issue 3: Configuration Conflicts

**Symptoms:** Different behavior between direct API and MCP tools

**Solution:**
```javascript
// Ensure consistent configuration
const sharedConfig = {
  embeddings: openAIEmbeddings({ /* same settings */ }),
  vector: pgvectorStore({ /* same settings */ }),
  // ... other shared settings
};

// Use in both places
const orq = createOrquel(sharedConfig);  // Direct API

export default {
  orquel: sharedConfig,  // MCP server
  server: { name: 'my-server' }
};
```

### Issue 4: Claude Code Integration Problems

**Symptoms:** Claude Code can't see MCP tools

**Solution:**
```bash
# 1. Verify server starts correctly
orquel mcp serve --stdio --verbose

# 2. Check tool availability
orquel mcp tools

# 3. Test health
orquel mcp health

# 4. Verify Claude Code configuration
# - Command: orquel mcp serve --stdio
# - Transport: STDIO
```

## Performance Considerations

### Memory Usage

v0.3.0 includes memory optimizations but adds MCP functionality:

- **Core Orquel**: Same memory usage as v0.2.0
- **MCP Server**: Additional ~10-20MB for server infrastructure
- **Tool Caching**: Configurable caching for better performance

### Latency

- **Direct API**: No performance change from v0.2.0
- **MCP Tools**: Small overhead (~5-10ms) for protocol handling
- **Advanced Features**: New optimization tools can improve performance

### Database Load

- **Read Operations**: Same as v0.2.0
- **Write Operations**: Same as v0.2.0  
- **Analytics Tools**: New tools may generate additional queries for analysis

## Testing Your Migration

### 1. Functional Testing

```bash
# Test existing functionality
node -e "
import { createOrquel } from '@orquel/core';
// ... your existing setup code ...
console.log('✅ Direct API works');
"

# Test MCP server
orquel mcp health
echo "✅ MCP server works"
```

### 2. Performance Testing

```bash
# Benchmark your setup
orquel-mcp tools benchmark --benchmarkType full --iterations 3

# Compare with v0.2.0 performance if needed
```

### 3. Integration Testing

If using Claude Code:

```bash
# Start MCP server
orquel mcp serve --stdio &

# Test basic operations through Claude Code:
# 1. List available tools
# 2. Try ingest tool with sample content  
# 3. Try query tool
# 4. Try answer tool
```

## Rollback Plan

If you need to rollback to v0.2.0:

```bash
# 1. Stop MCP server
killall node  # or your process manager

# 2. Downgrade package
npm install orquel@^0.2.0

# 3. Remove MCP-specific dependencies (optional)
npm uninstall @orquel/mcp-server

# 4. Your existing code continues to work unchanged
```

**Note:** Rolling back won't affect your data or existing functionality.

## Post-Migration Recommendations

### 1. Explore New Features

```bash
# Try advanced analytics
orquel-mcp tools analyze-kb --analysisType all

# Experiment with search optimization
orquel-mcp tools optimize-search --testQueries "relevant,to,your,content"

# Analyze content clusters
orquel-mcp tools semantic-clusters --analyzeGaps true
```

### 2. Set Up Monitoring

```bash
# Regular health checks
echo "0 */6 * * * /usr/local/bin/orquel mcp health" | crontab -

# Performance monitoring
orquel-mcp tools benchmark --benchmarkType search > performance.log
```

### 3. Claude Code Integration

Follow the [MCP Integration Guide](./MCP_INTEGRATION_GUIDE.md) to set up Claude Code integration.

### 4. Team Training

- Share the new MCP tools with your team
- Set up shared MCP configurations
- Document your organization's usage patterns

## Support

If you encounter issues during migration:

1. **Check Health**: `orquel mcp health`
2. **Review Logs**: Enable verbose mode `--verbose`
3. **Test Components**: Use `orquel mcp tools` to test individual features
4. **Performance Issues**: Use `orquel-mcp tools benchmark` to identify bottlenecks
5. **Documentation**: Review the [MCP Integration Guide](./MCP_INTEGRATION_GUIDE.md)

The migration to v0.3.0 is designed to be seamless while opening up powerful new possibilities with MCP integration. Take your time to explore the new features and optimize your setup for your specific use case.