# Contributing

## Repository layout
Use these top-level boundaries:
- `apps/` product-facing apps
- `services/` APIs/workers
- `libs/` shared code
- `infra/` deployment/infrastructure
- `docs/` architectural and operational docs
- `scripts/` automation

## Change policy
- Keep changes scoped to one area whenever possible
- Update docs when workflows or ownership change
- Avoid duplicated utilities across apps/services; move shared logic to `libs/`

## Validation policy
- Run impacted lint/build/test commands before merge
- Include validation evidence in pull requests
- Never commit secrets; use environment variables and secret managers

## Review policy
- CODEOWNERS determines required reviewers
- Cross-area changes must include at least one reviewer per touched area
