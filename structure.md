# FocusTube — Project Structure & Database Map (structure.md)

This document is a comprehensive guide for developers (humans) to understand the architecture, file structure, database schema, and operational patterns of the FocusTube study platform.

---

## 1. Project Overview & Current State

FocusTube is a study platform built with Next.js 16, Prisma 7, Tailwind v4, and NextAuth v5.

- **Completed**: Next.js 16 scaffolding, Prisma schema pushed to Neon, Google-based OAuth authentication (NextAuth v5 + JWT session strategy), and route protection via Next.js 16 Proxy.
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
│   │   ├── api/auth/[...nextauth]/
│   │   │   └── route.ts       ← NextAuth v5 GET/POST exports
│   │   ├── sign-in/
│   │   │   └── page.tsx       ← Server Action-based Google sign-in page
│   │   ├── favicon.ico        ← Default Next.js favicon
│   │   ├── globals.css        ← Tailwind v4 import + CSS variables (bg/fg colours)
│   │   ├── layout.tsx         ← Root HTML shell: Navbar + children, wraps with SessionProvider
│   │   └── page.tsx           ← Default Next.js boilerplate landing page (to be replaced)
│   ├── components/
│   │   ├── AuthButton.tsx     ← Client Component: toggles drop-down, displays user avatar/sign out
│   │   └── Navbar.tsx         ← Client-side Navbar wrapping AuthButton
│   ├── lib/
│   │   └── db.ts              ← Prisma client singleton with PrismaPg driver adapter
│   ├── auth.ts                ← NextAuth v5 Config (adapter, Google provider, JWT callbacks)
│   └── proxy.ts               ← Next.js 16 Route protection Proxy (replaces middleware.ts)
├── .env.example               ← Safe-to-commit template with empty values
├── .env.local                 ← Actual secrets — NEVER commit (gitignored)
├── .gitignore                 ← Ignores node_modules/, .next/, .env.local
├── AGENTS.md                  ← Warnings/rules for AI assistants
├── CLAUDE.md                  ← Quick link to AGENTS.md
├── agent.md                   ← High-density context for AI agents
├── eslint.config.mjs          ← ESLint flat config
├── next-env.d.ts              ← Auto-generated Next.js types
├── next.config.ts             ← Empty Next.js config (no custom settings yet)
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

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### `src/app/layout.tsx`
The primary HTML skeleton of the app.
- Imports standard font variables.
- Wraps the entire layout with a NextAuth `SessionProvider` so components can call `useSession()`.
- Renders the custom global `<Navbar />`.

### `src/app/page.tsx`
The root landing page (`/`). It will be customized to present the project dashboard/splash page.

### `src/app/globals.css`
Tailwind CSS v4 entry point. Configures native CSS variables and themes inside `@theme inline` (replacing the legacy `tailwind.config.js` or `tailwind.config.ts`).

### `src/proxy.ts`
Custom proxy implementation that runs authentication checks and route protection in Next.js 16, replacing traditional Next.js middleware.

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
[src/proxy.ts] (Checks JWT cookie via auth())
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

---

## 6. Key CLI Commands

- `npx prisma db push` — Synchronizes schema changes with Neon PostgreSQL.
- `npx prisma generate` — Generates TypeScript bindings for `@prisma/client`.
- `npx prisma studio` — Interactive local admin dashboard for browsing database records.
