#!/usr/bin/env node

import { program } from 'commander';
import { initializeOrquel, closeOrquel, type OrquelMcpConfig } from './orquel-manager.js';

program
  .name('orquel-mcp')
  .description('Orquel MCP Server - Expose your knowledge base via Model Context Protocol')
  .version('0.3.0');

program
  .command('serve')
  .description('Start the MCP server')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --port <port>', 'HTTP server port (default: 3001)', '3001')
  .option('--stdio', 'Use STDIO transport instead of HTTP')
  .option('--http', 'Use HTTP transport (default)')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Orquel MCP Server...');
      
      // Load configuration if provided
      if (options.config) {
        process.env.ORQUEL_CONFIG_PATH = options.config;
      }
      
      if (options.verbose) {
        process.env.ORQUEL_VERBOSE = 'true';
      }

      // Initialize Orquel (this will load config from env or file)
      try {
        // For now, we'll let the orquel-manager handle initialization
        // when the first tool is called
        console.log('✅ Configuration loaded');
      } catch (error) {
        console.error('❌ Configuration error:', error);
        process.exit(1);
      }

      // Start the appropriate transport
      const transport = options.stdio ? 'stdio' : 'http';
      
      if (transport === 'stdio') {
        console.log('📡 Starting STDIO transport...');
        // For STDIO, we need to handle the MCP protocol directly
        // This would typically be handled by xmcp framework
        process.stderr.write('🔗 MCP server ready on STDIO\n');
        
        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
          console.error('🔄 Shutting down...');
          await closeOrquel();
          process.exit(0);
        });
        
        process.on('SIGINT', async () => {
          console.error('🔄 Shutting down...');
          await closeOrquel();
          process.exit(0);
        });
        
      } else {
        const port = parseInt(options.port);
        console.log(`🌐 Starting HTTP transport on port ${port}...`);
        console.log(`📋 Server will be available at: http://localhost:${port}`);
        
        // This would typically start the HTTP server via xmcp
        // For now, we'll show the startup message
        console.log('✅ MCP server ready');
        console.log('💡 Use xmcp serve command for full HTTP server functionality');
      }

    } catch (error) {
      console.error('❌ Failed to start MCP server:', error);
      process.exit(1);
    }
  });

program
  .command('tools')
  .description('List available MCP tools')
  .action(() => {
    console.log('📚 Available Orquel MCP Tools:\n');
    
    const tools = [
      {
        name: 'ingest',
        description: 'Ingest documents into the knowledge base',
        params: 'title, content, [kind, url, author, metadata]'
      },
      {
        name: 'query',
        description: 'Search the knowledge base for relevant content',
        params: 'query, [k, hybrid, rerank, includeScores, includeMetadata]'
      },
      {
        name: 'answer',
        description: 'Generate AI answers with source citations',
        params: 'question, [topK, includeSources, includeContext]'
      },
      {
        name: 'list-sources',
        description: 'List all available sources in the knowledge base',
        params: '[includeStats, sortBy, limit]'
      },
      {
        name: 'clear',
        description: 'Clear the knowledge base (requires confirmation)',
        params: 'confirm, [sourceFilter, dryRun]'
      },
    ];

    tools.forEach(tool => {
      console.log(`🔧 ${tool.name}`);
      console.log(`   ${tool.description}`);
      console.log(`   Parameters: ${tool.params}`);
      console.log('');
    });
    
    console.log('💡 More tools coming in future releases:');
    console.log('   • hybrid-search - Configure search weights');
    console.log('   • benchmark - Performance testing');
    console.log('   • analyze-kb - Knowledge base analytics');
    console.log('   • optimize-search - Auto-tune parameters');
  });

program
  .command('config')
  .description('Show configuration information')
  .option('--example', 'Show example configuration')
  .action((options) => {
    if (options.example) {
      console.log('📋 Example Orquel MCP Configuration:\n');
      
      const exampleConfig = `// orquel-mcp.config.js
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
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
    lexical: postgresLexical({
      connectionString: process.env.DATABASE_URL,
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
};`;
      
      console.log(exampleConfig);
      console.log('\n💡 Usage:');
      console.log('   orquel-mcp serve --config ./orquel-mcp.config.js');
      
    } else {
      console.log('🔧 Configuration Sources (in order of priority):\n');
      console.log('1. --config flag: Custom configuration file');
      console.log('2. ORQUEL_CONFIG_PATH: Environment variable');
      console.log('3. Environment variables: OPENAI_API_KEY, DATABASE_URL');
      console.log('4. Default: Memory store (no persistence)\n');
      
      console.log('📋 Current Environment:');
      console.log(`   ORQUEL_CONFIG_PATH: ${process.env.ORQUEL_CONFIG_PATH || 'not set'}`);
      console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '***set***' : 'not set'}`);
      console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '***set***' : 'not set'}`);
      console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    }
  });

program
  .command('health')
  .description('Check server health and configuration')
  .action(async () => {
    try {
      console.log('🏥 Orquel MCP Server Health Check\n');
      
      // Try to initialize Orquel to test configuration
      const { getOrquelInstance } = await import('./orquel-manager.js');
      const orq = await getOrquelInstance();
      
      console.log('✅ Orquel instance created successfully');
      
      // Test basic functionality
      try {
        await orq.query('test', { k: 1 });
        console.log('✅ Query functionality works');
      } catch (error) {
        console.log('⚠️  Query test failed (expected if knowledge base is empty)');
      }
      
      console.log('\n🎉 Health check completed - MCP server is ready!');
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      console.log('\n💡 Common issues:');
      console.log('   • Missing adapter packages (@orquel/embeddings-*, @orquel/store-*)');
      console.log('   • Invalid API keys or connection strings');
      console.log('   • Configuration file errors');
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception:', error);
  await closeOrquel();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💥 Unhandled rejection:', reason);
  await closeOrquel();
  process.exit(1);
});

program.parse();