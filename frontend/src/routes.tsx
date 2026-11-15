import { Outlet, ScrollRestoration, redirect, useLoaderData, useLocation, useNavigation, type LoaderFunctionArgs, type RouteObject } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import ProtectedLayout from "@/components/auth/ProtectedLayout";
import LayoutShell from "@/components/layout/LayoutShell";
import { LoadingPage, NotFoundPage, RouteError } from "@/components/layout/RouteFeedback";
import { backendFetch, getSession, loadCourse } from "@/lib/backend";

export async function sessionLoader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.signal);
  const pathname = new URL(request.url).pathname.replace(/\/$/, "") || "/";
  const publicPage = pathname === "/" || pathname === "/sign-in";
  if (session && publicPage) throw redirect("/dashboard");
  if (!session && /^\/(dashboard|courses|study-library|settings|learning|notes)(\/|$)/.test(pathname)) {
    throw redirect("/sign-in");
  }
  return session;
}

export async function courseLoader({ params, request }: LoaderFunctionArgs) {
  return loadCourse(params.id!, request.signal);
}

export async function dashboardLoader({ request }: LoaderFunctionArgs) {
  const response = await backendFetch("/api/stats/learning", request.signal);
  if (response.status === 401) throw redirect("/sign-in");
  if (!response.ok) throw new Error("Unable to load dashboard");
  const data = await response.json();
  if (typeof data.totalPlaylists !== "number") throw new Error("Invalid learning statistics");
  return data.totalPlaylists as number;
}

export async function legacyCourseLoader({ params, request }: LoaderFunctionArgs) {
  await loadCourse(params.courseId!, request.signal);
  throw redirect(`/study-library?courseId=${encodeURIComponent(params.courseId!)}`);
}

function Root() {
  const session = useLoaderData<typeof sessionLoader>();
  const navigation = useNavigation();
  const { pathname } = useLocation();
  return <AuthProvider session={session}>
    <title>{pathname === "/study-library" ? "Study Library · FocusTube" : "FocusTube — Learn from YouTube Playlists"}</title>
    <LayoutShell>
      {navigation.state !== "idle" && <p role="status" className="px-6 pt-3 text-sm text-gray-500">Loading page…</p>}
      <Outlet />
    </LayoutShell>
    <ScrollRestoration />
  </AuthProvider>;
}

export const routes: RouteObject[] = [{
  id: "root",
  path: "/",
  loader: sessionLoader,
  shouldRevalidate: () => true,
  Component: Root,
  ErrorBoundary: RouteError,
  HydrateFallback: LoadingPage,
  children: [
    { index: true, lazy: async () => ({ Component: (await import("./pages/HomePage")).default }) },
    { path: "sign-in", lazy: async () => ({ Component: (await import("./pages/SignInPage")).default }) },
    { Component: ProtectedLayout, ErrorBoundary: RouteError, children: [
      { path: "dashboard", loader: dashboardLoader, lazy: async () => ({ Component: (await import("./pages/DashboardPage")).default }) },
      { path: "courses", lazy: async () => ({ Component: (await import("./pages/CoursesPage")).default }) },
      { path: "courses/:id", loader: courseLoader, lazy: async () => ({ Component: (await import("./pages/CoursePage")).default }) },
      { path: "study-library", lazy: async () => ({ Component: (await import("./pages/StudyLibraryPage")).default }) },
      { path: "settings", lazy: async () => ({ Component: (await import("./components/settings/SettingsPage")).default }) },
      { path: "learning", loader: () => redirect("/study-library"), Component: LoadingPage },
      { path: "notes", loader: () => redirect("/study-library"), Component: LoadingPage },
      { path: "learning/:courseId", loader: legacyCourseLoader, Component: LoadingPage },
      { path: "notes/:courseId", loader: legacyCourseLoader, Component: LoadingPage },
    ] },
    { path: "*", Component: NotFoundPage },
  ],
}];
