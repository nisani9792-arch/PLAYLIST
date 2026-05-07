# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains **BUILD PLAY** (formerly Jusic Music Workstation) — a Hebrew RTL music playlist tool for Odoo operators.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (bundled, ESM output)

## Artifacts

### BUILD PLAY (`artifacts/jusic`)
- **Kind**: web (React + Vite)
- **Port**: 21378, preview path `/`
- **Stack**: React 19, Vite, Tailwind CSS v4, TypeScript, Framer Motion
- **Theme**: Dark navy background, cyan accents, Heebo + Inter + Space Grotesk fonts (Hebrew RTL)
- **Design**: rounded-xl/2xl corners, bg-primary/10 badges, subtle shadows, Framer Motion AnimatePresence + whileHover
- **Features**:
  - Live Meilisearch search (via `/api/search` backend proxy) with filter bar (songs-only default + optional genre)
  - Drag-and-drop playlist reorder (`@hello-pangea/dnd`)
  - Virtual scrolling (`@tanstack/react-virtual`)
  - AI playlist generator (Gemini via `/api/gemini/playlist`)
  - Bulk import panel with staging area (same filters as search)
  - localStorage draft + flush on `pagehide` / `beforeunload` (`jusic_playlist_draft`)
  - Usage signals + playlist export history for optional JSON training export
  - Odoo CSV export (UTF-8 BOM)

### API Server (`artifacts/api-server`)
- **Kind**: api (Express)
- **Port**: 8080, proxy path `/api`
- **Routes**:
  - `GET /api/healthz` — health check
  - `POST /api/search` — Meilisearch proxy (host: 164.92.213.53, index: music)
  - `POST /api/gemini/playlist` — Gemini AI playlist generation (returns `{ lines: string[] }`)
- **Note**: `@google/genai` is bundled (not externalized) via esbuild — removed from external list in `build.mjs`

## Meilisearch

- **Configuration**: `MEILISEARCH_URL`, `MEILISEARCH_API_KEY`, optional `MEILISEARCH_INDEX` (see `artifacts/api-server/.env.example`). Secrets must never be committed.
- **Default index name**: `music` if unset
- **Field mapping** (client normalize): `name_he` → song_name, `artists[]` → artist, `genres[]` → genre, `uid` → id
- All search calls go through the backend proxy at `POST /api/search` to avoid CORS and hide the API key

## Gemini AI Integration

- Uses `@workspace/integrations-gemini-ai` lib
- Env vars: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` (set via Replit secrets)
- Model: `gemini-2.5-flash`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
