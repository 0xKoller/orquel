# Team Documentation Hub with MCP

A production-ready team documentation system using Orquel MCP server with HTTP transport for multiple team members.

## Overview

This example demonstrates:
- Multi-user team documentation system
- HTTP MCP server for remote access
- Role-based content management
- Integration with existing documentation workflows
- Performance optimization for team usage
- Authentication and security

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Team Members   │◄──►│  HTTP MCP       │◄──►│   PostgreSQL    │
│ (Claude Code)   │    │    Server       │    │   + Documents   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │  File Watcher   │
│  (Optional)     │    │   (Auto-sync)   │
└─────────────────┘    └─────────────────┘
```

## Features

- **🌐 HTTP MCP Server**: Multiple team members can connect
- **🔒 Authentication**: API key-based access control
- **📁 File Watching**: Automatic ingestion of documentation changes
- **👥 Multi-tenant**: Department/project-based content separation
- **⚡ Performance**: Connection pooling and caching
- **📊 Analytics**: Team usage analytics and insights
- **🔄 CI/CD Integration**: Automated documentation updates

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension
- OpenAI API key
- Docker (optional, for containerized deployment)

### Installation

```bash
# Create project
mkdir team-docs-hub && cd team-docs-hub
npm init -y

# Install dependencies
npm install orquel@latest express cors helmet rate-limiter-flexible
npm install @orquel/embeddings-openai @orquel/store-pgvector @orquel/lexical-postgres @orquel/answer-openai
npm install chokidar dotenv winston pm2

# Development dependencies
npm install --save-dev nodemon
```

### Project Structure

```
team-docs-hub/
├── config/
│   ├── orquel-mcp.config.js
│   ├── server.config.js
│   └── auth.config.js
├── docs/
│   ├── engineering/
│   ├── product/
│   ├── design/
│   └── operations/
├── scripts/
│   ├── setup-database.js
│   ├── ingest-docs.js
│   └── file-watcher.js
├── src/
│   ├── middleware/
│   └── utils/
├── logs/
├── docker-compose.yml
└── ecosystem.config.js
```

## Configuration

### 1. MCP Server Configuration

Create `config/orquel-mcp.config.js`:

```javascript
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
import { openAIAnswerer } from '@orquel/answer-openai';

export default {
  orquel: {
    embeddings: openAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-large', // Higher quality for team use
      batchSize: 100, // Efficient batch processing
    }),
    vector: pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      dimensions: 3072,
      tableName: 'team_docs_chunks',
      indexType: 'hnsw',
      performanceOptions: {
        batchSize: 200,
        connectionTimeoutMs: 10000,
        statementTimeoutMs: 120000,
      },
      poolConfig: {
        max: 20, // Support multiple concurrent users
        min: 5,
        idleTimeoutMillis: 30000,
      },
    }),
    lexical: postgresLexical({
      connectionString: process.env.DATABASE_URL,
      tableName: 'team_docs_lexical',
      enableFuzzySearch: true,
      enableStemming: true,
    }),
    answerer: openAIAnswerer({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o', // High quality for team use
      temperature: 0.05, // Consistent, factual answers
      maxTokens: 2000,
    }),
    hybrid: {
      denseWeight: 0.6,
      lexicalWeight: 0.4, // Higher lexical weight for exact term matching
      normalizationMethod: 'rrf',
    },
    debug: false, // Disabled in production
  },
  server: {
    name: 'team-documentation-hub',
    verbose: process.env.NODE_ENV === 'development',
  },
};
```

### 2. Server Configuration

Create `config/server.config.js`:

```javascript
export default {
  port: process.env.PORT || 3001,
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: [
      'https://claude.ai',
      'http://localhost:3000', // Local development
      process.env.WEBAPP_URL, // Team web app
    ],
    credentials: true,
  },
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // per user per minute
  },
  auth: {
    enabled: process.env.NODE_ENV === 'production',
    apiKeys: {
      engineering: process.env.ENGINEERING_API_KEY,
      product: process.env.PRODUCT_API_KEY,
      design: process.env.DESIGN_API_KEY,
      operations: process.env.OPERATIONS_API_KEY,
      admin: process.env.ADMIN_API_KEY,
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: 'logs/server.log',
  },
};
```

### 3. Environment Configuration

Create `.env`:

```bash
# Database
DATABASE_URL=postgresql://teamdocs:secure_password@localhost:5432/team_docs_hub

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
WEBAPP_URL=https://docs.yourcompany.com

# API Keys for different teams
ENGINEERING_API_KEY=eng_your-secure-key-here
PRODUCT_API_KEY=prod_your-secure-key-here
DESIGN_API_KEY=design_your-secure-key-here
OPERATIONS_API_KEY=ops_your-secure-key-here
ADMIN_API_KEY=admin_your-secure-key-here

# File watching
DOCS_DIRECTORY=/path/to/your/docs
WATCH_ENABLED=true

# Logging
LOG_LEVEL=info
```

## Implementation

### 1. Enhanced MCP Server

Create `src/server.js`:

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initializeOrquel } from '@orquel/mcp-server';
import config from '../config/orquel-mcp.config.js';
import serverConfig from '../config/server.config.js';
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/logging.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(serverConfig.cors));

// Rate limiting
const limiter = rateLimit({
  windowMs: serverConfig.rateLimit.windowMs,
  max: serverConfig.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Logging and parsing
app.use(loggingMiddleware);
app.use(express.json());

// Authentication
if (serverConfig.auth.enabled) {
  app.use('/mcp', authMiddleware);
}

// Initialize Orquel
initializeOrquel(config);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { checkMcpHealth } = await import('../scripts/health-check.js');
    const health = await checkMcpHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});

// Team-specific endpoints
app.get('/api/teams/:team/stats', async (req, res) => {
  const { team } = req.params;
  const { getTeamStats } = await import('../scripts/team-analytics.js');
  
  try {
    const stats = await getTeamStats(team);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MCP Protocol proxy (for xmcp integration)
app.use('/mcp', createProxyMiddleware({
  target: 'http://localhost:3002', // Internal xmcp server
  changeOrigin: true,
  pathRewrite: {
    '^/mcp': '',
  },
}));

// Start server
const server = app.listen(serverConfig.port, serverConfig.host, () => {
  console.log(`🚀 Team Documentation Hub running on ${serverConfig.host}:${serverConfig.port}`);
  console.log(`📊 Health check: http://${serverConfig.host}:${serverConfig.port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
```

### 2. Authentication Middleware

Create `src/middleware/auth.js`:

```javascript
import serverConfig from '../../config/server.config.js';

export function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      hint: 'Provide API key in X-API-Key header or apiKey query parameter'
    });
  }
  
  // Find which team this API key belongs to
  const team = Object.entries(serverConfig.auth.apiKeys)
    .find(([, key]) => key === apiKey)?.[0];
  
  if (!team) {
    return res.status(401).json({ 
      error: 'Invalid API key' 
    });
  }
  
  // Add team context to request
  req.team = team;
  req.isAdmin = team === 'admin';
  
  next();
}
```

### 3. File Watcher for Auto-Ingestion

Create `scripts/file-watcher.js`:

```javascript
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { getOrquelInstance } from '@orquel/mcp-server';
import { createHash } from 'crypto';

class DocumentWatcher {
  constructor(docsPath) {
    this.docsPath = docsPath;
    this.processedFiles = new Map(); // Track file hashes to avoid reprocessing
    this.orq = null;
  }
  
  async initialize() {
    this.orq = await getOrquelInstance();
    console.log('📁 Document watcher initialized');
  }
  
  async start() {
    if (!this.orq) {
      await this.initialize();
    }
    
    const watcher = chokidar.watch(this.docsPath, {
      ignored: [
        /node_modules/,
        /\.git/,
        /\.DS_Store/,
        /thumbs\.db/i
      ],
      persistent: true,
    });
    
    watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'changed'))
      .on('unlink', (filePath) => this.handleFileDelete(filePath))
      .on('error', (error) => console.error('File watcher error:', error));
    
    console.log(`👀 Watching for changes in: ${this.docsPath}`);
  }
  
  async handleFileChange(filePath, action) {
    try {
      // Only process supported file types
      const ext = path.extname(filePath).toLowerCase();
      if (!['.md', '.txt', '.rst', '.adoc'].includes(ext)) {
        return;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const contentHash = createHash('md5').update(content).digest('hex');
      
      // Skip if file hasn't actually changed
      if (this.processedFiles.get(filePath) === contentHash) {
        return;
      }
      
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(this.docsPath, filePath);
      const department = this.extractDepartment(relativePath);
      
      const source = {
        title: this.generateTitle(relativePath),
        kind: ext.substring(1), // Remove the dot
        url: `file://${path.resolve(filePath)}`,
        author: department,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
      
      console.log(`📄 Processing ${action} file: ${relativePath}`);
      
      const { chunks } = await this.orq.ingest({ source, content });
      await this.orq.index(chunks);
      
      this.processedFiles.set(filePath, contentHash);
      
      console.log(`✅ ${action} ${relativePath}: ${chunks.length} chunks indexed`);
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }
  
  async handleFileDelete(filePath) {
    console.log(`🗑️ File deleted: ${path.relative(this.docsPath, filePath)}`);
    this.processedFiles.delete(filePath);
    // TODO: Implement chunk deletion based on file path
  }
  
  extractDepartment(relativePath) {
    const parts = relativePath.split(path.sep);
    const departmentMap = {
      'engineering': 'Engineering Team',
      'product': 'Product Team', 
      'design': 'Design Team',
      'operations': 'Operations Team',
      'legal': 'Legal Team',
      'hr': 'Human Resources',
    };
    
    return departmentMap[parts[0]] || 'General';
  }
  
  generateTitle(relativePath) {
    const baseName = path.basename(relativePath, path.extname(relativePath));
    const dirPath = path.dirname(relativePath);
    
    // Convert kebab-case and snake_case to title case
    const title = baseName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    if (dirPath !== '.') {
      const category = path.basename(dirPath)
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      return `${category}: ${title}`;
    }
    
    return title;
  }
}

// Start watcher if running directly
if (process.env.WATCH_ENABLED === 'true') {
  const docsPath = process.env.DOCS_DIRECTORY || './docs';
  const watcher = new DocumentWatcher(docsPath);
  watcher.start();
}

export { DocumentWatcher };
```

### 4. Team Analytics

Create `scripts/team-analytics.js`:

```javascript
import { getOrquelInstance } from '@orquel/mcp-server';

export async function getTeamStats(team) {
  try {
    const orq = await getOrquelInstance();
    
    // Get team-specific content by author/department
    const { results } = await orq.query('', { k: 1000 }); // Get many results
    
    const teamContent = results.filter(result => 
      result.chunk.source.author?.toLowerCase().includes(team.toLowerCase()) ||
      result.chunk.metadata?.department?.toLowerCase() === team.toLowerCase()
    );
    
    // Calculate statistics
    const totalChunks = teamContent.length;
    const uniqueSources = new Set(teamContent.map(r => r.chunk.source.title)).size;
    
    const contentTypes = teamContent.reduce((acc, result) => {
      const kind = result.chunk.source.kind || 'unknown';
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});
    
    const avgChunkLength = totalChunks > 0 
      ? teamContent.reduce((sum, r) => sum + r.chunk.text.length, 0) / totalChunks 
      : 0;
    
    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentContent = teamContent.filter(result => {
      const createdAt = result.chunk.metadata?.source?.createdAt;
      return createdAt && new Date(createdAt) > thirtyDaysAgo;
    });
    
    return {
      team,
      statistics: {
        totalChunks,
        uniqueSources,
        avgChunkLength: Math.round(avgChunkLength),
        contentTypes,
        recentActivity: {
          chunksAdded: recentContent.length,
          sourcesAdded: new Set(recentContent.map(r => r.chunk.source.title)).size,
        },
      },
      topSources: getTopSources(teamContent, 10),
      recommendations: generateRecommendations(teamContent),
      lastUpdated: new Date().toISOString(),
    };
    
  } catch (error) {
    throw new Error(`Failed to get team stats: ${error.message}`);
  }
}

function getTopSources(teamContent, limit = 10) {
  const sourceCounts = teamContent.reduce((acc, result) => {
    const title = result.chunk.source.title;
    acc[title] = (acc[title] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(sourceCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([title, chunkCount]) => ({ title, chunkCount }));
}

function generateRecommendations(teamContent) {
  const recommendations = [];
  
  // Check for content gaps
  const contentTypes = new Set(teamContent.map(r => r.chunk.source.kind));
  const commonTypes = ['md', 'txt', 'rst'];
  const missingTypes = commonTypes.filter(type => !contentTypes.has(type));
  
  if (missingTypes.length > 0) {
    recommendations.push({
      type: 'content_diversification',
      message: `Consider adding ${missingTypes.join(', ')} documentation`,
      priority: 'medium',
    });
  }
  
  // Check for old content
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const oldContent = teamContent.filter(result => {
    const updatedAt = result.chunk.metadata?.source?.updatedAt;
    return updatedAt && new Date(updatedAt) < sixMonthsAgo;
  });
  
  if (oldContent.length > teamContent.length * 0.3) {
    recommendations.push({
      type: 'content_freshness',
      message: `${Math.round(oldContent.length / teamContent.length * 100)}% of content is older than 6 months`,
      priority: 'high',
    });
  }
  
  // Check content distribution
  const sourceCounts = teamContent.reduce((acc, result) => {
    const title = result.chunk.source.title;
    acc[title] = (acc[title] || 0) + 1;
    return acc;
  }, {});
  
  const topSource = Object.entries(sourceCounts).sort(([,a], [,b]) => b - a)[0];
  if (topSource && topSource[1] > teamContent.length * 0.5) {
    recommendations.push({
      type: 'content_balance',
      message: `"${topSource[0]}" represents ${Math.round(topSource[1] / teamContent.length * 100)}% of team content`,
      priority: 'medium',
    });
  }
  
  return recommendations;
}
```

## Deployment

### 1. Docker Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: team_docs_hub
      POSTGRES_USER: teamdocs
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U teamdocs"]
      interval: 30s
      timeout: 10s
      retries: 5

  orquel-mcp:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://teamdocs:secure_password@postgres:5432/team_docs_hub
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ENGINEERING_API_KEY=${ENGINEERING_API_KEY}
      - PRODUCT_API_KEY=${PRODUCT_API_KEY}
      - DESIGN_API_KEY=${DESIGN_API_KEY}
      - OPERATIONS_API_KEY=${OPERATIONS_API_KEY}
      - ADMIN_API_KEY=${ADMIN_API_KEY}
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./docs:/app/docs:ro
      - ./logs:/app/logs
    restart: unless-stopped

  file-watcher:
    build: .
    command: ["node", "scripts/file-watcher.js"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://teamdocs:secure_password@postgres:5432/team_docs_hub
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DOCS_DIRECTORY=/app/docs
      - WATCH_ENABLED=true
    volumes:
      - ./docs:/app/docs:ro
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
```

### 2. Production Configuration

Create `ecosystem.config.js` for PM2:

```javascript
module.exports = {
  apps: [
    {
      name: 'orquel-mcp-server',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_file: './logs/server-combined.log',
      time: true,
    },
    {
      name: 'orquel-file-watcher',
      script: 'scripts/file-watcher.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        WATCH_ENABLED: 'true',
      },
      error_file: './logs/watcher-error.log',
      out_file: './logs/watcher-out.log',
      log_file: './logs/watcher-combined.log',
      time: true,
    }
  ]
};
```

### 3. CI/CD Integration

Create `.github/workflows/deploy-docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        npm ci
        npm run build
        
    - name: Trigger documentation re-ingestion
      run: |
        curl -X POST "${{ secrets.MCP_SERVER_URL }}/api/admin/reindex" \
          -H "X-API-Key: ${{ secrets.ADMIN_API_KEY }}" \
          -H "Content-Type: application/json" \
          -d '{"confirm": true, "rebuildVectorIndex": true}'
```

## Usage

### Team Member Setup

Each team member configures Claude Code with:

```
Server Name: "Team Documentation Hub"
Command: curl
Arguments: [
  "-X", "POST",
  "https://docs.yourcompany.com/mcp/tools",
  "-H", "X-API-Key: YOUR_TEAM_API_KEY",
  "-H", "Content-Type: application/json",
  "-d", "@-"
]
Transport: HTTP
```

### Common Workflows

1. **Search team documentation:**
   ```
   Use the query tool to search for "deployment process engineering"
   ```

2. **Get answers with team context:**
   ```
   Use the answer tool to answer: "What's our process for code reviews?"
   ```

3. **Analyze team knowledge:**
   ```
   Use the analyze-kb tool to get insights about our team's documentation coverage
   ```

This setup provides a scalable, secure, and efficient team documentation system that keeps everyone's knowledge synchronized and accessible.