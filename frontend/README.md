# FocusTube frontend

React 19, Vite 8, React Router 7, TypeScript, Tailwind CSS, and Tiptap. This browser application owns pages and UI; authentication, data access, and provider calls are handled by FastAPI.

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

`src/main.tsx` mounts React, `src/routes.tsx` defines routes/loaders, `src/pages/` holds page adapters, `src/components/` groups UI by domain, and `src/lib/` holds browser API/auth helpers and utilities. `public/` contains static assets. Vite writes ignored static output to `dist/`. Geist fonts are bundled from npm; images load directly in the browser.

The `@/*` alias resolves to `src/*`. Browser requests use same-origin `/api/*`; `vite.config.ts` forwards them to `BACKEND_URL` (default `http://127.0.0.1:8000`) in development and local preview, with a 120-second timeout and sanitized proxy error logs. The cookie/callback origin remains `http://localhost:3000`; port conflicts fail instead of silently changing it. `BACKEND_URL` stays in Node configuration; `VITE_APP_VERSION` is browser-visible. Never prefix secrets with `VITE_`.

`npm.cmd run start` is a local build preview, not a production server. Production hosting must serve `dist/`, proxy `/api/*` before applying the SPA fallback to `index.html`, preserve cookies/Origin/redirects, and allow long AI requests. Vite's local proxy is not included in static output. See [deployment requirements](../docs/DEPLOYMENT_GUIDE.md).

After building, run `node frontend/scripts/check-proxy.mjs` from root to verify local dev/preview HTTP behavior against an isolated mock backend. It creates no application data and uses no providers.

Video Chat is available in the course learning hub/workspace when the backend capability enables it. It requires no summary. Conversation state stays in memory; closing the workspace or switching videos clears it. Vitest interaction tests live in `tests/`. See [the simple RAG guide](../docs/RAG_GUIDE.md).

See [development](../docs/DEVELOPMENT.md), [project structure](../docs/PROJECT_STRUCTURE.md), and [API contracts](../docs/API.md).
