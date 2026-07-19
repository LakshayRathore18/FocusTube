# FocusTube — Project TODO

> Last updated: 2026-07-14
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

- [x] **Dashboard enhancements**: search filter, progress bars on course cards, Continue Watching section(#)

### 🔄 In Progress

- [ ] **Step 7 — AI: summary + quiz (synchronous)**
  - [x] YouTube transcript fetching utility (`src/lib/transcript.ts` + test route)
  - [ ] Swappable AI provider interface `src/lib/ai/provider.ts`
  - [ ] Gemini implementation `src/lib/ai/gemini.ts`
  - [ ] `POST /api/ai/content` — check AIContent → insert pending → generate → save ready
  - [ ] Unique constraint on `youtubeVideoId` handles race (first insert wins, second reads)
  - [ ] Return summary + quiz JSON to client

- [ ] **Step 9 — Full-text note search**
  - [ ] Postgres `tsvector` + GIN index on `Note.content`
  - [ ] `GET /api/notes/search?q=X`
  - [ ] Search UI (dashboard or notes panel)
  - [ ] No external search service

### ✅ Completed (Current Session)

- [x] **All Notes page** (`/notes`) — fetch notes with video+course info via `GET /api/notes`, group by course, search by content/title, modal editor reuse
- [x] **Codebase restructuring** — moved docs to `docs/`, grouped components into `layout/`, `course/`, `notes/`, `search/` subdirectories
- [x] **Transcript fetching utility** (`src/lib/transcript.ts`) — wraps `youtube-transcript-plus` with typed error handling
- [x] **Transcript test route** (`src/app/api/test-transcript/route.ts`) — temp GET handler to validate against real videos
- [x] **Transcript QA page** (`src/app/test-transcript/page.tsx`) — temp UI form + history list for manual pipeline testing

---




