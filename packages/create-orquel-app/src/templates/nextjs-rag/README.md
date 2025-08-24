# {{name}}

{{description}}

A modern RAG (Retrieval-Augmented Generation) application built with Orquel v0.2.0, featuring PostgreSQL with pgvector for production-grade vector storage and Next.js for the frontend.

## Features

- 🔍 **Hybrid Search**: Combines vector similarity and lexical search using PostgreSQL + pgvector
- 🤖 **AI-Powered Q&A**: Natural language question answering over your knowledge base
- 📚 **Document Management**: Upload and manage documents through a clean admin interface
- ⚡ **High Performance**: Optimized for production with connection pooling and indexing
- 🔐 **Secure**: Built-in authentication and rate limiting
- 🐳 **Docker Ready**: Complete containerization with Docker Compose
- 📊 **Analytics**: Built-in statistics and health monitoring

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- OpenAI API key

### 1. Environment Setup

```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://dev:dev123@localhost:5432/orquel_dev
```

### 2. Start Development Environment

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis with Docker
npm run docker:dev

# Setup database tables
npm run db:setup

# Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## Usage

### Adding Documents

1. Navigate to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Upload text files, markdown documents, or other text-based content
3. Documents will be automatically chunked and indexed for search

### Searching & Asking Questions

1. Use the main chat interface to ask questions about your documents
2. Toggle to search mode to explore documents directly
3. The system uses hybrid search combining vector similarity and full-text search

## Production Deployment

### Docker Compose (Recommended)

```bash
# Copy production environment
cp .env.example .env.production

# Edit .env.production with your production values
# Then build and deploy
docker-compose up -d
```

### Manual Deployment

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## API Endpoints

- `POST /api/ask` - Ask questions about your knowledge base
- `POST /api/search` - Search documents directly  
- `POST /api/ingest` - Upload and process documents
- `GET /api/health` - System health check

## Configuration

### Search Settings

Customize search behavior in your environment variables:

```bash
DENSE_WEIGHT=0.7          # Vector search weight
LEXICAL_WEIGHT=0.3        # Full-text search weight  
HYBRID_METHOD=rrf         # Combination method (rrf|weighted)
```

### Rate Limiting

```bash
RATE_LIMIT_REQUESTS=100   # Requests per minute
```

### Authentication

```bash
ADMIN_PASSWORD=your_secure_password  # Admin interface password
```

## Development

### Project Structure

```
├── app/                  # Next.js app router
│   ├── api/             # API routes
│   ├── admin/           # Admin interface
│   └── globals.css      # Global styles
├── components/          # React components
├── lib/                 # Utility libraries
├── scripts/             # Database and setup scripts
└── docker-compose.yml   # Production deployment
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks
- `npm run docker:dev` - Start development databases
- `npm run db:setup` - Initialize database schema

## Architecture

This application uses:

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with PostgreSQL
- **Vector Store**: PostgreSQL with pgvector extension
- **Lexical Search**: PostgreSQL full-text search with tsvector
- **Embeddings**: OpenAI text-embedding-3-small
- **AI Responses**: OpenAI GPT models
- **Deployment**: Docker with Nginx reverse proxy

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running: `docker-compose -f docker-compose.dev.yml ps`
2. Check connection string in `.env`
3. Verify pgvector extension: `npm run db:setup`

### OpenAI API Issues

1. Verify API key in environment variables
2. Check rate limits and billing in OpenAI dashboard
3. Try with different model configurations

### Performance Issues

1. Check database indexes: Query the `pg_stat_user_indexes` table
2. Monitor connection pool usage
3. Adjust chunk size and search parameters

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and type checks
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ using [Orquel](https://github.com/orquel/orquel)