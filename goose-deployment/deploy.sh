#!/bin/bash
set -e

echo "🚀 Starting Deployment Pipeline..."

# Step 1: Create virtual environment
python3 -m venv /root/venv
source /root/venv/bin/activate

# Step 2: Install dependencies
pip install --quiet -r /root/requirements.txt

# Step 3: Run demo
python /root/train_demo.py --epochs 1 --batch 4

# Step 4: Check Goose CLI
/root/.local/bin/goose --help

# Step 5: Run Goose code review
/root/.local/bin/goose run \
    --recipe /root/recipes/automated-code-review.yaml \
    --params language=python \
    --params min_coverage=80 \
    --params coding_standards=PEP8 \
    --output-format json

echo "✅ Deployment Pipeline Complete!"
