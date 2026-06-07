#!/bin/bash

# Smiley OS - Startup Script for macOS
# Add this to your ~/Library/LaunchAgents for auto-start on login

# Usage:
#   1. chmod +x start.sh
#   2. ./start.sh
#   OR
#   3. npm start

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Smiley OS..."
echo "📁 Project: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "   Copy .env.example to .env and configure your API key"
    exit 1
fi

# Start the server
echo "🎉 Starting server..."
npm start
