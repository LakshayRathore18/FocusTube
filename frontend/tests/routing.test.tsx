import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "../src/routes";
import type { Course } from "../src/components/course/types";

// Keep the real route configuration, loaders, auth provider and page adapters.
vi.mock("../src/components/layout/LayoutShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("../src/components/course/CourseContent", () => ({ default: ({ course, playVideoId }: { course: Course; playVideoId?: string }) => <div><h1>{course.title}</h1><p>Playing {playVideoId}</p></div> }));
vi.mock("../src/components/study-library/StudyLibraryPage", () => ({ default: ({ initialCourseId }: { initialCourseId: string }) => <h1>Library {initialCourseId}</h1> }));
vi.mock("../src/components/settings/SettingsPage", () => ({ default: () => <h1>Account settings</h1> }));
vi.mock("../src/components/dashboard/FirstTimeExperience", () => ({ default: () => <h1>Import your first course</h1> }));
vi.mock("../src/components/dashboard/DashboardPage", () => ({ default: () => <h1>Your learning dashboard</h1> }));

const session = { user: { id: "user", name: "Learner", email: "learner@example.test", image: null } };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
let router: ReturnType<typeof createMemoryRouter>;

function open(path: string) {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => { cleanup(); router?.dispose(); vi.unstubAllGlobals(); });

test("anonymous deep links go to sign-in without rendering protected content", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 401)));
  open("/courses/private?play=video");
  await screen.findByText("Welcome to FocusTube");
  expect(router.state.location.pathname).toBe("/sign-in");
  expect(screen.queryByText("Account settings")).toBeNull();
  expect(screen.getByRole("button", { name: "Continue with Google" }).closest("form")?.getAttribute("action")).toBe("/api/auth/google");
});

test.each(["/", "/sign-in?error=oauth"])("signed-in visitors at %s go to their dashboard", async (path) => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(response(url === "/api/auth/session" ? session : { totalPlaylists: 2 }))));
  open(path);
  await screen.findByText("Your learning dashboard");
  expect(router.state.location.pathname).toBe("/dashboard");
});

test("new accounts see onboarding; dashboard failures do not look like an empty account", async () => {
  let unavailable = true;
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url === "/api/auth/session" ? response(session) : unavailable ? response({}, 503) : response({ totalPlaylists: 0 }))));
  open("/dashboard");
  await screen.findByRole("alert");
  expect(screen.queryByText("Import your first course")).toBeNull();
  unavailable = false;
  fireEvent.click(screen.getByText("Try again"));
  await screen.findByText("Import your first course");
});

test("course deep links preserve autoplay and use abortable same-origin no-store requests", async () => {
  const fetcher = vi.fn((url: string) => Promise.resolve(response(url === "/api/auth/session" ? session : { id: "course", title: "React course", videos: [] })));
  vi.stubGlobal("fetch", fetcher);
  open("/courses/course?play=lesson");
  await screen.findByRole("heading", { name: "React course" });
  expect(screen.getByText("Playing lesson")).toBeTruthy();
  const request = fetcher.mock.calls.find(([url]) => url === "/api/courses/course");
  expect(request).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/courses/course")?.[1]).toMatchObject({ cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal) });
});

test.each([403, 404])("unavailable courses (%s) render a safe not-found page", async (status) => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url === "/api/auth/session" ? response(session) : response({}, status))));
  open("/courses/private");
  await screen.findByRole("heading", { name: "Page not found" });
});

test.each(["/learning", "/notes"])("legacy %s redirects to Study Library", async (path) => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(session))));
  open(path);
  await screen.findByRole("heading", { name: "Library" });
  expect(router.state.location.pathname).toBe("/study-library");
});

test.each(["/learning/course", "/notes/course"])("legacy %s checks ownership before applying the library filter", async (path) => {
  const fetcher = vi.fn((url: string) => Promise.resolve(response(url === "/api/auth/session" ? session : { id: "course" })));
  vi.stubGlobal("fetch", fetcher);
  open(path);
  await screen.findByRole("heading", { name: "Library course" });
  expect(fetcher.mock.calls.some(([url]) => url === "/api/courses/course")).toBe(true);
  expect(router.state.location.search).toBe("?courseId=course");
});

test("session failures can be retried and are never treated as signed-out sessions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({}, 503)).mockResolvedValue(response({}, 401)));
  open("/sign-in?error=oauth");
  await screen.findByRole("alert");
  expect(screen.queryByText("Continue with Google")).toBeNull();
  fireEvent.click(screen.getByText("Try again"));
  await screen.findByText("Welcome to FocusTube");
  expect(screen.getByRole("alert").textContent).toContain("Google sign-in was cancelled");
});

test("navigation rechecks expired sessions before rendering a new protected page", async () => {
  let expired = false;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(expired ? response({}, 401) : response(session))));
  open("/settings");
  await screen.findByRole("heading", { name: "Account settings" });
  expired = true;
  await act(async () => { await router.navigate("/study-library"); });
  await screen.findByText("Welcome to FocusTube");
  expect(screen.queryByRole("heading", { name: "Library" })).toBeNull();
});

test("unknown URLs have a not-found view and query changes update library filters", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(session))));
  open("/does-not-exist");
  await screen.findByRole("heading", { name: "Page not found" });
  await act(async () => { await router.navigate("/study-library?courseId=one"); });
  await screen.findByRole("heading", { name: "Library one" });
  await act(async () => { await router.navigate("/study-library?courseId=two"); });
  await waitFor(() => expect(screen.getByRole("heading").textContent).toBe("Library two"));
});

test("an unauthorized legacy course does not open the shared library filter", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url === "/api/auth/session" ? response(session) : response({}, 403))));
  open("/notes/private");
  await screen.findByRole("heading", { name: "Page not found" });
  expect(router.state.location.pathname).toBe("/notes/private");
});

test("leaving a pending course aborts its loader and prevents stale content", async () => {
  let pendingSignal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    if (url !== "/api/courses/slow") return Promise.resolve(response(session));
    pendingSignal = init?.signal ?? undefined;
    return new Promise<Response>((_, reject) => {
      pendingSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  }));
  open("/courses/slow");
  await waitFor(() => expect(pendingSignal).toBeTruthy());
  await act(async () => { await router.navigate("/settings"); });
  await screen.findByRole("heading", { name: "Account settings" });
  expect(pendingSignal?.aborted).toBe(true);
  expect(screen.queryByRole("alert")).toBeNull();
});
