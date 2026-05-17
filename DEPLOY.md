# BUILD PLAY — Render + Neon

Production runs as a single **Render Web Service** (`workspace-api`) that serves the React app and the Express API.

## Stack

| Layer | Provider |
|--------|-----------|
| Hosting | [Render](https://render.com) |
| Database | [Neon](https://neon.tech) PostgreSQL |
| Search | Meilisearch (external) |
| AI | Google Gemini API |

## Render setup

1. Connect the GitHub repo `nisani9792-arch/PLAYLIST`.
2. **Root Directory:** `.` (repository root — not `artifacts/`).
3. **Build command:** `bash scripts/render-build.sh` (from `render.yaml`).
4. **Start command:** `pnpm start`
5. **Health check path:** `/api/healthz`

## Environment variables (Render Dashboard)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon **pooled** connection string with `?sslmode=require` |
| `MEILISEARCH_URL` | Yes | Search host |
| `MEILISEARCH_API_KEY` | Yes | Search API key |
| `MEILISEARCH_INDEX` | No | Default `music` |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Yes | e.g. `https://generativelanguage.googleapis.com` |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Yes | Gemini API key |
| `TRUST_PROXY` | Recommended | `1` (set in blueprint) |
| `CORS_ORIGINS` | No | Only if frontend is on another origin |

`PORT` is set automatically by Render.

## Neon

1. Create a project and database in Neon.
2. Copy the **pooled** connection string into Render as `DATABASE_URL`.
3. On each deploy, `scripts/render-build.sh` runs `pnpm --filter @workspace/db run migrate` when `DATABASE_URL` is available (applies versioned SQL migrations — no interactive prompts).

Local schema migrate:

```bash
export DATABASE_URL="postgresql://..."
pnpm --filter @workspace/db run migrate
```

## Local development

```bash
pnpm install
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Edit .env with DATABASE_URL, Meilisearch, Gemini

pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start

# In another terminal:
pnpm --filter @workspace/jusic run dev
```

## Deploy

Push to `main` — Render auto-deploys if the service is linked to the repo.

```bash
git push origin main
```

Verify in Render → **Events** → latest deploy **Live**, then open `/api/healthz`.
