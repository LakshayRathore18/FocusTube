import { handlers } from "@/auth";

/**
 * Next.js 15 Route Handler for NextAuth v5.
 *
 * `handlers` is an object with { GET, POST } already created by NextAuth.
 * We just re-export them — no manual request forwarding needed.
 *
 * Captures all auth routes:
 *   GET  /api/auth/session
 *   GET  /api/auth/csrf
 *   GET  /api/auth/signin
 *   GET  /api/auth/callback/google
 *   POST /api/auth/signin/google
 *   POST /api/auth/signout
 */
export const { GET, POST } = handlers;
