# FastAPI migration status

Updated 2026-11-05. Implementation remains uncommitted. The original database has not been touched. The separate Neon database now has Alembic revision `0003`; `alembic check` reports no model/schema differences. Video RAG is newly authorized and implemented; see [RAG status](RAG_STATUS.md) and [the beginner-friendly guide](RAG_GUIDE.md). Historical migration-only scope statements below do not defer this newly requested feature.

## Repository reorganization

The frontend now lives in `frontend/` with its source, assets, environment template, and Next.js/TypeScript/lint/PostCSS configuration. Root npm workspace scripts retain `dev`, `start`, `build`, `typecheck`, and `lint`; the shared lockfile remains at the root. FastAPI stays in `backend/`. Current shared guides are indexed in `docs/README.md`, agent instructions are at root `AGENTS.md`, and the continuation record is `docs/development/SESSION_HANDOFF.md`.

The old root environment file was preserved as ignored `backend/.env.legacy.local`; the database safety preflight reads its archived target from there. Frontend settings now live in `frontend/.env.local`, with no provider/database secrets. Historical architecture/issues/resume notes were moved intact to `docs/archive/legacy/`. Personal notes remain ignored; the master guide and pre-existing AI route archive were preserved. The one-off Gemini request-comparison tool is archived as text. Removed five unused starter SVG assets, empty old API/Prisma/script directories, and the obsolete root Next.js build output after safely removing its generated junction without traversing its target.

Post-move verification: root workspace TypeScript and production build pass; all 75 backend tests pass; backend Ruff checks pass. The root start command forwards flags correctly. A live temporary-account smoke test through the reorganized frontend passed database readiness, session lookup, courses, note storage, playback/statistics, deletion cascades, and logout; its temporary data was removed. Frontend lint retains the same pre-existing 8 errors and 12 warnings. No commits or database schema changes were made.

## Verified locally

- Backend suite: **75 passed** on temporary SQLite databases, with mocked provider calls and a Windows-compatible Uvicorn loop regression.
- Ruff lint and formatting pass for app, tests, and migrations.
- Frontend TypeScript check passes.
- Production build passes with network access for Google fonts.
- No active Prisma/Auth.js/provider imports remain under `frontend/src/` or in `frontend/package.json`.
- `backend/.env` exists and is ignored. Existing Google/YouTube/Supadata/Gemini credentials were copied from the previous root environment into missing backend settings without displaying values; that original file is now preserved as `backend/.env.legacy.local`. The user supplied a new Neon URL, confirmed separate from the archive and empty before migration; its SQLAlchemy driver prefix was corrected without changing credentials/TLS options.

## Neon cutover verification

- Reported avatar failure resolved: the original Google image and the Next.js optimizer now return 200. The Next.js process previously lacked outbound network permission and returned 500/EACCES; restarted with approved network access.
- Real Supadata extraction succeeds for the affected video. Full Gemini generation now succeeds after adding a configurable model fallback, bounded output, shorter primary deadline, saved-transcript reuse and timeout attempt refunds. Active primary/default is `gemini-3.5-flash-lite`, with the separately verified `gemini-2.5-flash` fallback; backend `.env` and setup example agree. A fresh-video test exposed intermittent 503s on 3.5 as well; generation then passed with the fallback enabled. Review the fallback before Google's December 1, 2026 model routing change documented in README. Authentication/invalid-output failures do not trigger fallback. Fixed the disabled frontend Retry button and mapped failure codes to readable messages. Tests cover fallback, provider classification, transcript reuse and recovery after repeated transient failures.
- `python -m scripts.diagnose_features --verify-api` successfully generated a full summary/quiz through Next.js, retrieved matching content from the video API, verified repeat-request cache reuse, and checked persistence in Neon. Its temporary account/course/video were removed; the successful shared content cache remains. Earlier failed attempts also cleaned up their temporary accounts. Visual UI walkthrough and real PostgreSQL claim concurrency remain outstanding.

- Initial migration applied successfully: `alembic current` reports `0001 (head)` and `alembic check` reports no new upgrade operations.
- The user confirmed successful Google login through `http://localhost:3000`; a read-only query also confirmed that an active Google session is persisted in Neon without displaying user details.
- A live smoke test using a temporary account confirmed Next.js → FastAPI → Neon readiness/session lookup, course list/detail, persisted notes and library views, playback/resume/completion, statistics, course-delete cascades, and logout session revocation. Only that temporary account and its records were removed afterward.
- Fixed the Windows psycopg `ProactorEventLoop` incompatibility. Alembic and database scripts use `app.runtime.database_event_loop`; Uvicorn must be started with `--loop app.runtime:database_event_loop`. See the root README command. No installed packages were modified.
- `python -m scripts.check_database` provides a read-only redacted target/schema/session check. `python -m scripts.smoke_test` creates and removes its own temporary account; it does not prove interactive Google OAuth or external provider generation.

## Live HTTP connection checks (2026-11-04)

FastAPI and Next.js were started natively and probed through `http://localhost:3000`:

- `/api/health` returns 200 both directly on FastAPI and through Next.js: the rewrite works.
- Anonymous `/api/auth/session` returns 401; the landing and sign-in pages return 200.
- Anonymous dashboard, courses, learning, and settings pages redirect to `/sign-in` with 307 using the production build.
- Google login redirects to `accounts.google.com` with the exact configured localhost callback. This proves initiation/discovery, not successful sign-in or credential acceptance by Google.
- A callback without valid OAuth state redirects safely to sign-in.
- Logout without a session returns 204 for the expected Origin and 403 for an invalid Origin.
- During the initial audit, database readiness returned 503 against the placeholder. This is now resolved by the Neon configuration, migration, and Windows event-loop fix described above.

The development server encountered a disk-full Turbopack error while compiling additional pages. It was stopped; only the verified generated `.next/dev/cache` was cleared (about 551 MB), then checks were repeated successfully with the existing production build. No source/database files were removed. Free disk space before further development builds.

The resumed session fixed database evaluation of AI claim timestamps, UTC handling for exhausted stale claims, and nullable resume-position updates. It added regressions for replaced workers, exhausted claims, retry concurrency, timeout outcomes, failed import writes, session rotation/repeat login, identity rejection, and provider validation/failures. Request logs are visible JSON and omit query strings and raw exception text.

Course polling no longer resets its counter on each pending response, skips overlapping checks, resumes existing pending work, and stops on errors or exhausted checks. Workspace polling is similarly bounded and displays initial failures. Session state is checked on client pathname changes, with a request timeout; settings renders an auth-service error instead of a blank page.

## Known check failures / limits

`npm.cmd run lint` still reports **8 errors**, from existing synchronous state updates in effects and one unescaped apostrophe:

- `frontend/src/app/courses/CoursesClientPage.tsx`: state update through initial fetch effect.
- `frontend/src/app/learning/page.tsx`: unescaped apostrophe.
- `frontend/src/components/dashboard/DashboardPage.tsx`: state update through initial fetch effect.
- `frontend/src/components/learning/CourseLearningHub.tsx`: three initial-fetch effect errors.
- `frontend/src/components/learning/LearningWorkspace.tsx`: existing initial-fetch effect pattern.
- `frontend/src/components/notes/CourseLibrary.tsx`: initial-fetch effect pattern.

Warnings include existing image optimization and unused-variable warnings. ESLint now ignores `backend/` so it does not traverse Python environments/caches. These unrelated UI refactors were left outside the backend migration fixes.

An Authlib HTTPX compatibility deprecation warning remains; it does not fail tests. Missing/invalid OAuth-state handling is exercised with the real client for a callback missing state. Other OAuth error-path tests mock the provider client; they do not establish real nonce/JWT signature verification or a full login flow.

Stale generated `.next/dev/types/validator.ts` originally referenced deleted API handlers. It was moved to ignored `.next/dev/types/validator.ts.stale`; regenerated current types pass. No source type checks were disabled.

## Required before calling the migration complete

The new Neon database and provider settings are configured in `backend/.env`; keep secrets out of chat and Git. See [setup](../README.md).

- [x] Confirm the new host/database is separate from the archived target.
- [x] Apply Alembic `0001`, inspect current revision, and run `alembic check`.
- [ ] Verify constraints, cascades, simultaneous initial claims/retries, and locking against PostgreSQL.
- [x] Verify Google's exact localhost callback and successful user sign-in.
- [ ] Walk through anonymous redirects, Google login/repeat login, expired sessions, logout, cookies, and client navigation through the Next.js rewrite.
- [ ] Import/duplicate import, course detail, playback resume/completion, notes save/delete, library tabs, statistics, sync archival, and course deletion.
- [x] Verify core sessions/course/note/progress/statistics/deletion APIs through Next.js against Neon using an isolated temporary account. A full browser feature walkthrough remains pending.
- [ ] Exercise real YouTube/Supadata/Gemini success/failure flows and AI caching/unlocks; visually verify bounded polling/error cleanup.
- [ ] Resolve or explicitly accept the existing frontend lint backlog.

No Docker, RAG, production deployment, staging, or commits are part of this verification stage. Preserve the user-authored `PROJECT_MASTER_GUIDE.md` and archived original AI route.
