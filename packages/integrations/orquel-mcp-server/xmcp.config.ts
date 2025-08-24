import { defineConfig } from 'xmcp';

export default defineConfig({
  name: 'orquel-mcp-server',
  version: '0.3.0',
  description: 'MCP server for Orquel RAG toolkit - query knowledge bases via Model Context Protocol',
  
  // Enable both HTTP and STDIO transports
  transports: {
    stdio: {
      enabled: true,
    },
    http: {
      enabled: true,
      port: 3001,
      cors: {
        origin: ['http://localhost:3000', 'https://claude.ai'],
        credentials: true,
      },
    },
  },

  // Tool discovery configuration
  tools: {
    directory: './src/tools',
    pattern: '**/*.{ts,js}',
  },

  // Development configuration
  dev: {
    hotReload: true,
    verbose: true,
  },

  // Security and middleware
  middleware: [
    // Rate limiting middleware
    {
      name: 'rateLimit',
      enabled: true,
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      },
    },
    // Request logging
    {
      name: 'logger',
      enabled: true,
    },
  ],

  // Environment-specific overrides
  environments: {
    development: {
      transports: {
        http: {
          port: 3001,
        },
      },
    },
    production: {
      middleware: [
        {
          name: 'rateLimit',
          config: {
            windowMs: 60000,
            maxRequests: 50, // Stricter in production
          },
        },
      ],
    },
  },
});