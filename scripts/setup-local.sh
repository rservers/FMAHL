#!/bin/bash

set -e

echo "🚀 Setting up Find Me A Hot Lead local development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}📝 Creating .env.local from .env.example...${NC}"
    cp .env.example .env.local
    echo -e "${GREEN}✅ Created .env.local${NC}"
    echo -e "${YELLOW}⚠️  Please review .env.local and update any values if needed${NC}"
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not running. Please start Docker and run this script again.${NC}"
    exit 1
fi

echo ""
echo "🐳 Starting Docker services..."
docker-compose -f infrastructure/docker/docker-compose.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until docker exec fmhl-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""

# Wait for Redis to be ready
echo "Waiting for Redis..."
until docker exec fmhl-redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""

echo -e "${GREEN}✅ Docker services are running${NC}"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
npm run db:migrate

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review .env.local and update any values"
echo "  2. Run 'npm run dev' to start the web app"
echo "  3. Run 'npm run dev:worker' to start the worker (in another terminal)"
echo "  4. Or run 'npm run dev:all' to start both"
echo ""
echo "Services:"
echo "  - Web app: http://localhost:3000"
echo "  - MailHog UI: http://localhost:8025"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""

