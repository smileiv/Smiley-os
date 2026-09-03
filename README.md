# Smiley OS Monorepo

This repository is the consolidated monorepo destination for Smiley OS projects.

## Monorepo standards
- Scope and migration guide: `/docs/monorepo/README.md`
- Repository inventory: `/docs/monorepo/repository-inventory.yaml`
- Migration wave log: `/docs/monorepo/migration-waves.md`
- Source repo archive checklist: `/docs/monorepo/archive-checklist.md`

## Standard top-level layout
- `apps/` applications
- `services/` APIs and workers
- `libs/` shared code
- `infra/` infrastructure and deployment assets
- `docs/` architecture and runbooks
- `scripts/` automation

## Migration tooling
- History-preserving import helper: `scripts/monorepo/import-repository.sh`
- Validation runner: `scripts/monorepo/validate-wave.sh`

## Current project assets
- Root Node backend (`server.js`, `package.json`)
- Frontend app (`smiley-os-frontend/`)
- Goose deployment assets (`goose-deployment/`)

## Local development
- Backend: `npm install && npm start`
- Frontend: `npm --prefix smiley-os-frontend install && npm --prefix smiley-os-frontend run dev`
