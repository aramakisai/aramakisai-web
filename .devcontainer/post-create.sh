#!/usr/bin/env bash
set -euo pipefail

echo "==> pre-commit + yamllint"
pipx install pre-commit || pip install --user pre-commit
pip install --user yamllint
pre-commit install --install-hooks || echo "pre-commit install skipped (not a git repo?)"

echo "==> frontend deps (pnpm)"
if [ -f frontend/package.json ]; then
  corepack prepare --activate
  (cd frontend && pnpm install --frozen-lockfile || pnpm install)
fi

echo "==> versions"
node --version
pnpm --version
infisical --version || true
gitleaks version || true

echo "==> done"
