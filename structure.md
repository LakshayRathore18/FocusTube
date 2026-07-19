# FocusTube — Project Structure & Database Map (structure.md)

This document is a comprehensive guide for developers (humans) to understand the architecture, file structure, database schema, and operational patterns of the FocusTube study platform.

---

## 1. Project Overview & Current State

FocusTube is a study platform built with Next.js 16, Prisma 7, Tailwind v4, and NextAuth v5.

- **Completed**: 
  - Next.js 16 scaffolding, Prisma schema pushed to Neon
  - Google-based OAuth authentication (NextAuth v5 + JWT session strategy)
  - Route protection via Next.js 16 Proxy
  - YouTube Data API v3 integration (playlist import, playlist items fetch)
  - Course import POST endpoint + list GET endpoint
  - Dashboard page (list courses, import new playlist via URL)
  - Course detail page with YouTube embed player, progress tracking, and notes modal
  - Tiptap rich text notes with debounced autosave (1.5s)
  - Landing page (redirects authenticated users to dashboard)
- **Running**: Dev server runs on `localhost:3000`.
- **Database**: 6 tables deployed on Neon PostgreSQL. Prisma client generated and active.

---

## 2. Directory Structure

```
focustube/
├── prisma/
│   └── schema.prisma          ← DB schema (all 6 models defined here)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.ts   ← NextAuth v5 GET/POST exports
│   │   │   ├── courses/
│   │   │   │   ├── route.ts   ← GET (list courses) + POST (import playlist)
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts ← GET (single course with videos, ownership check)
│   │   │   └── videos/
│   │   │       └── [id]/
│   │   │           ├── route.ts  ← PATCH (update video watch state)
│   │   │           └── notes/
│   │   │               └── route.ts ← GET/PUT (fetch/upsert notes)
│   │   ├── courses/
│   │   │   └── [id]/
│   │   │       └── page.tsx   ← Course detail server component, delegates to CourseContent
│   │   ├── dashboard/
│   │   │   └── page.tsx       ← Dashboard: course cards grid + import form
│   │   ├── sign-in/
│   │   │   └── page.tsx       ← Server Action-based Google sign-in page
│   │   ├── favicon.ico        ← Default Next.js favicon
│   │   ├── globals.css        ← Tailwind v4 import + CSS variables
│   │   ├── layout.tsx         ← Root HTML shell: Navbar + children, wraps with SessionProvider
│   │   └── page.tsx           ← Landing page (redirects authed users to /dashboard)
│   ├── components/
│   │   ├── AuthButton.tsx     ← Client Component: user avatar dropdown / sign in button
│   │   ├── CourseContent.tsx  ← Client Component: YouTube iframe embed + video list + notes modal
│   │   ├── Navbar.tsx         ← Client-side Navbar wrapping AuthButton
│   │   └── NoteEditor.tsx     ← Tiptap rich text editor with toolbar + debounced autosave
│   ├── lib/
│   │   ├── db.ts              ← Prisma client singleton with PrismaPg driver adapter
│   │   └── youtube.ts         ← YouTube Data API v3: extractPlaylistId, fetchPlaylistData, fetchPlaylistItems
│   ├── auth.ts                ← NextAuth v5 Config (adapter, Google provider, JWT callbacks)
│   ├── proxy.ts               ← Route protection (NextAuth v5 auth check for /dashboard, /courses)
├── .env.example               ← Safe-to-commit template with empty values
├── .env.local                 ← Actual secrets — NEVER commit (gitignored)
├── .gitignore                 ← Ignores node_modules/, .next/, .env.local
├── AGENTS.md                  ← Warnings/rules for AI assistants
├── CLAUDE.md                  ← Quick link to AGENTS.md
├── agent.md                   ← High-density context for AI agents
├── eslint.config.mjs          ← ESLint flat config
├── issues.md                  ← Current issues tracker
├── next-env.d.ts              ← Auto-generated Next.js types
├── next.config.ts             ← Empty Next.js config
├── package.json               ← npm dependencies and script configuration
├── package-lock.json          ← Lock file
├── postcss.config.mjs         ← PostCSS pipeline for Tailwind v4
├── prisma.config.ts           ← Prisma 7 config (connection URL, schema path)
├── todo.md                    ← Build tracker + design decisions
└── tsconfig.json              ← TypeScript config (strict mode & path aliases)
```

---

## 3. Comprehensive File Explanations

### `prisma/schema.prisma`
Contains the database schema definitions (6 models, 2 enums).
*Note*: In Prisma 7, the `datasource db` block does not specify the connection `url` directly; that is outsourced to `prisma.config.ts`.
```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}
```

### `prisma.config.ts`
New convention in Prisma 7. It configures the schema path and imports `dotenv/config` to read connection strings from `.env.local` before loading CLI environments.
```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

### `src/lib/db.ts`
Prisma client singleton that configures connection pooling using `pg` and maps the client through `@prisma/adapter-pg`.
- Prevents database connection exhaustion caused by Next.js hot-reloads in development.
- Uses a driver adapter to satisfy Prisma 7 requirements.

### `src/lib/youtube.ts`
YouTube Data API v3 utility functions:
- `extractPlaylistId(url)` — parses various YouTube URL formats to extract the playlist ID
- `fetchPlaylistData(playlistId)` — fetches playlist metadata (title, thumbnail, video count)
- `fetchPlaylistItems(playlistId)` — paginated fetch of all videos in a playlist (up to 500)
- Skips private/deleted videos automatically
- Requires `YOUTUBE_API_KEY` environment variable

### `src/app/layout.tsx`
The primary HTML skeleton of the app.
- Imports standard font variables.
- Wraps the entire layout with a NextAuth `SessionProvider` so components can call `useSession()`.
- Renders the custom global `<Navbar />`.

### `src/app/page.tsx`
The root landing page (`/`).
- Calls `auth()` server-side to check if user is authenticated
- If authenticated: redirects to `/dashboard`
- If not: shows the marketing landing page with "Get Started" and "Dashboard" buttons and feature highlights

### `src/app/dashboard/page.tsx`
Client-side dashboard page (`/dashboard`).
- Fetches all user courses from `GET /api/courses`
- Shows course cards with thumbnails, titles, and video counts
- Contains an import form: paste YouTube playlist URL → calls `POST /api/courses` → redirects to new course page
- Handles duplicate import (409) by redirecting to existing course
- Shows empty state when no courses exist

### `src/app/courses/[id]/page.tsx`
Server component for the course detail page (`/courses/[id]`).
- Checks auth via `auth()`, redirects to `/sign-in` if not authenticated
- Fetches course data (with videos ordered by position) from Prisma
- Verifies ownership — calls `notFound()` if user doesn't own the course
- Delegates all rendering to the `CourseContent` client component

### `src/components/CourseContent.tsx`
Client component that provides the interactive course experience:
- **Modal video player**: Clicking a video opens a centered modal with YouTube iframe embed (autoplay enabled)
- **Modal features**: Dark backdrop (`bg-black/70` + `backdrop-blur-sm`), close via X button, Escape key, or clicking outside the player
- **Status indicator system**: Each video has a circular status icon — empty gray ring (not_started), amber partial-progress ring (watching, with progress % from `lastWatchedSeconds`/`durationSeconds`), solid green checkmark (completed)
- **Left-edge accent bar**: Thin 3px vertical bar on the far-left edge of each row — green for completed, amber for in_progress, none for not_started
- **Completed row tint**: Subtle green overlay (`bg-green-500/5`) across completed rows for scannability
- **Colored status labels**: Status text matches state color — gray (not_started), amber (in_progress), green (completed)
- **Hover-expand Play button**: Red button shows only ▶ icon by default. On row hover, expands width and fades in "Play" text via CSS transitions (150ms ease-out)
- **Row hover**: Lightened background on hover reinforces clickability
- **Unavailable videos**: Dimmed with "Unavailable" badge
- **Course header**: Shows title, thumbnail, video count, completed count, and progress bar

### `src/app/api/courses/route.ts`
- `GET /api/courses`: Returns all courses for the authenticated user with video counts, sorted by most recently updated
- `POST /api/courses`: Imports a YouTube playlist — extracts playlist ID, fetches metadata + videos from YouTube API, creates Course + Video rows in a Prisma transaction. Returns 409 if user already imported the same playlist

### `src/app/api/courses/[id]/route.ts`
- `GET /api/courses/[id]`: Returns a single course with all its videos (ordered by position). Includes ownership check (403 if forbidden, 404 if not found)

### `src/app/globals.css`
Tailwind CSS v4 entry point. Configures native CSS variables and themes inside `@theme inline` (replacing the legacy `tailwind.config.js` or `tailwind.config.ts`).

### `src/proxy.ts`
Route protection proxy using NextAuth v5's `auth()` wrapper. Protects `/dashboard` and `/courses` paths, redirecting unauthenticated users to `/sign-in`.

---

## 4. Database Schema Reference

Six main models store FocusTube platform data:

### `User`
Stores oauth user details populated by NextAuth on Google sign-in.
- `id` (String, Primary Key, CUID)
- `name` (String, Optional)
- `email` (String, Unique)
- `emailVerified` (DateTime, Optional)
- `image` (String, Optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### `Account`
Stores Google OAuth access tokens and credentials.
- `userId` matches the `User.id` (cascaded deletion).
- Managed automatically by `@auth/prisma-adapter`.

### `Course`
Corresponds to an imported YouTube playlist.
- Unique index on `[userId, youtubePlaylistId]` ensures a user cannot import the same playlist twice.

### `Video`
A video from an imported YouTube playlist.
- Stores watch states (`status` enum, `lastWatchedSeconds`) directly on the model.
- Connected to a parent `Course` (and indirectly to a `User`).

### `AIContent`
**Shared globally across all users** to avoid duplicate LLM processing fees and API lookups.
- Keyed by `youtubeVideoId` (@unique).
- Stores `transcript`, `summary`, and a dynamic `quiz` JSON payload.
- Schema shape for `quiz` column:
  ```json
  {
    "questions": [
      {
        "question": "Question text?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": 0
      }
    ]
  }
  ```

### `Note`
User-created text notes for specific videos.
- Tied directly to a `Video.id`.
- Authorized by checking `Note -> Video -> Course -> User.id === session.user.id`.

---

## 5. System Flows

### Auth & Route Protection Flow
```
[Browser Request]
       │
       ▼
[src/proxy.ts] (Checks JWT session via auth())
       │
       ├─► [Unauthenticated] ──► Redirect to /sign-in
       │
       └─► [Authenticated] ────► Render protected route (/dashboard, /courses)
```

### Sign-In Pipeline
1. User requests `/sign-in` and submits **Continue with Google**.
2. Server Action triggers `signIn("google", { redirectTo: "/dashboard" })` inside `src/auth.ts`.
3. User signs in on Google. Google redirects back to `/api/auth/callback/google`.
4. NextAuth adapter queries/inserts records in `User` and `Account` tables in PostgreSQL.
5. Session token maps Google identity (`token.sub`) to database User ID (`session.user.id`).
6. JWT cookie is set; user is redirected to `/dashboard`.

### Playlist Import Flow
1. User pastes a YouTube playlist URL on the dashboard import form.
2. `POST /api/courses` receives the URL, calls `extractPlaylistId()`.
3. YouTube Data API fetches playlist metadata and all video items (paginated up to 500).
4. A Prisma transaction creates the Course row + all Video rows in one batch.
5. User is redirected to `/courses/[courseId]` where the embedded player is ready.

### Course Viewing Flow
1. Server component at `/courses/[id]` verifies auth and ownership.
2. Fetches course + videos from Prisma, delegates to `CourseContent` client component.
3. `CourseContent` selects the first video by default and renders the YouTube iframe embed.
4. User clicks any video in the list → it becomes the "now playing" video.
5. The iframe changes to the newly selected video's YouTube ID.

---

## 6. Key CLI Commands

- `npx prisma db push` — Synchronizes schema changes with Neon PostgreSQL.
- `npx prisma generate` — Generates TypeScript bindings for `@prisma/client`.
- `npx prisma studio` — Interactive local admin dashboard for browsing database records.
- `npm run dev` — Starts Next.js dev server on `localhost:3000`.
- `npx tsc --noEmit` — TypeScript type-check without emitting files.
