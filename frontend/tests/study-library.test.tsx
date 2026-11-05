import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import StudyLibraryPage from "../src/components/study-library/StudyLibraryPage";
import type { StudyLibraryData } from "../src/components/study-library/types";

vi.mock("next/dynamic", () => ({ default: () => function Workspace({ onClose, initialTab, savedOnly }: { onClose: () => void; initialTab: string; savedOnly: boolean }) {
  return <div role="dialog"><p>{initialTab} {savedOnly ? "saved only" : "generation enabled"}</p><button onClick={onClose}>Close test workspace</button></div>;
} }));

const data: StudyLibraryData = {
  items: [{ id: "video:notes", type: "notes", videoId: "video", youtubeVideoId: "abcdefghijk", videoTitle: "React closures", courseId: "course", courseTitle: "React", preview: "Remember the lexical scope", updatedAt: "2026-11-06T10:00:00Z", isAvailable: false }],
  total: 1, resourceTotal: 3, counts: { all: 3, notes: 1, summary: 1, quiz: 1 }, courses: [{ id: "course", title: "React" }], page: 1, pageSize: 24,
};
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("course, content search, type and sort are combined in the server request", async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response(data)));
  vi.stubGlobal("fetch", fetcher);
  render(<StudyLibraryPage initialCourseId="course" />);
  await screen.findByRole("button", { name: "Open personal note: React closures" });
  fireEvent.change(screen.getByLabelText("Search study library"), { target: { value: "lexical scope" } });
  fireEvent.click(screen.getByRole("group", { name: "Resource type" }).querySelectorAll("button")[1]);
  fireEvent.change(screen.getByLabelText("Sort resources"), { target: { value: "oldest" } });
  await waitFor(() => {
    const params = new URL(fetcher.mock.calls.at(-1)![0], "http://localhost").searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ q: "lexical scope", courseId: "course", type: "notes", sort: "oldest", page: "1", pageSize: "24" });
  });
});

test("opening an archived saved note uses the workspace and closing preserves filters", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(data))));
  render(<StudyLibraryPage initialCourseId="course" />);
  await screen.findByRole("button", { name: "Open personal note: React closures" });
  fireEvent.change(screen.getByLabelText("Search study library"), { target: { value: "closures" } });
  fireEvent.click(await screen.findByRole("button", { name: "Open personal note: React closures" }));
  expect(await screen.findByText("notes saved only")).toBeTruthy();
  fireEvent.click(screen.getByText("Close test workspace"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect((screen.getByLabelText("Search study library") as HTMLInputElement).value).toBe("closures");
  expect((screen.getByLabelText("Filter by course") as HTMLSelectElement).value).toBe("course");
});

test("HTTP failures can be retried and empty libraries point back to Courses", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(response({ ...data, items: [], total: 0, resourceTotal: 0, counts: { all: 0, notes: 0, summary: 0, quiz: 0 } }));
  vi.stubGlobal("fetch", fetcher);
  render(<StudyLibraryPage />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Try again"));
  await screen.findByText("Your next good idea belongs here");
  expect(screen.getByRole("link", { name: "Explore your courses" }).getAttribute("href")).toBe("/courses");
});
