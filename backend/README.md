# FocusTube backend

FastAPI owns Google OAuth, database sessions, course/video/progress APIs, personal notes, statistics, playlist imports, transcripts, and AI generation. SQLAlchemy/psycopg access PostgreSQL; Alembic manages schema changes.

Video chat uses the independent RAG router/services and migration `0002` with pgvector and non-destructive migration `0003` for MiniLM dimensions. Read [RAG explained simply](../docs/RAG_GUIDE.md) for the flow and [RAG status](../docs/RAG_STATUS.md) before enabling it. Configuration remains backend-only.

Embeddings now run locally with MiniLM L6 v2 / FastEmbed on CPU. After configuring the backend, run `python -m scripts.setup_embeddings` once. Weights are cached in ignored `backend/.cache/embeddings/`; requests never download them. `python -m scripts.check_local_embeddings` checks offline inference, while `scripts.check_local_rag` explicitly verifies saved-transcript preparation/retrieval against the guarded active database without Gemini calls. Existing indexes need preparation again after the model switch. Gemini still generates answers and can hit its own quota.

From the repository root, install with `uv sync --project backend`. Configuration lives in ignored `backend/.env`, resolved independently of the working directory. Preserve existing settings; copy `.env.example` only on a fresh checkout. The archived database is never an active target.

From `backend/`, start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log --loop app.runtime:database_event_loop
```

The event loop supports async psycopg on Windows. Google callbacks use the frontend origin and `/api/auth/callback/google`. Local mutations require `Origin: http://localhost:3000`; viewing OpenAPI at port 8000 does not bypass that protection.

| Folder/file | Responsibility |
| --- | --- |
| `app/routers/` | HTTP handlers and domain operations |
| `app/services/` | External YouTube, Supadata, and Gemini adapters |
| `app/models.py` | Database tables/constraints |
| `app/schemas.py` | Validated inputs and serialization |
| `app/dependencies.py` | Session and ownership enforcement |
| `migrations/` | Versioned, non-destructive schema evolution |
| `tests/` | Isolated SQLite/mocked-provider regressions |
| `scripts/` | Explicit live checks; see the shared development guide |

Run checks from `backend/`:

```powershell
.\.venv\Scripts\ruff.exe check app tests migrations scripts
.\.venv\Scripts\ruff.exe format --check app tests migrations scripts
.\.venv\Scripts\python.exe -m pytest -q
```

Before applying any migration, confirm that `DATABASE_URL` targets the separate FastAPI database. Never reset, wipe, drop, truncate, or migrate the archived target. The optional `.env.legacy.local` is preserved solely for the preflight safety comparison and is never loaded by application settings.

See [setup](../README.md), [development and operational checks](../docs/DEVELOPMENT.md), [architecture](../docs/ARCHITECTURE.md), and [API contracts](../docs/API.md).
