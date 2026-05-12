#!/bin/bash

# Development Quick Start Script
# Sistem FO KIMA

set -e

echo "🚀 Starting Sistem FO KIMA Development Environment..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not running. Starting database with Docker...${NC}"
    echo "Please start Docker Desktop first, then run this script again."
    exit 1
fi

# Start PostgreSQL with Docker Compose
echo -e "${BLUE}📦 Starting PostgreSQL database...${NC}"
docker compose up -d db

# Wait for database to be ready
echo -e "${BLUE}⏳ Waiting for database to be ready...${NC}"
sleep 5

# Setup Backend
echo ""
echo -e "${BLUE}🔧 Setting up Backend...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
fi

# Generate Prisma Client
echo "Generating Prisma Client..."
npm run prisma:generate

# Apply migrations
echo "Applying database migrations..."
npm run prisma:deploy

# Seed database (optional)
read -p "Do you want to seed the database with sample data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Seeding database..."
    npm run prisma:seed
fi

cd ..

# Setup Frontend
echo ""
echo -e "${BLUE}🎨 Setting up Frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

cd ..

# Done
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo ""
echo "Open 2 terminal windows and run:"
echo ""
echo -e "${BLUE}Terminal 1 - Backend:${NC}"
echo "  cd backend && npm run start:dev"
echo ""
echo -e "${BLUE}Terminal 2 - Frontend:${NC}"
echo "  cd frontend && npm run dev"
echo ""
echo -e "${GREEN}Then open: http://localhost:5173${NC}"
echo ""
