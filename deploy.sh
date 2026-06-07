#!/bin/bash

# Smiley OS - Quick Deploy Script
# Usage: bash deploy.sh [option]
# Options: codespaces, render, docker, node

set -e

echo "🦆 Smiley OS Deploy Options"
echo "=================================="
echo ""
echo "Choose deployment method:"
echo "1) Docker Compose (local testing)"
echo "2) GitHub Codespaces (cloud browser)"
echo "3) Render.com (production free tier)"
echo "4) Node.js Direct (no container)"
echo ""

if [ -z "$1" ]; then
    read -p "Select option (1-4): " option
else
    option=$1
fi

case $option in
    1|docker)
        echo ""
        echo "🐳 Starting Docker Compose..."
        echo ""
        if [ ! -f .env ]; then
            cp .env.example .env
            echo "📝 Created .env file - edit to add your GEMINI_API_KEY"
            read -p "Press enter to continue..."
        fi
        docker-compose up
        ;;
    
    2|codespaces)
        echo ""
        echo "☁️  Opening GitHub Codespaces..."
        echo "1. Go to: https://github.com/smileiv/Smiley-os"
        echo "2. Code → Codespaces → Create on goose/self-hosted-setup"
        echo "3. In terminal run:"
        echo "   npm install"
        echo "   GEMINI_API_KEY=your_key npm start"
        echo ""
        open "https://github.com/smileiv/Smiley-os/codespaces"
        ;;
    
    3|render)
        echo ""
        echo "🚀 Render.com Deployment Guide"
        echo "1. Go to: https://render.com"
        echo "2. New → Web Service"
        echo "3. Connect GitHub repo: smileiv/Smiley-os"
        echo "4. Branch: goose/self-hosted-setup"
        echo "5. Build: npm install"
        echo "6. Start: node server.js"
        echo "7. Add env var: GEMINI_API_KEY"
        echo ""
        open "https://render.com"
        ;;
    
    4|node)
        echo ""
        echo "📦 Starting Node.js..."
        if [ ! -f .env ]; then
            cp .env.example .env
            echo "📝 Created .env file - edit to add your GEMINI_API_KEY"
            read -p "Press enter to continue..."
        fi
        npm install
        npm start
        ;;
    
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac
