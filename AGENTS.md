# FocusTube — AI Agent Map (agent.md)

> **PURPOSE**: Read this to understand the project structure, status, and constraints.
> **DO NOT DUPLICATE IMPLEMENTATION DETAILS**: To check database schemas or code implementation details, read the files directly using your tools rather than relying on cached explanations here.
> **HUMAN GUIDE**: Read [the project structure](docs/PROJECT_STRUCTURE.md) and [development guide](docs/DEVELOPMENT.md).

<!-- BEGIN:nextjs-agent-rules -->
## ⚠️ Next.js Version Warning

This is **not** the Next.js version you may know from training data. This project uses **Next.js 16** (Turbopack), which has breaking changes — APIs, conventions, and file structure may all differ from older versions.

- **Always** read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
- **Heed deprecation notices** — what worked in Next.js 13/14/15 may not work here.
<!-- END:nextjs-agent-rules -->

---
<!-- Important guideline -->
Database Safety — Non-Negotiable
NEVER run any command that resets, wipes, or drops the database — this includes prisma migrate dev --reset, prisma db push --force-reset, DROP TABLE, TRUNCATE, or any migration path that Prisma reports as requiring data loss to apply.
If a schema change cannot be applied without data loss (Prisma will say so explicitly), stop and explain the situation instead of proceeding. State exactly what data would be lost and why, then wait for explicit confirmation before running anything destructive. Do not decide this trade-off unilaterally.
Prefer non-destructive migration paths always: default values for new required columns, backfill scripts for existing rows, or making a new column nullable first and tightening it later — instead of a reset.
If you are ever unsure whether a command is destructive, treat it as destructive and ask first.


## 1. Current architecture (2026-11-04)

Read `README.md`, `docs/PROJECT_STRUCTURE.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/MIGRATION_STATUS.md`, and the latest continuation note in `docs/development/SESSION_HANDOFF.md`. Actual source files are authoritative.

- Next.js 16 / React 19 lives in `frontend/`. The root npm workspace forwards dev/build/start/lint/typecheck commands to this application. Browser `/api/*` calls are rewritten to FastAPI on port 8000.
- FastAPI owns Google OAuth/OIDC, opaque database sessions, all business APIs, SQLAlchemy/psycopg database access, YouTube, Supadata transcripts, and Gemini.
- Current models are in `backend/app/models.py`; initial Alembic migration is `backend/migrations/versions/0001_initial.py`.
- Auth.js, Prisma and the Next.js business API route handlers were removed from the active implementation. Do not restore them based on historical docs.
- Server auth/fetch helpers are in `frontend/src/lib/backend.ts`; client auth state is in `frontend/src/components/auth/AuthProvider.tsx`.
- API JSON preserves camelCase fields and ownership checks. Shared AI content requires an owned video before cache access or generation; unlocks belong to each user's video.

## 2. Safety and scope

- Preserve all existing uncommitted work. Never stage or commit without explicit user instruction.
- Never modify the archived Prisma/Neon database. The user selected a new empty Neon database for FastAPI; no data migration is required. Confirm that target before applying Alembic.
- Follow the database safety rule above: never reset, wipe, DROP, TRUNCATE, or run a data-loss migration.
- No Docker. Use native Python/Node processes and a separate PostgreSQL database.
- Frontend settings live in `frontend/.env.local`; active secrets/database/provider settings belong only in ignored `backend/.env`. Legacy settings are preserved in ignored `backend/.env.legacy.local`, read only by the database safety preflight. Never print secrets or copy the old database URL to the active backend.
- Video transcript RAG is authorized and implemented as a separate feature; read `docs/RAG_GUIDE.md`, `docs/RAG_STATUS.md` and `docs/RAG_IMPLEMENTATION_PLAN.md`. Course-wide/personal-note retrieval, worker queues and deployment remain deferred. Keep provider/database logic in FastAPI, and never bypass video ownership for shared indexes.
- Preserve `docs/PROJECT_MASTER_GUIDE.md` as user-authored historical material and `docs/archive/nextjs-ai-content.ts.txt` as the archive of pre-existing AI route edits.
- No sub-agents unless explicitly requested by the user or applicable instructions.

## 3. Verification and conventions

Read relevant installed Next.js guides before writing frontend code, as required above. Use async route params/cookies and no-store user-specific server fetches. Backend session/ownership checks remain authoritative when frontend layouts are reused during navigation.

From root: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.

Keep frontend source/configuration under `frontend/`, Python code under `backend/`, and shared documentation under `docs/`. Keep one npm lockfile at the root and `uv.lock` in `backend/`. Do not introduce frontend database/provider dependencies or duplicate lockfiles. Historical notes are under `docs/archive/`; they do not override current source or instructions. Do not delete user-authored notes as unused application code.
From `backend/`: `.\.venv\Scripts\ruff.exe check app tests migrations scripts`, `.\.venv\Scripts\ruff.exe format --check app tests migrations scripts`, `.\.venv\Scripts\python.exe -m pytest -q`.

Tests use isolated temporary SQLite databases and mocked providers; they do not prove real PostgreSQL migration, locking, concurrency, Google OAuth, or provider behavior. Report those limitations explicitly. See `docs/MIGRATION_STATUS.md` for current results and outstanding manual checks.

Run Uvicorn with `--no-access-log` to avoid logging OAuth callback query strings; sanitized application request logs provide method, route template, status, duration and request ID. Never log exception bodies that could expose SQL values, tokens, transcripts, or provider URLs.

On Windows, Uvicorn also requires `--loop app.runtime:database_event_loop` for async psycopg. Alembic and database verification scripts already use this compatible loop. The separate Neon database is now migrated to `0001` and Google login/core data API checks pass; consult the latest migration status before repeating setup.
