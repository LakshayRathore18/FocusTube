import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "./auth-types";

export async function backendFetch(path: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("focustube_session");
  try {
    return await fetch(`${process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}${path}`, {
      headers: token ? { Cookie: `focustube_session=${token.value}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("The service is unavailable. Please try again shortly.");
  }
}

export const getSession = cache(async (): Promise<Session | null> => {
  const response = await backendFetch("/api/auth/session");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("The service is unavailable. Please try again shortly.");
  return response.json();
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
