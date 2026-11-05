# FastAPI contracts

Browser requests use same-origin `/api/*` URLs through Next.js. FastAPI owns all endpoints below. Live OpenAPI schemas are at `http://127.0.0.1:8000/docs` when the backend runs.

Authenticated endpoints require the opaque `focustube_session` cookie. Mutations also require `Origin` to exactly match `FRONTEND_ORIGIN`. Errors use `{ "error": "message" }`; invalid input returns 400, missing/expired authentication 401, Origin violations 403, and missing/unauthorized resources 403 or 404. Responses carry `Cache-Control: no-store` and `X-Request-ID`.

## Routes

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/health` | `{status:"ok"}` without DB access |
| GET | `/api/health/ready` | `{status:"ready"}` or 503 database unavailable |
| GET | `/api/auth/google` | Begin Google redirect flow; 503 if unconfigured |
| GET | `/api/auth/callback/google` | Verify identity, rotate session, 303 to dashboard; OAuth errors redirect to sign-in |
| GET | `/api/auth/session` | `{user:{id,name,email,image}}` or 401 |
| POST | `/api/auth/logout` | Revoke token, clear cookies, 204 |
| GET | `/api/courses` | Course array, camelCase columns, `_count`, remaining duration |
| POST | `/api/courses` | `{url}` playlist URL/ID; 201 `{courseId,title,videoCount}`; duplicate 409 with `courseId` |
| GET | `/api/courses/{id}` | Course, ordered `videos`, `_count.videos` |
| DELETE | `/api/courses/{id}` | `{deleted:id}` |
| POST | `/api/courses/{id}/sync` | `{added,updated,archived,total}` |
| GET | `/api/courses/{id}/content-status` | Map of video IDs to `{hasNotes,aiStatus}` |
| PATCH | `/api/videos/{id}` | `{status?,lastWatchedSeconds?}`; returns `{id,status,lastWatchedSeconds,completedAt}` |
| GET | `/api/videos/continue-watching` | Up to three in-progress videos with course metadata |
| GET | `/api/videos/recently-watched` | Up to six in-progress/completed videos |
| GET | `/api/videos/{id}/notes` | Note object or null |
| PUT | `/api/videos/{id}/notes` | `{content}` nonempty rich text; returns saved note |
| DELETE | `/api/videos/{id}/notes` | `{success:true}`; 404 when absent |
| GET | `/api/videos/{id}/ai-progress` | Read-only owned-video progress: `{status:"not_started"}`, pending with `stage:"transcript"` or `"content"`, or ready/failed; no source/content payload or unlock |
| GET | `/api/videos/{id}/ai-content` | `{summary,quiz}` if unlocked/ready, otherwise `{needsRegeneration:true}` |
| GET | `/api/notes` | Personal notes with video/course metadata |
| GET | `/api/notes/overview` | Course library aggregates |
| GET | `/api/notes/{courseId}?tab=personal\|ai` | Course resources; default personal; invalid tab 400 |
| GET | `/api/study-library` | Owned saved resources with search, filters, counts and pagination; see below |
| GET | `/api/stats/learning` | `{totalPlaylists,totalVideos,completedVideos,personalNotes,aiSummaries}` |
| GET | `/api/stats/weekly` | Weekly completion/watch duration and total completion counts |
| POST | `/api/ai/content` | `{youtubeVideoId,courseId?}`; ready, pending, or failed result |

Video status is `not_started`, `in_progress`, or `completed`. `lastWatchedSeconds` accepts an integer from 0 to 2,147,483,647 or null to clear it. At least one update field is required; explicit null status is invalid. Dates use JSON datetime serialization and nullable fields remain null.

## Study Library

`GET /api/study-library` accepts `q` (up to 200 characters), `type=all|notes|summary|quiz`, optional `courseId`, `sort=recent|oldest|title`, `page` (minimum 1), and `pageSize` (default 24, maximum 100). Invalid values return 400. A course filter is ownership-checked (403 for another user's course, 404 for a missing course).

Response: `{items,total,resourceTotal,counts,courses,page,pageSize}`. Each item contains `{id,type,videoId,youtubeVideoId,videoTitle,courseId,courseTitle,preview,updatedAt,isAvailable}`. IDs combine the owned video ID and resource type. `total` counts matches after all filters; `resourceTotal` counts the entire owned library. `counts` contains `{all,notes,summary,quiz}` after search/course filtering and before the type filter. `courses` lists owned course IDs/titles. Out-of-range pages clamp to the final page.

Search is case-insensitive literal substring matching over lesson/course titles, visible personal-note text, and summary hooks/key points. Quiz questions/answers are neither searched nor included in library metadata. Note HTML is converted to plain text; scripts/styles are excluded. Previews are limited to 180 characters. Recent/oldest ordering uses the note update date or the later AI update/video-unlock date, with stable resource-ID tie-breaking.

The endpoint reads existing records without generating or unlocking AI content. Only ready, unlocked AI resources for owned videos are included. Saved resources remain available when their video is archived. The initial implementation normalizes and filters owned resource text in the backend before pagination; it is not an indexed full-text search service.

## AI responses

```json
{
  "status": "ready",
  "summary": {"hook": "Overview", "keyPoints": ["Key idea"]},
  "quiz": {"questions": [{
    "question": "Which option?",
    "options": ["A", "B", "C", "D"],
    "answer": 0
  }]}
}
```

`answer` is a zero-based integer index. Pending generation returns `{status:"pending"}`. Provider or retry exhaustion returns `{status:"failed",reason:"..."}` with HTTP 200; clients must inspect the result status as well as HTTP errors. Reasons include `max_attempts`, `timeout`, `no_captions`, `rate_limited`, `video_unavailable`, `parse_error`, `invalid_quiz_shape`, and `api_error`.

A repeated POST can acquire an eligible retry claim, so it is not a read-only status endpoint. Ready results unlock only the requesting user's selected video. Requests can take up to 90 seconds; Next.js allows 120 seconds for the proxy.

## Video chat / RAG

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/rag/capabilities` | Public, non-secret `{videoChat:boolean}`; no provider/database calls |
| GET | `/api/rag/videos/{videoId}/status` | Owned video only; `{status,reason?}` with `not_prepared`, `pending`, `ready`, `failed` |
| POST | `/api/rag/videos/{videoId}/prepare` | Owned video only; 200 `{status:"ready"}`, 202 `{status:"pending"}`, or safe error |
| POST | `/api/rag/videos/{videoId}/ask` | `{question,history?}` → `{status,answer,citations}` |

Chat requires no summary, completion or AI unlock. Status polling is read-only. Prepare/ask share a database-backed ten-request allowance per user per minute. Mutations retain Origin validation. Disabled endpoints return 503 `feature_disabled` after authentication/ownership, without accessing the shared RAG cache or providers.

Question: 1–2,000 characters, nonblank. History: at most six `{role:"user"|"assistant",content}` messages, each 1–4,000 characters. Extra request/history fields are rejected. Responses remain camelCase and no-store. History is untrusted context, never evidence.

Answer status is `answered` or `insufficient_evidence`. Answered results require valid server-assigned source IDs. Citations contain `{sourceId,excerpt,videoId,videoTitle,videoUrl}` from retrieved records, without timestamps. Insufficient evidence returns a safe explanation and no citations. Conversations are not persisted.

RAG errors use `{error:"safe_code",code:"safe_code"}`. Codes include `feature_disabled`, `not_prepared`, `rate_limited`, `provider_quota`, `provider_not_configured`, `provider_unavailable`, `transcript_unavailable`, `no_captions`, `video_unavailable`, `timeout`, `invalid_embedding`, `invalid_answer`, `invalid_citations`. Existing authentication/input errors retain the common `{error}` convention.

HTTP statuses: 409 not prepared; 422 unavailable captions/video; 429 user throttle or provider quota, with `Retry-After: 60`; 503 temporary/configuration/disabled service; 504 deadline; 502 invalid generated answer/citations. Prepare is bounded to 90 seconds; the complete answer pipeline is bounded to 60 seconds.

Embeddings now use cached local BGE Base v1.5 on CPU. Additional safe 503 codes are `embedding_model_unavailable` (run the explicit model setup), `embedding_not_configured` (unsupported configured local model), `embedding_busy` (retry after local inference finishes), and `local_embedding_failed`. Changing embedding model/index version makes an old index `not_prepared` with `index_incompatible`; preparation rebuilds it from its saved source. No database migration is needed for this 768-dimensional switch. Generation/rewriting still call Gemini and can return provider quota errors.

### Visible AI generation stages

AI notes/summary generation persists the full fetched transcript under the current claim before calling Gemini. `GET /api/videos/{id}/ai-progress` reports `transcript` until a nonempty saved transcript exists, then `content` while summary and quiz generation runs. Old pending claims (over two minutes) report failed. The endpoint checks video ownership, is no-store, never invokes providers and never unlocks generated content. The final POST response still owns completion/errors and unlocks. No schema migration is needed.

The frontend reads progress while the POST is still running (also for existing pending work). Requests are sequential, have five-second timeouts, retry every two seconds, stop on completion/failure or after fifty checks, and abort when the indicator unmounts. There is no synthetic percentage or timer-based stage progression.
