#!/usr/bin/env bash
# Render production build: install, typecheck+build, optional Drizzle push to Neon.
set -euo pipefail

echo "=== Render build (JUSIC PLAY) ==="
echo "PWD=$(pwd)"

if [[ ! -f package.json ]]; then
  echo "FATAL: package.json missing. Set Render Root Directory to '.' (repo root)."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@11.0.8 --activate
fi

pnpm install --frozen-lockfile
pnpm run build

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "=== Drizzle migrate → Neon ==="
  pnpm --filter @workspace/db run migrate
else
  echo "WARN: DATABASE_URL unset during build — skipping schema migrate (set it in Render env)."
fi

echo "=== Build complete ==="
