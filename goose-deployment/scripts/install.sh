#!/bin/bash
set -e

echo "🐧 Installing dependencies..."

# Install system dependencies (if needed)
apt-get update
apt-get install -y python3-venv

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --quiet -r requirements.txt

echo "✅ Dependencies installed successfully"