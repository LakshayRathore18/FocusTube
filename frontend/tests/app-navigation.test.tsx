import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "../src/routes";

const course = {
  id: "course", title: "React fundamentals", thumbnailUrl: "/FocusTube.png", lastSyncedAt: null,
  _count: { videos: 1, completedVideos: 0, inProgressVideos: 0 }, remainingDurationSeconds: 60,
  videos: [{ id: "video", courseId: "course", youtubeVideoId: "abcdefghijk", title: "Understanding hooks", position: 0, durationSeconds: 60, thumbnailUrl: "/FocusTube.png", isAvailable: true, status: "not_started" }],
};
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const data = url === "/api/auth/session" ? { user: { id: "user", name: "Learner", email: "learner@example.test", image: "/FocusTube.png" } }
      : url === "/api/courses" ? [course]
      : url === "/api/courses/course" ? course
      : url === "/api/stats/weekly" ? { totalVideosCompleted: 0, totalVideosCount: 1 }
      : url === "/api/rag/capabilities" ? { videoChat: false }
      : {};
    return Promise.resolve(new Response(JSON.stringify(data)));
  }));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); router?.dispose(); vi.unstubAllGlobals(); });

test("real course cards, images, detail pages and sidebar links work through React Router", async () => {
  router = createMemoryRouter(routes, { initialEntries: ["/courses"] });
  render(<RouterProvider router={router} />);
  const openCourse = await screen.findByRole("link", { name: "Open React fundamentals" });
  const image = openCourse.querySelector("img")!;
  expect(image.getAttribute("src")).toBe("/FocusTube.png");
  expect(image.style.position).toBe("absolute");
  fireEvent.click(openCourse);
  await screen.findByRole("heading", { level: 1, name: "React fundamentals" });
  await waitFor(() => expect(router.state.location.pathname).toBe("/courses/course"));
  expect(screen.getByText("Understanding hooks")).toBeTruthy();
  const navigation = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(navigation).getByRole("link", { name: "Courses" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("link", { name: "Back to courses" }));
  await screen.findByRole("link", { name: "Open React fundamentals" });
  expect(router.state.location.pathname).toBe("/courses");
});

test("course search uses browser navigation and closes the dialog after selection", async () => {
  router = createMemoryRouter(routes, { initialEntries: ["/courses"] });
  render(<RouterProvider router={router} />);
  fireEvent.click(await screen.findByRole("button", { name: "Search courses" }));
  const dialog = await screen.findByRole("dialog", { name: "Search courses" });
  const result = await within(dialog).findByRole("button", { name: /React fundamentals/ });
  fireEvent.click(result);
  await screen.findByRole("heading", { level: 1, name: "React fundamentals" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search courses" })).toBeNull());
  await waitFor(() => expect(router.state.location.pathname).toBe("/courses/course"));
});
