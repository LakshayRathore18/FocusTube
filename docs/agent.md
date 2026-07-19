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

## 1. Project Overview & Current State

FocusTube is a video-based study platform where users import YouTube playlists as courses, take notes, and interact with AI-generated quizzes and transcripts.

- **Stack**: Next.js 16 (Turbopack), Tailwind v4 (CSS-native config), Prisma 7, PostgreSQL (Neon), NextAuth v5 (Google OAuth, JWT session).
- **Status**: Core features functional. Playlist import (YouTube Data API v3), course detail page with embedded YouTube player, and dashboard are implemented. Auth & route protection are complete. Next up: notes, progress tracking, and AI content generation.
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
- [src/app/test-transcript/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/test-transcript/page.tsx) — TEMP QA page: form to test transcript fetching against real YouTube videos.
- [src/app/api/test-transcript/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/test-transcript/route.ts) — TEMP API route consumed by the QA page.
- [src/components/layout/Navbar.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/Navbar.tsx) & [layout/AuthButton.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/AuthButton.tsx) — Auth navbar controls.
- [src/components/layout/Sidebar.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/Sidebar.tsx) — Collapsible sidebar with nav links, weekly progress, and user info.
- [src/components/layout/LayoutShell.tsx](file:///c:/CODING/WebDev/focustube/src/components/layout/LayoutShell.tsx) — Shell orchestrating Navbar + collapsible Sidebar + main content.
- [src/components/course/CourseContent.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/CourseContent.tsx) — Client component: video list with status indicator rings, left-edge accent bars, hover-expand Play buttons, and YouTube modal popup player.
- [src/app/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/page.tsx) — Landing page (redirects authenticated users to /dashboard).
- [src/app/dashboard/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/dashboard/page.tsx) — Dashboard: list courses, import new playlist.
- [src/app/courses/[id]/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/courses/[id]/page.tsx) — Course detail page (server fetcher) → delegates to CourseContent client component.
- [src/app/api/courses/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/courses/route.ts) — POST (import playlist) and GET (list courses).
- [src/app/api/courses/[id]/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/courses/[id]/route.ts) — GET single course with videos (ownership check).
- [src/app/api/videos/[id]/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/[id]/route.ts) — PATCH video status (in_progress / completed) with ownership check.
- [src/app/api/videos/[id]/notes/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/[id]/notes/route.ts) — GET/PUT notes per video with ownership check.
- [src/app/api/videos/continue-watching/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/videos/continue-watching/route.ts) — GET up to 3 most recently updated in_progress videos per user (dashboard "Continue Watching" section).
- [src/app/api/notes/route.ts](file:///c:/CODING/WebDev/focustube/src/app/api/notes/route.ts) — GET all notes for the user with video and course info (for the All Notes page).
- [src/app/notes/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/notes/page.tsx) — All Notes page: notes grouped by course, search filter, click-to-open modal note editor.
- [src/app/dashboard/page.tsx](file:///c:/CODING/WebDev/focustube/src/app/dashboard/page.tsx) — Dashboard: course cards with progress bars, search filter, Continue Watching section, import form.
- [src/components/course/CourseContent.tsx](file:///c:/CODING/WebDev/focustube/src/components/course/CourseContent.tsx) — Course page with video list, status rings, modal player, and collapsible notes editor.
- [src/components/notes/NoteEditor.tsx](file:///c:/CODING/WebDev/focustube/src/components/notes/NoteEditor.tsx) — Tiptap rich text editor with toolbar and debounced autosave.
- [src/components/search/SearchOverlay.tsx](file:///c:/CODING/WebDev/focustube/src/components/search/SearchOverlay.tsx) — Global search overlay for navigating courses.

---

## 3. Database Schema Overview

Do not memorize fields here. Read [prisma/schema.prisma](file:///c:/CODING/WebDev/focustube/prisma/schema.prisma) directly.
- `User` & `Account`: Auth and Google account details.
- `Course`: Imported YouTube playlist, owned by `User`.
- `Video`: Playlist videos. Watch state (`status`, `lastWatchedSeconds`) is stored here.
- `AIContent`: Shared globally across all users (keyed by `@unique youtubeVideoId`). Contains transcript, summary, and quiz JSON.
- `Note`: User-written text notes linked to a `Video`.

---

## 4. Critical Conventions & Gotchas

### DB & Prisma 7
- **Importing the DB Client**: Always use `import { db } from "@/lib/db"`. Never instantiate `new PrismaClient()` elsewhere.
- **Prisma 7 Configuration**: The database URL is configured in [prisma.config.ts](file:///c:/CODING/WebDev/focustube/prisma.config.ts). Do not specify `url = env("DATABASE_URL")` in [schema.prisma](file:///c:/CODING/WebDev/focustube/prisma/schema.prisma).
- **Prisma Client Generation**: When updating schemas, always run `npx prisma generate` to rebuild the TypeScript types in `node_modules/@prisma/client`.

### Next.js 15/16 Routing & APIs
- **Awaiting Params**: Route params (e.g. `{ params }: { params: Promise<{ courseId: string }> }`) must be awaited in Next.js 15+: `const { courseId } = await params;`.
- **Route Protection**: Managed via `src/proxy.ts` using NextAuth's `auth()` wrapper (default export pattern).
- **Notes Autosave**: Notes use debounced trailing-edge autosave (1.5s) via `PUT /api/videos/[id]/notes`.

### Performance Optimizations
- **Parallel DB Queries**: Course page (`src/app/courses/[id]/page.tsx`) and API (`src/app/api/courses/[id]/route.ts`) use `Promise.all` to run `db.course.findUnique` and `db.video.count` in parallel instead of sequential `include`, cutting application-code latency by ~40%.
- **Dashboard enrichment**: `GET /api/courses` uses `Promise.all` with a `groupBy` query to fetch per-course completed video counts in parallel with the main course query, avoiding an n+1 pattern.
- **SSL Connection String**: `src/lib/db.ts` auto-appends `sslmode=verify-full` to the Postgres connection string (or replaces any existing weak sslmode) to suppress the pg-connection-string deprecation warning for Neon deployments.

### Note Authorization Pattern
- Never trust request-supplied entity IDs directly without ownership verification. Ensure the entity ownership resolves back to the session user:
  ```ts
  const video = await db.video.findFirst({
    where: { id: videoId, course: { userId: session.user.id } }
  });
  ```

---

