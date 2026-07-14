import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Proxy — Next.js 16 replacement for middleware.
 *
 * Uses NextAuth v5's `auth()` helper to read the session JWT.
 *
 * Protected: /dashboard, /courses
 * Redirect target: /sign-in
 */
export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  const protectedPaths = ["/dashboard", "/courses"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Run proxy only on dashboard and courses paths
  matcher: ["/dashboard/:path*", "/courses/:path*"],
};
