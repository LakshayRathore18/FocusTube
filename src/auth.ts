import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

/**
 * NextAuth v5 (beta) — single source of truth.
 *
 * Exports:
 *   handlers → used in src/app/api/auth/[...nextauth]/route.ts
 *   auth      → used in Server Components / API routes to get the session
 *   signIn    → server-side sign-in helper
 *   signOut   → server-side sign-out helper
 *
 * Strategy: JWT — no Session table in DB. Saves free-tier Neon connections.
 * The Prisma adapter still writes User + Account rows on first Google login.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Prevents OAuthAccountNotLinked when the same email signs in via
      // different OAuth flows (e.g. re-auth after DB wipe). Safe here
      // because we only have one provider (Google).
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      // Expose the Prisma user id on the session object so API routes
      // can do ownership checks without an extra DB lookup.
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in", // redirect here instead of the default NextAuth page
  },
});
