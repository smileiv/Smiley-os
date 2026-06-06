#!/bin/bash

# Smiley OS - Quick Setup Script for macOS
# Run this from the project root: bash setup.sh

set -e

echo "🦆 Smiley OS Self-Hosted Setup"
echo "========================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v)"
echo "✅ npm $(npm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for .env
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Edit .env and add your GEMINI_API_KEY"
    echo "   Get one at: https://aistudio.google.com/apikey"
fi

echo ""
echo "========================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add your Gemini API key"
echo "  2. Run: npm start"
echo "  3. Visit: http://localhost:3000"
echo ""
echo "For development with live reload:"
echo "  npm install --save-dev nodemon && npm run dev"
echo "========================================"
