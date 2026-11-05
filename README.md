# FocusTube

FocusTube turns YouTube playlists into courses with playback progress, rich text notes, and AI summaries and quizzes.

Next.js is the frontend; FastAPI owns authentication, database access, and provider calls. Google login, core data APIs, and real AI summary generation have been verified against a separate Neon database. Video chat now adds transcript-grounded questions and answers; read [RAG explained simply](docs/RAG_GUIDE.md) and its [rollout status](docs/RAG_STATUS.md). Deployment remains deferred.

## Repository layout

```text
frontend/    Next.js application, components, public assets, and frontend configuration
backend/     FastAPI application, database migrations, tests, and operational checks
docs/        Architecture, API contracts, development guide, and historical archives
AGENTS.md    Repository-wide instructions for coding agents
```

The root is an npm workspace. Run frontend commands from here; npm executes them in `frontend/`. Python dependencies and commands belong to `backend/`. See the [complete code map](docs/PROJECT_STRUCTURE.md).

Before uploading the migration or changing hosting, read the [safe deployment guide](docs/DEPLOYMENT_GUIDE.md). It explains how to preserve the existing Vercel site while testing the new version separately.

## Local setup (Windows, no Docker)

Use Node.js, npm, Python 3.12+, and uv. Run commands in PowerShell. Use `npm.cmd` if PowerShell blocks `npm.ps1`.

```powershell
npm.cmd ci
uv sync --project backend
```

Copy `frontend/.env.example` to `frontend/.env.local` only if the destination does not already exist. Frontend configuration is:

```dotenv
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_APP_VERSION=0.1.0
```

All backend credentials belong in ignored `backend/.env`. Copy `backend/.env.example` only if that file does not exist. An ignored file with a random auth secret was created during the resumed migration session; preserve that secret.

| Backend variable | Value / purpose |
| --- | --- |
| `DATABASE_URL` | Separate empty PostgreSQL database, using `postgresql+psycopg://` |
| `FRONTEND_ORIGIN` | `http://localhost:3000` |
| `AUTH_SECRET` | At least 32 random characters; used to sign temporary OAuth state |
| `COOKIE_SECURE` | `false` for local HTTP; must be `true` with HTTPS |
| `SESSION_DAYS` | `7` by default |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `SUPADATA_API_KEY` | Native YouTube transcripts |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini generation; model defaults to `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Defaults to `gemini-2.5-flash` for availability failures/timeouts; set empty to disable. |
| `RAG_ENABLED` | Defaults to `false`; enables video chat after migration and verification |
| `RAG_EMBEDDING_MODEL` | Defaults to local `sentence-transformers/all-MiniLM-L6-v2`; 384 dimensions, no embedding API key |

For video chat, download the local embedding model once after configuring the backend: from `backend/`, run `.\.venv\Scripts\python.exe -m scripts.setup_embeddings`. The ignored cache stays in `backend/.cache/embeddings/`. Existing Gemini indexes need **Prepare video chat** again after the model switch; no reset/migration is needed. Answers still use Gemini and its quota. See the [simple RAG guide](docs/RAG_GUIDE.md).

The fallback is the alternate model verified with full transcripts in this setup. Google plans to route Gemini 2.5 Flash requests to 3.5 Flash-Lite from December 1, 2026; review the fallback before then so it remains independent of the primary model. See [Google's model lifecycle](https://aistudio.google.com/docs/deprecations#gemini-2-5-flash-models).

Keep `frontend/.env.local` and `backend/.env` out of Git. FastAPI resolves its environment file relative to `backend/`, independently of the current directory. It does not read the frontend environment file. The previous root `.env.local` has been preserved as ignored `backend/.env.legacy.local`; application runtime never loads it, and the read-only database guard uses it to reject the archived target.

## New Neon target

The selected target is a **new Neon database**. Create a separate empty database/project for FastAPI; keep the old Prisma database as an untouched archive. No data transfer is required. The localhost port 5433 URL in the example is a placeholder, not a running database.

Put the new connection string in `backend/.env`. Change its scheme to `postgresql+psycopg://` and retain the connection's TLS parameters. Confirm that its host/database identify the new target before applying migrations. Do not copy the archived database URL.

From `backend/`, after the target is configured and confirmed separate:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic check
```

The initial revision is `0001`; revision `0002` adds video RAG tables and pgvector; non-destructive revision `0003` permits MiniLM dimensions while retaining old vectors. Never reset, wipe, drop, truncate, or apply a migration requiring data loss. Destructive downgrade is disabled.

## Google login and running the app

Register this exact Google OAuth redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Start native processes in two terminals:

```powershell
# Terminal 1, from backend/
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log --loop app.runtime:database_event_loop
```

```powershell
# Terminal 2, from the repository root
npm.cmd run dev
```

Open `http://localhost:3000` consistently. Browser `/api/*` calls are rewritten to FastAPI. The custom loop is required for async psycopg on Windows. The backend uses sanitized structured request logs; `--no-access-log` avoids logging OAuth callback query strings through Uvicorn's default access logger.

Health endpoints are `/api/health` and `/api/health/ready`. OpenAPI is available directly at `http://127.0.0.1:8000/docs`. Mutations require `Origin: http://localhost:3000`; Swagger requests originating on port 8000 will be rejected. Do not weaken Origin protection to work around this.

## Checks

From the repository root:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

From `backend/`:

```powershell
.\.venv\Scripts\ruff.exe check app tests migrations
.\.venv\Scripts\ruff.exe format --check app tests migrations
.\.venv\Scripts\python.exe -m pytest -q
```

Backend tests use isolated temporary SQLite databases and mocked services. They do not establish PostgreSQL migration/concurrency correctness or real OAuth/provider integration. Next.js builds fetch the configured Google fonts and need network access. Generated output belongs in `frontend/.next/`. If stale generated types reference deleted handlers, regenerate them instead of changing source types to hide errors.

See the [documentation index](docs/README.md), [development guide](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API.md), and [session handoff](docs/development/SESSION_HANDOFF.md). Older Prisma/Auth.js documents are preserved under `docs/archive/legacy/`; `docs/PROJECT_MASTER_GUIDE.md` remains preserved user-authored historical material.
