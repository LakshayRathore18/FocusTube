# FocusTube — Project TODO

> Last updated: 2026-07-20
> Distraction-free YouTube study platform. Paste playlist URL → structured course → watch in-app → notes + AI summaries/quizzes.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | `src/` directory layout |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS v4 | PostCSS via `@tailwindcss/postcss` |
| UI Components | Tiptap (rich text editor) + lucide-react (icons) | Installed via npm |
| Database | PostgreSQL — Neon (free tier) | Serverless Postgres |
| ORM | Prisma 7.8.0 | Schema in `prisma/schema.prisma`, connection URL in `prisma.config.ts` |
| Auth | NextAuth / Auth.js v5 | Google OAuth only, JWT sessions (no DB sessions) |
| AI | Google Gemini API (`gemini-3.1-flash-lite`, via `GEMINI_MODEL` env var) | Swappable provider interface in `src/lib/ai/` |
| YouTube | YouTube Data API v3 + `youtube-transcript-plus` | Playlist import + transcript fetching |
| Deploy | Vercel Hobby (free tier) | 60s function timeout |
| Async Jobs | None — synchronous only | No cron dependency for the primary AI path (Hobby cron = once/day max, unsuitable for request-triggered work) |
| PG Adapter | `@prisma/adapter-pg` + `pg` | Required by Prisma 7 |
| Package Manager | npm | |

> **Concurrency design (interview-relevant):** `AIContent` is deduped globally via a unique constraint on `youtubeVideoId` — not per-user. When two requests race to generate notes for the same video, Postgres atomically allows only one `INSERT` to succeed; the loser catches the unique-violation, reads the winner's row instead, and the frontend polls via idempotent re-POSTs. No manual locking or Redis needed for correctness — the DB constraint *is* the lock.

---

## Build Steps

### ✅ Completed

- [x] Schema design + architecture discussion finalized
- [x] Next.js 15 scaffold (TypeScript + Tailwind + ESLint + App Router + src/)
- [x] **Step 1 — Prisma schema + Neon migration**
  - [x] Installed `prisma 7.8.0`, `@prisma/client`, `@auth/prisma-adapter`, `@prisma/adapter-pg`, `pg`
  - [x] Wrote `prisma/schema.prisma` with all 6 models (User, Account, Course, Video, AIContent, Note)
  - [x] Created `prisma.config.ts` (Prisma 7 breaking change — URL moves out of schema)
  - [x] Created `.env.local` and `.env.example`
  - [x] Ran `npx prisma db push` — all tables live in Neon ✅
  - [x] Ran `npx prisma generate` — client generated
  - [x] Created `src/lib/db.ts` Prisma singleton with `PrismaPg` driver adapter
- [x] **Step 2 — Auth: Google OAuth + JWT sessions**
  - [x] Installed `next-auth@beta`
  - [x] Wrote `src/auth.ts` with Google provider, Prisma adapter, JWT strategy
  - [x] Created route handler: `src/app/api/auth/[...nextauth]/route.ts`
  - [x] Wrote `src/middleware.ts` to protect `/dashboard` and `/courses`
  - [x] Implemented Sign-in and Sign-out UI components and layouts
  - [x] Set up Google OAuth credentials locally

### ✅ Completed

- [x] **Step 3 — Playlist import**
  - [x] YouTube Data API v3 integration (Playlists + PlaylistItems)
  - [x] Extract playlist ID from any YouTube playlist URL format
  - [x] `POST /api/courses` — create Course + Video rows in a transaction
  - [x] Thumbnail: use playlist thumbnail, fall back to first video thumbnail
  - [x] Set `isAvailable=false` at import for private/unavailable videos
  - [x] Import UI: input → loading state → redirect to course page

- [x] **Step 4 — Course page: player + navigation**
  - [x] `/courses/[courseId]` — course overview with video list
  - [x] YouTube iframe embed modal player
  - [x] Status indicator system (rings, partial-fill, checkmarks)
  - [x] Clickable status circle to toggle completed
  - [x] `PATCH /api/videos/[videoId]` — update watch state
  - [x] On play → sets `status=watching`, "Mark as completed" button in modal
  - [x] Hover-expand play button

- [x] **Step 6 — Progress: complete + course %**
  - [x] "Mark complete" button → `PATCH` video `status=completed`
  - [x] Course completion % = completed / total videos
  - [x] Display % as progress bar on course page

- [x] **Step 8 — Dashboard: courses + resume**
  - [x] `/dashboard` — list all user courses
  - [x] Show title, thumbnail, video count
  - [x] Import new playlist CTA

### ✅ Completed

- [x] **Step 5 — Notes: Tiptap rich text editor + autosave**
  - [x] `NoteEditor.tsx` — Tiptap rich text with toolbar (bold, italic, underline, headings, lists, clear formatting)
  - [x] Debounced trailing-edge autosave (1.5s) via `PUT /api/videos/[id]/notes`
  - [x] `GET /api/videos/[id]/notes` — load existing note on mount
  - [x] Notes modal triggered from player control bar and video list (pencil icon)
  - [x] Notes indicator: filled pencil icon when a video has notes
  - [x] Save status indicator: idle → saving → saved / error
  - [x] Ownership verified via Video → Course → User chain


### ✅ Completed

- [x] **Step 6 — AI Notes + Quiz**
  - [x] `src/lib/ai/provider.ts` — swappable `AIProvider` interface
  - [x] `src/lib/ai/gemini.ts` — Gemini provider implementing AIProvider with `@google/genai` SDK
  - [x] `POST /api/ai/content` — production AI content generation endpoint:
    - [x] Try-insert pending `AIContent` row keyed by `youtubeVideoId` (global dedup, not per-user)
    - [x] Winner: fetch transcript → call Gemini → update row to `ready`/`failed` (`attempts`, `lastAttemptedAt` tracked on failure)
    - [x] Loser (unique violation / P2002): read existing row, return as-is — no retry, no wait
    - [x] If row exists with `status: "failed"` and `attempts < 3`: retry inline on next request
    - [x] If `attempts >= 3`: return permanent failure, no further retries
    - [x] Transcript truncation to 20,000 chars for Vercel Hobby 60s timeout mitigation
  - [x] Frontend: explicit "Generate Notes" button per video in `CourseContent.tsx` with 4 visual states (idle, generating, ready, failed)
  - [x] Frontend polling: re-POST the same idempotent endpoint every 2s while `status: "pending"`, capped at 15 attempts (30s total)
  - [x] Display summary + quiz in tabbed modal (Summary tab with hook + keyPoints, Quiz tab with clickable options)
  - [x] Content-status batch endpoint for pre-populating notes/AI button states on mount
  - [x] Per-user unlock tracking via `Video.aiContentUnlockedAt` timestamp
  - [x] `GET /api/videos/[id]/ai-content` — lazy fetch summary+quiz for single video with `needsRegeneration` signal
  - [x] CourseContent refactored into 6 sub-components (types, StatusBadge, NotesModal, VideoPlayerModal, AIContentModal)
  - [x] Course delete button with confirmation modal (DELETE /api/courses/[id])
  - [x] Real-time sidebar stats via `refresh-stats` custom event dispatch
  - [x] Stale JWT recovery (user upsert) on playlist import
  - [x] Cleanup script for AIContent schema migration (npm run cleanup:ai)

### 🔜 Later / Optional (nice-to-have, not required for a working product)

- [ ] Redis (Upstash) cache-aside layer in front of `AIContent` reads — pure optimization, not correctness-critical
- [ ] Trending videos — based on actual watch activity (`status → in_progress` transitions), not AI notes requests, since a video can be popular without anyone needing a summary
- [ ] Save video to personal playlist/bookmarks
- [ ] Daily cron sweep to retry stuck `failed` rows (only relevant once Redis/trending exist; not needed for the inline-retry-on-request approach above)
- [ ] Full-text note search (Postgres `tsvector` + GIN index)
- [ ] Mobile responsiveness pass across all pages
- [ ] Replace `<img>` tags with Next.js `<Image>` component for better performance (7 locations identified in lint warnings)
- [ ] Remove unused variables and imports (useCallback, aiContentLoading identified in lint warnings)
- [ ] Fix React exhaustive-deps warning for pollTimersRef.current in effect cleanup

---




