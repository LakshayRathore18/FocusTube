# FocusTube — AI Agent Map (agent.md)

> **PURPOSE**: Read this to understand the project structure, status, and constraints.
> **DO NOT DUPLICATE IMPLEMENTATION DETAILS**: To check database schemas or code implementation details, read the files directly using your tools rather than relying on cached explanations here.
> **HUMAN GUIDE**: Detailed human documentation is in [structure.md](file:///c:/CODING/WebDev/focustube/structure.md).

---

## 1. Project Overview & Current State

FocusTube is a video-based study platform where users import YouTube playlists as courses, take notes, and interact with AI-generated quizzes and transcripts.

- **Stack**: Next.js 16 (Turbopack), Tailwind v4 (CSS-native config), Prisma 7, PostgreSQL (Neon), NextAuth v5 (Google OAuth, JWT session).
- **Status**: Scaffold complete. OAuth, route protection (proxy.ts), and database connectivity (with Prisma Client singleton setup) are implemented and functional.
- **Current Task List**: Look at [todo.md](file:///c:/CODING/WebDev/focustube/todo.md) for what needs to be built next.

---

## 2. Directory Map (Core Files Only)

- [prisma/schema.prisma](file:///c:/CODING/WebDev/focustube/prisma/schema.prisma) — Database schema definition (6 models).
- [prisma.config.ts](file:///c:/CODING/WebDev/focustube/prisma.config.ts) — Prisma 7 configuration file.
- [src/auth.ts](file:///c:/CODING/WebDev/focustube/src/auth.ts) — NextAuth v5 configuration.
- [src/proxy.ts](file:///c:/CODING/WebDev/focustube/src/proxy.ts) — Route protection proxy (Next.js 16 convention).
- [src/lib/db.ts](file:///c:/CODING/WebDev/focustube/src/lib/db.ts) — Prisma Client database singleton.
- [src/components/Navbar.tsx](file:///c:/CODING/WebDev/focustube/src/components/Navbar.tsx) & [AuthButton.tsx](file:///c:/CODING/WebDev/focustube/src/components/AuthButton.tsx) — Auth navbar controls.

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
- **Route Protection**: Managed via the custom [proxy.ts](file:///c:/CODING/WebDev/focustube/src/proxy.ts) file.

### Note Authorization Pattern
- Never trust request-supplied entity IDs directly without ownership verification. Ensure the entity ownership resolves back to the session user:
  ```ts
  const video = await db.video.findFirst({
    where: { id: videoId, course: { userId: session.user.id } }
  });
  ```

---

## 5. What Does NOT Exist Yet

- Course dashboard, play, and detail pages (`/courses/[courseId]`, `/courses/[courseId]/videos/[videoId]`, `/dashboard`).
- YouTube Playlist import client and APIs.
- AI processing/generation pipelines (transcripts, summaries, quizzes) using Gemini.
- Notes management and search index/APIs.
