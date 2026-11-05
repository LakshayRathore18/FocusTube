# FocusTube frontend

Next.js 16, React 19, TypeScript, Tailwind CSS, and Tiptap. This application owns pages and UI; authentication, data access, and provider calls are handled by FastAPI.

Install with `npm.cmd ci` from the repository root. Keep frontend settings in `.env.local`, next to this README; copy `.env.example` only for a new configuration. Never place database URLs or provider keys here.

Run these commands from the repository root:

```powershell
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run start
```

`src/app/` contains route pages/layouts, `src/components/` groups UI by domain, and `src/lib/` holds API/auth helpers and utilities. `public/` contains static assets. Generated Next.js output stays in `.next/` and is ignored.

The `@/*` alias resolves to `src/*`. Browser requests use same-origin `/api/*`; `next.config.ts` forwards them to `BACKEND_URL` (default `http://127.0.0.1:8000`). The cookie/callback origin remains `http://localhost:3000`.

Video Chat is available in the course learning hub/workspace when the backend capability enables it. It requires no summary. Conversation state stays in memory; closing the workspace or switching videos clears it. Vitest interaction tests live in `tests/`. See [the simple RAG guide](../docs/RAG_GUIDE.md).

See [development](../docs/DEVELOPMENT.md), [project structure](../docs/PROJECT_STRUCTURE.md), and [API contracts](../docs/API.md).
