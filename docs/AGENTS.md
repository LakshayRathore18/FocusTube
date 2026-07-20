# FocusTube — AI Agent Map (agent.md)

> **PURPOSE**: Read this to understand the project structure, status, and constraints.
> **DO NOT DUPLICATE IMPLEMENTATION DETAILS**: To check database schemas or code implementation details, read the files directly using your tools rather than relying on cached explanations here.
> **HUMAN GUIDE**: Detailed human documentation is in [docs/structure.md](file:///c:/CODING/WebDev/focustube/docs/structure.md).

<!-- BEGIN:nextjs-agent-rules -->
## ⚠️ Next.js Version Warning

This is **not** the Next.js version you may know from training data. This project uses **Next.js 16** (Turbopack), which has breaking changes — APIs, conventions, and file structure may all differ from older versions.

- **Always** read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
- **Heed deprecation notices** — what worked in Next.js 13/14/15 may not work here.
<!-- END:nextjs-agent-rules -->

---
<!-- Important guideline -->
Database Safety — Non-Negotiable
NEVER run any command that resets, wipes, or drops the database — this includes prisma migrate dev --reset, prisma db push --force-reset, DROP TABLE, TRUNCATE, or any migration path that Prisma reports as requiring data loss to apply.
If a schema change cannot be applied without data loss (Prisma will say so explicitly), stop and explain the situation instead of proceeding. State exactly what data would be lost and why, then wait for explicit confirmation before running anything destructive. Do not decide this trade-off unilaterally.
Prefer non-destructive migration paths always: default values for new required columns, backfill scripts for existing rows, or making a new column nullable first and tightening it later — instead of a reset.
If you are ever unsure whether a command is destructive, treat it as destructive and ask first.


## 1. Project Overview & Current State

FocusTube is a video-based study platform where users import YouTube playlists as courses, take notes, and interact with AI-generated quizzes and transcripts.

- **Stack**: Next.js 16 (Turbopack), Tailwind v4 (CSS-native config), Prisma 7, PostgreSQL (Neon), NextAuth v5 (Google OAuth, JWT session).
- **Status**: Core features functional. Playlist import (YouTube Data API v3), course detail page with embedded YouTube player, dashboard, notes (Tiptap editor with autosave), and AI-generated study notes + quizzes are implemented. Auth & route protection are complete.
- **Production Status**: Project is production-ready for Vercel Hobby. Production readiness audit completed on 2026-07-20 with all critical issues fixed.
- **Current Task List**: Look at [docs/todo.md](file:///c:/CODING/WebDev/focustube/docs/todo.md) for what needs to be built next.

---

## 2. Directory Map (Core Files Only)

- [prisma/schema.prisma](file:///c:/CODING/WebDev/focustube/prisma/schema.prisma) — Database schema definition (6 models).
- [prisma.config.ts](file:///c:/CODING/WebDev/focustube/prisma.config.ts) — Prisma 7 configuration file.
- [src/auth.ts](file:///c:/CODING/WebDev/focustube/src/auth.ts) — NextAuth v5 configuration.
- [src/proxy.ts](file:///c:/CODING/WebDev/focustube/src/proxy.ts) — Route protection via NextAuth v5 `auth()` wrapper (protects /dashboard, /courses).
- [src/lib/db.ts](file:///c:/CODING/WebDev/focustube/src/lib/db.ts) — Prisma Client database singleton.
- [src/lib/youtube.ts](file:///c:/CODING/WebDev/focustube/src/lib/youtube.ts) — YouTube Data API v3 helpers (playlist extraction, fetch playlist data + items).
- [src/lib/transcript.ts](file:///c:/CODING/WebDev/focustube/src/lib/transcript.ts) — YouTube transcript fetcher (wraps `youtube-transcript-plus`).
- [src/lib/ai/provider.ts](file:///c:/CODING/WebDev/focustube/src/lib/ai/provider.ts) — AIProvider interface with `GenerateNotesResult` and `QuizPayload` types.
- [src/lib/ai/gemini.ts](file:///c:/CODING/WebDev/focustube/src/lib/ai/gemini.ts) — Gemini provider implementing AIProvider (model: `gemini-3.1-flash-lite`).
- [src/components/layout/Navbar.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/Navbar.tsx) & [layout/AuthButton.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/AuthButton.tsx) — Auth navbar controls.
- [src/components/layout/Sidebar.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/Sidebar.tsx) — Collapsible sidebar with nav links, weekly progress, and user info.
- [src/components/layout/LayoutShell.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/LayoutShell.tsx) — Shell orchestrating Navbar + collapsible Sidebar + main content.
- [src/components/course/CourseContent.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/CourseContent.tsx) — Main course page orchestrator (now imports sub-components, ~350 lines). Video list, AI generation + polling, delete course with confirmation modal, refresh-stats event dispatch on status change.
- [src/components/course/types.ts](file:///c:/CODING/WebDev/focustube/src/components/course/types.ts) — Shared type definitions: Video, Course, StudySummary, QuizPayload, AiGenerationState.
- [src/components/course/StatusBadge.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/StatusBadge.tsx) — SVG status rings (not_started/in_progress/completed) for video rows.
- [src/components/course/NotesModal.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/NotesModal.tsx) — Tiptap note editor modal overlay with Escape key + backdrop close.
- [src/components/course/VideoPlayerModal.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/VideoPlayerModal.tsx) — YouTube iframe embed modal with autoplay, Mark complete button, Notes button.
- [src/components/course/AIContentModal.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/AIContentModal.tsx) — Tabbed modal (Summary / Quiz tabs) with structured hook+keyPoints display and clickable quiz options with correct/incorrect feedback.
- [src/app/api/ai/content/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/ai/content/route.ts) — POST endpoint: AI content generation with shared AIContent (keyed by youtubeVideoId). On ready, stamps the user's Video row with aiContentUnlockedAt. Also accepts courseId for precise Video row pinning. DB-level concurrency (P2002 race handling) and polling support. Truncates transcript to 20,000 chars before Gemini call as Vercel Hobby 60s timeout mitigation. Summary JSON-stringified before storing in @db.Text column.
- [src/app/api/courses/[id]/content-status/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/courses/[id]/content-status/route.ts) — GET endpoint: returns per-video hasNotes and aiStatus ("ready"/"pending"/"failed"/"none") by reading Video.aiContentUnlockedAt + global AIContent status. Used by CourseContent on mount to pre-populate button states.
- [src/app/api/courses/[id]/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/courses/[id]/route.ts) — GET (single course with videos, ownership check) + DELETE (deletes course cascading to videos/notes, preserves shared AIContent).
- [src/app/api/videos/[id]/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/[id]/route.ts) — PATCH video status (validated against not_started/in_progress/completed) with ownership check.
- [src/app/api/videos/[id]/ai-content/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/[id]/ai-content/route.ts) — GET: lazy-fetches summary+quiz for a single video. Returns { needsRegeneration: true } when AIContent row is missing/stale despite unlock stamp, so frontend can offer regeneration.
- [src/app/api/videos/[id]/notes/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/[id]/notes/route.ts) — GET/PUT notes per video with ownership check.
- [src/app/api/videos/continue-watching/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/continue-watching/route.ts) — GET up to 3 most recently updated in_progress videos per user (dashboard "Continue Watching" section).
- [src/app/api/courses/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/courses/route.ts) — POST (import playlist) and GET (list courses). POST includes user upsert for stale JWTs and try-catch around transaction for proper JSON error responses.
- [src/app/api/notes/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/notes/route.ts) — GET all notes for the user with video and course info (for the All Notes page).
- [src/app/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/page.tsx) — Landing page (redirects authenticated users to /dashboard via middleware + server component).
- [src/app/dashboard/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/dashboard/page.tsx) — Dashboard: course cards with progress bars, search filter, Continue Watching section, import form.
- [src/app/courses/[id]/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/courses/[id]/page.tsx) — Course detail page (server fetcher) → delegates to CourseContent client component.
- [src/app/notes/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/notes/page.tsx) — All Notes page: notes grouped by course, search filter, click-to-open modal note editor.
- [src/components/notes/NoteEditor.tsx](file:///c:/CODING/WebDev/focustube/src/components/notes/NoteEditor.tsx) — Tiptap rich text editor with toolbar and debounced autosave.
- [src/components/search/SearchOverlay.tsx](file:///c:/CODING/WebDev/focustube/src/components/search/SearchOverlay.tsx) — Global search overlay for navigating courses.
- [scripts/cleanup-ai-content.ts](file:///c:/CODING/WebDev/focustube/scripts/cleanup-ai-content.ts) — One-off script to clean stale AIContent rows after schema changes (validates summary shape, deletes malformed rows). Run via `npm run cleanup:ai`.

---

## 3. Database Schema Overview

Do not memorize fields here. Read [prisma/schema.prisma](file:///c:/CODING/WebDev/focustube/prisma/schema.prisma) directly.
- `User` & `Account`: Auth and Google account details.
- `Course`: Imported YouTube playlist, owned by `User`.
- `Video`: Playlist videos. Watch state (`status`, `lastWatchedSeconds`) + `aiContentUnlockedAt DateTime?` (per-user AI unlock stamp) stored here.
- `AIContent`: Shared globally across all users (keyed by `@unique youtubeVideoId`). Contains transcript, summary, and quiz JSON. Per-user unlock tracked via `Video.aiContentUnlockedAt`.
- `Note`: User-written text notes linked to a `Video`.

---

## 4. Environment Variables

The following environment variables are required (set in `.env.local`):

| Variable | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) | Neon dashboard |
| `NEXTAUTH_URL` | App base URL (`http://localhost:3000` for dev) | — |
| `NEXTAUTH_SECRET` | JWT encryption key | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | Google Cloud Console |
| `GEMINI_API_KEY` | Google Gemini API key (model: `gemini-3.1-flash-lite`, set in `src/lib/ai/gemini.ts`) | Google AI Studio |

---

## 5. Critical Conventions & Gotchas

### DB & Prisma 7
- **Importing the DB Client**: Always use `import { db } from "@/lib/db"`. Never instantiate `new PrismaClient()` elsewhere.
- **Prisma 7 Configuration**: The database URL is configured in [prisma.config.ts](file:///c:/CODING/WebDev/focustube/prisma.config.ts). Do not specify `url = env("DATABASE_URL")` in [schema.prisma](file:///c:/CODING/WebDev/focustube/prisma/schema.prisma).
- **Prisma Client Generation**: When updating schemas, always run `npx prisma generate` to rebuild the TypeScript types in `node_modules/@prisma/client`.

### Next.js 15/16 Routing & APIs
- **Awaiting Params**: Route params (e.g. `{ params }: { params: Promise<{ courseId: string }> }`) must be awaited in Next.js 15+: `const { courseId } = await params;`.
- **Route Protection**: Managed via `src/proxy.ts` using NextAuth's `auth()` wrapper (default export pattern). Matcher includes `/` — signed-in users visiting the landing page get redirected to `/dashboard` at the middleware level.
- **Notes Autosave**: Notes use debounced trailing-edge autosave (1.5s) via `PUT /api/videos/[id]/notes`. On successful save, `onHasContentChange(videoId, true)` is called to instantly update the parent button state (no refresh needed).

### Performance Optimizations
- **Parallel DB Queries**: Course page (`src/app/courses/[id]/page.tsx`) and API (`src/app/api/courses/[id]/route.ts`) use `Promise.all` to run `db.course.findUnique` and `db.video.count` in parallel instead of sequential `include`, cutting application-code latency by ~40%.
- **Dashboard enrichment**: `GET /api/courses` uses `Promise.all` with a `groupBy` query to fetch per-course completed video counts in parallel with the main course query, avoiding an n+1 pattern.
- **SSL Connection String**: `src/lib/db.ts` auto-appends `sslmode=verify-full` to the Postgres connection string (or replaces any existing weak sslmode) to suppress the pg-connection-string deprecation warning for Neon deployments.
- **Content-status batch endpoint**: `GET /api/courses/[id]/content-status` returns notes + AI status for all videos in a single request using two parallel batched Prisma queries (no N+1).
- **Shared AIContent + per-user Video unlock**: AI content is generated once per video globally (saves API costs). Per-user green button state tracked via `Video.aiContentUnlockedAt` instead of separate AIContent rows.

### Note Authorization Pattern
- Never trust request-supplied entity IDs directly without ownership verification. Ensure the entity ownership resolves back to the session user:
  ```ts
  const video = await db.video.findFirst({
    where: { id: videoId, course: { userId: session.user.id } }
  });
  ```

### Stale JWT Recovery (DB Reset)
- If the database is reset, the user's JWT may reference a `userId` that no longer exists as a `User` row.
- `POST /api/courses` handles this by upserting the user record from session data before creating the course.

### No Auto-Play on Course Page
- `CourseContent` no longer auto-plays a video on mount (removed the `useEffect` that found the first `in_progress` video).
- The video player modal only opens when the user explicitly clicks a video row.

---

