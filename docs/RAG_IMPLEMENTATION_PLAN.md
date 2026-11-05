# Latest authorized amendment: MiniLM

The user selected `sentence-transformers/all-MiniLM-L6-v2` for local embeddings with Render Free as the intended target. This supersedes BGE/Google embedding details below. Use 384-dimensional normalized vectors, complete 240-token window pooling, no query prefix, one CPU thread and batch size one. Non-destructive migration `0003` allows variable vector dimensions while retaining old data. Compatibility checks require explicit preparation again. Gemini remains the answer provider. See [the beginner guide](RAG_GUIDE.md) for setup and deployment limitations.

# FocusTube: Video RAG Implementation Plan

Status: implemented 2026-11-04; see [RAG status](RAG_STATUS.md) for rollout checks and remaining acceptance work. Created 2026-11-04.

This document records the agreed first feature and its implementation requirements. Read [RAG explained simply](RAG_GUIDE.md) for a beginner-friendly walkthrough of the resulting code. Source defaults keep RAG disabled; local rollout state is recorded separately.

**Authorized amendment, 2026-11-04:** Following quota failures, the user requested open-source embeddings. The current implementation replaces Google embedding calls with local `BAAI/bge-base-en-v1.5` through FastEmbed/ONNX, retaining 768 dimensions and normalized vectors. The original Google-embedding requirements below describe the initial plan; the local implementation and verification in `RAG_GUIDE.md` / `RAG_STATUS.md` supersede them. BGE uses query instructions and token-window pooling instead of Google task types. Existing indexes must be prepared again under the new model/version; no schema migration/reset is required. Gemini remains responsible for answer generation/rewriting.

## 1. Goal and agreed behavior

Add **Ask this video** so users can ask questions about a video in their imported courses and receive answers grounded in its full transcript.

- Available immediately for an owned video, independently of summary generation, completion and AI unlock status.
- Support follow-up questions during the current open chat.
- Keep conversation history in frontend memory; clear it when the workspace closes or the selected video changes.
- Display supporting transcript excerpts and the video link.
- Explain when the transcript cannot support an answer.
- Use the active Neon database with pgvector; no separate vector database is required for v1.
- Preserve existing summaries, quizzes, authentication and progress behavior.

Course-wide retrieval, personal-note retrieval, timestamps, saved conversations, uploads, worker queues and deployment are outside this first version. Keep the backend services reusable so later features can extend them.

## 2. Current integration points

- FastAPI owns authentication, ownership checks, database access and provider credentials.
- Next.js renders the application and forwards browser `/api/*` requests to FastAPI.
- `AIContent.transcript` already stores full shared transcripts when AI generation has fetched them. Imported videos may not have transcripts yet.
- Summary generation currently sends only the first 20,000 transcript characters to Gemini. RAG must index the full transcript instead.
- Supadata ingestion currently flattens captions into text and discards timing. First-version citations therefore link to the video and quote passages, without timestamp claims.
- The learning workspace currently exposes Notes, AI Summary and Quiz. Chat will be an independent fourth tab.

## 3. Architecture and storage

Request flow:

```text
Next.js chat
  -> FastAPI session authentication and video ownership check
  -> retrieve passages from the selected video's prepared transcript
  -> Gemini generates an answer using those passages
  -> validate citations and return answer plus supporting excerpts
```

### Backend services

Separate transcript preparation, embedding, retrieval and answer generation into reusable services under the existing backend service layer. Add a dedicated RAG router and register it with the application.

Use the existing Google GenAI SDK for embeddings and generation. Add the Python pgvector integration to the backend dependencies and update `uv.lock`. Do not introduce frontend provider or database dependencies.

### Additive database migration

Enable the PostgreSQL `vector` extension and introduce:

| Table | Purpose |
| --- | --- |
| `rag_documents` | Shared transcript document keyed by YouTube video ID; stores full text, content hash, indexing version, embedding model/dimensions, preparation state and claim metadata. |
| `rag_chunks` | Ordered passages belonging to a document; stores text, character offsets and a 768-dimensional embedding. |
| `rag_rate_limits` | Database-backed per-user request window and count, shared across application processes. |

Document states are `pending`, `ready` and `failed`. Store a safe failure reason, claim ID and claim expiry. Chunks cascade when their document is deleted. Per-user rate-limit records cascade when the user is deleted.

Use unique constraints on document YouTube ID and document/chunk position. Start with exact cosine-distance search restricted to the selected document. Defer approximate vector indexes until measurements justify them.

Shared transcript storage never grants access by itself. Every request must pass current user/video ownership checks. Deleting a user's course may leave the shared transcript index intact, but that user must lose access through the deleted course.

### Configuration defaults

- `RAG_ENABLED=false` until migration and smoke verification pass.
- `RAG_EMBEDDING_MODEL=gemini-embedding-001`.
- Embedding dimensions: **768**.
- Normalize document and query embeddings consistently.
- Use document/query retrieval task types.
- Record the embedding model and chunking version; never compare incompatible embeddings.
- Reuse existing configured Gemini generation models and safe fallback policy.

Verify the configured embedding model with the existing backend credentials before rollout. If unavailable, leave RAG disabled and report the configuration blocker. Do not silently switch embedding models against an existing index.

## 4. Transcript preparation

Preparation runs only after the user opens Chat and requests it.

1. Authenticate and resolve the owned application video ID.
2. Reuse a compatible ready RAG document.
3. Otherwise atomically acquire a preparation claim with a five-minute expiry.
4. Reuse an existing full `AIContent.transcript` when available; otherwise fetch through Supadata.
5. Split the complete transcript into passages targeting 2,400 characters with approximately 400 characters of overlap, preferring sentence or whitespace boundaries. Preserve source character offsets.
6. Embed in bounded batches and publish the complete index atomically, only while the claim remains current.

Do not hold a database transaction during provider calls. Preserve fetched transcript text if embedding fails. Never expose a partial index as ready.

A failed or interrupted request can be retried; expired claims can be replaced. Preparation is request-bound with a 90-second deadline. No in-process background jobs or worker queue in v1. Superseded claims cannot publish.

Preparation must not modify summary status, quiz data, generation attempts or AI unlock timestamps. RAG's independent document state must not be represented by a misleading pending or ready summary entry.

## 5. API contracts and retrieval

All endpoints use existing session authentication, ownership checks, camelCase responses and no-store behavior. Mutation endpoints retain existing Origin validation.

| Endpoint | Contract |
| --- | --- |
| `GET /api/rag/videos/{videoId}/status` | Return `not_prepared`, `pending`, `ready` or `failed`, plus a safe reason when applicable. |
| `POST /api/rag/videos/{videoId}/prepare` | Prepare or reuse the index. Return 200 when ready, 202 when another preparation owns the claim, or a sanitized error. |
| `POST /api/rag/videos/{videoId}/ask` | Accept `{question, history}` and return `{status, answer, citations}`. Status is `answered` or `insufficient_evidence`. |

Each history item contains only `role: user|assistant` and `content`. Accept at most six prior messages, each no longer than 4,000 characters. Limit the current question to 2,000 characters and reject blank input. Keep existing validation error conventions.

Use 409 when asking before preparation is ready; 429 for throttling/provider quota; 503 for temporary provider/configuration unavailability; 504 for timeouts. Include stable safe error codes without exposing provider responses. Disabled endpoints return a clear feature-disabled response without making provider calls.

### Answer generation

- For follow-ups, produce a standalone retrieval question using bounded conversation history; fall back to the current question if rewriting fails.
- Treat browser-supplied history as untrusted context, never as evidence.
- Retrieve the six closest chunks from the authorized document.
- Send retrieved passages with server-assigned source IDs to Gemini.
- Require structured output containing an answer, evidence sufficiency and cited source IDs.
- Require at least one valid citation for an answered result. Reject unknown citation IDs and return a safe generation error rather than an unsupported answer.
- Build citation excerpts, titles and video URLs server-side from retrieved records. Each citation contains its source ID, excerpt, application video ID, video title and video URL.
- Return `insufficient_evidence` with no citations when the supplied material does not support an answer.
- Treat transcript instructions as untrusted source content.
- Bound the complete answer pipeline, including rewriting and generation failover, to 60 seconds.
- Do not persist questions or answers.

Use a database-backed per-user throttle of ten RAG mutation requests per minute and one active preparation per document. Update counters atomically across application processes and return `Retry-After` when throttled. Status polling is read-only and does not consume mutation allowance.

## 6. Frontend experience

Add a **Chat** tab to the existing video learning workspace. Keep it enabled independently of Summary and Quiz readiness. Ensure the course learning entry points can open this tab without requiring an AI summary.

- Show an explicit **Prepare video chat** action before first use.
- Show preparation, pending, ready, unavailable and retry states.
- Poll preparation status every three seconds for at most two minutes, with one request in flight. If still pending, explain that preparation is taking longer and allow a later status refresh.
- Provide suggested questions, a message list, input and send button.
- Disable duplicate submissions.
- Render answers safely as text; render citations as expandable excerpts with video links.
- Clearly distinguish missing evidence from technical failure.
- Abort client requests and clear conversation state when closing or switching videos. An aborted browser request does not guarantee cancellation of server work; claim expiry provides recovery.
- Discard late responses belonging to the previous video.
- Keep failed questions retryable without adding duplicate successful conversation turns.
- Hide the Chat entry when the backend feature is disabled, using a non-secret feature capability response.

Read the installed Next.js guidance before frontend changes. Preserve existing API rewrites and authentication helpers.

## 7. Problems and safeguards

| Problem | Handling |
| --- | --- |
| Missing or inaccurate captions | Explain unavailable captions; do not fabricate source material. Transcript quality still limits answer quality. |
| Initial preparation latency and cost | Prepare on demand, reuse shared indexes, batch embeddings and throttle requests. |
| Retrieval missing context | Use overlapping full-transcript chunks and test questions from different lecture sections. |
| Unsupported generated answers | Require evidence and validate citation IDs. Evaluate factual support manually; valid IDs alone do not prove correctness. |
| Provider failures | Keep useful preparation state, sanitize errors and allow safe retries. |
| Interrupted preparation | Use expiring database claims and atomic publication; never depend on process-local state for correctness. |
| Shared-cache information leaks | Enforce ownership before status, preparation, retrieval or generation. |
| Embedding model changes | Version the index and reject incompatible embeddings. Reindex deliberately before serving a new version. |
| Render restarts and redeploys | Keep durable transcripts, claims and vectors in Neon, not local filesystem indexes. |

## 8. Verification

### Automated checks

Test the following behaviors:

- Authentication, ownership and cross-user isolation before cache access or provider calls.
- Full-transcript coverage, including material beyond character 20,000.
- Chunk boundaries, overlap, source offsets and embedding compatibility.
- Concurrent preparation, stale claims, atomic publication and retry after failure.
- Follow-up rewriting and untrusted conversation history.
- Invalid citations, unsupported answers and transcript prompt injection.
- Provider quota, missing captions, timeout and configuration failures.
- Throttling across independent application instances.
- Frontend request cancellation, video switching, pending preparation and retry states.
- Existing summary, quiz, notes, progress and unlock behavior remaining unchanged.

Keep ordinary unit/API tests isolated with mocked providers. Verify pgvector distance queries, migrations and claim concurrency against a separate PostgreSQL test database; SQLite cannot prove these properties. Never use the archived database for tests.

Run backend tests and Ruff checks, frontend typecheck and production build. Report the existing frontend lint baseline separately and introduce no additional violations.

### Live acceptance

Using an owned captioned video:

1. Prepare Chat before generating any summary.
2. Ask questions about the beginning, middle and end.
3. Verify answer support against displayed excerpts.
4. Ask a follow-up using “that” or “it.”
5. Ask an unrelated question and verify insufficient-evidence behavior.
6. Reopen Chat and confirm the index persists while conversation history clears.
7. Restart the application and confirm prepared data remains usable.
8. Verify a different user without an owned copy cannot access the shared prepared content.

## 9. Implementation order and safe rollout

1. Perform read-only checks of the active database identity, pgvector availability and embedding access. Confirm the target is separate from the archived database.
2. Add configuration, dependencies, additive migration and reusable preparation/retrieval services. Keep the feature disabled.
3. Add authenticated APIs, citation validation, throttling and automated tests.
4. Add the Chat interface and frontend behavior checks.
5. Verify the migration and vector behavior against isolated PostgreSQL, then apply the additive migration to the confirmed active Neon target.
6. Enable locally, complete live acceptance and record measured preparation/answer latency and provider failures.
7. Keep deployment as a separate task. When deploying later, supply backend secrets through Render environment settings and keep the database in Neon.

Never reset, wipe or apply a data-loss migration. Roll back operationally by disabling RAG while retaining its tables and existing application data.

Update architecture, API contracts, setup instructions, environment examples, the documentation index, agent guidance and session handoff. Record video RAG as the newly authorized feature while broader RAG and deployment remain deferred.

Log only safe operational metadata: phase, duration, chunk count and failure category. Never log questions, answers, transcripts, credentials or connection URLs.

## 10. Completion criteria

- An authenticated user can prepare and chat with an owned video independently of summary generation.
- Answers use retrieved full-transcript evidence and expose validated supporting excerpts.
- Follow-ups work during the current open chat without storing conversations.
- Shared indexes survive application restarts and cannot bypass ownership checks.
- Interrupted preparation and provider outages produce recoverable, understandable states.
- Required checks pass, remaining limitations are documented, and existing application behavior is preserved.
