#!/bin/bash
set -e

echo "🔧 Setting up Orquel test environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Stop existing test containers if running
echo "🛑 Stopping existing test containers..."
docker-compose -f docker-compose.test.yml down --volumes > /dev/null 2>&1 || true

# Start test database
echo "🚀 Starting test database containers..."
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
timeout 60s bash -c 'until docker-compose -f docker-compose.test.yml exec postgres-test pg_isready -U test -d orquel_test; do sleep 2; done'

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostgreSQL test database is ready${NC}"
else
    echo -e "${RED}❌ Failed to start PostgreSQL test database${NC}"
    exit 1
fi

# Test Redis connection
timeout 30s bash -c 'until docker-compose -f docker-compose.test.yml exec redis-test redis-cli -a test123 ping | grep PONG; do sleep 2; done' > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Redis test cache is ready${NC}"
else
    echo -e "${YELLOW}⚠️ Redis test cache is not responding (optional)${NC}"
fi

# Set test environment variables
export TEST_DATABASE_URL="postgresql://test:test123@localhost:5433/orquel_test"
export TEST_REDIS_URL="redis://test123@localhost:6380"

echo ""
echo "🎯 Test environment is ready!"
echo ""
echo "Environment variables:"
echo "  TEST_DATABASE_URL=${TEST_DATABASE_URL}"
echo "  TEST_REDIS_URL=${TEST_REDIS_URL}"
echo ""
echo "To run tests:"
echo "  pnpm test                    # Run all tests"
echo "  pnpm test:integration        # Run integration tests only"
echo "  pnpm test:performance        # Run performance benchmarks"
echo ""
echo "To stop test environment:"
echo "  docker-compose -f docker-compose.test.yml down --volumes"