# FocusTube

A distraction-free YouTube study platform. Paste a playlist URL → get a structured course → watch videos inside the app → take notes and get AI-generated summaries and quizzes per video.

## Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL on Neon (free tier) via Prisma 7
- **Auth**: NextAuth / Auth.js v5 — Google OAuth, JWT sessions
- **AI**: Google Gemini API
- **Deploy**: Vercel Hobby

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/LakshayRathore18/FocusTube.git
cd FocusTube
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` — see `.env.example` for the full list.

### 3. Push database schema

```bash
npx prisma db push
npx prisma generate
```

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

See [`agent.md`](./agent.md) for a full map of every file and the current architecture.
See [`todo.md`](./todo.md) for build progress and design decisions.

## Environment Variables

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → your project → connection string |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
