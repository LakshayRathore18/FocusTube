import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { createMemoryRouter, RouterProvider, useLoaderData } from "react-router-dom";
import SyncButton from "../src/components/course/SyncButton";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("playlist sync reloads route data without navigating or reloading the document", async () => {
  const onSyncComplete = vi.fn();
  let lessons = 1;
  const loader = vi.fn(() => lessons);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
    lessons = 2;
    return Promise.resolve(new Response(JSON.stringify({ added: 1, updated: 0, archived: 0, total: 2 })));
  }));
  function Course() {
    const count = useLoaderData() as number;
    return <><h1>{count} lessons</h1><SyncButton courseId="course" onSyncComplete={onSyncComplete} /></>;
  }
  const router = createMemoryRouter([{ path: "/courses/course", loader, Component: Course, HydrateFallback: () => null }], { initialEntries: ["/courses/course"] });
  render(<RouterProvider router={router} />);
  await screen.findByText("1 lessons");
  fireEvent.click(screen.getByRole("button", { name: "Sync playlist with YouTube" }));
  await screen.findByText("2 lessons");
  await waitFor(() => expect(onSyncComplete).toHaveBeenCalledOnce());
  expect(loader).toHaveBeenCalledTimes(2);
  expect(router.state.location.pathname).toBe("/courses/course");
  expect(fetch).toHaveBeenCalledWith("/api/courses/course/sync", { method: "POST" });
  router.dispose();
});
