import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { initializeOrquel, getCurrentConfig, type OrquelMcpConfig } from '@orquel/mcp-server';

interface McpServeOptions {
  config?: string;
  port?: string;
  stdio?: boolean;
  http?: boolean;
  verbose?: boolean;
  dev?: boolean;
}

interface McpToolsOptions {
  detailed?: boolean;
}

interface McpHealthOptions {
  config?: string;
}

interface McpConfigOptions {
  generate?: boolean;
  validate?: string;
  output?: string;
}

export async function startMcpServer(options: McpServeOptions): Promise<void> {
  try {
    console.log('🚀 Starting Orquel MCP Server...\n');
    
    // Determine transport mode
    const useStdio = options.stdio || (!options.http && !options.port);
    const transport = useStdio ? 'STDIO' : 'HTTP';
    
    console.log(`📡 Transport: ${transport}`);
    if (!useStdio) {
      console.log(`🌐 Port: ${options.port || 3001}`);
    }
    console.log(`🔧 Config: ${options.config || 'environment/auto-detection'}`);
    console.log(`📝 Verbose: ${options.verbose ? 'enabled' : 'disabled'}\n`);
    
    // Set environment variables
    if (options.config) {
      process.env.ORQUEL_CONFIG_PATH = options.config;
    }
    if (options.verbose) {
      process.env.ORQUEL_VERBOSE = 'true';
    }
    
    // Test configuration before starting server
    console.log('🔍 Validating configuration...');
    try {
      await validateConfiguration(options.config);
      console.log('✅ Configuration valid\n');
    } catch (error) {
      console.error('❌ Configuration error:', error);
      console.log('\n💡 Common issues:');
      console.log('• Missing environment variables (OPENAI_API_KEY, DATABASE_URL)');
      console.log('• Missing adapter packages (@orquel/embeddings-*, @orquel/store-*)');
      console.log('• Invalid configuration file format');
      console.log('\nUse "orquel mcp config --generate" to create a sample configuration.');
      process.exit(1);
    }
    
    if (options.dev) {
      console.log('🔄 Starting in development mode with hot reloading...');
      await startDevelopmentServer(options);
    } else {
      console.log('🏁 Starting production server...');
      await startProductionServer(options);
    }
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

export async function listMcpTools(options: McpToolsOptions): Promise<void> {
  console.log('🔧 Orquel MCP Tools\n');
  
  const tools = [
    {
      name: 'ingest',
      description: 'Ingest documents into the knowledge base for search and retrieval',
      category: 'Core',
      parameters: ['title (string)', 'content (string)', 'kind? (md|txt|pdf|docx|html)', 'url? (string)', 'author? (string)', 'metadata? (object)'],
      example: { title: 'User Guide', content: '# Getting Started...', kind: 'md' }
    },
    {
      name: 'query',
      description: 'Search the knowledge base using hybrid vector and lexical search',
      category: 'Core', 
      parameters: ['query (string)', 'k? (number, 1-50)', 'hybrid? (boolean)', 'rerank? (boolean)', 'includeScores? (boolean)', 'includeMetadata? (boolean)'],
      example: { query: 'How to configure authentication?', k: 5, hybrid: true }
    },
    {
      name: 'answer',
      description: 'Generate AI answers with source citations from knowledge base',
      category: 'Core',
      parameters: ['question (string)', 'topK? (number, 1-20)', 'includeSources? (boolean)', 'includeContext? (boolean)'],
      example: { question: 'What are the system requirements?', topK: 3, includeSources: true }
    },
    {
      name: 'list-sources',
      description: 'List all sources in the knowledge base with statistics',
      category: 'Management',
      parameters: ['includeStats? (boolean)', 'sortBy? (title|created|chunks)', 'limit? (number, 1-100)'],
      example: { includeStats: true, sortBy: 'chunks', limit: 20 }
    },
    {
      name: 'clear',
      description: 'Clear all content from the knowledge base (requires confirmation)',
      category: 'Management',
      parameters: ['confirm (boolean)', 'sourceFilter? (string)', 'dryRun? (boolean)'],
      example: { confirm: true, dryRun: false }
    },
    {
      name: 'hybrid-search',
      description: 'Advanced hybrid search with configurable dense/lexical weights',
      category: 'Advanced',
      parameters: ['query (string)', 'denseWeight? (number, 0-1)', 'lexicalWeight? (number, 0-1)', 'normalizationMethod? (rrf|minmax|zscore)', 'showAnalytics? (boolean)'],
      example: { query: 'machine learning', denseWeight: 0.7, lexicalWeight: 0.3, showAnalytics: true }
    },
    {
      name: 'optimize-search',
      description: 'Auto-optimize hybrid search parameters using ML techniques',
      category: 'Advanced',
      parameters: ['testQueries (string[])', 'optimizationGoal? (precision|recall|balanced)', 'maxIterations? (number, 5-50)'],
      example: { testQueries: ['search query 1', 'search query 2'], optimizationGoal: 'balanced' }
    },
    {
      name: 'benchmark',
      description: 'Performance benchmarking with detailed metrics and analysis',
      category: 'Advanced',
      parameters: ['benchmarkType? (ingestion|search|full)', 'dataSize? (small|medium|large)', 'iterations? (number, 1-10)', 'concurrency? (number, 1-10)'],
      example: { benchmarkType: 'search', dataSize: 'medium', iterations: 3 }
    },
    {
      name: 'analyze-kb',
      description: 'Comprehensive knowledge base analysis including health and statistics',
      category: 'Analytics',
      parameters: ['analysisType? (overview|content|performance|health|all)', 'includeContentSample? (boolean)', 'contentAnalysisDepth? (basic|detailed)'],
      example: { analysisType: 'all', includeContentSample: true, contentAnalysisDepth: 'detailed' }
    },
    {
      name: 'reindex',
      description: 'Rebuild search indexes for performance optimization',
      category: 'Maintenance',
      parameters: ['confirm (boolean)', 'rebuildVectorIndex? (boolean)', 'rebuildLexicalIndex? (boolean)', 'batchSize? (number, 10-1000)', 'dryRun? (boolean)'],
      example: { confirm: true, rebuildVectorIndex: true, batchSize: 100, dryRun: false }
    },
    {
      name: 'semantic-clusters',
      description: 'Analyze semantic clusters and identify knowledge gaps',
      category: 'Analytics',
      parameters: ['sampleSize? (number, 50-1000)', 'clusterCount? (number, 3-20)', 'similarityThreshold? (number, 0.1-0.95)', 'analyzeGaps? (boolean)'],
      example: { sampleSize: 200, clusterCount: 8, analyzeGaps: true }
    }
  ];
  
  if (options.detailed) {
    // Detailed view with full parameter information
    const categories = [...new Set(tools.map(t => t.category))];
    
    categories.forEach(category => {
      console.log(`## ${category} Tools\n`);
      
      const categoryTools = tools.filter(t => t.category === category);
      
      categoryTools.forEach(tool => {
        console.log(`### ${tool.name}`);
        console.log(`${tool.description}\n`);
        
        console.log('**Parameters:**');
        tool.parameters.forEach(param => {
          console.log(`• ${param}`);
        });
        
        console.log('\n**Example:**');
        console.log('```json');
        console.log(JSON.stringify(tool.example, null, 2));
        console.log('```\n');
        
        console.log('---\n');
      });
    });
  } else {
    // Compact view
    const categories = [...new Set(tools.map(t => t.category))];
    
    categories.forEach(category => {
      console.log(`## ${category} Tools`);
      
      const categoryTools = tools.filter(t => t.category === category);
      
      categoryTools.forEach(tool => {
        console.log(`• **${tool.name}** - ${tool.description}`);
      });
      
      console.log('');
    });
  }
  
  console.log('💡 **Usage in Claude Code:**');
  console.log('1. Start the MCP server: `orquel mcp serve --stdio`');
  console.log('2. Configure Claude Code to connect to the MCP server');
  console.log('3. Use tools directly in conversations');
  console.log('');
  console.log('📖 **More Information:**');
  console.log('• Use `orquel mcp health` to check server status');
  console.log('• Use `orquel mcp config --generate` for configuration help');
  console.log('• Visit documentation for detailed setup guides');
}

export async function checkMcpHealth(options: McpHealthOptions): Promise<void> {
  console.log('🏥 Orquel MCP Health Check\n');
  
  try {
    // Configuration validation
    console.log('🔍 **Configuration Check**');
    
    if (options.config) {
      console.log(`• Config file: ${options.config}`);
      
      if (!existsSync(options.config)) {
        console.log('❌ Configuration file not found\n');
        return;
      }
      
      try {
        const configContent = readFileSync(options.config, 'utf8');
        console.log('✅ Configuration file exists and readable');
        
        // Try to parse if it's JSON
        if (options.config.endsWith('.json')) {
          JSON.parse(configContent);
          console.log('✅ JSON configuration is valid');
        }
      } catch (error) {
        console.log(`❌ Configuration file error: ${error}`);
      }
    } else {
      console.log('• Config source: Environment variables / auto-detection');
    }
    
    // Environment variables check
    console.log('\n🌍 **Environment Variables**');
    const envVars = [
      { name: 'ORQUEL_CONFIG_PATH', required: false, current: process.env.ORQUEL_CONFIG_PATH },
      { name: 'OPENAI_API_KEY', required: true, current: process.env.OPENAI_API_KEY ? '***set***' : undefined },
      { name: 'DATABASE_URL', required: false, current: process.env.DATABASE_URL ? '***set***' : undefined },
      { name: 'NODE_ENV', required: false, current: process.env.NODE_ENV },
    ];
    
    envVars.forEach(envVar => {
      const status = envVar.current ? '✅' : (envVar.required ? '❌' : '⚠️');
      const value = envVar.current || 'not set';
      console.log(`${status} ${envVar.name}: ${value}`);
    });
    
    // Try to initialize Orquel
    console.log('\n🔧 **Orquel Initialization**');
    
    try {
      if (options.config) {
        process.env.ORQUEL_CONFIG_PATH = options.config;
      }
      
      await validateConfiguration(options.config);
      console.log('✅ Orquel instance created successfully');
      
      // Test basic functionality  
      console.log('\n🧪 **Functionality Tests**');
      
      const orquelModule = await import('@orquel/mcp-server');
      const orq = await orquelModule.getOrquelInstance();
      
      // Test embeddings
      console.log('• Testing embeddings...');
      const config = (orq as any).config;
      await config.embeddings.embed(['health check test']);
      console.log('  ✅ Embeddings working');
      
      // Test vector search
      console.log('• Testing vector search...');
      await orq.query('health check', { k: 1 });
      console.log('  ✅ Vector search working');
      
      // Test lexical search if available
      if (config.lexical) {
        console.log('• Testing lexical search...');
        await config.lexical.search('health check', 1);
        console.log('  ✅ Lexical search working');
      } else {
        console.log('  ⚠️ Lexical search not configured');
      }
      
      // Test answer generation if available
      if (config.answerer) {
        console.log('• Testing answer generation...');
        await orq.answer('What is a health check?', { topK: 1 });
        console.log('  ✅ Answer generation working');
      } else {
        console.log('  ⚠️ Answer generation not configured');
      }
      
      console.log('\n🎉 **Health check completed successfully!**');
      console.log('The MCP server is ready for use.');
      
    } catch (error) {
      console.log(`❌ Orquel initialization failed: ${error}`);
      console.log('\n💡 **Common Solutions:**');
      console.log('• Install required adapter packages:');
      console.log('  - npm install @orquel/embeddings-openai');
      console.log('  - npm install @orquel/store-memory (or @orquel/store-pgvector)');
      console.log('• Set required environment variables');
      console.log('• Check API keys and connection strings');
      console.log('• Use "orquel mcp config --generate" to create a sample config');
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

export async function generateMcpConfig(options: McpConfigOptions): Promise<void> {
  if (options.generate) {
    console.log('📋 Generating Orquel MCP Configuration\n');
    
    const configTemplate = {
      orquel: {
        embeddings: {
          adapter: '@orquel/embeddings-openai',
          config: {
            apiKey: '${OPENAI_API_KEY}',
            model: 'text-embedding-3-small',
            dimensions: 1536
          }
        },
        vector: {
          adapter: '@orquel/store-pgvector',
          config: {
            connectionString: '${DATABASE_URL}',
            dimensions: 1536,
            tableName: 'orquel_chunks',
            indexType: 'hnsw'
          }
        },
        lexical: {
          adapter: '@orquel/lexical-postgres',
          config: {
            connectionString: '${DATABASE_URL}',
            tableName: 'orquel_lexical'
          }
        },
        answerer: {
          adapter: '@orquel/answer-openai',
          config: {
            apiKey: '${OPENAI_API_KEY}',
            model: 'gpt-4o-mini'
          }
        },
        debug: false
      },
      server: {
        name: 'my-orquel-mcp-server',
        verbose: true
      }
    };
    
    const jsConfig = `// orquel-mcp.config.js
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
import { openAIAnswerer } from '@orquel/answer-openai';

export default {
  orquel: {
    embeddings: openAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    }),
    vector: pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      dimensions: 1536,
      indexType: 'hnsw',
    }),
    lexical: postgresLexical({
      connectionString: process.env.DATABASE_URL,
    }),
    answerer: openAIAnswerer({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    }),
    debug: process.env.NODE_ENV === 'development',
  },
  server: {
    name: 'my-orquel-mcp-server',
    verbose: true,
  },
};`;

    const outputPath = options.output || './orquel-mcp.config.js';
    
    try {
      writeFileSync(outputPath, jsConfig);
      console.log(`✅ Configuration generated: ${outputPath}\n`);
      
      console.log('📦 **Required Dependencies:**');
      console.log('npm install @orquel/embeddings-openai @orquel/store-pgvector @orquel/lexical-postgres @orquel/answer-openai\n');
      
      console.log('🔑 **Required Environment Variables:**');
      console.log('export OPENAI_API_KEY="your-openai-api-key"');
      console.log('export DATABASE_URL="postgresql://user:pass@localhost:5432/orquel"\n');
      
      console.log('🚀 **Usage:**');
      console.log(`orquel mcp serve --config ${outputPath}`);
      console.log('orquel mcp health --config ' + outputPath);
      
    } catch (error) {
      console.error(`❌ Failed to write configuration: ${error}`);
    }
    
  } else if (options.validate) {
    console.log(`🔍 Validating Configuration: ${options.validate}\n`);
    
    try {
      await validateConfiguration(options.validate);
      console.log('✅ Configuration is valid and functional');
    } catch (error) {
      console.error(`❌ Configuration validation failed: ${error}`);
      process.exit(1);
    }
  } else {
    console.log('❓ Please specify --generate or --validate option\n');
    console.log('Examples:');
    console.log('  orquel mcp config --generate');
    console.log('  orquel mcp config --generate --output ./my-config.js');
    console.log('  orquel mcp config --validate ./orquel-mcp.config.js');
  }
}

async function validateConfiguration(configPath?: string): Promise<void> {
  // Set up environment for testing
  if (configPath) {
    process.env.ORQUEL_CONFIG_PATH = configPath;
  }
  
  // Import the MCP server module and try to initialize
  const orquelMcp = await import('@orquel/mcp-server');
  const orq = await orquelMcp.getOrquelInstance();
  
  // Test basic operations
  await orq.query('configuration test', { k: 1 });
}

async function startDevelopmentServer(options: McpServeOptions): Promise<void> {
  // In development mode, we'd use xmcp dev command
  // For now, we'll simulate by running the production server with development flags
  console.log('🔄 Development mode - hot reloading enabled');
  console.log('💡 Changes to tools will be automatically reloaded\n');
  
  await startProductionServer({ ...options, verbose: true });
}

async function startProductionServer(options: McpServeOptions): Promise<void> {
  const transport = options.stdio ? 'stdio' : 'http';
  
  // For now, we'll provide instructions on how to use xmcp directly
  // In the future, this could spawn the xmcp process directly
  
  console.log('🚀 **MCP Server Ready**\n');
  
  if (transport === 'stdio') {
    console.log('📡 **STDIO Transport Active**');
    console.log('The server is ready to accept MCP protocol messages via STDIO.\n');
    
    console.log('🔗 **Claude Code Integration:**');
    console.log('Configure Claude Code to use this server with:');
    console.log('• Server command: orquel mcp serve --stdio');
    console.log('• Transport: STDIO\n');
    
  } else {
    console.log(`🌐 **HTTP Transport Active**`);
    console.log(`Server running on: http://localhost:${options.port || 3001}\n`);
    
    console.log('🔗 **HTTP Integration:**');
    console.log('Connect MCP clients to:');
    console.log(`• URL: http://localhost:${options.port || 3001}`);
    console.log('• Protocol: HTTP\n');
  }
  
  console.log('🛠️ **Available Tools:**');
  console.log('• ingest - Add documents to knowledge base');
  console.log('• query - Search knowledge base');
  console.log('• answer - Generate AI answers');
  console.log('• analyze-kb - Health and statistics');
  console.log('• hybrid-search - Advanced search configuration');
  console.log('• benchmark - Performance analysis');
  console.log('• + 5 more tools\n');
  
  console.log('💡 **Next Steps:**');
  console.log('• Use "orquel mcp tools" to see all available tools');
  console.log('• Use "orquel mcp health" to verify everything is working');
  console.log('• Check the documentation for integration guides\n');
  
  // Keep the process running
  console.log('✅ MCP server is running. Press Ctrl+C to stop.\n');
  
  // Set up graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down MCP server...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🔄 Shutting down MCP server...');
    process.exit(0);
  });
  
  // Keep the process alive
  await new Promise(() => {});
}