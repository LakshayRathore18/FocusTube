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
  - Dashboard page (course cards with progress bars, search filter, Continue Watching section, import form)
  - Course detail page with YouTube embed player, progress tracking, and notes modal
  - Tiptap rich text notes with debounced autosave (1.5s)
  - Landing page (redirects authenticated users to dashboard)
  - Continue Watching API (up to 3 in_progress videos with course info)
  - All Notes page (/notes): notes grouped by course, search filter, modal note editor
  - AI content generation (transcript → structured summary + quiz) with shared AIContent + per-user Video.aiContentUnlockedAt unlock stamp
  - "Generate Notes" button per video with polling (2s intervals, max 15 attempts)
  - AI study notes modal: tabbed summary (hook + keyPoints) + quiz with clickable options
  - Content-status batch endpoint for pre-populating notes/AI button states on mount
  - Stale JWT recovery (user upsert) on playlist import
  - Improved error handling: response text fallback on JSON parse failure + transaction try-catch
  - Middleware-level landing page redirect for authenticated users
  - No auto-play on course page (video player only opens on explicit click)
  - CourseContent.tsx refactored into 6 smaller files (types, StatusBadge, NotesModal, VideoPlayerModal, AIContentModal)
  - Course delete button with confirmation modal (DELETE /api/courses/[id])
  - Real-time sidebar stats via refresh-stats custom event
  - Cleanup script for AIContent schema migration (npm run cleanup:ai)
  - needsRegeneration route signal for stale AIContent rows
- **Running**: Dev server runs on `localhost:3000`.
- **Database**: 8 tables deployed on Neon PostgreSQL. Prisma client generated and active.

---

## 2. Directory Structure

```
focustube/
├── docs/
│   ├── AGENTS.md                ← AI AGENTS context + Next.js version warnings
│   ├── structure.md            ← This file: human-readable project guide
│   ├── todo.md                 ← Build tracker + design decisions
│   ├── issues.md               ← Issue tracker
│   ├── CLAUDE.md               ← Quick link to AGENTS.md
│   └── README.md               ← Project overview
├── scripts/
│   └── cleanup-ai-content.ts   ← One-off cleanup for AIContent rows (npm run cleanup:ai)
├── prisma/
│   └── schema.prisma           ← DB schema (all 6 models defined here)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.ts   ← NextAuth v5 GET/POST exports
│   │   │   ├── courses/
│   │   │   │   ├── route.ts   ← GET (list courses) + POST (import playlist)
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts ← GET (single course with videos, ownership check)
│   │   │   ├── notes/
│   │   │   │   └── route.ts   ← GET (all notes with video + course info, for /notes page)
│   │   │   ├── stats/
│   │   │   │   └── weekly/
│   │   │   │       └── route.ts ← GET (weekly stats for sidebar widget)
│   │   │   ├── ai/
│   │   │   │   └── content/
│   │   │   │       └── route.ts   ← POST: production AI notes + quiz generation (concurrency-safe, truncates transcript to 20k chars for Vercel 60s timeout)
│   │   │   └── videos/
│   │   │       ├── continue-watching/
│   │   │       │   └── route.ts  ← GET (up to 3 in_progress videos with course info, for dashboard)
│   │   │       └── [id]/
│   │   │           ├── route.ts  ← PATCH (update video watch state)
│   │   │           └── notes/
│   │   │               └── route.ts ← GET/PUT (fetch/upsert notes)
│   │   │       └── content-status/│   │   │       └── route.ts ← GET (batch notes + AI status per video, reads Video.aiContentUnlockedAt)
│   │   ├── courses/
│   │   │   └── [id]/
│   │   │       └── page.tsx   ← Course detail server component, delegates to CourseContent
│   │   └── videos/
│   │       └── [id]/
│   │           └── ai-content/
│   │               └── route.ts ← GET (lazy fetch summary+quiz, returns needsRegeneration if stale)
│   │   ├── dashboard/
│   │   │   └── page.tsx       ← Dashboard: course cards with progress bars, search filter, Continue Watching section, import form
│   │   ├── notes/
│   │   │   └── page.tsx       ← All Notes page: notes grouped by course, search, modal editor
│   │   ├── settings/
│   │   │   └── page.tsx       ← Settings page
│   │   ├── sign-in/
│   │   │   └── page.tsx       ← Server Action-based Google sign-in page
│   │   ├── favicon.ico        ← Default Next.js favicon
│   │   ├── globals.css        ← Tailwind v4 import + CSS variables
│   │   ├── layout.tsx         ← Root HTML shell: LayoutShell + SessionProvider
│   │   └── page.tsx           ← Landing page (redirects authed users to /dashboard)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── LayoutShell.tsx ← Shell: Navbar + collapsible Sidebar + main content
│   │   │   ├── Navbar.tsx     ← Client-side Navbar wrapping AuthButton
│   │   │   ├── Sidebar.tsx    ← Collapsible sidebar: nav links, weekly progress, user info
│   │   │   └── AuthButton.tsx ← User avatar dropdown / sign in button
│   │   ├── course/
│   │   │   ├── types.ts          ← Shared types: Video, Course, StudySummary, QuizPayload, AiGenerationState
│   │   │   ├── StatusBadge.tsx   ← SVG progress rings (not_started / in_progress / completed)
│   │   │   ├── NotesModal.tsx    ← Tiptap note editor modal, Escape key + backdrop close
│   │   │   ├── VideoPlayerModal.tsx ← YouTube iframe embed modal with Mark complete
│   │   │   ├── AIContentModal.tsx   ← Tabbed Summary/Quiz modal, clickable quiz options
│   │   │   └── CourseContent.tsx ← Main orchestrator (imports the above, ~350 lines)
│   │   ├── notes/
│   │   │   └── NoteEditor.tsx ← Tiptap rich text editor with toolbar + debounced autosave
│   │   └── search/
│   │       └── SearchOverlay.tsx ← Global course search overlay
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── provider.ts    ← AIProvider interface + GenerateNotesResult/QuizPayload types
│   │   │   └── gemini.ts      ← Gemini provider implementing AIProvider (@google/genai, model: gemini-3.1-flash-lite)
│   │   ├── db.ts              ← Prisma client singleton with PrismaPg driver adapter
│   │   ├── transcript.ts      ← YouTube transcript fetcher (wraps youtube-transcript-plus)
│   │   └── youtube.ts         ← YouTube Data API v3: extractPlaylistId, fetchPlaylistData, fetchPlaylistItems
│   ├── auth.ts                ← NextAuth v5 Config (adapter, Google provider, JWT callbacks)
│   └── proxy.ts               ← Route protection (NextAuth v5 auth check for /dashboard, /courses)
├── .env.example               ← Safe-to-commit template with empty values
├── .env.local                 ← Actual secrets — NEVER commit (gitignored)
├── .gitignore                 ← Ignores node_modules/, .next/, .env.local
├── eslint.config.mjs          ← ESLint flat config
├── next-env.d.ts              ← Auto-generated Next.js types
├── next.config.ts             ← Empty Next.js config
├── package.json               ← npm dependencies and script configuration
├── package-lock.json          ← Lock file
├── postcss.config.mjs         ← PostCSS pipeline for Tailwind v4
├── prisma.config.ts           ← Prisma 7 config (connection URL, schema path)
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

### `src/lib/ai/provider.ts`
AI provider interface defining the contract for generating study notes from transcripts.
- `AIProvider` interface with a single method: `generateNotes(transcript: string): Promise<GenerateNotesResult>`
- `StudySummary` — `{ hook: string; keyPoints: string[] }` — structured summary with a hook sentence and numbered key points
- `GenerateNotesResult` — tagged union: `{ success: true, summary: StudySummary, quiz }` or `{ success: false, reason }`
- `QuizPayload` — `{ questions: { question, options: string[], answer: number }[] }` (dynamic count, 1-10 questions)
- Enables swapping between different AI backends (Gemini, Grok, etc.) without changing route or UI code.

### `src/lib/ai/gemini.ts`
Gemini provider implementing `AIProvider`.
- Uses `@google/genai` SDK (Google GenAI SDK).
- Default model: `gemini-3.1-flash-lite` (overridable via `GEMINI_MODEL` env var).
- `generateNotes()` — generates structured summary (`{ hook, keyPoints }`) + quiz (1-10 questions) from a transcript. Includes markdown code fence stripping as a fallback before JSON parsing, and Zod schema validation (`StudySummarySchema`, `NotesSchema` with dynamic `.min(1).max(10)`).
- Prompt instructs Gemini to return `summary.hook` (captivating one-liner) + `summary.keyPoints` (array of 3-6 items) and 5-10 quiz questions.
- Requires `GEMINI_API_KEY` environment variable.

### `src/lib/transcript.ts`
YouTube transcript fetching utility.
- Wraps the `youtube-transcript-plus` npm package.
- Returns typed results: `{ success: true, transcript: string }` or `{ success: false, reason: string }`.
- Classifies errors into descriptive reason codes (e.g., "TRANSCRIPT_DISABLED", "VIDEO_UNAVAILABLE").

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
- Renders the custom `<LayoutShell />` which orchestrates Navbar + Sidebar + main content.

### `src/app/page.tsx`
The root landing page (`/`).
- Calls `auth()` server-side to check if user is authenticated
- If authenticated: redirects to `/dashboard`
- If not: shows the marketing landing page with "Get Started" and "Dashboard" buttons and feature highlights

### `src/app/dashboard/page.tsx`
Client-side dashboard page (`/dashboard`).
- Fetches all user courses from `GET /api/courses` (now includes `_count.completedVideos`)
- Fetches continue-watching videos from `GET /api/videos/continue-watching`
- Shows course cards with thumbnails, titles, video counts, progress bar + "X/Y completed"
- Client-side search filter that filters courses by title in real-time
- "Continue Watching" section at top showing up to 3 in-progress video cards with play overlay, duration badge, course name
- Contains an import form: paste YouTube playlist URL → calls `POST /api/courses` → redirects to new course page
- Handles duplicate import (409) by redirecting to existing course
- Shows empty state when no courses exist or no courses match search

### `src/app/courses/[id]/page.tsx`
Server component for the course detail page (`/courses/[id]`).
- Checks auth via `auth()`, redirects to `/sign-in` if not authenticated
- Fetches course data (with videos ordered by position) from Prisma
- Verifies ownership — calls `notFound()` if user doesn't own the course
- Delegates all rendering to the `CourseContent` client component

### `src/components/course/CourseContent.tsx`
Main orchestrator component (~350 lines) that imports all sub-components. Manages course state, video interactions, AI generation lifecycle, and delete flow.

**Key responsibilities:**
- **Mount lifecycle**: Fetches `/api/courses/[id]/content-status` to pre-populate notes/AI button states
- **Video status updates**: PATCHes `/api/videos/[id]` on click, dispatches `refresh-stats` custom event for sidebar
- **AI generation pipeline**: Manages generate → poll (2s, 15 attempts) → display lifecycle per video via `useRef` tracking
- **Delete course**: Confirmation modal → DELETE /api/courses/[id] → redirect to dashboard
- **Sub-component usage**: Delegates rendering to VideoPlayerModal, NotesModal, AIContentModal, StatusBadge

**Sub-components:**

#### `StatusBadge.tsx`
- `NotStartedRing` — empty gray circle SVG
- `InProgressRing` — amber dash-offset circle based on `lastWatchedSeconds / durationSeconds`
- `CompletedCheck` — solid green circle with white checkmark

#### `VideoPlayerModal.tsx`
- Centered modal: YouTube iframe embed (autoplay=1), dark backdrop with backdrop-blur-sm
- Close via X button, Escape key, or backdrop click
- Bottom bar: Notes button (opens NotesModal for same video) + Mark Complete / Completed badge

#### `NotesModal.tsx`
- Hosts the `NoteEditor` (Tiptap) with "Save & Close" button
- Flushes unsaved content before closing via `flushAndClose()` callback
- Escape key + backdrop click close

#### `AIContentModal.tsx`
- Tabbed layout: "Summary" (default) + "Quiz (N)" tabs with emerald active indicator
- **Summary tab**: Hook sentence in emerald card + numbered Key Points list with blue circle badges
- **Quiz tab**: Questions with clickable option buttons. Clicking reveals correct (green + ✓) / incorrect (red + ✕) feedback. "Try again" / "Reveal answer" button per question

**Visual features in video rows:**
- **Left-edge accent bar**: 3px vertical bar — green (completed), amber (in_progress), none (not_started)
- **Completed row tint**: Subtle `bg-green-500/5` overlay
- **Hover-expand Play button**: W-9 → group-hover:w-[4.2rem] with text fade-in
- **Status colors**: Gray (not_started), amber (in_progress), green (completed)

**AI button 4 visual states:**
1. **Idle** — sparkle icon, gray border
2. **Generating** — animated spinner with "Generating..." / "Processing..." text, emerald border
3. **Ready** — filled book icon, emerald tint, opens modal on click
4. **Failed** — dimmed sparkle, red border, tooltip shows error, clickable to retry

**Polling flow:**
- `"pending"` response → `setInterval` every 2s (re-POSTs same endpoint with `courseId`)
- Per-video attempt counter via `pollAttemptsRef` (max 15 attempts)
- Cleanup on unmount via `clearInterval` in useEffect cleanup

### `src/app/api/ai/content/route.ts`
**Production** AI content generation endpoint.
- Auth-protected (same session pattern as other routes).
- **Request body**: `{ youtubeVideoId: string, courseId?: string }` — `courseId` is used to precisely pin the user's Video row for the unlock stamp.
- **Step 1 — Check existing**: Queries `AIContent` table by `youtubeVideoId`. Returns `"ready"` (with data), `"pending"`, or `"failed"` (max 3 attempts) immediately if found.
- **Step 2 — Claim & generate**: Inserts or updates an `AIContent` row to `"pending"`. Uses the `@unique` constraint on `youtubeVideoId` as a DB-level dedup lock — concurrent inserts hit P2002 (unique violation) and safely fall back to returning `"pending"`. The winner fetches the transcript via `getTranscript()` then calls `geminiProvider.generateNotes()`, updating the row to `"ready"` or `"failed"`.
  - **Transcript truncation**: As a stopgap against Vercel Hobby's 60s function timeout on very long videos, the transcript is truncated to the first 20,000 characters before being passed to Gemini. This is a temporary mitigation; the proper fix (streaming response or background job) is noted as out of scope.
- **Unlock stamp**: When content becomes ready (whether newly generated or already existing from another user), the current user's `Video` row gets `aiContentUnlockedAt = now()`. This tracks per-user green button state while keeping AIContent globally shared.
- **Response shape**: `{ status: "pending" | "ready" | "failed", summary?, quiz?, reason? }`.

### `src/app/api/courses/route.ts`
- `GET /api/courses`: Returns all courses for the authenticated user with video counts AND per-course completed video count (via parallel `groupBy`), sorted by most recently updated
- `POST /api/courses`: Imports a YouTube playlist — extracts playlist ID, fetches metadata + videos from YouTube API, creates Course + Video rows in a Prisma transaction. Returns 409 if user already imported the same playlist
  - **User upsert**: Before importing, recreates the user's DB record from session data if it was lost (stale JWT after DB reset)
  - **Transaction error handling**: The `$transaction` is wrapped in try-catch so DB errors return proper JSON responses instead of HTML error pages

### `src/app/api/courses/[id]/route.ts`
- `GET /api/courses/[id]`: Returns a single course with all its videos (ordered by position). Includes ownership check (403 if forbidden, 404 if not found)

### `src/app/api/notes/route.ts`
- `GET /api/notes`: Returns all notes for the authenticated user with video title, course title, and YouTube video ID. Ownership enforced via `Note → Video → Course → User` chain. Ordered by most recently updated.

### `src/app/notes/page.tsx`
Client-side All Notes page (`/notes`).
- Fetches all user notes from `GET /api/notes`
- Groups notes by course title
- Each note card shows video title, course name, plain-text preview (first ~100 chars), and time-ago timestamp
- Search input filters by note text content or video title (client-side)
- Clicking a note opens a modal with the shared `NoteEditor` component (Tiptap editor), reusing the save/close pattern from the course page
- Empty state: "No notes yet — start adding notes while watching videos."

### `src/components/layout/Navbar.tsx`
Client component rendering the top navigation bar with the app logo, search toggle, and auth controls.

### `src/components/layout/Sidebar.tsx`
Client component for the collapsible sidebar with navigation links (Dashboard, All Notes, Settings), weekly progress ring, and user info panel.

### `src/components/layout/LayoutShell.tsx`
Client component that orchestrates the full-page layout: full-width Navbar on top, collapsible Sidebar on the left, and main content area on the right.

### `src/components/search/SearchOverlay.tsx`
Client component providing a global search overlay for quickly navigating to courses. Supports keyboard navigation (arrow keys, Enter, Escape).

### `src/app/globals.css`
Tailwind CSS v4 entry point. Configures native CSS variables and themes inside `@theme inline` (replacing the legacy `tailwind.config.js` or `tailwind.config.ts`).

### `src/proxy.ts`
Route protection proxy using NextAuth v5's `auth()` wrapper. Protects `/dashboard`, `/courses`, `/notes`, and `/settings` paths, redirecting unauthenticated users to `/sign-in`. Also includes `/` in the matcher to redirect authenticated users from the landing page to `/dashboard`.

**Matcher**: `["/", "/dashboard/:path*", "/courses/:path*", "/notes/:path*", "/settings/:path*"]`

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
- Per-user unlock tracking is done via `Video.aiContentUnlockedAt` — when a user triggers or reuses AI content, their `Video` row gets a timestamp stamp, and the UI reads that to show the green button state.
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

### `Video` (additional field)
- `aiContentUnlockedAt DateTime?` — Set when the user first generates (or unlocks existing) AI content for this video. Read by `GET /api/courses/[id]/content-status` to determine the green button state per-user.

### `Note`
User-created text notes for specific videos.
- Tied directly to a `Video.id`.
- Authorized by checking `Note -> Video -> Course -> User.id === session.user.id`.

---

## 5. In-Depth Visual Flow Charts

### ── 5.1 Auth & Route Protection ──

```
                         ┌──────────────────────────────┐
                         │   [Browser Request]           │
                         │   GET /dashboard or /courses  │
                         └──────────┬───────────────────┘
                                    │
                                    ▼
                   ┌──────────────────────────────────────┐
                   │  src/proxy.ts (Middleware)           │
                   │  auth() checks JWT session cookie    │
                   └──────────┬───────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
   ┌─────────────────┐ ┌──────────┐ ┌──────────────────┐
   │ No Session      │ │ Signed   │ │ Landing (/ page) │
   │ Redirect /sign-in│ │ in       │ │ Signed in →      │
   └─────────────────┘ │ Proceed  │ │ redirect /dash   │
                        └────┬─────┘ └──────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │ Server Component / Page      │
              │ (auth() again for safety)    │
              └──────────────────────────────┘
```

### ── 5.2 Playlist Import ──

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│ Dashboard │────▶│ Import Form  │────▶│ POST /api/courses │
│ page.tsx  │     │ paste URL    │     │ route.ts         │
└──────────┘     └──────────────┘     └────────┬─────────┘
                                                │
                ┌───────────────────────────────┼────────────────┐
                │                               │                │
                ▼                               ▼                ▼
     ┌────────────────────┐     ┌────────────────────────┐ ┌──────────┐
     │ extractPlaylistId() │     │ Check duplicate import │ │ User     │
     │ (lib/youtube.ts)    │     │ @@unique[userId,       │ │ Upsert   │
     └─────────┬──────────┘     │ youtubePlaylistId]     │ │ (stale   │
               │                └───────────┬────────────┘ │ JWT)     │
               ▼                            │              └──────────┘
     ┌────────────────────┐                 │
     │ fetchPlaylistData()│                 │ 409 if exists
     │ + fetchPlaylistItems│                 │ (redirect to existing)
     └─────────┬──────────┘                 │
               │                            ▼
               ▼               ┌────────────────────────┐
     ┌────────────────────┐    │ Prisma $transaction    │
     │ YouTube Data API   │    │ create Course + Videos │
     │ v3 (paginated)     │───▶│ (try-catch for JSON    │
     └────────────────────┘    │  error responses)      │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │ Redirect →              │
                               │ /courses/[courseId]     │
                               └────────────────────────┘
```

### ── 5.3 Course Viewing & Video Interaction ──

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│ /courses/[id]     │────▶│ CourseContent    │────▶│ content-status GET   │
│ page.tsx (server) │     │ (client component)│    │ (populate button     │
│ auth + fetch      │     │ imports 5 subs   │    │  states on mount)    │
└──────────────────┘     └────────┬─────────┘    └──────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────────┐
         │                        │                            │
         ▼                        ▼                            ▼
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ Click video row │   │ Toggle status circle │   │ Click Notes / AI    │
│ → Play modal    │   │ → PATCH /api/videos/ │   │ → Open NotesModal / │
│ (YouTube iframe)│   │ [id] + dispatch      │   │   AIContentModal    │
│ Mark Complete   │   │   refresh-stats event│   └──────────────────────┘
│ → Close modal   │   └──────────────────────┘
└─────────────────┘

   status click flow:             stats refresh flow:
   completed ↔ not_started        PATCH resolves
          │                           │
          ▼                           ▼
   updateVideoStatus()         window.dispatchEvent(
          │                      "refresh-stats")
          │                           │
          ▼                           ▼
   PATCH /api/videos/[id]       Sidebar re-fetches
   .then(dispatch               GET /api/stats/weekly
     "refresh-stats")            → setWeeklyStats(data)
```

### ── 5.4 AI Content Generation (In-Depth) ──

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI GENERATION PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────┘

[User clicks sparkle "Generate" button]
         │
         ▼
  ┌──────────────────┐
  │ triggerGeneration │  sets aiGenStates → "generating" (spinner)
  │ (video)           │  POST /api/ai/content { youtubeVideoId, courseId }
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                   POST /api/ai/content (route.ts)               │
  └──────────────────────────────────────────────────────────────────┘
           │
           ▼
  ┌──────────────────┐
  │ STEP 1: Check    │
  │ existing row     │───── ready ──→ unlockForCurrentUser() → return { status: "ready", ... }
  │ AIContent table  │───── pending → return { status: "pending" }
  │ by youtubeVideoId│───── failed  → if attempts≥3: return { failed, "max_attempts" }
  └────────┬─────────┘               if attempts<3: fall through to Step 2
           │ no row or retry
           ▼
  ┌──────────────────┐
  │ STEP 2: Claim    │
  │ generation       │
  └────────┬─────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  ┌────────┐ ┌──────────────────┐
  │ INSERT │ │ updateMany WHERE │  ← optimistic lock on retry
  │ new row│ │ id + status:"failed"│
  │        │ │ if count===0 →    │
  │ P2002? │ │   another won     │
  │ → lose │ │   return "pending"│
  └───┬────┘ └────────┬─────────┘
      │               │
      └───────┬───────┘
              │ (winner)
              ▼
  ┌──────────────────────┐
  │ getTranscript(id)    │
  │ (youtube-transcript- │
  │  plus)               │
  └──────────┬───────────┘
             │
        ┌────┴────┐
        │         │
        ▼         ▼
  ┌──────────┐ ┌──────────────────┐
  │ success  │ │ failure → update │
  │ Continue │ │ AIContent →      │
  └────┬─────┘ │ status:"failed"  │
       │       │ attempts: inc    │
       ▼       └──────────────────┘
  ┌──────────────────────┐
  │ Truncate transcript  │  TEMPORARY: 20,000 chars
  │ to 20,000 chars      │  (Vercel Hobby 60s timeout)
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ geminiProvider       │
  │ .generateNotes(      │
  │   truncatedTranscript│
  │ )                    │
  └──────────┬───────────┘
             │
        ┌────┴────┐
        │         │
        ▼         ▼
  ┌──────────┐ ┌──────────────────┐
  │ success  │ │ failure → update │
  │          │ │ AIContent →      │
  │ summary  │ │ status:"failed"  │
  │ ={hook,  │ │ attempts: inc    │
  │ keyPoints}│ └──────────────────┘
  │ quiz     │
  │ =questions│
  └────┬─────┘
       │
       ▼
  ┌──────────────────────────────┐
  │ Update AIContent row:        │
  │ status="ready"               │
  │ summary=JSON.stringify(...)  │  ← stored as JSON string in @db.Text
  │ quiz={...}                   │
  │ attempts: inc + 1            │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌──────────────────────────────┐
  │ unlockForCurrentUser()       │
  │ stamps Video row with        │
  │ aiContentUnlockedAt = now()  │
  │ (pins via courseId)          │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌──────────────────────────────┐
  │ Return { status: "ready",   │
  │   summary, quiz } to client  │
  └──────────────────────────────┘

[Client receives response]
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  ┌───────┐ ┌──────────┐
  │ ready │ │ pending  │  ← start polling (2s, max 15)
  │ → open│ └────┬─────┘
  │ modal │      │
  └───────┘      ▼
           ┌──────────────────┐
           │ Poll: re-POST    │
           │ every 2s         │
           │ (includes        │
           │  courseId)       │
           └────────┬─────────┘
                    │
           ┌────────┴────────┐
           │                 │
           ▼                 ▼
     ┌──────────┐    ┌──────────────┐
     │ ready    │    │ 15 attempts  │
     │ → open   │    │ exceeded →   │
     │ modal    │    │ status:"failed"│
     └──────────┘    └──────────────┘

[Opening AI Content Modal]
         │
         ▼
  ┌───────────────────────────────┐
  │ handleOpenAiContent(video)   │
  └───────────────┬───────────────┘
                  │
            ┌─────┴─────┐
            │           │
            ▼           ▼
     ┌───────────┐ ┌─────────────────┐
     │ Cached    │ │ No cache →      │
     │ summary+  │ │ GET /api/videos  │
     │ quiz in   │ │ /[id]/ai-content │
     │ aiGenStates│ └────────┬────────┘
     │ → use it  │          │
     └─────┬─────┘     ┌────┴────┐
           │           │         │
           │           ▼         ▼
           │     ┌─────────┐ ┌──────────┐
           │     │ summary │ │needs     │
           │     │ + quiz  │ │Regen.   │
           │     │ → show  │ │ → reset  │
           │     │ modal   │ │ aiGen    │
           │     └─────────┘ │ States   │
           │                 │ → show   │
           │                 │ Generate │
           ▼                 │ button   │
     ┌────────────────┐      └──────────┘
     │ AIContentModal │
     │  - Summary tab │
     │    (hook +     │
     │     keyPoints) │
     │  - Quiz tab    │
     │    (clickable  │
     │     options)   │
     └────────────────┘

---
Concurrency Design:
```
Request A ──► INSERT AIContent ──► success (winner) ──► generates
Request B ──► INSERT AIContent ──► P2002     ──► returns "pending"
                                                  (reads winner's row)
The @unique constraint on youtubeVideoId is the lock.
```
```

### ── 5.5 Delete Course ──

```
[User clicks "Delete course" button]
         │
         ▼
  ┌───────────────────┐
  │ Confirmation Modal│
  │ "This will delete │
  │  {title} and all  │
  │  {N} videos..."   │
  └────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  ┌──────┐ ┌──────────────────┐
  │Cancel│ │ DELETE /api      │
  │close │ │ /courses/[id]    │
  │modal │ │ → ownership      │
  └──────┘ │   check          │
           │ → cascade delete │
           │   (Course→Videos │
           │    →Notes)       │
           │ → AIContent      │
           │   preserved      │
           │   (shared)       │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │ router.push(     │
           │   "/dashboard")  │
           └──────────────────┘
```

### ── 5.6 Sidebar Stats Real-Time Update ──

```
[User marks video completed on course page]
         │
         ▼
  PATCH /api/videos/[id]
         │
         ▼
  .then() dispatchEvent("refresh-stats")
         │
         ▼
  Sidebar.tsx EventListener fires fetchStats()
         │
         ▼
  GET /api/stats/weekly  (3 parallel Prisma queries)
         │
         ├─► Videos completed this week (count + duration)
         ├─► Total completed (all-time)
         └─► Total video count
         │
         ▼
  setWeeklyStats(data) → re-render progress circle
```

## 6. System Flows

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

### AI Content Generation Flow
```
[User clicks "Generate Notes" on a video]
       │
       ▼
[CourseContent] POST /api/ai/content { youtubeVideoId }
       │
       ▼
[API Route] Step 1 — Check AIContent table for existing row
       │
       ├─► ready  → return { status: "ready", summary, quiz }
       ├─► pending → return { status: "pending" }
       ├─► failed (≥3 attempts) → return { status: "failed", reason: "max_attempts" }
       └─► failed (<3) or no row → fall through to Step 2
              │
              ▼
       [API Route] Step 2 — Claim generation
              │
              ├─► INSERT into AIContent (status: "pending")
              │   └─► If P2002 (race lost) → return { status: "pending" }
              │
              └─► Winner proceeds:
                   ├─► getTranscript(youtubeVideoId)
                   ├─► geminiProvider.generateNotes(transcript)
                   └─► Update row → "ready" (success) or "failed" (failure)
                          │
                          ▼
                   return { status, summary, quiz, reason }

[Client-side polling]
       │
       ├─► "pending" → poll every 2s (re-POST /api/ai/content)
       ├─► "ready"   → open AIContentModal with summary + quiz
       └─► "failed"  → show error state on button (user can retry)
```

## 6. Key CLI Commands

- `npx prisma db push` — Synchronizes schema changes with Neon PostgreSQL.
- `npx prisma generate` — Generates TypeScript bindings for `@prisma/client`.
- `npx prisma studio` — Interactive local admin dashboard for browsing database records.
- `npm run dev` — Starts Next.js dev server on `localhost:3000`.
- `npx tsc --noEmit` — TypeScript type-check without emitting files.
