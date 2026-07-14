# FocusTube — Project TODO

> Last updated: 2026-07-14
> Distraction-free YouTube study platform. Paste playlist URL → structured course → watch in-app → notes + AI summaries/quizzes.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | `src/` directory layout |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS v4 | PostCSS via `@tailwindcss/postcss` |
| UI Components | shadcn/ui | To be initialized |
| Database | PostgreSQL — Neon (free tier) | Serverless Postgres |
| ORM | Prisma 7.8.0 | Schema in `prisma/schema.prisma`, connection URL in `prisma.config.ts` (breaking change from v6) |
| Auth | NextAuth / Auth.js v5 | Google OAuth only, JWT sessions (no DB sessions) |
| AI | Google Gemini API | Via swappable provider interface in `src/lib/ai/` |
| YouTube | YouTube Data API v3 | Playlist + PlaylistItems endpoints |
| Deploy | Vercel Hobby (free tier) | 60s function timeout |
| Async Jobs | None yet — synchronous only | Add Upstash QStash ONLY if timeout is hit |
| PG Adapter | `@prisma/adapter-pg` + `pg` | Required by Prisma 7 — driver adapters are now mandatory |
| Package Manager | npm | |

> **Free-tier constraint**: No Redis, no queues, no websockets, no microservices, no Railway/AWS/GCP/Azure unless there's a concrete need.

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

### 🔄 In Progress

- [ ] **Step 2 — Auth: Google OAuth + JWT sessions**

### 📋 Upcoming

- [ ] **Step 2 — Auth: Google OAuth + JWT sessions**
  - [ ] Install `next-auth@beta`
  - [ ] `src/auth.ts` — configure Google provider, Prisma adapter, JWT strategy
  - [ ] Route handler: `src/app/api/auth/[...nextauth]/route.ts`
  - [ ] Middleware `src/middleware.ts`: protect `/dashboard`, `/courses` routes
  - [ ] Sign in / sign out UI components
  - [ ] Set up Google OAuth credentials (console.cloud.google.com)

- [ ] **Step 3 — Playlist import**
  - [ ] YouTube Data API v3 integration (Playlists + PlaylistItems)
  - [ ] Extract playlist ID from any YouTube playlist URL format
  - [ ] `POST /api/courses` — create Course + Video rows in a transaction
  - [ ] Thumbnail: use playlist thumbnail, fall back to first video thumbnail
  - [ ] Set `isAvailable=false` at import for private/unavailable videos
  - [ ] Import UI: input → loading state → redirect to course page

- [ ] **Step 4 — Course page: player + navigation**
  - [ ] `/courses/[courseId]` — course overview, video list sidebar
  - [ ] `/courses/[courseId]/videos/[videoId]` — player page
  - [ ] YouTube iframe embed player
  - [ ] Prev / Next video buttons
  - [ ] On play → `PATCH /api/videos/[videoId]` → `status=watching`
  - [ ] "Video not available" modal for `isAvailable=false`

- [ ] **Step 5 — Notes: add / edit / delete**
  - [ ] Notes panel beside the player
  - [ ] `POST /api/notes` — create
  - [ ] `PATCH /api/notes/[noteId]` — update
  - [ ] `DELETE /api/notes/[noteId]` — delete
  - [ ] `GET /api/notes?videoId=X` — list (auth check via Video→Course→User)

- [ ] **Step 6 — Progress: complete + course %**
  - [ ] "Mark complete" button → `PATCH` video `status=completed`
  - [ ] Course completion % = completed / total available videos
  - [ ] Display % on dashboard course cards

- [ ] **Step 7 — AI: summary + quiz (synchronous)**
  - [ ] Swappable AI provider interface `src/lib/ai/provider.ts`
  - [ ] Gemini implementation `src/lib/ai/gemini.ts`
  - [ ] YouTube transcript fetching utility
  - [ ] `POST /api/ai/content` — check AIContent → insert pending → generate → save ready
  - [ ] Unique constraint on `youtubeVideoId` handles race (first insert wins, second reads)
  - [ ] Return summary + quiz JSON to client

- [ ] **Step 8 — Dashboard: courses + resume**
  - [ ] `/dashboard` — list all user courses
  - [ ] Show title, thumbnail, completion %
  - [ ] "Resume" → last `status=watching` video, or first not_started
  - [ ] Import new playlist CTA

- [ ] **Step 9 — Full-text note search**
  - [ ] Postgres `tsvector` + GIN index on `Note.content`
  - [ ] `GET /api/notes/search?q=X`
  - [ ] Search UI (dashboard or notes panel)
  - [ ] No external search service

---

## Environment Variables

```env
# .env.local (never commit)

DATABASE_URL=              # Neon connection string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=           # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_API_KEY=
GEMINI_API_KEY=
```

---

## Key Design Decisions (interview-ready)

**Why shared AIContent by youtubeVideoId, not per user?**
Cost and dedup. Two users importing the same video share one AI call. The unique constraint on `youtubeVideoId` is a lightweight distributed lock — the second concurrent insert fails with a unique violation and falls back to reading the existing row. AI cost grows sub-linearly with users.

**Why is watch state on Video, not a separate UserVideoProgress table?**
A `Video` already belongs to one user via `Course → User`. Denormalization eliminates a join on every player load. If we ever support shared courses (multi-user per course), we'd extract a progress table at that point — not before.

**Why JWT sessions, not DB sessions?**
Vercel serverless functions are stateless. JWT sessions are stored in a signed cookie — zero DB reads per authenticated request. DB sessions would require a `Session` table and a read on every request, burning free-tier connection budget. We skip `Session` and `VerificationToken` tables entirely.

**Why synchronous AI, not a job queue?**
Vercel Hobby gives 60s per invocation. Most videos fit. Setting up QStash speculatively means job IDs, polling routes, retry logic — real complexity for a problem we haven't hit. Add it when we get an actual timeout error.

**Why Postgres full-text search, not Algolia/Elasticsearch?**
Free-tier constraint. Postgres `tsvector` + GIN index handles note-search at our scale. External search adds cost and ops overhead we don't need.
