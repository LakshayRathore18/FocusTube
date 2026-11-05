# GitHub / deployment safety review - 2026-11-05

User asked how to upload/deploy the migrated FastAPI/RAG app while preserving the old Vercel version and retaining an easy rollback. This turn was a review/documentation task: no branch creation, staging, commit, push, database change, deploy or hosting/OAuth setting change was performed.

Read local Git state and actual current remote heads with git ls-remote: local main and GitHub main both at 3ade797d5ac638e8bb9992c8a2bcf87f90fbea3f (original Next.js/Auth.js/Prisma root app); only remote branch returned was main. All migrated code is still uncommitted/untracked. Active secret files/cache/dependencies are ignored. Filename-only scan of 135 Git-eligible text files found no copies of current configured secret values; not a historical/full secret audit. No gh/vercel CLI or local .vercel project link was found, and hosting dashboards were not inspected. Do not claim the actual Vercel production branch/commit is confirmed.

Added docs/DEPLOYMENT_GUIDE.md and links from root/docs READMEs: preserve main + old Vercel settings/domain/database; keep old snapshot ref and move changes to feature/fastapi-rag; review complete migration before staging/committing; explicit branch pushes only after user instruction. Recommended separate NEW Vercel frontend project tracking feature branch + NEW Render Python backend service + the already separate FastAPI Neon database. Existing Vercel can create feature-branch previews; those may fail with old root settings without replacing production. Separate repository is an option if no old-project preview activity is wanted. Separate Google OAuth client/new stable frontend callback avoids altering old credentials.

Documented uv/port/health/model-at-build setup, one worker, Python 3.13.13 matching local interpreter, workspace/root lockfile concerns for frontend, env/cookie/Google origin settings, test acceptance and rollback by continuing to use old URL. Verified current official docs for production vs preview behavior, Render Free limits, uv detection, Python selection and Vercel external rewrite timeout. Render Free memory/latency remain unverified: 512 MB / 0.1 CPU; ~minute wake after 15-minute idle can exceed existing 10-second session fetch timeout; proxy max120s vs90s preparation/generation plus cold-start overhead. Two Render services share750free monthly hours. No render.yaml/vercel.json exists. Actual hosting configuration, production commit, hosted login/cookies, Linux inference and free-tier peak RAM are still to check. Documentation-only changes need no repeated application test run.

---

# Ask AI sizing, alignment and scroll fix - 2026-11-05

User supplied screenshots showing the welcome heading clipped between a tall header/composer/footer and a bright native Windows scrollbar. Fixed the layout rather than adding more decoration: explicit grid rows with minmax(0,1fr) for the message pane, viewport-bounded chat dialog, compact header and no duplicate Close footer in Chat (top-right close remains), same centered content width for empty state/messages/composer, and a one-line 40px composer that grows only to 104px. Removed manual textarea resizing. Empty state now uses a small inline icon/title and compact suggestion cards. Narrow tab spacing prevents unnecessary horizontal scrolling at 390px.

Conversation auto-scroll now targets only the message container with scrollTo, not scrollIntoView on a child (which can move ancestors). No initial scroll for empty/preparation state. Added scoped dark scrollbars with visible 8px Chromium thumbs, Firefox fallback and symmetric gutter; corrected narrow-view padding to keep content/composer aligned. Reduced motion remains respected. Dialog gets accessible role/name and message pane is keyboard focusable. No backend/database changes.

Validation: typecheck, build and existing 7 frontend tests pass; lint remains 8 existing errors/12 warnings. Verified real workspace components plus production CSS in a separate headless Brave/Playwright preview with synthetic API responses at 1100x760, 1100x560 and 390x780. Headless scrollbar hiding was disabled so actual native scrollbar styling could be reviewed. Inspected desktop/mobile empty, long-answer and expanded-source screenshots. Assertions passed: initial heading visible; no empty-state overflow; input 40px; no page/horizontal overflow; long answers scroll up/down while header/composer stay fixed; source link reachable; multiline input capped at 104px; no browser errors. Message pane heights 441/241/461px respectively. No real provider calls or authenticated browser session were used.

Preview bundle, script and screenshots are ignored in `backend/.cache/ui-preview/`. Temporary npm-exec test tools did not add application dependencies. An attempted inspection of the user's browser timed out at app approval; isolated preview was used instead. Full authenticated provider interaction was not repeated for these frontend-only changes.

---

# Ask AI interface redesign ? 2026-11-05

Redesigned `VideoChat.tsx` and the chat mode of `LearningWorkspace.tsx`: fixed-height chat with independently scrolling conversation and visible composer, blue-accented empty/preparation states, starter question cards, separate user/assistant messages, grouped expandable source cards, pending question preview and answer spinner, inline retry errors and transcript readiness badge. Workspace header now reads Ask AI when Chat is active. Input supports Enter to send, Shift+Enter for newline and composition-event protection. Original text-only answer rendering, citation URLs, ownership/provider endpoints, bounded polling/cancellation and memory-only history remain. Scrolling and spinners respect reduced motion.

Frontend typecheck, production build and existing seven tests passed. Lint retains the existing 8 errors/12 warnings. Browser visual review is still manual; automated checks do not establish visual layout. No backend/database changes. Beginner guide updated.

---

# AI progress indicators ? 2026-11-05

User requested visible stages and animation while generating study material. Added shared `AiGenerationProgress` to Courses rows and Learning Summary/Quiz, showing backend-confirmed transcript/content stages with spinner and completed-step checkmarks. New ownership-checked no-store GET `/videos/{id}/ai-progress` returns only status/stage, never source text or generated content and never unlocks. Current AI generation claim now saves the full transcript before Gemini starts; a replaced claim exits before generation. Existing fields suffice; no migration or active database changes were required.

Progress polls independently while the long POST runs: sequential GETs, five-second timeout, two-second interval, fifty-check cap, stop on ready/failed and abort on unmount. Cached transcripts skip directly to content generation. Final POST still owns success/failure and unlocks. Added spinners to chat preparation/question submission; no invented sub-stages or percentages. Reduced-motion preference is respected.

Validation: 122 backend tests (isolated SQLite/mocked providers), 7 frontend tests, typecheck, production build and backend Ruff checks pass. Frontend lint retains 8 existing errors/12 warnings. Tests cover real phase transitions, saved source before generation, non-owner denial, no unlock/leak, stale work and UI poll cancellation/completion. This does not prove real PostgreSQL concurrency/provider timing or browser visual layout; live visual verification remains manual. API, architecture and beginner RAG guide updated.

---

# Courses chat shortcut ? 2026-11-05

User requested easier chat access from Courses. `CourseContent.tsx` now uses the existing capability hook and shows a visible **Ask AI** action for available videos. Clicking stops row playback propagation and opens a lazy-loaded existing `LearningWorkspace` with `initialTab="chat"`, keyed by video ID. Closing unmounts chat. No backend changes or summary prerequisite. Beginner guide and RAG status updated. Typecheck, production build and existing five chat tests pass; lint remains 8 errors/12 warnings. Live browser check remains manual.

---

# MiniLM switch ? 2026-11-05

User selected `sentence-transformers/all-MiniLM-L6-v2` for embeddings, targeting Render Free. Configuration/defaults and local adapter now use 384 dimensions, no prefix, complete 240-token window pooling, max length 256, one thread and batch size one. Downloaded ONNX weights into ignored cache; real offline retrieval check passed in 2.54 seconds. Gemini generation is unchanged and still subject to quota.

Non-destructive migration `0003` allows variable vector dimensions, preserving existing data; applied after archive-separation preflight and isolated PostgreSQL checks. Chunk count/vector fingerprint unchanged across active migration, `alembic check` clean. Isolated integration verified mixed 384/768 vectors with document-scoped retrieval and claim/throttle behavior. 120 backend tests and Ruff lint/format pass. Active saved-transcript preparation/retrieval also passed in 12.81 seconds with six passages and no Gemini/Supadata calls; temporary user data was cleaned up and shared index retained. Existing indexes require explicit preparation again. Actual Render deployment/resource fit and full MiniLM answer factual review are pending. See the current RAG status and beginner guide; earlier BGE entries are historical.

---

# FocusTube: Codex handoff

Updated: 2026-11-04

## Resumed session: read this before the original handoff

**Latest local embedding switch (2026-11-04):** User supplied a passing complete `scripts.smoke_rag` run with follow-up/unrelated/reopen/isolation checks, enabled local RAG and reached Chat, then reported a provider quota error and explicitly requested open-source embeddings. Replaced Google embedding calls with local CPU `BAAI/bge-base-en-v1.5` through FastEmbed 0.9.1/ONNX. Google generation/rewriting models remain unchanged, so their quota limits can still occur; the reported 429 did not identify its originating model. Updated default/ignored active embedding setting, preserving secrets and `RAG_ENABLED=true`. BGE weights are already downloaded into ignored `backend/.cache/embeddings/`; fresh installs use `python -m scripts.setup_embeddings`. Runtime is cache-only, with one inference operation per process, two CPU threads, and native work off the async event loop. Missing weights/busy inference are safe retryable errors, without silent Google fallback.

Vectors remain normalized 768-dimensional, with unchanged schema `0002`. Index version now `chars-2400-overlap-400-bge-token480-pool-v2`; older model/version indexes require explicit preparation again. Full passages use 480-token windows and token-weighted normalized pooling so BGE's 512-token input bound does not silently truncate them. Query instructions apply only to queries. Updated `RAG_GUIDE.md`, development/setup/status/plan documentation. The model is English-oriented; non-English retrieval is not validated.

Verification: **120 backend tests pass**, Ruff lint/format pass. Real offline model/relevance/full-token coverage check passed (~2.45 seconds). Guarded active Neon local prepare/retrieval check passed (~12.45 seconds), returning six passages with zero Gemini/Supadata calls; temporary account removed, shared reindexed document retained. No schema migration, reset or archived-database access. No frontend changes; previous frontend checks not rerun. Complete answer acceptance under BGE and manual factual support remain pending; user-provided prior full smoke result used the old embedding model. Restart/reopen Chat and prepare remaining videos again. No commits/staging. Details: `docs/RAG_STATUS.md`.

**Latest video RAG implementation (2026-11-04), superseding earlier RAG deferral:** User explicitly requested executing `docs/RAG_IMPLEMENTATION_PLAN.md` and maintaining beginner-friendly explanations. Implemented the independent video-chat backend, additive migration `0002`, frontend Chat resource/workspace, tests and documentation. Start with `docs/RAG_GUIDE.md` (plain-language flow, diagrams, code map and troubleshooting) and `docs/RAG_STATUS.md` (verified results and rollout blocker). API, architecture, setup, structure, index and agent guidance were updated. Broader RAG, worker queues and deployment remain deferred. Existing user changes and historical notes remain preserved; nothing staged or committed.

RAG uses normalized 768-dimensional `gemini-embedding-001` vectors in Neon pgvector, full transcripts, 2400-character passages with 400-character overlap, exact retrieval of six chunks, five-minute claim expiry, atomic publication, transcript preservation on embedding failures and ten per-user mutation requests per minute through an atomic database upsert. Every request checks video ownership before shared-cache access. Conversation stays in frontend memory. Structured answers require valid server-generated source IDs; browser history/transcript instructions are untrusted context. Preparation is bounded to 90 seconds and the entire answer pipeline to 60 seconds.

Verified read-only target separation and embedding access, then provisioned/reused dedicated PostgreSQL database `focustube_rag_test` on the active server. Its additive migrations, native vectors/ranking, concurrent claims/stale publishers and fourteen-session throttle test passed; temporary test rows removed, database retained intentionally without DROP/reset. Applied additive `0002` to the confirmed active Neon target: current=head, Alembic check reports no drift. Archived database untouched. Existing application tables were not changed.

Checks: **114 backend tests pass** (39 RAG/service/provider checks); Ruff lint/format pass; **5 frontend interaction tests pass**; typecheck and final production build pass. Lint remains exactly the prior 8 errors / 12 warnings, without new violations or suppressions. Python tests use SQLite/mocked providers; PostgreSQL checks are explicit scripts, not proof of every concurrency scenario. The existing Authlib deprecation warning remains.

**Rollout blocker: active local RAG remains disabled.** Live preparation succeeded (8 chunks, about 3.35 seconds service time); live beginning/middle/end answers succeeded with server-built excerpts in a partial acceptance run. Initial HTTP 400 schema rejection was fixed by sending a portable Gemini schema while validating strictly with Pydantic afterward. An initial follow-up returned insufficient evidence because rewriting could time out before failover; rewriting now budgets 4 seconds primary / 10 seconds fallback under a 15-second rewrite bound, still inside the 60-second answer bound. Subsequent complete acceptance attempts were blocked by primary timeouts and intermittent fallback 503s, including an explicit retry. Do not claim revised follow-ups, unrelated-question handling, manual factual support or a full browser walkthrough are live-verified. Computer-use browser discovery reported host unavailable; native Brave windows were present but no authenticated walkthrough was attempted during the rollout blocker.

Resume with `python -m scripts.smoke_rag` when providers recover; it uses temporary accounts and real Neon/providers through ASGI HTTP, removes its accounts, and retains the shared index. Then finish browser/source-support acceptance and enable `RAG_ENABLED=true` locally, restart the backend and verify capability discovery through Next.js. Existing ignored environment contents/model choices remain unchanged. No application servers were started by this RAG implementation turn. See `docs/RAG_STATUS.md` for exact limits and commands. Do not reapply setup destructively.

**Latest folder reorganization (2026-11-04), superseding all historical root/frontend paths below:** User requested a professional frontend/backend layout, cleanup, and documentation. All existing frontend source and assets moved intact to `frontend/src/` and `frontend/public/`; Next.js, TypeScript, ESLint, PostCSS, environment template, and frontend package manifest also moved under `frontend/`. Root `package.json` is a private npm workspace with the same dev/start/build/lint/typecheck shortcuts; `package-lock.json` is the sole npm lock. Dependencies were reorganized offline without upgrading versions. Next.js resolves the workspace root explicitly for Turbopack and file tracing.

Backend structure and active `backend/.env` were preserved. The original root `.env.local` moved intact to ignored `backend/.env.legacy.local`; `scripts.check_database` now reads that path to refuse the archived target. `frontend/.env.local` contains only the backend origin and public app version. All secret/personal files are confirmed ignored. User `.vscode/` settings were preserved. Root `AGENTS.md` now contains the former docs instructions, and `CLAUDE.md` points to it. This handoff moved from root `CODEX_HANDOFF.md` to `docs/development/SESSION_HANDOFF.md`, retaining all older notes.

Created `docs/README.md`, `docs/PROJECT_STRUCTURE.md`, `docs/DEVELOPMENT.md`, and per-application READMEs; updated root README, architecture, status, and agent paths. Historical README/structure/roadmap/issues/resume notes and associated image moved to `docs/archive/legacy/`; ignored personal notes moved to `docs/archive/personal/`. The user-authored `docs/PROJECT_MASTER_GUIDE.md` and pre-existing `docs/archive/nextjs-ai-content.ts.txt` remain intact. Retired comparison script `backend/scripts/probe_generation.py` was preserved as `docs/archive/diagnostics/probe_generation.py.txt`; active backend checks remain in `backend/scripts/`.

Removed confirmed unused starter SVGs (`file`, `globe`, `next`, `vercel`, `window`), empty old API/Prisma/script directories, and obsolete root `.next/` and TypeScript build info. A generated old Prisma junction inside `.next/dev/node_modules` was deleted as a link only before deleting the cache; its target was not traversed/deleted. Future generated Next.js output is `frontend/.next/`.

Verification after the move: frontend root commands typecheck/build pass, all 75 backend tests pass, backend Ruff lint/format pass, and live core API smoke through the rebuilt frontend passes with temporary-account cleanup. Frontend lint retains exactly the previous 8 errors and 12 warnings; no suppressions added. Root startup forwards host/port flags successfully. Next.js production server is now running on 3000 from the workspace (tool session 87819); FastAPI remains on 8000 (session 83451). No commits, schema changes, or archived-database writes. Current model configuration remains Gemini 3.5 Flash-Lite primary / 2.5 Flash fallback, as in the preceding session.

**Latest committed-repository comparison (2026-11-04):** User supplied GitHub and confirmed their deployed site generated notes for a previously unused video, ruling out cache reuse as the explanation for their test. Browser host was unavailable and web fetching failed; approved read-only Git network access confirmed remote main/HEAD `3ade797d5ac638e8bb9992c8a2bcf87f90fbea3f`, identical to the preserved local HEAD. Public repository metadata identifies deployment `https://focus-tube-eight.vercel.app`. Local old/new Gemini API keys match (compared only as a boolean; no secrets printed); deployed environment values were not accessed.

Sent the exact committed Next.js prompt and two-user-message format via direct REST, with the original `gemini-3.1-flash-lite` and saved 14,913-character transcript: HTTP 200, valid summary/quiz, six questions. Then tested the current Python service with the SAME original model/transcript and fallback disabled: valid summary/quiz, five questions. Thus both request formats and the original model worked at comparison time; prior 503 observations do not establish a permanent model incompatibility, SDK bug, or JSON-mode cause. Do not claim a specific migration root cause was found. App configuration remains 3.5 primary/2.5 fallback as documented below; no business logic/model configuration changed during this comparison. `scripts.probe_generation --old-request` reproduces the committed request; `--sdk` now explicitly disables fallback so it cannot misattribute a fallback success to the requested model. Its saved-transcript selector includes ready rows for read-only comparison. Formatting/lint pass for this script. Archived database and deployment were not modified.

**Latest active model configuration (2026-11-04), superseding earlier defaults:** The user requested fixing summaries after a plain-text check returned 503 for 3.1 Flash-Lite and 200 for 3.5 Flash-Lite. Updated both source defaults and ignored backend `.env` to primary `gemini-3.5-flash-lite` and fallback `gemini-2.5-flash`; credentials preserved. A fresh uncached-video check exposed intermittent 503s on 3.5 too, which is why the independent, full-transcript-verified 2.5 Flash fallback remains enabled. The subsequent real app generation returned `ready`; retrieval, persisted transcript/content, and repeat-request cache reuse all passed, and its temporary account/course/video were removed. No existing ready AI content was deleted or overwritten for verification. Added `--fresh` to `scripts.diagnose_features` to select a course video without an AI cache row.

FastAPI was restarted with this configuration on port 8000 (Windows-compatible loop); Next.js continues on 3000. Provider regression suite: 22 passed; existing full suite result remains 75 passed. Ruff lint/format pass across app/tests/scripts/migrations. README documents the model defaults and Google's announced December 1, 2026 routing change for 2.5 Flash, after which an independent fallback needs review. Nothing staged or committed; archived database untouched.

**Latest AI resolution (2026-11-04), superseding the provider-blocker note below:** Full summary generation now succeeds through the running Next.js → FastAPI → Neon stack for the affected video. Direct full-transcript tests succeeded on Gemini 2.5 Flash and 3.5 Flash-Lite; the old strategy spent the request budget retrying the unavailable primary model. Added configurable `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`, empty disables), one SDK attempt per model, a 20-second primary deadline when fallback is configured, and a 60-second fallback deadline within the existing 90-second pipeline bound. Availability/timeout errors may fall back; authentication and invalid output errors do not. Output is bounded to 4,096 tokens with five requested quiz questions. Primary model/env credentials were preserved. Failed retries reuse the saved transcript, and timeouts also refund their attempt so temporary failures cannot permanently lock a video.

The live `scripts.diagnose_features --verify-api` returned `ready`, retrieved the matching summary/quiz through the video API, verified a repeat request uses the stored result, and checked ready transcript/content persistence in Neon. It uses/removes only its own temporary account/course/video; the successful shared content cache for the real YouTube video remains available. The real user can refresh the course and click Generate once to unlock/use this cache. **75 backend tests pass**, Ruff lint/format and diff whitespace checks pass. No frontend code changed in this follow-up. Added redacted `scripts.probe_generation` for direct REST/SDK testing of saved transcripts without printing source or credentials. The frontend remains on port 3000; FastAPI was restarted on 8000 with the new fallback code and compatible Windows loop. Nothing staged or committed; archived DB untouched.

**Latest reported-feature fixes (2026-11-04):** Investigated missing Google avatar and failed AI summaries. The saved Google photo URL returns 200, but the sandbox-started Next.js optimizer returned 500 with outbound `EACCES`. Restarting Next.js with approved network access fixed the actual optimizer request (200 image/png); no avatar source change was necessary. The rebuilt production frontend remains on port 3000 with network access.

Supadata successfully returned the affected video's transcript (10,310 characters). Gemini `gemini-3.1-flash-lite` and its preview variant return 503 UNAVAILABLE. A small `gemini-3.5-flash-lite` probe succeeded, but two full API generation checks also failed with the provider unavailable; this is **not a successful end-to-end AI verification**. Restored the original model setting after testing. No new credentials are currently needed based on these results. Added bounded SDK retries (three attempts, original 60-second per-call timeout; existing 90-second overall pipeline bound retained), safe provider error categories, and attempt refunds for Gemini outage/quota/configuration failures so these cannot exhaust a video's three permanent attempts. Genuine content failures still retain their cap. The failed-generation frontend button was disabled despite saying “Click to retry”; it now permits retries. Both AI views translate provider failure codes to readable messages.

Added redacted `python -m scripts.diagnose_features` diagnostics, model probes, and `--verify-api`. The latter uses a separate temporary account/course/video against the confirmed new target; successful generation would retain the shared video cache. Both attempted live checks removed their temporary accounts and left real user records untouched. **70 backend tests pass**, Ruff checks pass, frontend typecheck/build pass. The original database remains untouched, and nothing was staged or committed. AI availability remains an external blocker; do not describe full summary generation as fixed or verified until a real full-video request succeeds.

**Latest Neon verification (2026-11-04), superseding the earlier missing-database notes:** The user supplied the new database URL in `backend/.env`. Its driver prefix was corrected to `postgresql+psycopg://` without printing secrets or changing TLS options. Read-only preflight confirmed a separate Neon endpoint/database and no existing tables. Applied initial Alembic revision `0001`; `alembic current` reports head and `alembic check` reports no new upgrade operations. The archived database remains untouched.

The real connection exposed Windows psycopg incompatibility with the Proactor event loop. Added `backend/app/runtime.py` with `database_event_loop`, used by Alembic and database scripts. **Start Uvicorn with `--loop app.runtime:database_event_loop`**, including when running without reload. The root README has the full command. Added `backend/tests/test_runtime.py`; the suite now has **62 passing tests**, with Ruff lint/format passing across app/tests/migrations/scripts.

The user confirmed **Google login works**. A live temporary-account smoke test through `http://localhost:3000` passed Neon readiness, database session lookup, course list/detail, note storage/library APIs, playback/resume/completion, statistics, course deletion cascades, and logout session revocation. The temporary account and its own records were removed, preserving real user data. Added redacted read-only `python -m scripts.check_database` and temporary-account `python -m scripts.smoke_test` helpers (run from `backend/`).

FastAPI was restarted on 8000 with the compatible loop and new Neon settings; Next.js production server remains on 3000. Do not launch duplicate processes. Still outstanding: real YouTube import/sync and Supadata/Gemini generation, full browser feature walkthrough, PostgreSQL claim concurrency tests, and the existing eight frontend lint errors. Do not describe every feature as fully verified yet. No staging or commits were performed.

Latest connection audit (2026-11-04): existing Google/YouTube/Supadata/Gemini credentials were found in `.env.local` and copied into missing keys in ignored `backend/.env`, without printing values. The database URL and auth secret were preserved. **Provider keys are now configured, superseding the earlier blank-credentials note below; the new Neon URL is still missing.**

Live HTTP checks confirm Next.js `/api/*` reaches FastAPI, anonymous sessions return 401, protected pages redirect to sign-in, Google login initiates with the correct callback, invalid-state callbacks fail safely, and Origin/logout checks work. Database readiness remains 503 against the placeholder. The 61 backend tests and TypeScript check pass again. No successful real login, PostgreSQL migration, or data walkthrough has occurred. The user asked whether they need to create a new database; confirmed yes, a separate empty Neon database, preserving the original archive.

During development HTTP checks, Turbopack hit a disk-full error. Stopped that server and cleared only verified generated `.next/dev/cache` (about 551 MB) with approval. Repeated protected-page checks successfully using the existing production build. At the end of this audit, native FastAPI is running on 8000 and Next.js production server on 3000; check existing listeners before launching duplicates. Keep disk-space availability in mind before another dev/build run.

The user explicitly requested continuation from this handoff, authorizing implementation to resume. The earlier documentation-only restriction below is historical. The user selected **a new Neon database** when asked about the live verification target.

Current results: **61 backend tests pass**, Ruff lint/format checks pass, frontend typecheck and production build pass. Frontend lint retains eight pre-existing errors (see `docs/MIGRATION_STATUS.md`). One Authlib HTTPX deprecation warning remains.

Changes made during continuation:

- Fixed AI claim bulk-update synchronization by evaluating timestamp predicates in the database. Exhausted stale claims compare UTC datetimes without treating naive SQLite values as local time.
- Added exhausted-claim, replaced-worker, retry-concurrency, pipeline-timeout, and failed-import-write regressions.
- Added `backend/tests/test_auth.py` for session rotation/cookies/repeat login, verified identity checks, email-link rejection, OAuth error handling, and a real Authlib callback missing state.
- Added `backend/tests/test_providers.py` for Gemini JSON/quiz validation and provider failures, transcript error/timeout handling, and playlist pagination/deduplication.
- Fixed playback completion rejecting the frontend's nullable resume position; status remains non-null and invalid positions remain rejected.
- Bounded both frontend polling paths, prevented overlapping checks/counter resets, resumed existing pending generation, handled non-2xx responses and initial failures, and added client request timeouts.
- Rechecked client auth on pathname changes and displayed auth-service failure in settings.
- Added visible sanitized JSON request logs; unexpected exceptions no longer print raw SQL/provider data. Origin-rejected responses also carry no-store/request-ID headers. Start Uvicorn with `--no-access-log` to avoid default logging of OAuth query strings.
- Cleaned root `.env.example` to frontend-only variables and ignored `backend/` in ESLint.
- Created ignored `backend/.env` with a random auth secret without printing it. **Its database URL is still the localhost placeholder and provider credentials are blank.** No archived credentials were copied.
- Moved stale generated `.next/dev/types/validator.ts` to ignored `validator.ts.stale`; it referenced removed Next.js API handlers. Current generated types pass.
- Added root `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/MIGRATION_STATUS.md`. Updated `docs/AGENTS.md` to the current architecture while retaining its Next.js and database-safety rules. Marked old setup/structure/roadmap docs as historical. Preserved `docs/PROJECT_MASTER_GUIDE.md` and the original AI route archive.

Nothing has been staged or committed. **No PostgreSQL migration, real OAuth/provider walkthrough, or browser verification has been performed. The archived database remains untouched.** Test databases are temporary SQLite files only.

Next action: configure the new separate Neon URL and provider credentials in `backend/.env`, then confirm the target is separate before applying Alembic. Follow the remaining checklist in `docs/MIGRATION_STATUS.md`. Do not repeat the resolved failures or recreate the environment file. No sub-agents were used.

The remainder is the preserved original handoff and contains superseded test results, bugs, and next steps.

## Read this first

- Project: `C:\CODING\WebDev\focustube` on Windows, using PowerShell.
- The FastAPI migration is **partially implemented and not yet verified end to end**.
- Last backend test result: **27 passed, 2 failed**. Neither failure has been fixed yet.
- The existing Neon database has not been modified. No new database migration has been applied.
- The user does **not use Docker**. Continue with native Python/Node processes and a separate PostgreSQL database; a new Neon database is acceptable.
- **Do not commit anything without the user's explicit instruction.** Do not infer permission to commit from permission to implement. Nothing was staged or committed during this work.
- The latest request is documentation only: create this root `CODEX_HANDOFF.md` and do not modify other files. Resume implementation only when the user requests it.

## Conversation and original goal

The user initially asked to inspect the current project and prepare the steps for moving the entire backend to FastAPI, motivated by plans to implement RAG.

The project was inspected in Plan mode, including the Prisma schema, API routes, authentication, frontend callers, YouTube/transcript helpers, and AI generation. The user clarified:

1. Future RAG should let users choose between course video transcripts and their own notes as answer sources.
2. **RAG implementation is deferred. The current task is backend migration only.**
3. The entire backend includes Google authentication and session management, not just business APIs.
4. Prefer the simplest local development rebuild and a complete local cutover over a gradual production migration.
5. Start with a **separate empty database**. Keep the old database untouched as an archive; no data migration is required.
6. Target local development first. Deployment decisions are deferred.

A migration plan was presented and the user said, "Implement the plan." During implementation, the user additionally requested proper ongoing documentation. When Docker was checked, the user clarified that they do not have/use Docker; the intended setup was changed accordingly. The user then asked for progress and next steps before requesting this handoff file.

## Original application before migration

FocusTube is a YouTube study application. Users sign in with Google, import playlists as courses, watch embedded videos, track progress and resume positions, save rich text notes, and generate Gemini study summaries and quizzes.

Original stack:

- Next.js 16.2.10 App Router, React 19, TypeScript, Tailwind CSS v4.
- Tiptap rich text editor and Lucide icons.
- Next.js route handlers for all business APIs.
- Prisma 7 with Neon PostgreSQL.
- Auth.js/NextAuth v5 beta, Google OAuth, JWT sessions.
- YouTube Data API v3 for playlist metadata and paginated items.
- **Supadata** for native video transcripts. Older project docs still mention `youtube-transcript-plus`, but the actual code had already moved to Supadata.
- Google GenAI SDK for Gemini summaries and quizzes; configured model defaults to `gemini-3.1-flash-lite`.

Original data entities: User, Account, Course, Video, Note, AIContent. Videos belong to courses, courses belong to users, and notes belong to individual videos. AIContent is shared globally by YouTube video ID; AI unlock timestamps live on each user's Video row.

Inspection found that the course detail server component queried Prisma directly. Replacing API handlers alone would therefore not complete the backend migration. Auth.js was also used across layouts, redirects, navbar, sidebar, dashboard, and settings.

The original transcript helper strips timestamps. AI generation runs within an HTTP request, stores the full transcript, and sends only the first 20,000 characters to Gemini. These behaviors were retained for migration; timestamped ingestion and durable job infrastructure belong to later RAG work.

## Agreed migration architecture and decisions

- Keep Next.js as the frontend and place the Python backend in `backend/` in the same repository.
- Run Next.js at `http://localhost:3000` and FastAPI on port `8000`.
- Forward browser `/api/*` requests through a Next.js rewrite to FastAPI, preserving a single browser origin and existing frontend API URLs.
- Preserve camelCase JSON fields, existing business request/response shapes, nullable values, dates, `_count`, and summary/quiz structures wherever practical.
- Use Python >=3.12, FastAPI/Uvicorn, Pydantic v2/settings, SQLAlchemy 2.x async sessions with psycopg, and Alembic.
- Use HTTPX for YouTube/Supadata, Authlib for Google OAuth/OpenID Connect, and Google's Python GenAI SDK for Gemini.
- Use new UUID string identifiers and snake_case database columns, serialized to camelCase at the API boundary.
- Recreate the original entities in an empty PostgreSQL database and add a Session table. Do not map or backfill old Prisma tables.
- Replace Auth.js with opaque session cookies. Store token hashes and expiry in PostgreSQL. Sessions default to seven days; cookies are HttpOnly and SameSite=Lax, with Secure required for HTTPS configuration.
- OAuth callback: `http://localhost:3000/api/auth/callback/google`.
- Match Google accounts by provider subject, not automatic email linking. Require a verified Google email.
- Enforce ownership in FastAPI. AI generation must require a video owned by the requesting user before returning shared cached data or invoking providers.
- Validate Origin against the configured frontend origin on POST/PUT/PATCH/DELETE requests.
- Preserve transactional course import, playlist uniqueness, and sync archival: removed videos become unavailable without deleting notes or progress.
- Keep AI summaries/quizzes shared by YouTube video ID and unlock them separately per user/video.
- Bound AI generation to 90 seconds; pending claims expire after two minutes. Use atomic claims, claim IDs, and at most three attempts, counted once per claimed attempt.
- Keep synchronous request-based generation for this migration. No Redis, embeddings, vector database, RAG chatbot, or worker queue yet.
- Use a native setup without Docker. The backend currently defaults to local PostgreSQL port 5433, but no such database has been configured or started.

## Implemented so far

These features have code written; this does not imply full runtime verification.

### Backend foundation and database

- Python project manifest and locked dependencies; a local `backend/.venv` was created using `uv`.
- Settings load `backend/.env` by an absolute path, not the frontend's `.env.local`.
- Async SQLAlchemy session factory and models for users, accounts, sessions, courses, videos, notes, and shared AI content.
- Uniqueness constraints, foreign keys/cascades, video/AI status checks, nonnegative playback position checks, timestamps, and AI claim metadata.
- Explicit initial Alembic revision `0001`; destructive downgrade is disabled.
- FastAPI app with routers, validation errors using an `error` field, Origin validation, no-store responses, request IDs/logging, and health/readiness routes.

### Authentication

- Google login and callback through Authlib.
- User/account creation and repeat-login lookup by provider subject.
- Hashed opaque sessions, cookie creation, session lookup, logout revocation, and cookie clearing.
- Reusable current-user and course/video ownership dependencies.
- Authentication code is not yet covered by comprehensive OAuth tests or a real Google login walkthrough.

### Business APIs

- Courses: list, import, detail, delete, sync, and per-video content status.
- Videos: update status/resume position; continue-watching and recently-watched lists.
- Notes: get/upsert/delete per video, all-notes list, course overview/library, and personal/AI course tabs.
- Statistics: weekly completions/watch duration and learning totals.
- AI: Supadata transcripts, Gemini generation and response validation, cached results, per-user unlocks, retry limits, stale claims, and claim-guarded writes.
- Empty rich text notes are rejected; playback position is strictly validated.
- Python YouTube fetching deduplicates playlist entries by YouTube video ID and skips private/deleted entries.

### Frontend integration

- New auth context supplies the existing `useSession()`-style state to frontend consumers.
- Sign-in navigation and sign-out now target FastAPI endpoints.
- Protected layouts validate sessions through a shared server helper.
- Server helper forwards only the app session cookie and disables user-specific request caching.
- Course detail page fetches FastAPI data rather than querying Prisma.
- Root page and sign-in redirects use the new backend session helper.
- Added a page error boundary and an auth-service error state in the navbar.
- Next.js proxies `/api/*` to FastAPI, with a 120-second proxy timeout for AI generation.
- Removed old Next.js API handlers, Auth.js configuration/proxy, Prisma helpers/schema/config, and the database wipe script.

### Dependencies and preservation

- Node dependencies for Prisma, Auth.js, database adapters, server-side AI/transcripts, and their unused tooling have been removed from `package.json` and `package-lock.json`.
- Added `npm run typecheck` (`next typegen && tsc --noEmit`).
- Added ignore rules for Python environments, caches, and backend secrets; excluded `backend/` from TypeScript compilation.
- An existing user-edited AI route was copied verbatim to `docs/archive/nextjs-ai-content.ts.txt` before its removal from the active frontend.

## Files created, modified, or removed

Paths are relative to the project root. All migration changes are uncommitted.

### Created: Python backend

- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/.env.example`
- `backend/alembic.ini`
- `backend/app/__init__.py`
- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/models.py`
- `backend/app/schemas.py`
- `backend/app/dependencies.py`
- `backend/app/main.py`
- `backend/app/routers/__init__.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/courses.py`
- `backend/app/routers/videos.py`
- `backend/app/routers/notes.py`
- `backend/app/routers/stats.py`
- `backend/app/routers/ai.py`
- `backend/app/services/__init__.py`
- `backend/app/services/youtube.py`
- `backend/app/services/transcripts.py`
- `backend/app/services/gemini.py`
- `backend/migrations/env.py`
- `backend/migrations/script.py.mako`
- `backend/migrations/versions/0001_initial.py`
- `backend/tests/conftest.py`
- `backend/tests/test_api.py`

The installed `.venv`, pytest cache, Ruff cache, and Python bytecode are local artifacts, not source files to commit.

### Created: frontend and archive

- `src/lib/auth-types.ts`
- `src/lib/backend.ts`
- `src/components/auth/AuthProvider.tsx`
- `src/components/auth/ProtectedLayout.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/courses/layout.tsx`
- `src/app/learning/layout.tsx`
- `src/app/settings/layout.tsx`
- `src/app/error.tsx`
- `docs/archive/nextjs-ai-content.ts.txt`
- `CODEX_HANDOFF.md` (this documentation-only request)

### Modified

- `.env.example` (partially updated; legacy entries still need removal)
- `.gitignore`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/sign-in/page.tsx`
- `src/app/courses/[id]/page.tsx`
- `src/components/dashboard/DashboardPage.tsx`
- `src/components/layout/AuthButton.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/settings/SettingsPage.tsx`

### Removed from active implementation

- `prisma/schema.prisma`
- `prisma.config.ts`
- `scripts/wipe-db.mjs`
- `src/auth.ts`
- `src/proxy.ts`
- `src/lib/db.ts`
- `src/lib/youtube.ts`
- `src/lib/transcript.ts`
- `src/lib/ai/provider.ts`
- `src/lib/ai/gemini.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/ai/content/route.ts`
- `src/app/api/courses/route.ts`
- `src/app/api/courses/[id]/route.ts`
- `src/app/api/courses/[id]/sync/route.ts`
- `src/app/api/courses/[id]/content-status/route.ts`
- `src/app/api/videos/[id]/route.ts`
- `src/app/api/videos/[id]/notes/route.ts`
- `src/app/api/videos/[id]/ai-content/route.ts`
- `src/app/api/videos/continue-watching/route.ts`
- `src/app/api/videos/recently-watched/route.ts`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/overview/route.ts`
- `src/app/api/notes/[courseId]/route.ts`
- `src/app/api/stats/learning/route.ts`
- `src/app/api/stats/weekly/route.ts`

### Pre-existing changes to preserve

At initial inspection, Git already showed:

- Modified `src/app/api/ai/content/route.ts`, primarily expanded explanatory comments. Its current version is preserved in the archive listed above.
- Untracked `docs/PROJECT_MASTER_GUIDE.md`. This was not created or rewritten by the migration agent. Preserve it and review before updating documentation.

No Dockerfile or Compose configuration exists from this implementation. A proposed tool operation that included them was interrupted before application; they should not be reintroduced as a setup requirement.

## API surface now implemented

All paths below are owned by FastAPI and browser requests pass through Next.js.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Process health |
| GET | `/api/health/ready` | Database connectivity |
| GET | `/api/auth/google` | Begin Google login |
| GET | `/api/auth/callback/google` | OAuth callback |
| GET | `/api/auth/session` | Current user, or 401 |
| POST | `/api/auth/logout` | Revoke session; 204 |
| GET, POST | `/api/courses` | List/import courses |
| GET, DELETE | `/api/courses/{course_id}` | Course detail/deletion |
| POST | `/api/courses/{course_id}/sync` | Sync playlist metadata and archive missing videos |
| GET | `/api/courses/{course_id}/content-status` | Notes and AI status per video |
| PATCH | `/api/videos/{video_id}` | Watch status/resume position |
| GET | `/api/videos/continue-watching` | Up to three in-progress videos |
| GET | `/api/videos/recently-watched` | Up to six watched videos |
| GET, PUT, DELETE | `/api/videos/{video_id}/notes` | Personal note CRUD |
| GET | `/api/videos/{video_id}/ai-content` | Unlocked summary/quiz or regeneration signal |
| GET | `/api/notes` | All personal notes |
| GET | `/api/notes/overview` | Course library aggregates |
| GET | `/api/notes/{course_id}?tab=personal\|ai` | Course resources |
| GET | `/api/stats/learning` | Learning totals |
| GET | `/api/stats/weekly` | Weekly progress |
| POST | `/api/ai/content` | Generate/reuse summary and quiz |

FastAPI's generated OpenAPI documentation is available directly at `http://127.0.0.1:8000/docs` once running. Mutations require an `Origin: http://localhost:3000` header by default; calling them directly from Swagger on port 8000 will fail Origin validation unless accessed/configured appropriately. Do not weaken Origin validation just to bypass this.

## Verification performed and current bugs

### Test results

Last command, executed from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Result: **27 passed, 2 failed**. Tests use an isolated temporary SQLite database with foreign keys enabled and mocked external services. They do not connect to Neon or exercise the initial Alembic migration; fixtures create tables from model metadata.

Passing coverage includes sessions/logout/expiry, unauthenticated access, ownership isolation, Origin protection, invalid progress, note CRUD and empty-note validation, libraries/statistics, import/sync/deletion behavior, provider-failure atomicity, and AI generation/caching/truncation.

Failing tests:

1. `tests/test_api.py::test_ai_retries_and_stale_claim`
2. `tests/test_api.py::test_ai_concurrent_requests_only_generate_once`

Both encounter `TypeError: can't compare offset-naive and offset-aware datetimes` in SQLAlchemy ORM bulk-update synchronization while evaluating the AI claim predicate. SQLite returns naive datetimes while `now()` and the stale cutoff are UTC-aware. The concurrency test also produced cancellation/connection-cleanup noise after the primary error.

Probable repair to investigate: make the conditional claim update synchronize through the database rather than Python predicate evaluation, for example `.execution_options(synchronize_session=False)` with explicit refresh where needed, and normalize UTC handling consistently for any Python comparisons. Do not mask the failure or remove the concurrency test. Review the `.timestamp()` comparison in the exhausted-claim branch as well: naive SQLite values must not be interpreted as local wall time.

### Other checks

- Python dependencies were successfully installed using `uv sync --project backend`; the available interpreter is Python 3.13.13, compatible with the >=3.12 manifest.
- Ruff fixed two initial issues and formatted existing Python files. It ran before the initial migration and tests were subsequently added, so rerun it over the final set.
- Warnings observed: pytest-asyncio fixture loop scope is unset; Authlib emits an HTTPX compatibility/deprecation warning. Review them separately from the failing tests.
- Node dependency cleanup completed: current `package.json` no longer lists Prisma/Auth.js/server-side provider packages. No successful final frontend install/build/typecheck/lint result has been recorded.
- No real Google OAuth, YouTube, Supadata, or Gemini integration walkthrough has been completed.
- No PostgreSQL migration or PostgreSQL concurrency verification has been performed.

### Remaining cleanup and review

- Root `.env.example` currently has the new frontend variables **plus old backend/Auth.js placeholders**. Remove the old entries so the file is truly frontend-only.
- `backend/.env` has not been created/configured. `AUTH_SECRET` is required and must contain at least 32 characters. Do not copy the old database URL there.
- New PostgreSQL target has not been provisioned. Default port 5433 is a placeholder, not an available server.
- Existing documentation still describes Prisma/Auth.js/Vercel and is stale for the new architecture. Proper documentation requested by the user remains unfinished apart from this handoff and the archive.
- `src/app/sign-in/page.tsx` still has an old comment describing NextAuth/server actions and middleware; update it when implementation resumes.
- Review frontend generation failures and polling. Existing callers do not consistently handle non-2xx responses. In `CourseContent`, a pending response restarts polling/reset counts; in `LearningWorkspace`, an initial failed response is not consistently displayed. Verify bounded polling and loading/error cleanup before claiming parity.
- Review auth-provider error display beyond the navbar, protected-layout/client-navigation behavior, and backend-unavailable states.
- Add OAuth tests and external-provider tests, including invalid/missing state or nonce, cancellation, missing/unverified email, repeat login, uniqueness races, timeouts, malformed Gemini JSON, and invalid quiz shape.
- Verify the initial migration matches the models against a real empty PostgreSQL database; metadata-based SQLite tests do not establish migration correctness.
- Confirm structured request log fields are actually visible with the chosen logging configuration and no secrets/provider URLs/transcripts leak through exception logs.

## Exact next steps when implementation resumes

1. **Reinspect the working tree.** Preserve pre-existing work and the archive. Do not commit, stage, reset, or discard anything. Read applicable repository instructions; use actual code as the source of truth.
2. **Fix the AI timezone/synchronization bug** in `backend/app/routers/ai.py`. Rerun the two failing tests first, then the complete backend suite. Add a regression for an exhausted stale claim and a late old worker whose claim has been replaced.
3. **Add missing behavioral tests**, especially OAuth/session rotation/cookie behavior, provider failure/validation/timeout handling, simultaneous first-generation claims and retry claims, and failed writes without partial course import.
4. **Complete configuration cleanup.** Make root `.env.example` frontend-only. Keep database/provider secrets solely in ignored `backend/.env`. Generate a real secret locally without printing it. Never copy or reuse the old Neon database URL as the migration target.
5. **Run static and frontend checks**, fix migration-caused problems, and record remaining pre-existing issues separately:

   ```powershell
   # From the project root
   npm.cmd run typecheck
   npm.cmd run lint
   npm.cmd run build

   # From backend/
   .\.venv\Scripts\ruff.exe check app tests migrations
   .\.venv\Scripts\ruff.exe format --check app tests migrations
   .\.venv\Scripts\python.exe -m pytest -q
   ```

6. **Use a separate empty PostgreSQL database without Docker.** Prefer a new Neon database if the user has no native PostgreSQL installation. The user must provide/configure access through the ignored backend environment file. Confirm the target is separate from the archived database before applying anything. Do not run reset, wipe, DROP, TRUNCATE, or data-loss migrations.
7. **Configure and verify migrations.** Backend variables are `DATABASE_URL` (SQLAlchemy psycopg URL), `FRONTEND_ORIGIN`, `AUTH_SECRET`, `COOKIE_SECURE`, `SESSION_DAYS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `SUPADATA_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. For a new Neon target use its separate connection URL with a `postgresql+psycopg://` scheme and the TLS parameters required by that connection. Then, from `backend/`:

   ```powershell
   .\.venv\Scripts\python.exe -m alembic upgrade head
   .\.venv\Scripts\python.exe -m alembic current
   .\.venv\Scripts\python.exe -m alembic check
   ```

   Verify uniqueness, cascade behavior, and concurrency against PostgreSQL. Do not use the original Neon database for tests.
8. **Configure Google OAuth** to allow `http://localhost:3000/api/auth/callback/google`. Set frontend `BACKEND_URL=http://127.0.0.1:8000`; keep the browser origin consistently `http://localhost:3000`.
9. **Start both native processes** in separate terminals:

   ```powershell
   # Terminal 1, backend/
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

   # Terminal 2, project root
   npm.cmd run dev
   ```

10. **Perform a browser walkthrough:** anonymous access/redirects, Google sign-in, repeat sign-in, playlist import/duplicate import, course view, playback progress/resume, note autosave/delete, library tabs, statistics, AI generation/cached access/failure states, sync archival, course deletion, logout, and expired-session behavior. Confirm cookies and redirects work through the Next.js rewrite.
11. **Finish documentation alongside fixes.** Add a root setup guide, API contracts, migration checklist/status, and an accurate architecture guide. Update stale project maps/instructions while preserving their database safety rules and the user-authored master guide. Explain the no-Docker workflow, environment ownership, Google callback, commands, tests, and known limitations. Clearly defer RAG and deployment.
12. **Report verified completion honestly.** Separate code implemented, checks passed, and any checks blocked by missing database/provider credentials. Do not call the migration complete until existing features work through FastAPI and Next.js has no active database/provider logic. Do not commit unless the user explicitly requests it.

## Environment and tooling notes

- PowerShell blocks `npm.ps1` in this environment; use `npm.cmd`.
- Git initially reported dubious repository ownership. Use the per-command option `git -c safe.directory=C:/CODING/WebDev/focustube ...`; do not change global Git configuration just for inspection.
- Python installation and test/lint commands encountered sandbox filesystem permission limits. Approved command prefixes during this session included `uv sync --project backend`, `.\.venv\Scripts\python.exe -m pytest`, and `.\.venv\Scripts\ruff.exe`. Follow the current tool permission flow if access is still restricted; do not bypass it.
- The current tests provide a test-only `AUTH_SECRET`. Running the real app or Alembic still requires real backend configuration.
- Next.js 16 has breaking API changes. The relevant installed docs for rewrites, async cookies, and layouts were read before frontend changes. Continue consulting `node_modules/next/dist/docs/` before further Next.js edits, as required by `docs/AGENTS.md`.
- No sub-agents were used. Do not introduce delegation unless the user or applicable instructions explicitly request it.
