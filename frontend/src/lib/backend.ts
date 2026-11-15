import { redirect } from "react-router-dom";
import type { Session } from "./auth-types";

/** Browser requests keep HttpOnly session cookies on the same origin. */
export async function backendFetch(path: string, signal?: AbortSignal) {
  try {
    return await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The service is unavailable. Please try again shortly.");
  }
}

export async function getSession(signal?: AbortSignal): Promise<Session | null> {
  const response = await backendFetch("/api/auth/session", signal);
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("The service is unavailable. Please try again shortly.");
  return response.json();
}

export async function loadCourse(id: string, signal?: AbortSignal) {
  const response = await backendFetch(`/api/courses/${encodeURIComponent(id)}`, signal);
  if (response.status === 401) throw redirect("/sign-in");
  if (response.status === 403 || response.status === 404) {
    throw new Response(null, { status: 404 });
  }
  if (!response.ok) throw new Error("Unable to load course");
  return response.json();
}
