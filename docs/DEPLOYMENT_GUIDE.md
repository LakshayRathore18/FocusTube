# Preserve the live site while testing FastAPI and RAG

Reviewed 2026-11-05. This is a deployment plan, not a completed deployment. No branch was created, files staged, commit made, push performed or hosting settings changed during this review.

## What was checked

| Item | Finding |
| --- | --- |
| GitHub repository | `LakshayRathore18/FocusTube` |
| Current local branch | `main` |
| Local HEAD and GitHub main | Both `3ade797d5ac638e8bb9992c8a2bcf87f90fbea3f` (`refactor code`) |
| Committed code at that revision | Original Next.js app at repository root, with Auth.js/Prisma; no FastAPI migration committed |
| New implementation | Still local, uncommitted changes, including the move to `frontend/` and addition of `backend/` |
| Secret handling | Active/legacy backend env files, frontend local env, model cache and dependencies are ignored |
| Extra secret check | No copies of configured active secret values found in 135 Git-eligible text files. This is not a full historical credential audit. |
| Deployment files | No `render.yaml` or `vercel.json` in the working tree |
| Hosting dashboards | Not inspected. The old Vercel project's actual production branch, deployed commit, domains and environment settings still need a dashboard check. |

The many deleted root `src/`, `public/` and configuration files in Git status are part of the previous reorganization. Their replacements are currently untracked in `frontend/` and other folders. The eventual commit must include the complete migration, not just the new backend.

## The recommended arrangement

Keep the existing Vercel project and its database intact. Use the same GitHub repository with a new branch, a **new Vercel frontend project**, and a **new Render backend service**.

```text
main                         Original Next.js code
  -> existing Vercel project -> existing website and original database

feature/fastapi-rag           New frontend + FastAPI + RAG
  -> NEW Vercel project      -> separate test website URL
  -> NEW Render web service  -> FastAPI + local MiniLM
  -> new FastAPI Neon DB     -> independent of the original database
```

A branch separates code. Separate hosting projects, URLs, environment settings and databases separate the running applications. Vercel supports multiple projects from one repository. [Vercel monorepo documentation](https://vercel.com/docs/monorepos).

If you want absolutely no new deployment activity in the old Vercel project, a separate GitHub repository is another option: the existing integration may automatically create preview builds for a new branch in the same repository. Those previews are separate from production when the production branch is configured correctly. [Vercel Git deployment behavior](https://vercel.com/docs/git).

## 1. Check the live Vercel project first

In the **existing** Vercel project, read and record:

- The production branch. This plan assumes it is `main`; verify it.
- The source commit of the currently live deployment. Do not assume it is the latest GitHub commit.
- The current project name and live domain.

Leave its root directory, build/install commands, environment variables, domains and production branch unchanged. In particular, do not change the old project's root directory to `frontend/` to make a feature-branch preview pass: those are project settings, not an isolated branch configuration. [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build).

Also keep the original database and Google OAuth credentials intact. Do not put the old Prisma database URL in the new backend.

## 2. Save the new work on its own branch

The following are instructions for a later Git operation; they were **not executed** during this review. Run from the repository root. Branch names below must not already exist.

First retain a named reference to the old committed code, then move the current working changes onto a new branch:

```powershell
git branch backup/legacy-nextjs 3ade797d5ac638e8bb9992c8a2bcf87f90fbea3f
git switch -c feature/fastapi-rag
git status --short
```

Creating this branch carries your uncommitted changes with you. It does not upload or commit them. The backup points to the checked GitHub main commit; if Vercel is running a different commit, record that exact deployment commit too.

Before committing, review the full file list, including old file removals, moved files, user-authored documents and `.vscode/` settings. Confirm ignored secrets remain ignored:

```powershell
git check-ignore backend/.env backend/.env.legacy.local frontend/.env.local backend/.cache/embeddings
```

After that review, save and upload the complete intended snapshot:

```powershell
git add -A
git diff --cached --stat
git diff --cached --name-only
```

Inspect the staged changes before continuing. Actual `.env` files, secrets, dependencies, model weights and temporary preview screenshots must not be staged. Commit only when the staged snapshot is correct:

```powershell
git commit -m "Move backend to FastAPI and add video RAG"
git push -u origin feature/fastapi-rag
git push origin backup/legacy-nextjs
```

Both pushes name their destination branch explicitly. Do not push the migration to `main`, merge a PR into `main`, force-push, or change the repository default branch during the trial.

The original Vercel integration may try to preview the new branch using the old project settings. A failed preview is not a reason to repurpose the existing project. Check the deployment's environment and source branch; keep testing in the new project. Production follows the project's configured production branch. [Vercel production and preview branches](https://vercel.com/docs/git#production-branch).

## 3. Set up the new Render backend

Create a new Python web service from `feature/fastapi-rag`, with root directory **`backend`**. Start with manual deployments while verifying the service.

| Setting | Value |
| --- | --- |
| Branch | `feature/fastapi-rag` |
| Root directory | `backend` |
| Build command | `uv sync --frozen --no-dev && uv run --no-sync python -m scripts.setup_embeddings` |
| Start command | `uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log` |
| Health path | `/api/health` |
| Python version | Set `PYTHON_VERSION=3.13.13` to match the local tested interpreter rather than relying on a changing default. Linux wheels/inference still need deployment verification. |

Render detects uv through the `uv.lock` in the service root. The start command uses Render's assigned port. This is a Linux deployment: do not copy the local Windows event-loop override or `--reload`. [Render uv support](https://render.com/docs/uv-version), [Python version configuration](https://render.com/docs/python-version), [FastAPI deployment](https://render.com/docs/deploy-fastapi).

Configure environment values in the **new Render service**, before its build:

- `DATABASE_URL`: the separate FastAPI Neon database, using the existing psycopg URL format.
- `AUTH_SECRET`: a new random secret of at least 32 characters for this new deployment.
- `FRONTEND_ORIGIN`: the exact stable HTTPS URL of the new frontend, without a path.
- `COOKIE_SECURE=true`.
- Google OAuth client ID/secret for the new site, plus YouTube, Supadata and Gemini keys.
- `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`: the configured models you have verified.
- `RAG_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2`.
- Initially `RAG_ENABLED=false`; enable after backend/model/database checks pass.

The model is downloaded at build time into the ignored cache and packaged with this deployment. Runtime requests only read cached weights. Never upload your local `.venv`, `.env`, legacy env or model cache to GitHub.

Confirm the target in Neon and the Render environment before any migration. The currently selected FastAPI database was already migrated to `0003` in the implementation session. Check it rather than repeating database setup blindly. If a genuinely new database is selected, apply the existing non-destructive Alembic migrations only after confirming its identity. No reset, drop or old-database migration is part of this plan.

The local database safety check compares against an ignored legacy reference. That file is not present on Render, so its absence is not proof that a Render URL is safe. Confirm the Neon project/database identity directly; do not upload the legacy env to Render.

## 4. Set up the new frontend

Create a **new Vercel project**, for example `focustube-rag-test`. Keep the existing project untouched.

- Track `feature/fastapi-rag` as the **new project's** production branch. Verify the source branch/commit on its deployment.
- Select Next.js and root directory `frontend`.
- Keep the repository-root npm workspace and single `package-lock.json` available to the install/build. Enable inclusion of files outside the app root if that option is shown. Inspect the first build log to confirm workspace installation and `frontend/.next` output; monorepo settings are not yet verified in Vercel.
- Use `npm run build` for the frontend workspace with Next.js output defaults. The frontend's script is `next build`.
- Use a supported Node 22 runtime; the local checked interpreter was Node `22.13.1`. Do not require that old patch when the host provides an updated supported patch.
- Set `BACKEND_URL=https://YOUR-NEW-API.onrender.com` in the new project's environment before building. This server-only value configures rewrites and server fetches; changing it requires a redeploy.
- Do not copy database/provider credentials into frontend environment variables.
- Use a stable new project URL for login testing, not a different random URL for every commit.

The frontend already proxies browser `/api/*` traffic to FastAPI. Keep that routing: the browser should log in at the frontend host, and the session cookies remain on that host. Pointing browser login directly at the Render host would change the cookie flow. Actual proxy/cookie behavior must be tested after deployment.

For clean isolation, create a separate Google OAuth client for the new deployment, with this redirect URI:

```text
https://YOUR-NEW-FRONTEND.vercel.app/api/auth/callback/google
```

This is the callback configured by our FastAPI source. Leave the old site's OAuth client/redirects unchanged. New accounts/course data are in the new database; the original site's user data is not automatically migrated.

## 5. Verify before calling it successful

Test the new URL and the old URL separately:

1. New API health and database readiness respond successfully; deployed revision/models are correct.
2. New Google login, refresh, logout and logged-out access work through the frontend URL.
3. Course import, playback/progress and personal notes work.
4. AI notes/quiz generation and progress indicators work.
5. Model weights load without a runtime download; prepare chat, ask a relevant question and check its sources.
6. Ask an unrelated question, test a follow-up and reopen chat.
7. Restart the Render service and confirm database data/indexes persist and cached model weights still load.
8. Test after idle spin-down, and watch peak memory during transcript preparation.
9. Verify the original Vercel URL still uses its original deployment/login/database.

Prior local checks passed: 122 mocked-provider/SQLite backend tests, seven frontend tests, typecheck and production build. Frontend lint has eight existing errors and twelve warnings. Separate earlier PostgreSQL checks covered selected migrations/vector/concurrency behavior. These results do not establish hosted OAuth, cookies, Linux memory or provider latency.

## Free-tier limits that matter here

Render Free web services have 512 MB RAM and 0.1 CPU. MiniLM is a smaller candidate than the prior BGE model, but the whole Python process must fit; no Render measurement has been done. One worker avoids loading another model copy. [Render compute plans](https://render.com/docs/compute-plans).

Free services sleep after 15 minutes without traffic and can take about a minute to wake. Our server/client session fetches currently time out after 10 seconds, so a cold backend can make the first page/session request fail. Warming `/api/health` and retrying is a test workaround; the user-facing cold-start behavior needs verification or improvement before a reliable launch. Free runtime filesystem writes are lost on restarts/spin-down. Keep data in Neon and model weights in the build artifact. [Render free service limits](https://render.com/docs/free).

Vercel's external rewrite timeout is currently 120 seconds. Our generation/preparation deadlines are 90 seconds, but cold-start overhead can still consume the request budget. This needs a hosted test. [Vercel proxy limits](https://vercel.com/docs/limits#proxied-request-timeout).

If you prefer **both frontend and backend on Render**, use two separate web services. Next.js needs a Node web service because this app uses server auth and rewrites; a static site is not a drop-in replacement. From the repository root the frontend build is `npm ci && npm run build`, and its start is `npm run start -- --hostname 0.0.0.0 --port $PORT`. Keep the Python service rooted at `backend`. Both services share the workspace's 750 monthly free instance hours. Two services also expose the frontend to a second cold start. [Render free instance hours](https://render.com/docs/free#free-instance-hours).

## If the new deployment fails

Keep using the original Vercel URL. If its branch/project/domain/database were left intact, there is no live-site change to undo.

Keep the new branch so work is not lost. Fix and redeploy only the new services, or stop using them. `RAG_ENABLED=false` disables chat in the new backend without removing its data. Do not wipe the database or delete the branch to roll back a deployment.

For local access to the original code, commit/save the new branch first and then use a separate clone or worktree. Do not switch the current dirty tree back to the legacy code: uncommitted changes follow you across branches or can block switching. A Git branch switch also does not roll back database contents or environment files.

Do not merge into `main` or move the old domain until the new deployment passes acceptance and you intentionally choose a cutover. That future cutover needs its own domain/settings/database plan.
