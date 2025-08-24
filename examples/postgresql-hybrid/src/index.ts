#!/usr/bin/env node

import 'dotenv/config';
import { createOrquel } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { pgvectorStore } from '@orquel/store-pgvector';
import { postgresLexical } from '@orquel/lexical-postgres';
import { openAIAnswerer } from '@orquel/answer-openai';

// Sample documents for demonstration
const sampleDocuments = [
  {
    source: { title: 'AI and Machine Learning', kind: 'md' as const },
    content: `# Artificial Intelligence and Machine Learning

## Neural Networks

Neural networks are computational models inspired by biological neural networks in animal brains. They are composed of interconnected nodes called neurons that process and transmit information through weighted connections.

### Deep Learning

Deep learning architectures use multiple layers of neural networks to automatically learn hierarchical representations of data. These models excel at tasks like image recognition, natural language processing, and speech synthesis.

## Machine Learning Algorithms

Machine learning algorithms can be categorized into supervised, unsupervised, and reinforcement learning approaches. Each category serves different purposes in extracting patterns and making predictions from data.

### Applications

Modern AI applications include recommendation systems, autonomous vehicles, medical diagnosis, and natural language understanding. These systems combine multiple AI techniques to solve complex real-world problems.`
  },
  
  {
    source: { title: 'Database Systems', kind: 'md' as const },
    content: `# Database Management Systems

## Relational Databases

Database systems store and retrieve information efficiently using structured query languages like SQL. They ensure data consistency, integrity, and support concurrent access patterns.

### ACID Properties

ACID (Atomicity, Consistency, Isolation, Durability) properties guarantee reliable database transactions. These principles ensure that database operations are processed reliably even in the presence of failures.

## NoSQL Databases

NoSQL databases provide flexible schemas and horizontal scaling capabilities. They include document stores, key-value stores, column families, and graph databases, each optimized for different use cases.

### Vector Databases

Vector databases specialize in storing and searching high-dimensional vectors, essential for AI applications like similarity search, recommendation systems, and retrieval-augmented generation.`
  },
  
  {
    source: { title: 'Software Architecture', kind: 'md' as const },
    content: `# Software Architecture Patterns

## Microservices Architecture

Software architecture defines the structure of software systems and the relationships between components. Microservices architecture breaks applications into small, independent services that communicate via APIs.

### Design Principles

Key architectural principles include separation of concerns, single responsibility, and loose coupling. These principles help create maintainable, scalable, and testable software systems.

## Cloud-Native Patterns

Cloud-native applications leverage containerization, orchestration, and serverless computing to achieve scalability and resilience. They use patterns like circuit breakers, bulkheads, and graceful degradation.

### DevOps Integration

Modern architecture integrates with DevOps practices through continuous integration, continuous deployment, and infrastructure as code. This enables rapid, reliable software delivery.`
  }
];

// Test queries to demonstrate different search capabilities
const testQueries = [
  {
    query: "What are neural networks?",
    expectedType: "AI/ML concepts"
  },
  {
    query: "How do databases ensure ACID properties?",
    expectedType: "Database theory"
  },
  {
    query: "Explain microservices architecture",
    expectedType: "Software architecture"
  },
  {
    query: "Vector databases for AI applications",
    expectedType: "Hybrid - AI + Database"
  },
  {
    query: "Cloud native design patterns",
    expectedType: "Modern architecture"
  }
];

async function main() {
  console.log('🚀 Starting PostgreSQL + Hybrid Search Example\n');

  // Validate environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Example: postgresql://user:pass@localhost:5432/dbname');
    process.exit(1);
  }

  // Parse hybrid search configuration from environment
  const denseWeight = parseFloat(process.env.DENSE_WEIGHT || '0.7');
  const lexicalWeight = parseFloat(process.env.LEXICAL_WEIGHT || '0.3');
  const normalizationMethod = (process.env.NORMALIZATION_METHOD || 'rrf') as 'rrf' | 'minmax' | 'zscore';

  console.log('🔧 Configuration:');
  console.log(`   • Database: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`);
  console.log(`   • Vector dimensions: 1536`);
  console.log(`   • Hybrid search: ${normalizationMethod.toUpperCase()} algorithm`);
  if (normalizationMethod !== 'rrf') {
    console.log(`   • Weights: ${denseWeight} dense, ${lexicalWeight} lexical`);
  }
  console.log(`   • Debug mode: enabled\n`);

  try {
    // Create adapters
    const vectorStore = pgvectorStore({
      connectionString: process.env.DATABASE_URL,
      dimensions: 1536, // OpenAI text-embedding-3-small
      indexType: 'ivfflat',
      maxConnections: 10,
      autoSetup: true,
    });

    const lexicalStore = postgresLexical({
      connectionString: process.env.DATABASE_URL,
      language: 'english',
      maxConnections: 10,
      autoSetup: true,
    });

    // Perform health checks
    console.log('📊 Database Health Check:');
    const vectorHealth = await vectorStore.healthCheck();
    const lexicalHealth = await lexicalStore.healthCheck();
    
    if (!vectorHealth.healthy) {
      console.error(`❌ Vector store: ${vectorHealth.error}`);
      process.exit(1);
    }
    console.log(`   ✅ PostgreSQL: healthy (${vectorHealth.latencyMs}ms)`);

    if (!lexicalHealth.healthy) {
      console.error(`❌ Lexical store: ${lexicalHealth.error}`);
      process.exit(1);
    }
    console.log(`   ✅ Full-text search: configured (${lexicalHealth.latencyMs}ms)\n`);

    // Create Orquel instance with hybrid search configuration
    const orq = createOrquel({
      embeddings: openAIEmbeddings(),
      vector: vectorStore,
      lexical: lexicalStore,
      answerer: openAIAnswerer(),
      hybrid: {
        normalizationMethod,
        ...(normalizationMethod !== 'rrf' && {
          denseWeight,
          lexicalWeight,
        }),
      },
      debug: true, // Enable detailed logging
    });

    // Clear existing data for clean demo
    console.log('🧹 Clearing existing data...');
    await vectorStore.clear();
    
    // Ingest sample documents
    console.log('📚 Ingesting documents...');
    const allChunks = [];
    
    for (const doc of sampleDocuments) {
      const { chunks } = await orq.ingest(doc);
      allChunks.push(...chunks);
      console.log(`   📄 Processed: ${doc.source.title} (${chunks.length} chunks)`);
    }

    // Index all chunks
    console.log('\n🔄 Indexing chunks...');
    await orq.index(allChunks);
    console.log('✅ Indexing completed\n');

    // Display statistics
    const vectorStats = await vectorStore.getStats();
    const lexicalStats = await lexicalStore.getStats();
    
    console.log('📊 Storage Statistics:');
    console.log(`   • Total chunks: ${vectorStats.totalChunks}`);
    console.log(`   • Unique sources: ${vectorStats.totalSources}`);
    console.log(`   • Lexical indexed: ${lexicalStats.totalIndexed}`);
    console.log(`   • Avg words per chunk: ${lexicalStats.avgWordsPerChunk.toFixed(1)}\n`);

    // Test hybrid search with different queries
    console.log('🔍 Testing hybrid search...\n');
    
    for (const test of testQueries) {
      console.log(`Query: "${test.query}"`);
      console.log(`Expected: ${test.expectedType}\n`);
      
      const start = Date.now();
      
      // Perform hybrid search
      const { results } = await orq.query(test.query, { 
        k: 5, 
        hybrid: true 
      });
      
      const queryTime = Date.now() - start;
      
      console.log('📋 Results:');
      results.forEach((result, index) => {
        const score = result.score.toFixed(3);
        const preview = result.chunk.text.substring(0, 50).replace(/\n/g, ' ');
        const source = result.chunk.source.title;
        console.log(`   ${index + 1}. [${score}] ${preview}... (${source})`);
      });
      
      // Generate answer
      console.log('\n💡 Generated Answer:');
      const answerStart = Date.now();
      const { answer } = await orq.answer(test.query, { topK: 3 });
      const answerTime = Date.now() - answerStart;
      
      console.log(`${answer}\n`);
      
      console.log(`⏱️  Query time: ${queryTime}ms, Answer time: ${answerTime}ms`);
      console.log('─'.repeat(80) + '\n');
    }

    // Demonstrate search analytics
    console.log('📈 Search Analytics Example:');
    const analyticsQuery = "machine learning neural networks";
    console.log(`Query: "${analyticsQuery}"\n`);
    
    // Perform searches separately to analyze overlap
    const [denseEmbedding] = await orq.config.embeddings.embed([analyticsQuery]);
    const denseResults = await vectorStore.searchByVector(denseEmbedding, 10);
    const lexicalResults = await lexicalStore.search(analyticsQuery, 10);
    
    // Analyze overlap
    const { analyzeHybridOverlap } = await import('@orquel/core');
    const overlap = analyzeHybridOverlap(denseResults, lexicalResults);
    
    console.log('🔍 Search Method Comparison:');
    console.log(`   • Dense-only results: ${denseResults.length}`);
    console.log(`   • Lexical-only results: ${lexicalResults.length}`);
    console.log(`   • Overlap: ${overlap.overlapCount} chunks`);
    console.log(`   • Dense unique: ${overlap.denseOnlyCount}`);
    console.log(`   • Lexical unique: ${overlap.lexicalOnlyCount}`);
    console.log(`   • Complementary score: ${(overlap.complementaryScore * 100).toFixed(1)}%`);
    console.log(`   • Search diversity: ${overlap.complementaryScore > 0.3 ? 'High' : 'Low'}\n`);

    // Performance summary
    const finalStats = await vectorStore.getStats();
    console.log('🎯 Performance Summary:');
    console.log(`   • Total documents processed: ${sampleDocuments.length}`);
    console.log(`   • Total chunks indexed: ${finalStats.totalChunks}`);
    console.log(`   • Test queries executed: ${testQueries.length}`);
    console.log(`   • Hybrid search method: ${normalizationMethod.toUpperCase()}`);
    console.log(`   • Database connections: Available and healthy\n`);

    console.log('✅ PostgreSQL + Hybrid Search example completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   • Try different normalization methods (rrf, minmax, zscore)');
    console.log('   • Adjust dense/lexical weights for your use case');
    console.log('   • Scale up with larger document collections');
    console.log('   • Monitor performance with real-world queries');
    
  } catch (error) {
    console.error('\n❌ Error during execution:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

main().catch(console.error);