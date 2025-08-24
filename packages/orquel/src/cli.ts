#!/usr/bin/env node

import { Command } from 'commander';
import { runSetupWizard } from './wizard.js';
import { startMcpServer, listMcpTools, checkMcpHealth, generateMcpConfig } from './mcp-commands.js';

const program = new Command();

program
  .name('orquel')
  .description('Orquel RAG toolkit CLI with MCP server support')
  .version('0.3.0');

program
  .command('setup')
  .description('Run the setup wizard to install and configure adapters')
  .action(async () => {
    try {
      await runSetupWizard();
    } catch (error) {
      console.error('Setup failed:', error);
      process.exit(1);
    }
  });

// MCP Server Commands
const mcpCommand = program
  .command('mcp')
  .description('MCP (Model Context Protocol) server commands');

mcpCommand
  .command('serve')
  .description('Start the MCP server')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --port <port>', 'HTTP server port (default: 3001)', '3001')
  .option('--stdio', 'Use STDIO transport for local integration')
  .option('--http', 'Use HTTP transport for remote access (default)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dev', 'Enable development mode with hot reloading')
  .action(async (options) => {
    await startMcpServer(options);
  });

mcpCommand
  .command('tools')
  .description('List available MCP tools and their capabilities')
  .option('--detailed', 'Show detailed tool information including parameters')
  .action(async (options) => {
    await listMcpTools(options);
  });

mcpCommand
  .command('health')
  .description('Check MCP server health and configuration')
  .option('--config <path>', 'Path to configuration file to validate')
  .action(async (options) => {
    await checkMcpHealth(options);
  });

mcpCommand
  .command('config')
  .description('Generate or validate MCP server configuration')
  .option('--generate', 'Generate example configuration file')
  .option('--validate <path>', 'Validate existing configuration file')
  .option('--output <path>', 'Output path for generated configuration')
  .action(async (options) => {
    await generateMcpConfig(options);
  });

// Backward compatibility - maintain existing serve command structure
program
  .command('serve')
  .description('Start the MCP server (shorthand for "orquel mcp serve")')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --port <port>', 'HTTP server port (default: 3001)', '3001')
  .option('--stdio', 'Use STDIO transport')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('💡 Tip: Use "orquel mcp serve" for more MCP-specific options\n');
    await startMcpServer(options);
  });

program.parse();