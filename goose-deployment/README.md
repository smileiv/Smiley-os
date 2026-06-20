# Goose Deployment Pipeline

This repository contains the automated deployment pipeline with:

- **Headless Python demo** (`train_demo.py`) using PyTorch and Memory Caching (GRM)
- **Goose CLI integration** for automated code review
- **CI/CD configuration** for GitHub Actions and GitLab CI
- **Security hardening** with Ed25519 keys

## Project Overview

This project is a proof-of-concept for:

1. **Deploying machine learning demos** (GRM with PyTorch) in headless CI/CD pipelines
2. **Automated code review** using Goose to enforce linting, security scanning, and unit test coverage
3. **Secure credential management** with GitHub/GitLab secrets and Ed25519 SSH keys

## Directory Structure

```
goosedemo/
├── README.md                      # This file
├── train_demo.py                  # Headless PyTorch GRM demo
├── memory_caching.py             # Gated Residual Memory implementation
├── requirements.txt              # Python dependencies (torch, torchtext, etc.)
├── deploy.sh                     # Full pipeline automation script
├── recipes/                      # Goose automated code review recipes
│   ├── automated-code-review.yaml
│   └── subrecipes/               # Supporting recipe components
├── .gitignore                     # Environment and secret exclusions
├── scripts/                      # Various CI/CD utilities
│   └── helpers.sh
└── tests/                        # Test harness for validation
    └── test_gnmt.py
```

## Setup Steps

### Basic Usage

```bash
# 1. Clone with submodules (if any)
$ git clone https://github.com/user/goosedemo.git
$ cd goosedemo

# 2. Initialize virtual environment and install dependencies
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -r requirements.txt

# 3. Run the headless demo (e.g., for CI validation)
$ python train_demo.py --epochs 1 --batch 4
```

### Headless CI/CD Workflow

Use the `deploy.sh` script for end-to-end automation:

```bash
$ ./deploy.sh
```

This script performs:

1. **Environment Setup** – Creates and activates virtual environment
2. **Dependency Installation** – Installs all required Python packages
3. **Demo Execution** – Runs the training demo in headless mode
4. **Goose Integration** – Executes automated code review via Goose
5. **Validation** – Checks exit codes and logs success/failure

## Deployment Script (`deploy.sh`)

The `deploy.sh` script is a self-contained pipeline that can be run in any CI environment:

```bash
#!/bin/bash
set -e

echo "🚀 Starting Deployment Pipeline..."

# 1. Create virtual environment
python3 -m venv /root/venv
source /root/venv/bin/activate

# 2. Install dependencies
pip install --quiet -r /root/requirements.txt

# 3. Run demo
python /root/train_demo.py --epochs 1 --batch 4

# 4. Check Goose CLI
/root/.local/bin/goose --help

# 5. Run Goose code review
/root/.local/bin/goose run \
    --recipe /root/recipes/automated-code-review.yaml \
    --params language=python \
    --params min_coverage=80 \
    --params coding_standards=PEP8 \
    --output-format json

echo "✅ Deployment Pipeline Complete!"
```

**Key Features:**

- **Deterministic execution** – Exit on error (`set -e`)
- **Logging** – Clear output with status emojis for each step
- **Modularity** – Easy to extend or modify for custom workflows

## Headless Demo (`train_demo.py`)

The `train_demo.py` script is a minimal end-to-end training pipeline designed for CI/CD integration:

- **Synthetic dataset** – Creates random sequences without external data dependencies
- **Configurable parameters** – Vocabulary size, embedding dimension, hidden size, segment length
- **Headless execution** – Runs entirely on CPU for consistent CI environments
- **Progress reporting** – Uses `tqdm` to show training and validation metrics
- **Post-training validation** – Outputs perplexity and asserts shape correctness

**Minimal dependency requirements**:

```txt
torch>=2.2.0
torchtext==0.17.0
tqdm
```

**Example run:**

```bash
$ python train_demo.py --epochs 1 --batch 4
```

Sample output:

```
Using device: cpu
Epoch 1 | Train loss: 2.702  | Perplexity: 14.90
Epoch 1 | Val   loss: 2.702  | Perplexity: 14.90
MemoryC caching example run succeeded.
```

## Animated Example of MemoryC

MemoryC (Memory Caching) augments an LSTM with segment-based memory. See the test in `tests/test_gnmt.py` for a unit test of the `LanguageModel` wrapper.

## Automated Code Review with Goose

The `recipes/automated-code-review.yaml` defines a Goose recipe to apply:

- **Linting** (flake8) for PEP8 compliance
- **Static analysis** (bandit) for security
- **Unit test coverage** (pytest-cov)

**Example output format:**

```json
{
  "status": "success",
  "linting": { "passed": true, "file": "gnmt.py", "violations": [] },
  "security": { "passed": true, "file": "gnmt.py", "vulnerabilities": [] },
  "coverage": { "metrics": { "overall": 0.83 } }
}
```

**Integration command:**

```bash
/root/.local/bin/goose run \
    --recipe recipes/automated-code-review.yaml \
    --params language=python \
    --params min_coverage=80 \
    --params coding_standards=PEP8 \
    --output-format json
```

## CI/CD Example Configurations

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: Python CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Setup Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.14'
    - name: Install Dependencies
      run: |
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    - name: Run Demo
      run: |
        source venv/bin/activate
        python train_demo.py --epochs 1 --batch 4
    - name: Goose Review
      env:
        GITHUB_PERSONAL_ACCESS_TOKEN: ${{ secrets.GHUB_PERSONAL_ACCESS_TOKEN }}
      run: |
        source venv/bin/activate
        goose run \
          --recipe recipes/automated-code-review.yaml \
          --params language=python \
          --params min_coverage=80 \
          --params coding_standards=PEP8 \
          --output-format json
```

### GitLab CI

```yaml
# .gitlab-ci.yml
image: python:3.14-slim

stages:
  - test
  - review

test_job:
  stage: test
  script:
    - python3 -m venv venv
    - source venv/bin/activate
    - pip install -r requirements.txt
    - python train_demo.py --epochs 1 --batch 4

review_job:
  stage: review
  script:
    - source venv/bin/activate
    - goose run \
        --recipe recipes/automated-code-review.yaml \
        --params language=python \
        --params min_coverage=80 \
        --params coding_standards=PEP8 \
        --output-format json
  variables:
    GHUB_PERSONAL_ACCESS_TOKEN: ${GHUB_PERSONAL_ACCESS_TOKEN}
```

## Security Notes

- **SSH Keys**: Use Ed25519 keys generated via OpenSSL, with permissions `chmod 600`. Reference `/root/.ssh/ed25519_key`.
- **Secrets**: Never commit secrets to the repository. Store credentials in CI/CD secret managers (GitHub Secrets, GitLab CI/CD Variables, etc.).
- **VPN Integration**: If using WireGuard, store VPN configuration as a secret and apply via `wg-quick up /tmp/Smil4.conf`.

## Troubleshooting

### Common Issues

1. **Dependency Errors** (`torch` not found):

   ```bash
   pip install torch==2.2.0
   ```

2. **Goose CLI Not Found**:

   Ensure Goose is installed system-wide or in virtual environment and update PATH:

   ```bash
   export PATH="/root/.local/bin:$PATH"
   ```

3. **Demo Not Running**:

   Make sure `train_demo.py` has executable permissions:

   ```bash
   chmod +x train_demo.py
   ```

## Future Enhancements

- **Dockerization** – Containerize the demo with Docker for reproducible CI environments.
- **Cloud Integration** – Deploy to AWS Lambda or Google Cloud Functions.
- **Monitoring & Alerting** – Hook into Prometheus or OpenTelemetry for pipeline observability.
- **Model Persistence** – Save trained models and linting artifacts.

## License

This project is provided as an example for headless CI/CD pipelines. Use with caution in production environments.
```}}
]