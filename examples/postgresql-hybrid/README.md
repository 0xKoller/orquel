# PostgreSQL + Hybrid Search Example

This example demonstrates Orquel v0.2.0's production-ready features:

- **PostgreSQL + pgvector** for persistent vector storage
- **PostgreSQL full-text search** for lexical search  
- **Hybrid search** with Reciprocal Rank Fusion (RRF)
- **Advanced debugging** and performance analysis

## Prerequisites

1. **PostgreSQL 15+ with pgvector extension**
   ```bash
   # Using Docker (recommended)
   docker run -d \
     --name orquel-postgres \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=orquel_dev \
     -p 5432:5432 \
     pgvector/pgvector:pg15
   
   # Or install locally
   # macOS: brew install postgresql pgvector
   # Ubuntu: apt-get install postgresql-15 postgresql-15-pgvector
   ```

2. **OpenAI API Key**
   ```bash
   export OPENAI_API_KEY="your-key-here"
   ```

## Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and OpenAI API key
   ```

3. **Run the example**
   ```bash
   pnpm dev
   ```

## What This Example Shows

### 1. **Production Storage Setup**
- Automatic database schema creation
- Connection pooling with PostgreSQL
- Vector indexing with IVFFlat/HNSW
- Full-text search with tsvector

### 2. **Hybrid Search Algorithms**
- **RRF (Reciprocal Rank Fusion)** - Default, best for most cases
- **Weighted Score Combination** - Configurable dense/lexical weights
- **Score Normalization** - MinMax and Z-score methods

### 3. **Performance Analysis**
- Search overlap analysis
- Complementary score calculation
- Performance benchmarking
- Database health checks

### 4. **Real-World Usage Patterns**
- Document ingestion and indexing
- Hybrid search queries
- Answer generation with citations
- Error handling and recovery

## Configuration Options

### Hybrid Search Methods

```typescript
// Reciprocal Rank Fusion (recommended)
const orq = createOrquel({
  // ... adapters
  hybrid: {
    normalizationMethod: 'rrf'  // Default
  }
});

// Weighted score combination
const orq = createOrquel({
  // ... adapters  
  hybrid: {
    normalizationMethod: 'minmax',
    denseWeight: 0.7,
    lexicalWeight: 0.3
  }
});
```

### Database Configuration

```typescript
// Basic configuration
const vectorStore = pgvectorStore({
  connectionString: process.env.DATABASE_URL!,
  dimensions: 1536, // OpenAI text-embedding-3-small
});

// Advanced configuration
const vectorStore = pgvectorStore({
  connectionString: process.env.DATABASE_URL!,
  dimensions: 1536,
  indexType: 'hnsw',        // or 'ivfflat' 
  maxConnections: 20,
  tableName: 'my_chunks',
  autoSetup: true
});
```

## Sample Output

```
🚀 Starting PostgreSQL + Hybrid Search Example

🔧 Configuration:
   • Database: postgresql://localhost:5432/orquel_dev
   • Vector dimensions: 1536
   • Hybrid search: RRF algorithm
   • Debug mode: enabled

📊 Database Health Check:
   ✅ PostgreSQL: healthy (12ms)
   ✅ pgvector extension: loaded
   ✅ Full-text search: configured

📚 Ingesting documents...
   📄 Processed: AI and Machine Learning (3 chunks)
   📄 Processed: Database Systems (4 chunks)
   📄 Processed: Software Architecture (3 chunks)

🧠 Generated 10 embeddings (1536D)
🔤 Indexed in lexical store: postgres-lexical
✅ Indexing completed

🔍 Testing hybrid search...

Query: "What are neural networks?"
⚙️ Options: k=5, hybrid=true, rerank=false

🔄 Using hybrid search (dense + lexical)
📊 Dense results: 5, Lexical results: 4
🔄 Search overlap: 2 shared, 3 dense-only, 2 lexical-only
📊 Complementary score: 71.4%

📋 Results (RRF Algorithm):
   1. [0.091] Neural networks are computational models... (ai-ml.md)
   2. [0.067] Deep learning architectures use multiple layers... (ai-ml.md)  
   3. [0.045] Machine learning algorithms can be categorized... (ai-ml.md)
   4. [0.034] Database systems store and retrieve information... (databases.md)
   5. [0.029] Software architecture defines the structure... (architecture.md)

💡 Generated Answer:
Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information through weighted connections. Deep learning architectures use multiple layers of these networks to learn complex patterns from data.

📊 Performance Summary:
   • Total query time: 245ms
   • Vector search: 45ms  
   • Lexical search: 23ms
   • Hybrid fusion: 8ms
   • Answer generation: 169ms
   • Database connections: 3/20 used
```

## Docker Compose Setup

For easy development, use this `docker-compose.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: orquel_dev
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

## Next Steps

- Explore the [evaluation framework](../../docs/evaluation.md)
- Try different [hybrid search algorithms](../../docs/hybrid-search.md)
- Scale up with [Qdrant adapter](../qdrant-example/) (coming in v0.3.0)
- Deploy with the [Next.js template](../nextjs-rag/) (coming in v0.2.0)