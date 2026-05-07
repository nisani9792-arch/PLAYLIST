#!/usr/bin/env bash
# Render runs this from the service root (repo root unless Root Directory is set).
# For this pnpm workspace, Root Directory in Render must be empty / "." — not `artifacts`.
set -euo pipefail

echo "=== Render build debug ==="
echo "PWD=$(pwd)"
ls -la

if [[ ! -f package.json ]]; then
  echo "FATAL: package.json missing here. This usually means Render 'Root Directory' is set to a folder"
  echo "that is not the repo root (e.g. 'artifacts' has no package.json). Clear Root Directory or set it to '.'."
  echo "--- package.json under CWD (max depth 4) ---"
  find . -maxdepth 4 -name package.json -print || true
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@11.0.8 --activate
fi

pnpm install --frozen-lockfile
pnpm run build
