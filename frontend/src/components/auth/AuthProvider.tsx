"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@/lib/auth-types";

type AuthState = {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
};

const AuthContext = createContext<AuthState>({ data: null, status: "loading" });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthState>({ data: null, status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
    })
      .then(async (response) => {
        if (response.status === 401) return { data: null, status: "unauthenticated" } as AuthState;
        if (!response.ok) throw new Error("Session service unavailable");
        return { data: await response.json(), status: "authenticated" } as AuthState;
      })
      .then(setAuth)
      .catch(() => {
        if (!controller.signal.aborted) setAuth({ data: null, status: "error" });
      });
    return () => controller.abort();
  }, [pathname]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useSession() {
  return useContext(AuthContext);
}

export function signIn() {
  window.location.assign("/api/auth/google");
}

export async function signOut(options?: { callbackUrl?: string }) {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Sign out failed");
    window.location.assign(options?.callbackUrl ?? "/sign-in");
  } catch {
    window.alert("Unable to sign out. Please try again.");
  }
}
