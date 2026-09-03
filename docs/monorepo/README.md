# Monorepo Consolidation Guide

This repository is the destination monorepo for Smiley OS assets.

## 1) Scope and destination
- **Destination repository:** `smileiv/Smiley-os`
- **History policy:** preserve source commit history for every imported repository
- **Current accessible scope:**
  - `smileiv/Smiley-os`
- **Future scope source of truth:** `docs/monorepo/repository-inventory.yaml`

## 2) Organization model
Top-level layout:
- `apps/` user-facing applications
- `services/` backend APIs and workers
- `libs/` shared packages and utilities
- `infra/` deployment and infrastructure assets
- `docs/` architecture, runbooks, and migration records
- `scripts/` repository automation

Naming standards:
- folders: `kebab-case`
- packages/services: align with folder names
- CI workflow names: `<area>-<purpose>`

## 3) Inventory workflow
Maintain canonical inventory in `docs/monorepo/repository-inventory.yaml`.
Each repo entry tracks:
- language/tooling
- build/lint/test commands
- CI status
- dependency and secret handling
- ownership and migration status

## 4) Migration workflow (history-preserving)
Use `scripts/monorepo/import-repository.sh` to import repositories into target folders while keeping commit history.

## 5) Consolidation workflow
After each import:
- identify duplicate libraries and scripts
- unify CI workflow templates
- merge overlapping docs/runbooks

## 6) Standardization workflow
Keep common standards for:
- lint/build/test commands
- dependency update cadence
- release and versioning strategy

## 7) Automation and integrations
Track integration rewiring in `docs/monorepo/migration-waves.md`:
- CI/CD workflows
- branch protections and CODEOWNERS
- publishing/deployment references

## 8) Validation gates
Run wave validation with `scripts/monorepo/validate-wave.sh` and project-specific checks before marking a wave complete.

## 9) Archive process
Use `docs/monorepo/archive-checklist.md` before freezing source repositories.

## 10) Long-term governance
Use `CONTRIBUTING.md` + `CODEOWNERS` for ownership, review routing, and hygiene rules.
