import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AiGenerationProgress from "../src/components/course/AiGenerationProgress";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test("shows confirmed stages and stops polling when complete", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending", stage: "transcript" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending", stage: "content" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ready" })));
  vi.stubGlobal("fetch", fetcher);
  render(<AiGenerationProgress videoId="lesson" />);
  await act(async () => {});
  expect(screen.getByText("Getting video transcript…")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(screen.getByText("Creating summary and quiz…")).toBeTruthy();
  expect(screen.getByText("Transcript ready")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(screen.getByText("Summary and quiz ready")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls.every(([url]) => url === "/api/videos/lesson/ai-progress")).toBe(true);
});

test("closing aborts the progress request and schedules no further polls", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<AiGenerationProgress videoId="lesson" />);
  const signal = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1].signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
