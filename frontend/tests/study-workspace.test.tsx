import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import LearningWorkspace from "../src/components/learning/LearningWorkspace";

const { flush } = vi.hoisted(() => ({ flush: vi.fn(async () => true) }));
vi.mock("../src/components/notes/NoteEditor", async () => {
  const React = await import("react");
  return { default: React.forwardRef(function MockEditor(_, ref) {
    React.useImperativeHandle(ref, () => ({ flushAndSave: flush }));
    return <textarea aria-label="Test note" />;
  }) };
});
vi.mock("../src/lib/use-video-chat", () => ({ useVideoChat: () => false }));

beforeEach(() => {
  flush.mockResolvedValue(true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("failed note saves block close and tab changes; retry preserves the workspace", async () => {
  const onClose = vi.fn();
  flush.mockResolvedValue(false);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ needsRegeneration: true }))));
  render(<LearningWorkspace videoId="one" youtubeVideoId="abcdefghijk" videoTitle="Lesson" courseId="course" savedOnly onClose={onClose} />);
  fireEvent.click(screen.getByText("Done"));
  await waitFor(() => expect(flush).toHaveBeenCalled());
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "AI summary" }));
  await waitFor(() => expect(flush).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("Test note").closest("[hidden]")).toBeNull();
  flush.mockResolvedValue(true);
  fireEvent.click(screen.getByText("Done"));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

test("saved resources load read-only and missing material never triggers generation", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ needsRegeneration: true })));
  vi.stubGlobal("fetch", fetcher);
  render(<LearningWorkspace videoId="one" youtubeVideoId="abcdefghijk" videoTitle="Lesson" courseId="course" initialTab="summary" savedOnly onClose={() => {}} />);
  await screen.findByText("No saved material available");
  expect(screen.queryByText("Generate AI content")).toBeNull();
  fireEvent.click(screen.getByText("Retry loading"));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(fetcher.mock.calls.every(([url, options]) => url.endsWith("/ai-content") && !options.method)).toBe(true);
});

test("switching away flushes the editor and retains its mounted contents", async () => {
  let finish: (value: boolean) => void = () => {};
  flush.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ summary: { hook: "Saved summary", keyPoints: ["A point"] }, quiz: { questions: [] } }))));
  render(<LearningWorkspace videoId="one" youtubeVideoId="abcdefghijk" videoTitle="Lesson" courseId="course" savedOnly onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText("Test note"), { target: { value: "Keep my work" } });
  fireEvent.click(screen.getByRole("button", { name: "AI summary" }));
  expect(screen.getByText("Saving…")).toBeTruthy();
  expect(screen.queryByText("Saved summary")).toBeNull();
  await act(async () => finish(true));
  await screen.findByText("Saved summary");
  fireEvent.click(screen.getByRole("button", { name: "Personal notes" }));
  expect((screen.getByLabelText("Test note") as HTMLTextAreaElement).value).toBe("Keep my work");
});
