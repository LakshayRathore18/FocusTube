# Development

## Install and configure

From the repository root, run `npm.cmd ci` and `uv sync --project backend`. Node packages use the root npm workspace/lockfile; Python packages use `backend/pyproject.toml` and `backend/uv.lock`. Do not install another frontend lockfile.

On a fresh checkout, copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env`. Preserve existing files and auth secrets. Fill backend credentials locally; never paste them into source, logs, or chat.

| File | Loaded by | Contents |
| --- | --- | --- |
| `frontend/.env.local` | Next.js | Backend origin and public application version |
| `backend/.env` | FastAPI, Alembic, backend scripts | Active database, Google OAuth, provider keys, session settings |
| `backend/.env.legacy.local` | Database safety preflight only | Preserved old settings used to reject the archived database target |

All three are ignored. The legacy file is local history, not a required configuration file on a new checkout. Never copy its old `DATABASE_URL` into active settings. Current database schema is managed by Alembic; use only non-destructive migrations against the new target.

## Run locally

In terminal one, from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log --loop app.runtime:database_event_loop
```

In terminal two, from the repository root:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`. Use that hostname consistently for Google callbacks and cookies. The OAuth redirect URI remains `http://localhost:3000/api/auth/callback/google`. Next.js forwards `/api/*` to FastAPI and server-side fetches use `BACKEND_URL`.

The custom event loop is required for async psycopg on Windows. `--no-access-log` keeps OAuth query parameters out of Uvicorn logs. Application logs provide sanitized request IDs, route templates, durations, and statuses.

## Build and check

From the repository root:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run start
```

The root scripts run in `frontend/`. Direct workspace commands also work, for example `npm.cmd run dev --workspace @focustube/frontend`. Extra startup flags can be forwarded with `npm.cmd run start -- --hostname 127.0.0.1 --port 3000`. Stop the production frontend before rebuilding its generated output.

From `backend/`:

```powershell
.\.venv\Scripts\ruff.exe check app tests migrations scripts
.\.venv\Scripts\ruff.exe format --check app tests migrations scripts
.\.venv\Scripts\python.exe -m pytest -q
```

Tests create isolated temporary SQLite databases and mock providers. They do not connect to the live database. The existing frontend lint backlog is recorded in [verification status](MIGRATION_STATUS.md); don't suppress it to make a folder reorganization appear clean.

## Explicit live checks

Run these from `backend/` only when the respective services are configured:

| Command | Effect |
| --- | --- |
| `python -m scripts.check_database` | Read-only target/schema/session preflight; refuses the archived database when its preserved URL is available |
| `python -m scripts.check_gemini` | Sends a short normal-text prompt to configured models; no database access |
| `python -m scripts.smoke_test` | Creates a temporary account/course/video, checks core APIs through Next.js, and removes its own account/records |
| `python -m scripts.diagnose_features` | Reads feature state and tests the image/transcript/AI provider path; consumes provider quota |
| `python -m scripts.diagnose_features --verify-api` | Generates/reuses AI through Next.js using a temporary account, checks storage/cache, then removes its account; successful shared AI cache remains |

Use `.\.venv\Scripts\python.exe` in place of `python` unless the environment is already activated. The last command also accepts `--fresh` to choose an owned course video without an AI cache row. Live checks must never be imported into ordinary tests or run automatically during installation/startup.

## Troubleshooting

- Frontend cannot reach API: confirm port 8000 is listening, `frontend/.env.local` has the expected `BACKEND_URL`, and `/api/health/ready` succeeds through port 3000.
- Missing Google image: check the image URL and whether the Next.js process can reach Google; profile images pass through the image optimizer.
- AI failure: check the safe reason code. Provider availability can vary between requests; keep the request/transcript/model constant when comparing implementations. Never infer a permanent model incompatibility from a single 503.
- Build cannot download fonts: grant the build process network access. Do not silently replace fonts as part of an infrastructure fix.
- Low disk space: stop the relevant frontend before cleaning its ignored `frontend/.next/` output. Do not delete source, database files, or user notes as build caches.

Deployment is deferred. Any future hosting configuration must use `frontend/` as the Next.js application directory and keep backend credentials on the backend service.

## Video chat development

Read [RAG explained simply](RAG_GUIDE.md) for the design and [RAG status](RAG_STATUS.md) for verified rollout state. `RAG_ENABLED` defaults to false and `RAG_EMBEDDING_MODEL` defaults to local `sentence-transformers/all-MiniLM-L6-v2`; both are backend-only. No frontend environment flag or provider dependency is needed. After configuring the backend, run `python -m scripts.setup_embeddings` once to download the weights into ignored `backend/.cache/embeddings/`. Requests use cached files only. `python -m scripts.check_local_embeddings` verifies offline inference/relevance without database or Gemini calls. Existing indexes need preparation again after this model change. Apply non-destructive migration `0003` first; it preserves old vectors while allowing 384-dimensional MiniLM vectors.

Run `npm.cmd run test` from root for chat interaction tests. Backend ordinary pytest tests mock providers and use SQLite. Explicit live checks from `backend/` are:

```powershell
.\.venv\Scripts\python.exe -m scripts.check_rag
.\.venv\Scripts\python.exe -m scripts.verify_rag_postgres
.\.venv\Scripts\python.exe -m scripts.smoke_rag
```

`check_rag` checks the active target/pgvector availability and local embedding inference. `verify_rag_postgres` creates/reuses dedicated database `focustube_rag_test` on the confirmed active server, applies additive migrations and checks native vectors/claims/throttling with mocked providers. It removes its temporary rows and retains its schema/database. `smoke_rag` uses temporary accounts, the active database and real providers, retaining the successful shared index. It tests ASGI HTTP APIs directly; it does not replace browser or Next.js rewrite verification. `check_local_rag` prepares/retrieves a saved transcript on the guarded active database with local embeddings, removes its temporary account, and retains the rebuilt shared index; it makes no Gemini/Supadata calls. None uses the archived database. No live checks run during installation or ordinary tests.
