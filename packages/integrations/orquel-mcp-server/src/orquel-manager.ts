import { createOrquel, type Orquel, type OrquelConfig } from '@orquel/core';

/**
 * Configuration for Orquel MCP server
 */
export interface OrquelMcpConfig {
  /** Orquel configuration */
  orquel: OrquelConfig;
  /** Server configuration */
  server?: {
    /** Enable verbose logging */
    verbose?: boolean;
    /** Custom server name */
    name?: string;
  };
}

let cachedOrquelInstance: Orquel | null = null;
let cachedConfig: OrquelMcpConfig | null = null;

/**
 * Initialize Orquel with the provided configuration
 */
export function initializeOrquel(config: OrquelMcpConfig): void {
  cachedConfig = config;
  cachedOrquelInstance = createOrquel(config.orquel);
  
  if (config.server?.verbose) {
    console.log('🚀 Orquel MCP Server initialized');
    console.log(`📋 Configuration: ${config.server.name || 'orquel-mcp-server'}`);
    console.log(`🔧 Adapters: ${config.orquel.embeddings.name}, ${config.orquel.vector.name}`);
  }
}

/**
 * Get the current Orquel instance
 */
export async function getOrquelInstance(): Promise<Orquel> {
  if (!cachedOrquelInstance) {
    // Try to load from environment or use default configuration
    await loadDefaultConfiguration();
  }
  
  if (!cachedOrquelInstance) {
    throw new Error(
      'Orquel instance not initialized. Please configure the MCP server with adapters first.\n\n' +
      'Example configuration needed:\n' +
      '• Embeddings adapter (e.g., @orquel/embeddings-openai)\n' +
      '• Vector store adapter (e.g., @orquel/store-memory or @orquel/store-pgvector)\n\n' +
      'Set ORQUEL_CONFIG_PATH environment variable or use initializeOrquel() function.'
    );
  }
  
  return cachedOrquelInstance;
}

/**
 * Get current configuration
 */
export function getCurrentConfig(): OrquelMcpConfig | null {
  return cachedConfig;
}

/**
 * Load default configuration from environment or fallback to memory-based setup
 */
async function loadDefaultConfiguration(): Promise<void> {
  try {
    // Check if configuration path is provided
    const configPath = process.env.ORQUEL_CONFIG_PATH;
    if (configPath) {
      const config = await loadConfigFromFile(configPath);
      initializeOrquel(config);
      return;
    }

    // Check for environment variables for common configurations
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (openaiApiKey) {
      // Try to use OpenAI + memory/postgres configuration
      await loadEnvironmentConfiguration(openaiApiKey, databaseUrl);
      return;
    }

    // Fallback: warn user about configuration
    console.warn(
      '⚠️  No Orquel configuration found.\n' +
      'Set ORQUEL_CONFIG_PATH or OPENAI_API_KEY environment variables.\n' +
      'MCP tools will fail until proper configuration is provided.'
    );
    
  } catch (error) {
    console.error('Failed to load Orquel configuration:', error);
    throw new Error('Could not initialize Orquel. Check your configuration.');
  }
}

/**
 * Load configuration from a file
 */
async function loadConfigFromFile(configPath: string): Promise<OrquelMcpConfig> {
  try {
    // Dynamic import to support both CJS and ESM
    const config = await import(configPath);
    return config.default || config;
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}

/**
 * Load configuration from environment variables
 */
async function loadEnvironmentConfiguration(openaiApiKey: string, databaseUrl?: string): Promise<void> {
  try {
    // Try to import adapters dynamically
    let embeddingsAdapter;
    let vectorStoreAdapter;
    let lexicalAdapter;
    let answerAdapter;

    try {
      const { openAIEmbeddings } = await import('@orquel/embeddings-openai');
      embeddingsAdapter = openAIEmbeddings({ apiKey: openaiApiKey });
    } catch (error) {
      throw new Error('@orquel/embeddings-openai not found. Please install it.');
    }

    // Choose vector store based on database URL
    if (databaseUrl) {
      try {
        const { pgvectorStore } = await import('@orquel/store-pgvector');
        vectorStoreAdapter = pgvectorStore({
          connectionString: databaseUrl,
          dimensions: 1536, // OpenAI embedding dimensions
        });
        
        // Also try to load PostgreSQL lexical adapter
        try {
          // TODO: Re-enable after fixing build dependencies
          // const { postgresLexical } = await import('@orquel/lexical-postgres');
          // lexicalAdapter = postgresLexical({
          //   connectionString: databaseUrl,
          // });
        } catch (error) {
          console.warn('PostgreSQL lexical adapter not available:', error);
        }
      } catch (error) {
        console.warn('PostgreSQL adapter not available, falling back to memory store:', error);
      }
    }

    // Fallback to memory store
    if (!vectorStoreAdapter) {
      try {
        // TODO: Re-enable after fixing build dependencies
        // const { memoryStore } = await import('@orquel/store-memory');
        // vectorStoreAdapter = memoryStore();
        throw new Error('@orquel/store-memory temporarily disabled during build');
      } catch (error) {
        throw new Error('@orquel/store-memory not found. Please install it.');
      }
    }

    // Try to load answer adapter
    try {
      // TODO: Re-enable after fixing build dependencies
      // const { openAIAnswerer } = await import('@orquel/answer-openai');
      // answerAdapter = openAIAnswerer({ apiKey: openaiApiKey });
    } catch (error) {
      console.warn('OpenAI answer adapter not available:', error);
    }

    const orquelConfig: any = {
      embeddings: embeddingsAdapter,
      vector: vectorStoreAdapter,
      debug: process.env.NODE_ENV === 'development',
    };

    // Add optional properties only if they exist
    if (lexicalAdapter) {
      orquelConfig.lexical = lexicalAdapter;
    }
    if (answerAdapter) {
      orquelConfig.answerer = answerAdapter;
    }

    const config: OrquelMcpConfig = {
      orquel: orquelConfig,
      server: {
        verbose: process.env.NODE_ENV === 'development',
        name: 'orquel-mcp-server',
      },
    };

    initializeOrquel(config);
    
  } catch (error) {
    throw new Error(`Failed to load environment configuration: ${error}`);
  }
}

/**
 * Close Orquel instance and clean up resources
 */
export async function closeOrquel(): Promise<void> {
  if (cachedOrquelInstance && cachedConfig) {
    try {
      // Close vector store
      if (cachedConfig.orquel.vector.close) {
        await cachedConfig.orquel.vector.close();
      }
      
      // Close lexical store
      if (cachedConfig.orquel.lexical?.close) {
        await cachedConfig.orquel.lexical.close();
      }
      
      if (cachedConfig.server?.verbose) {
        console.log('🔒 Orquel MCP Server closed');
      }
    } catch (error) {
      console.error('Error closing Orquel:', error);
    }
  }
  
  cachedOrquelInstance = null;
  cachedConfig = null;
}