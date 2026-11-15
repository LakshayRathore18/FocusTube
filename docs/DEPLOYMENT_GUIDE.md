# Hosting FocusTube

The React frontend runs on Vercel. FastAPI runs separately at `https://focustube-api.onrender.com`. PostgreSQL and provider credentials belong only to the backend.

## Vercel configuration

The repository-root `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `frontend/dist` |
| API forwarding | `/api/*` to the existing Render service |
| Frontend routes | Fallback to `/index.html` |

In the existing project's Settings → Build and Deployment, leave Root Directory empty for the repository root, choose Vite and use Node.js 22.x. Clear conflicting dashboard overrides. The config uses the existing Render URL directly; a Vercel `BACKEND_URL` variable is not used. Change the rewrite destination and redeploy if the backend host changes.

Use the production branch selected in Vercel's Git settings. Deploy the intended new commit rather than redeploying an older revision. Keep existing domains and secrets unless intentionally changing the deployment.

## Backend and login

Render's `FRONTEND_ORIGIN` must exactly match the production frontend origin, without a trailing slash. Set `COOKIE_SECURE=true` for HTTPS. Keep database/provider settings and the auth secret on Render.

Google OAuth's authorized redirect URI must be:

```text
https://YOUR-FRONTEND-HOST/api/auth/callback/google
```

When retaining the same frontend domain, its existing origin and callback settings can stay. Login and API calls go through the frontend host so application cookies remain same-origin. Preview URLs need deliberate origin/OAuth configuration before authenticated testing.

API proxying precedes the SPA fallback and API responses use `Cache-Control: no-store`. Allow long AI requests within the host's supported proxy timeout. Cold backend starts may exceed the browser's ten-second session timeout; retry after the backend wakes. Never put secrets in browser-visible `VITE_` variables.

## Verification

From the repository root:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
node frontend/scripts/check-vercel.mjs
node frontend/scripts/check-proxy.mjs
```

Local checks cover build output, deployment settings, assets and forwarding behavior with a mock backend. They do not establish hosted OAuth, live provider behavior or browser playback. After Vercel is Ready, check frontend `/api/health`, Google login/logout, a refreshed course deep link, the brand favicon, notes, playback progress and AI resources.

`npm.cmd run start` is local Vite preview, not a production server. Render needs no code redeployment when only frontend files change. Never reset or recreate the database as part of frontend deployment.

If a deployment fails, use Vercel's earlier deployment/rollback controls and fix the frontend configuration. Preserve backend data and existing secrets.

References: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
