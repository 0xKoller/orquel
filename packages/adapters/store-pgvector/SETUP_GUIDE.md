# PostgreSQL + pgvector Setup Guide

This guide walks you through setting up PostgreSQL with the pgvector extension for production use with Orquel v0.2.0.

## Overview

The `@orquel/store-pgvector` adapter provides production-grade vector storage using PostgreSQL with the pgvector extension. This setup offers:

- **Scalable vector similarity search** with HNSW indexing
- **ACID compliance** for data integrity
- **Connection pooling** for high concurrency
- **Backup and replication** capabilities
- **Integration** with existing PostgreSQL infrastructure

## Installation Methods

### Option 1: Docker (Recommended for Development)

The fastest way to get started:

```bash
# Pull the official pgvector image
docker pull pgvector/pgvector:pg15

# Start PostgreSQL with pgvector
docker run -d \
  --name orquel-postgres \
  -e POSTGRES_DB=orquel \
  -e POSTGRES_USER=orquel \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  -v orquel_data:/var/lib/postgresql/data \
  pgvector/pgvector:pg15
```

#### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: orquel
      POSTGRES_USER: orquel
      POSTGRES_PASSWORD: secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orquel -d orquel"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

### Option 2: Local Installation

#### Ubuntu/Debian

```bash
# Install PostgreSQL 15
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-client-15

# Install pgvector
sudo apt-get install -y postgresql-15-pgvector

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS

```bash
# Using Homebrew
brew install postgresql@15 pgvector

# Start PostgreSQL
brew services start postgresql@15
```

#### CentOS/RHEL

```bash
# Install PostgreSQL 15
sudo dnf install -y postgresql15-server postgresql15-contrib

# Initialize database
sudo postgresql-15-setup initdb

# Install pgvector (compile from source)
git clone --branch v0.5.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install PG_CONFIG=/usr/pgsql-15/bin/pg_config

# Start PostgreSQL
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15
```

### Option 3: Cloud Providers

#### AWS RDS with pgvector

```bash
# Create RDS instance with pgvector support
aws rds create-db-instance \
  --db-instance-identifier orquel-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username orquel \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name your-subnet-group
```

#### Google Cloud SQL

```bash
# Create Cloud SQL instance
gcloud sql instances create orquel-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-4096 \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD \
  --database-flags=shared_preload_libraries=vector
```

#### Azure Database for PostgreSQL

```bash
# Create Azure PostgreSQL instance
az postgres flexible-server create \
  --resource-group orquel-rg \
  --name orquel-postgres \
  --location eastus \
  --admin-user orquel \
  --admin-password YOUR_SECURE_PASSWORD \
  --version 15 \
  --tier Burstable \
  --sku-name Standard_B2s
```

## Database Configuration

### 1. Enable pgvector Extension

Connect to your PostgreSQL database and enable the extension:

```sql
-- Connect as superuser
psql -h localhost -U postgres -d orquel

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
\dx vector

-- Check version
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

### 2. Create Database User (Production)

```sql
-- Create dedicated user for Orquel
CREATE USER orquel_app WITH PASSWORD 'secure_app_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE orquel TO orquel_app;
GRANT USAGE ON SCHEMA public TO orquel_app;
GRANT CREATE ON SCHEMA public TO orquel_app;

-- For existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO orquel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO orquel_app;

-- For future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orquel_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO orquel_app;
```

### 3. Configure PostgreSQL Settings

Edit `postgresql.conf` for optimal performance:

```bash
# Memory settings
shared_buffers = 256MB                    # 25% of RAM
effective_cache_size = 1GB                # 75% of RAM
work_mem = 64MB                           # For sorting and hashing

# Connection settings
max_connections = 100                     # Adjust based on your needs
shared_preload_libraries = 'pg_stat_statements'

# Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# For vector operations
maintenance_work_mem = 256MB              # For index building
max_parallel_workers = 4
max_parallel_workers_per_gather = 2
```

Restart PostgreSQL after configuration changes:

```bash
sudo systemctl restart postgresql
```

## Orquel Adapter Setup

### 1. Install the Adapter

```bash
npm install @orquel/store-pgvector @orquel/lexical-postgres
```

### 2. Initialize the Adapter

```typescript
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';

// Vector store configuration
const vectorStore = new PgVectorStoreAdapter({
  connectionString: process.env.DATABASE_URL,
  tableName: 'vector_chunks',
  dimensions: 1536, // Must match your embedding model
  
  // Connection pool settings
  poolConfig: {
    max: 20,                    // Maximum connections
    min: 2,                     // Minimum connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 2000,
  },
  
  // Performance settings
  indexOptions: {
    m: 16,              // HNSW parameter: number of bi-directional links
    efConstruction: 64, // HNSW parameter: size of dynamic candidate list
  },
});

// Lexical search adapter
const lexicalStore = new PostgresLexicalAdapter({
  connectionString: process.env.DATABASE_URL,
  tableName: 'lexical_chunks',
  
  // Full-text search configuration
  searchConfig: 'english',    // Language for text search
  
  // Connection pool (shared with vector store if same DB)
  poolConfig: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
```

### 3. Environment Variables

Create `.env` file:

```bash
# Database connection
DATABASE_URL=postgresql://orquel_app:secure_app_password@localhost:5432/orquel

# Search configuration
DENSE_WEIGHT=0.7
LEXICAL_WEIGHT=0.3
HYBRID_METHOD=rrf

# Performance tuning
PGVECTOR_HNSW_M=16
PGVECTOR_HNSW_EF_CONSTRUCTION=64
PGVECTOR_HNSW_EF_SEARCH=100
```

### 4. Initialize Database Schema

Create a setup script:

```typescript
// scripts/setup-database.ts
import { PgVectorStoreAdapter } from '@orquel/store-pgvector';
import { PostgresLexicalAdapter } from '@orquel/lexical-postgres';

async function setupDatabase() {
  const vectorStore = new PgVectorStoreAdapter({
    connectionString: process.env.DATABASE_URL!,
    tableName: 'vector_chunks',
    dimensions: 1536,
  });

  const lexicalStore = new PostgresLexicalAdapter({
    connectionString: process.env.DATABASE_URL!,
    tableName: 'lexical_chunks',
  });

  try {
    console.log('Initializing vector store...');
    await vectorStore.init();
    
    console.log('Initializing lexical store...');
    await lexicalStore.init();
    
    console.log('Creating performance indexes...');
    
    // Vector similarity index (HNSW)
    await vectorStore.createIndex({
      type: 'hnsw',
      metric: 'cosine',
      options: { m: 16, ef_construction: 64 }
    });
    
    // Full-text search index
    await lexicalStore.createIndex({
      type: 'gin',
      column: 'search_vector'
    });
    
    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDatabase();
}
```

Run the setup:

```bash
npx ts-node scripts/setup-database.ts
```

## Performance Optimization

### 1. Index Configuration

#### HNSW Index Parameters

```sql
-- Create vector index with optimal parameters
CREATE INDEX CONCURRENTLY vector_chunks_embedding_idx 
ON vector_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For different distance metrics:
-- L2 distance: vector_l2_ops
-- Inner product: vector_ip_ops  
-- Cosine distance: vector_cosine_ops (recommended)
```

#### Full-text Search Indexes

```sql
-- GIN index for full-text search
CREATE INDEX CONCURRENTLY lexical_chunks_search_vector_idx 
ON lexical_chunks USING gin(search_vector);

-- Metadata indexes
CREATE INDEX CONCURRENTLY vector_chunks_metadata_idx 
ON vector_chunks USING gin(metadata);

CREATE INDEX CONCURRENTLY lexical_chunks_metadata_idx 
ON lexical_chunks USING gin(metadata);

-- Timestamp indexes for maintenance
CREATE INDEX CONCURRENTLY vector_chunks_created_at_idx 
ON vector_chunks(created_at);

CREATE INDEX CONCURRENTLY lexical_chunks_created_at_idx 
ON lexical_chunks(created_at);
```

### 2. Query Optimization

#### Vector Search Parameters

```typescript
// Optimize search quality vs speed
const searchResults = await vectorStore.search(queryEmbedding, limit, {
  efSearch: 100,        // Higher = better quality, slower search
  probes: 1,            // For IVFFlat index (if used)
});
```

#### Connection Pooling

```typescript
const poolConfig = {
  // Connection limits
  max: 20,                        // Max concurrent connections
  min: 2,                         // Min idle connections
  
  // Timeouts
  idleTimeoutMillis: 30000,       // Close idle connections
  connectionTimeoutMillis: 2000,  // Connection timeout
  statementTimeout: 60000,        // Query timeout
  
  // Health checks
  allowExitOnIdle: false,
};
```

### 3. Monitoring and Maintenance

#### Query Performance Monitoring

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
WHERE query ILIKE '%vector%'
ORDER BY mean_time DESC
LIMIT 10;
```

#### Index Usage Statistics

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan
FROM pg_stat_user_indexes 
WHERE tablename IN ('vector_chunks', 'lexical_chunks');
```

#### Database Size Monitoring

```sql
-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('vector_chunks', 'lexical_chunks');

-- Check index sizes
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes 
WHERE tablename IN ('vector_chunks', 'lexical_chunks');
```

## Backup and Recovery

### 1. Regular Backups

```bash
# Full database backup
pg_dump -h localhost -U orquel_app -d orquel > orquel_backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U orquel_app -d orquel | gzip > orquel_backup_$(date +%Y%m%d).sql.gz

# Schema only
pg_dump -h localhost -U orquel_app -d orquel --schema-only > orquel_schema.sql

# Data only  
pg_dump -h localhost -U orquel_app -d orquel --data-only > orquel_data.sql
```

### 2. Point-in-Time Recovery

Enable WAL archiving in `postgresql.conf`:

```bash
# WAL settings for point-in-time recovery
wal_level = replica
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
max_wal_senders = 3
```

### 3. Automated Backup Script

```bash
#!/bin/bash
# backup.sh

DB_HOST="localhost"
DB_USER="orquel_app"
DB_NAME="orquel"
BACKUP_DIR="/backups/orquel"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --verbose --format=custom \
  --file=$BACKUP_DIR/orquel_backup_$DATE.dump

# Compress and encrypt (optional)
gzip $BACKUP_DIR/orquel_backup_$DATE.dump

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.dump.gz" -mtime +7 -delete

echo "Backup completed: orquel_backup_$DATE.dump.gz"
```

## Troubleshooting

### Common Issues

#### 1. pgvector Extension Not Found
```sql
-- Check if extension is available
SELECT name FROM pg_available_extensions WHERE name = 'vector';

-- If not available, install pgvector package for your PostgreSQL version
```

#### 2. Permission Denied
```sql
-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO orquel_app;
GRANT CREATE ON SCHEMA public TO orquel_app;
```

#### 3. Connection Pool Exhaustion
```typescript
// Increase pool size or reduce connection timeout
const poolConfig = {
  max: 50,  // Increase if needed
  connectionTimeoutMillis: 5000,  // Increase timeout
};
```

#### 4. Slow Vector Search
```sql
-- Check if HNSW index exists and is being used
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, content, embedding <=> $1 as distance 
FROM vector_chunks 
ORDER BY embedding <=> $1 
LIMIT 10;

-- Should show "Index Scan using vector_chunks_embedding_idx"
```

#### 5. High Memory Usage
```sql
-- Check current memory usage
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  pg_size_pretty(sum(pg_relation_size(oid))) as table_size
FROM pg_class WHERE relkind = 'r';

-- Reduce work_mem if needed
SET work_mem = '32MB';
```

### Debugging Connection Issues

```typescript
// Add connection debugging
const vectorStore = new PgVectorStoreAdapter({
  connectionString: process.env.DATABASE_URL,
  tableName: 'vector_chunks',
  dimensions: 1536,
  
  // Enable debugging
  debug: true,
  
  poolConfig: {
    // Add connection logging
    log: (message) => console.log('Pool:', message),
  },
});
```

### Performance Troubleshooting

```sql
-- Check for table bloat
SELECT 
  schemaname, 
  tablename, 
  n_dead_tup, 
  n_live_tup,
  round(n_dead_tup::float/n_live_tup::float*100, 2) as dead_pct
FROM pg_stat_user_tables 
WHERE n_live_tup > 0
ORDER BY dead_pct DESC;

-- If high dead_pct, run VACUUM
VACUUM ANALYZE vector_chunks;
VACUUM ANALYZE lexical_chunks;
```

## Production Deployment Checklist

- [ ] PostgreSQL 15+ with pgvector extension installed
- [ ] Dedicated database user with minimal permissions
- [ ] Connection pooling configured (max 20-50 connections)
- [ ] HNSW indexes created with optimal parameters
- [ ] Full-text search indexes created
- [ ] Monitoring and alerting set up
- [ ] Automated backups configured
- [ ] SSL/TLS connections enabled
- [ ] Firewall rules configured
- [ ] Resource monitoring (CPU, memory, disk)
- [ ] Log rotation configured

---

For additional help, see the [Migration Guide](../core/MIGRATION_GUIDE.md) or reach out to the Orquel community.