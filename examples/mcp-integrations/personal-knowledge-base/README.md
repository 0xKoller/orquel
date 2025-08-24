# Personal Knowledge Base with Claude Code

A complete example of setting up a personal knowledge base using Orquel MCP server with Claude Code integration.

## Overview

This example demonstrates:
- Personal document management with Orquel
- Claude Code integration via MCP protocol
- Local STDIO transport for security
- Markdown document processing
- Semantic search and AI-powered Q&A

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude Code   │◄──►│  Orquel MCP     │◄──►│   Local Files   │
│   (STDIO)       │    │     Server      │    │  + PostgreSQL   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension
- OpenAI API key
- Claude Code installed

### Installation

```bash
# Clone or create project directory
mkdir personal-kb && cd personal-kb

# Initialize project
npm init -y

# Install dependencies
npm install orquel@latest
npm install @orquel/embeddings-openai @orquel/store-pgvector @orquel/lexical-postgres @orquel/answer-openai

# Create directories
mkdir docs config
```

### Configuration

Create `orquel-mcp.config.js`:

```javascript
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
import { openAIAnswerer } from '@orquel/answer-openai';

export default {
  orquel: {
    embeddings: openAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small', // Cost-effective for personal use
    }),
    vector: pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      dimensions: 1536,
      tableName: 'personal_kb_chunks',
    }),
    lexical: postgresLexical({
      connectionString: process.env.DATABASE_URL,
      tableName: 'personal_kb_lexical',
    }),
    answerer: openAIAnswerer({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini', // Cost-effective for personal use
      temperature: 0.1,
    }),
    hybrid: {
      denseWeight: 0.7,
      lexicalWeight: 0.3,
    },
    debug: true,
  },
  server: {
    name: 'personal-knowledge-base',
    verbose: true,
  },
};
```

Create `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/personal_kb

# Optional: Development settings
NODE_ENV=development
ORQUEL_VERBOSE=true
```

### Database Setup

```bash
# Create database
createdb personal_kb

# Enable pgvector extension
psql personal_kb -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify setup
psql personal_kb -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"
```

## Usage

### 1. Start MCP Server

```bash
# Start in STDIO mode for Claude Code
orquel mcp serve --stdio --config ./orquel-mcp.config.js --verbose
```

### 2. Configure Claude Code

In Claude Code settings:
- Server Name: "Personal Knowledge Base"
- Command: `orquel mcp serve --stdio --config ./orquel-mcp.config.js`
- Arguments: `--verbose`
- Transport: STDIO
- Working Directory: `/path/to/personal-kb`

### 3. Ingest Your Documents

In Claude Code conversation:

```
Use the ingest tool to add my personal notes:

Title: "Meeting Notes - Project Alpha"
Content: "# Project Alpha Kickoff Meeting

Date: 2024-01-15
Attendees: Alice, Bob, Carol

## Key Decisions:
- Technology stack: React + Node.js
- Timeline: 3 months
- Budget: $50k

## Action Items:
- [ ] Set up development environment (Alice)
- [ ] Design mockups (Bob) 
- [ ] Database schema (Carol)

## Next Meeting:
January 22nd, 2024 at 2pm"
Kind: "md"
Author: "Me"
```

### 4. Search Your Knowledge Base

```
Use the query tool to search for "project timeline decisions"
```

### 5. Get AI Answers

```
Use the answer tool to answer: "What was decided about the Project Alpha timeline and who's responsible for what?"
```

## Example Workflows

### Daily Journal Integration

```javascript
// daily-journal.js - Automated daily journal ingestion
import fs from 'fs';
import path from 'path';
import { createOrquel } from '@orquel/core';
import { orquelConfig } from './orquel-mcp.config.js';

const orq = createOrquel(orquelConfig.orquel);

async function ingestDailyJournal(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  const journalPath = `./docs/journal/${dateStr}.md`;
  
  if (!fs.existsSync(journalPath)) {
    console.log(`No journal entry for ${dateStr}`);
    return;
  }
  
  const content = fs.readFileSync(journalPath, 'utf8');
  
  const { chunks } = await orq.ingest({
    source: {
      title: `Daily Journal - ${dateStr}`,
      kind: 'md',
      author: 'Me',
      createdAt: date,
      url: `file://${path.resolve(journalPath)}`,
    },
    content,
  });
  
  await orq.index(chunks);
  console.log(`✅ Ingested journal entry: ${dateStr} (${chunks.length} chunks)`);
}

// Run daily via cron or manually
ingestDailyJournal();
```

### Book Notes Processing

```javascript
// book-notes.js - Process reading notes
async function ingestBookNotes(bookTitle, author, notesFile) {
  const content = fs.readFileSync(notesFile, 'utf8');
  
  const { chunks } = await orq.ingest({
    source: {
      title: `Book Notes: ${bookTitle}`,
      kind: 'md',
      author: `Notes on ${author}`,
      metadata: {
        category: 'book-notes',
        book_title: bookTitle,
        book_author: author,
        reading_date: new Date().toISOString(),
      },
    },
    content,
  });
  
  await orq.index(chunks);
  console.log(`📚 Ingested book notes: ${bookTitle}`);
}

// Usage
await ingestBookNotes(
  "The Pragmatic Programmer",
  "David Thomas & Andrew Hunt", 
  "./docs/books/pragmatic-programmer-notes.md"
);
```

### Web Article Archiving

```javascript
// web-article.js - Archive web articles
import { JSDOM } from 'jsdom';

async function ingestWebArticle(url) {
  const response = await fetch(url);
  const html = await response.text();
  
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Extract title and content (simplified)
  const title = document.querySelector('title')?.textContent || url;
  const articleContent = document.querySelector('article')?.textContent ||
                        document.querySelector('.content')?.textContent ||
                        document.body.textContent;
  
  const { chunks } = await orq.ingest({
    source: {
      title: `Web Article: ${title}`,
      kind: 'html',
      url,
      author: 'Web Archive',
      metadata: {
        category: 'web-articles',
        archived_date: new Date().toISOString(),
        domain: new URL(url).hostname,
      },
    },
    content: articleContent,
  });
  
  await orq.index(chunks);
  console.log(`🌐 Archived article: ${title}`);
}
```

## Advanced Features

### Weekly Review Analysis

In Claude Code:

```
Use the semantic-clusters tool to analyze my knowledge base:
- sampleSize: 500
- clusterCount: 10 
- analyzeGaps: true

This will help me understand what topics I'm learning about and identify knowledge gaps.
```

### Performance Monitoring

```bash
# Monthly performance check
orquel mcp serve --config ./orquel-mcp.config.js &
sleep 5

# Run comprehensive analysis
orquel-mcp tools analyze-kb --analysisType "all" --includeContentSample true

# Performance benchmark
orquel-mcp tools benchmark --benchmarkType "search" --dataSize "medium"

# Optimize search parameters
orquel-mcp tools optimize-search --testQueries "meeting notes,book recommendations,project status"
```

### Backup and Sync

```javascript
// backup.js - Export knowledge base
async function exportKnowledgeBase() {
  // Get all sources
  const sources = await orq.query('', { k: 1000 }); // Large query to get many results
  
  // Group by source
  const sourceMap = new Map();
  sources.results.forEach(result => {
    const sourceTitle = result.chunk.source.title;
    if (!sourceMap.has(sourceTitle)) {
      sourceMap.set(sourceTitle, {
        source: result.chunk.source,
        chunks: []
      });
    }
    sourceMap.get(sourceTitle).chunks.push(result.chunk);
  });
  
  // Save as JSON backup
  const backup = {
    exported_at: new Date().toISOString(),
    version: '0.3.0',
    sources: Array.from(sourceMap.values())
  };
  
  fs.writeFileSync(`backup-${Date.now()}.json`, JSON.stringify(backup, null, 2));
  console.log('💾 Knowledge base backed up');
}
```

## Troubleshooting

### Common Issues

1. **"Can't connect to database"**
   ```bash
   # Check PostgreSQL is running
   pg_ctl status
   
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. **"OpenAI API quota exceeded"**
   - Monitor usage in OpenAI dashboard
   - Use `text-embedding-3-small` for embeddings (cheaper)
   - Use `gpt-4o-mini` for answers (cheaper)

3. **"Claude Code can't see MCP server"**
   ```bash
   # Check server starts correctly
   orquel mcp serve --stdio --config ./orquel-mcp.config.js --verbose
   
   # Verify tools are available
   orquel mcp tools
   ```

### Performance Optimization

1. **Batch process documents:**
   ```bash
   # Process multiple documents efficiently
   find ./docs -name "*.md" -exec node process-doc.js {} \;
   ```

2. **Optimize database:**
   ```sql
   -- Analyze tables for better query planning
   ANALYZE personal_kb_chunks;
   ANALYZE personal_kb_lexical;
   ```

3. **Memory management:**
   ```bash
   # Monitor memory usage
   orquel-mcp tools analyze-kb --analysisType "health"
   ```

## Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "mcp:start": "orquel mcp serve --stdio --config ./orquel-mcp.config.js",
    "mcp:health": "orquel mcp health --config ./orquel-mcp.config.js",
    "mcp:tools": "orquel mcp tools --detailed",
    "mcp:analyze": "orquel-mcp tools analyze-kb --analysisType all",
    "backup": "node scripts/backup.js",
    "ingest:journal": "node scripts/daily-journal.js",
    "ingest:books": "node scripts/process-book-notes.js"
  }
}
```

### Automation

```bash
# Crontab for daily journal ingestion
# Run at 11:59 PM daily
59 23 * * * cd /path/to/personal-kb && npm run ingest:journal

# Weekly analysis
0 9 * * 1 cd /path/to/personal-kb && npm run mcp:analyze > weekly-analysis.log

# Monthly backup
0 2 1 * * cd /path/to/personal-kb && npm run backup
```

This personal knowledge base setup provides a powerful, private AI assistant that learns from your personal documents, meeting notes, reading material, and daily thoughts while keeping everything under your control.