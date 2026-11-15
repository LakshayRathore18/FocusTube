## Chat layout and scrolling corrected (2026-11-05)

Fixed clipping shown in user screenshots: compact header, no duplicate bottom Close footer in Chat, viewport-sized grid with one independently scrolling conversation, aligned content/composer widths, compact 40px input growing to at most 104px, scoped dark scrollbars, compact starter cards and mobile tab spacing. Auto-scroll targets the message pane only; empty state no longer scrolls on opening.

Typecheck, build and existing seven frontend tests pass. Lint remains the same 8 existing errors/12 warnings. Isolated real-component/production-CSS browser checks and screenshot review passed at desktop 1100x760, short 1100x560 and mobile 390x780: heading visible, no outer or initial empty-state overflow, stable composer/header during answer scrolling, reachable expanded sources and bounded multiline input. Synthetic answers only; no authenticated session or provider calls. Latest screenshots are in ignored `backend/.cache/ui-preview/`. No backend/schema changes.

## Ask AI interface redesign (2026-11-05)

Chat now has a dedicated scrolling conversation, persistent question composer, suggested question cards, question/answer bubbles, grouped expandable transcript sources and clear preparation/answer states. The workspace identifies itself as Ask AI on Chat. Enter sends; Shift+Enter adds a line. Existing text safety, retries, polling/cancellation, citations and memory-only history are preserved. No backend/schema changes. Typecheck, build and seven frontend tests pass; lint remains at 8 existing errors/12 warnings. Browser visual review remains manual.

## Visible generation progress (2026-11-05)

AI notes/summary now show backend-confirmed **Getting video transcript ? Creating summary and quiz** stages with spinner/checkmarks in Courses and the Learning workspace. Chat preparation and answering also have spinners. Full source text is saved by the active claim before Gemini, using existing fields; no schema migration is needed. New read-only ownership-checked `/videos/{id}/ai-progress` exposes status/stage only and does not unlock content. Polling is bounded, sequential and canceled on unmount. See [the beginner guide](RAG_GUIDE.md#what-the-loading-indicators-mean).

Checks: 122 backend tests, 7 frontend tests, typecheck, build, backend Ruff lint/format pass. Frontend lint remains at 8 existing errors/12 warnings. Backend tests use isolated SQLite/mocked providers; real provider timing/PostgreSQL concurrency and browser visuals for this change remain unverified.

## Courses shortcut (2026-11-05)

Courses now shows a labeled **Ask AI** button beside each available video's existing actions when video chat is enabled. It opens the existing learning workspace directly on that video's Chat tab, without requiring summary generation or leaving the course page. The workspace loads on demand and unmounts on close, retaining existing chat cancellation/history behavior. The beginner guide documents both entry points.

Verification: frontend typecheck, production build and five existing chat tests passed; lint retains the existing 8 errors/12 warnings. Backend behavior was unchanged. A live browser check of this new shortcut remains manual.

# Latest update: MiniLM embeddings (2026-11-05)

The user selected **`sentence-transformers/all-MiniLM-L6-v2`** with Render Free as the intended deployment target. This supersedes the BGE status below. Default and active backend configuration now use MiniLM through cached FastEmbed/ONNX CPU inference: **384 dimensions**, no query prefix, 256-token model limit, complete 240-token windows with normalized token-weighted pooling, one CPU thread, batch size one and one embedding operation per process. The installed registry selects the approximately 90 MB ONNX export; quantization is not claimed.

Migration `0003` removes the vector column's fixed dimension restriction. It was applied to the safety-checked active Neon database after isolated PostgreSQL verification. Existing chunk count and a fingerprint of all stored chunk IDs/vector values matched before and after migration. `alembic check` reports no schema drift. Old vectors remain intact until explicit preparation replaces a video's derived chunks. Compatibility checks include model, dimensions and indexing version (`chars-2400-overlap-400-minilm-token240-pool-v3`). **Prepare existing videos again**; no reset is needed.

Verified: **120 backend tests pass**, Ruff lint/format pass (46 Python files); downloaded model produces 384-dimensional vectors, ranks the relevant synthetic passage first and covers long text completely in an offline real-model check (2.54 seconds including load). The isolated PostgreSQL check passed mixed 384/768-vector storage and document-filtered exact retrieval, migration, concurrent/expired claims, stale publication rejection and atomic throttling. Test rows were cleaned up. SQLite/mocked unit tests alone do not establish live database/provider behavior; the separate integration checks cover the listed PostgreSQL cases only.

Active Neon saved-transcript verification also passed: MiniLM prepared a compatible 384-dimensional index and retrieved six original transcript passages in **12.81 seconds**, with **zero Gemini/Supadata calls**. Temporary user data was removed and the rebuilt shared index retained.

Gemini still generates answers and rewrites follow-ups, so its quota still applies. Full answer/citation factual review with MiniLM and actual Render Free peak RAM/latency remain pending. Frontend code was unchanged; frontend checks were not rerun for this backend-only switch. [The beginner guide](RAG_GUIDE.md#minilm-on-render) includes backend build/start commands and explains model caching on Render; no deployment was performed.

---

# Video RAG implementation status

Updated 2026-11-04. Code is implemented and uncommitted. Start with [RAG explained simply](RAG_GUIDE.md).

## Latest: local open-source embeddings

User requested replacing Google embeddings after a quota error. Active/default embedding model is now **`BAAI/bge-base-en-v1.5`**, running locally on CPU through FastEmbed/ONNX. The model is downloaded to ignored `backend/.cache/embeddings/`; runtime uses cached files only. No embedding API key, GPU, external embedding server or Google embedding quota is needed. Answers and rewriting still use the existing configured Gemini models and remain subject to their quotas.

The schema stays at `0002` with 768 dimensions. Indexing version is now `chars-2400-overlap-400-bge-token480-pool-v2`. Existing Gemini indexes are rejected as incompatible and need **Prepare video chat** again, using saved transcripts where available. Long passages use complete 480-token windows with normalized, token-weighted pooling; source text/offsets remain intact. One operation per process and two ONNX CPU threads bound local inference. This is an English model; non-English retrieval quality has not been verified.

Verified after the change: **120 backend tests pass**, Ruff lint/format pass; a real offline CPU check returned 768-dimensional normalized vectors and ranked the relevant passage first (about 2.45 seconds including cold load). Active-target safety preflight passed, and `scripts.check_local_rag` prepared/retrieved six passages from a saved transcript on Neon with **zero Gemini/Supadata calls** (about 12.45 seconds including connection/setup). Its temporary account was removed and the useful rebuilt shared index retained. No database schema changes or resets. Frontend code was unchanged; previous frontend checks below were not rerun for this backend-only change.

The user subsequently supplied a **successful full `scripts.smoke_rag` result for the previous Gemini-embedding version**, including beginning/middle/end, follow-up, insufficient evidence for unrelated input, durable index reopening and non-owner denial. They enabled `RAG_ENABLED=true` locally and opened Chat. This supersedes the initial disabled-rollout notes below. It does not constitute full answer acceptance using the newly switched BGE embeddings; that remains to check in the browser when answer quota permits. Manual factual support remains unverified. A quota message alone did not identify whether generation or embedding was the original failing call; switching embeddings does not guarantee all quota errors disappear.

On this machine the model setup is complete and `RAG_EMBEDDING_MODEL` in ignored `backend/.env` was updated, preserving credentials, generation models and the user's enabled flag. Restart the backend/reopen Chat and prepare other existing videos again. Use `scripts.check_local_embeddings` for an offline local check, or `scripts.check_local_rag` for the explicit guarded database check. `scripts.setup_embeddings` is needed once on a fresh checkout. Nothing staged or committed.

## Initial implementation record (before the local-model switch)

## Implemented

- Full-transcript, on-demand preparation independent of summaries, quizzes, progress and unlocks.
- Shared Neon/pgvector documents, overlapping passages, normalized 768-dimensional embeddings, model/version compatibility and exact video-scoped retrieval.
- Expiring preparation claims, saved-source retries, guarded atomic publication and database-backed per-user throttling.
- Session/ownership/Origin checks, bounded history and questions, follow-up rewriting, structured answers, validated source IDs and server-built citations.
- Chat resource listing every course video; preparation, polling, errors, question retries, expandable sources and memory-only conversation state.
- Request cancellation, late-response rejection, feature capability discovery and safe operational metadata logging.
- Beginner guide, API/configuration documentation and explicit live verification scripts.

## Verified

| Check | Result |
| --- | --- |
| Existing plus new backend tests | 114 passed; 39 cover RAG/service/provider behavior |
| Backend Ruff lint and format | Pass |
| Frontend chat interaction tests | 5 passed |
| Frontend typecheck | Pass |
| Production frontend build | Pass |
| Frontend lint | Existing baseline: 8 errors, 12 warnings; no added violations |
| Active database safety preflight | Separate from archived database; archive untouched |
| Configured embedding access | `gemini-embedding-001` returned 768 dimensions |
| Isolated PostgreSQL migration | Passed in dedicated `focustube_rag_test` database |
| Native vectors / exact distance | Storage and cosine ranking passed |
| PostgreSQL preparation concurrency | Concurrent exclusion, expired claim replacement and stale publisher checks passed |
| PostgreSQL throttle concurrency | Exactly ten of fourteen independent simultaneous sessions admitted |
| Active Neon migration | `0002 (head)`; Alembic reports no new upgrade operations |
| Live preparation | Succeeded: eight chunks, approximately 3.35 seconds of preparation service work |
| Live answers | Beginning, middle and end questions returned cited answers in an initial partial run; final acceptance is blocked by intermittent provider outages |

The dedicated test database is retained for repeat checks; its test rows were removed. Migration `0002` only adds the vector extension and new RAG tables; no existing application table was changed. The shared prepared transcript remains cached in the active database. Live scripts remove their own temporary users/courses/videos.

## Rollout and limitations

Source defaults and the active local configuration remain `RAG_ENABLED=false`. **Local enabling is blocked by incomplete live acceptance, rather than enabled on the strength of unit tests.** The first live answer attempt exposed an HTTP 400 structured-schema rejection. The provider request now sends a portable Gemini schema, while Pydantic still applies strict validation server-side. Subsequent live answers succeeded. HTTP 400 configuration failures now stop without generation failover.

Live generation also showed primary timeouts and intermittent fallback 503s. The acceptance script records temporary failures and permits one explicit retry, while keeping ordinary rate limits. A first follow-up returned insufficient evidence when rewriting could not finish before its deadline; rewriting now has a short primary budget and a bounded fallback opportunity within the unchanged 60-second answer deadline.

The last acceptance attempt still failed with `provider_unavailable` after its explicit retry. Earlier cited beginning/middle/end answers took approximately 17.7, 22.5 and 20.6 seconds respectively. The first follow-up took approximately 29.5 seconds and returned insufficient evidence. The revised follow-up and unrelated-question acceptance could not be completed during the provider failures. Do not describe those cases as live-verified. The active backend environment file and its existing model choices were preserved; no RAG flag was enabled and no deployment was performed.

SQLite/mocked-provider tests cannot prove real PostgreSQL behavior; the explicit PostgreSQL checks cover selected vector/claim/throttle cases separately. They do not establish every production concurrency scenario. Existing real Google OAuth/core API verification is documented in [migration status](MIGRATION_STATUS.md); this RAG work does not re-prove the entire OAuth flow.

Still required: complete live acceptance after the rewrite adjustment; manual factual-support review against excerpts; a complete browser walkthrough; newly fetched live Supadata captions rather than the saved-transcript path used in the acceptance script; long-video preparation latency/cost evaluation; wider prompt-injection/retrieval-quality evaluation. Browser discovery reported its browser-access host unavailable; native Brave windows were discoverable, but no authenticated UI walkthrough was attempted while rollout remained blocked. Valid source IDs alone do not prove factual correctness.

To resume: run `scripts.smoke_rag` when provider availability recovers. After it passes, complete the browser/source-support checks, set `RAG_ENABLED=true` in ignored `backend/.env`, restart the backend using the documented compatible loop, and confirm `/api/rag/capabilities` through Next.js. The migration is already applied; do not reset or recreate application data.

Deployment, course-wide/personal-note retrieval, saved conversations, timestamps and worker queues remain deferred. Roll back operationally by disabling RAG; retain tables and data.
