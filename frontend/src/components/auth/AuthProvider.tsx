import { createContext, useContext } from "react";
import type { Session } from "@/lib/auth-types";

type AuthState = {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
};
const AuthContext = createContext<AuthState>({ data: null, status: "loading" });

/** The root route reloads the server session on each navigation/revalidation. */
export function AuthProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return <AuthContext.Provider value={{ data: session, status: session ? "authenticated" : "unauthenticated" }}>{children}</AuthContext.Provider>;
}

export function useSession() {
  return useContext(AuthContext);
}

export function signIn() {
  window.location.assign("/api/auth/google");
}

export async function signOut(options?: { callbackUrl?: string }) {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Sign out failed");
    window.location.assign(options?.callbackUrl ?? "/sign-in");
  } catch {
    window.alert("Unable to sign out. Please try again.");
  }
}
