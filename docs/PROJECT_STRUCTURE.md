# Project structure

FocusTube is a repository containing two applications. Next.js owns presentation and browser navigation; FastAPI owns identity, authorization, database access, and external providers.

```text
focustube/
|-- frontend/
|   |-- src/
|   |   |-- app/                  App Router pages, layouts, global styles
|   |   |-- components/
|   |   |   |-- auth/             Session provider and protected layout
|   |   |   |-- course/           Course/video UI and AI content modals
|   |   |   |-- dashboard/        Dashboard and first-time experience
|   |   |   |-- layout/           Navbar, sidebar, and application shell
|   |   |   |-- learning/         Learning hub and workspace
|   |   |   |-- notes/            Rich text editor and note library
|   |   |   |-- search/           Search overlay
|   |   |   |-- settings/         Settings UI
|   |   |   `-- shared/           Reused UI such as the quiz player
|   |   `-- lib/                  Backend fetch helpers, auth types, UI utilities
|   |-- public/                   Static application assets
|   |-- .env.example              Frontend settings template
|   |-- next.config.ts            API rewrite, image hosts, workspace resolution
|   |-- tsconfig.json             TypeScript settings and @/* source alias
|   |-- eslint.config.mjs         Frontend lint rules
|   |-- postcss.config.mjs        Tailwind/PostCSS configuration
|   `-- package.json              Frontend dependencies and scripts
|-- backend/
|   |-- app/
|   |   |-- routers/              HTTP endpoints grouped by domain
|   |   |-- services/             YouTube, transcript, and Gemini adapters
|   |   |-- config.py             Validated backend environment settings
|   |   |-- database.py           Async engine/session factory
|   |   |-- dependencies.py       Session lookup and ownership enforcement
|   |   |-- main.py               App construction, middleware, health endpoints
|   |   |-- models.py             SQLAlchemy schema and constraints
|   |   |-- runtime.py            Windows-compatible database event loop
|   |   `-- schemas.py            Input validation and JSON serialization
|   |-- migrations/               Alembic environment and versioned schema changes
|   |-- scripts/                  Explicit live operational checks
|   |-- tests/                    Isolated API, auth, provider, and runtime tests
|   |-- .env.example              Backend environment template
|   |-- alembic.ini               Migration configuration
|   |-- pyproject.toml            Python dependencies and tooling
|   `-- uv.lock                   Reproducible Python dependency lock
|-- docs/
|   |-- development/              Session continuation record
|   |-- archive/                  Historical notes and retired diagnostics
|   `-- *.md                      Current guides and preserved master guide
|-- AGENTS.md                     Repository-wide agent instructions
|-- CLAUDE.md                     Pointer to the same agent instructions
|-- README.md                     Main setup entry point
|-- package.json                  npm workspace and root command shortcuts
`-- package-lock.json             Single npm dependency lock for the frontend
```

## Placement rules

Video chat uses `backend/app/routers/rag.py`, `backend/app/services/rag.py`, and `backend/app/services/rag_provider.py`. UI components are `VideoChat.tsx` and `ChatVideoPicker.tsx` under `frontend/src/components/learning/`. Frontend interaction tests live in `frontend/tests/`; run them with root `npm.cmd run test`. See [RAG explained simply](RAG_GUIDE.md) for the complete RAG file map.

- Add pages and route layouts in `frontend/src/app/`; group UI components by domain in `frontend/src/components/`.
- Keep browser code free of database and provider credentials. The browser uses same-origin `/api/*`; Next.js forwards requests to FastAPI.
- Add domain endpoints in `backend/app/routers/`, provider adapters in `backend/app/services/`, models in `models.py`, and validated request/response structures in `schemas.py`.
- Put schema changes in new Alembic versions. Do not reset either database or edit an already-applied migration to change live schema.
- Keep operational scripts explicit: unit tests must not depend on a running server, provider credentials, or the live database.
- Put shared product/development documentation under `docs/`. Preserve user-authored historical material in the archive rather than mixing it with current setup instructions.

## Local-only files

`node_modules/`, `frontend/.next/`, `frontend/next-env.d.ts`, TypeScript build info, `backend/.venv/`, and Python caches are generated and ignored. npm can hoist dependencies to root `node_modules/`; that is expected for this workspace.

`frontend/.env.local` contains frontend settings. `backend/.env` contains active backend secrets. `backend/.env.legacy.local` preserves the previous application's settings solely for archive-target safety comparison; the application does not load it. None of these files belongs in Git. The original database remains untouched.
