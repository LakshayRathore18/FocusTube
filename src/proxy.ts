import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Proxy — Next.js route protection.
 *
 * Uses NextAuth v5's `auth()` helper to read the session JWT.
 *
 * Protected: /dashboard, /courses, /notes, /settings
 * Redirect target: /sign-in
 *
 * Also redirects authenticated users from / → /dashboard so the
 * landing page never shows for signed-in users.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Signed-in users on the landing page → redirect to dashboard
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  const protectedPaths = ["/dashboard", "/courses", "/learning", "/settings"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/dashboard/:path*", "/courses/:path*", "/learning/:path*", "/settings/:path*"],
};