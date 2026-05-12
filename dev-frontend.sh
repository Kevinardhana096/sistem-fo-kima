#!/bin/bash

# Quick Start Frontend
# Run this in Terminal 2

cd "$(dirname "$0")/frontend"

echo "🔵 Starting Frontend (React + Vite)..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🚀 Starting development server..."
echo "Frontend will run at: http://localhost:5173"
echo ""

npm run dev
