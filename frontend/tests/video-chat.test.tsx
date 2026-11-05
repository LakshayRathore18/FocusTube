import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import VideoChat from "../src/components/learning/VideoChat";

function response(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test("prepares without summaries, renders safe text and supports followups", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ status: "not_prepared" }))
    .mockResolvedValueOnce(response({ status: "ready" }))
    .mockResolvedValueOnce(response({ status: "answered", answer: "<script>unsafe()</script>", citations: [{ sourceId: "S1", excerpt: "Actual passage", videoTitle: "Lesson", videoUrl: "https://www.youtube.com/watch?v=abcdefghijk" }] }))
    .mockResolvedValueOnce(response({ status: "insufficient_evidence", answer: "Not enough evidence", citations: [] }));
  vi.stubGlobal("fetch", fetcher);
  render(<VideoChat videoId="first" />);
  fireEvent.click(await screen.findByText("Prepare video chat"));
  const input = await screen.findByLabelText("Your question");
  fireEvent.change(input, { target: { value: "What is this?" } });
  fireEvent.click(screen.getByText("Send"));
  expect(await screen.findByText("<script>unsafe()</script>")).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText("Actual passage")).toBeTruthy();
  fireEvent.change(input, { target: { value: "Explain that?" } });
  fireEvent.click(screen.getByText("Send"));
  await screen.findByText("Not enough transcript evidence");
  const body = JSON.parse(fetcher.mock.calls[3][1].body);
  expect(body.history).toEqual([{ role: "user", content: "What is this?" }, { role: "assistant", content: "<script>unsafe()</script>" }]);
  expect(fetcher.mock.calls.every(([url]) => url.startsWith("/api/rag/"))).toBe(true);
});

test("failed questions stay retryable and duplicate submissions are blocked", async () => {
  let resolveAsk: (value: Response) => void = () => {};
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ status: "ready" }))
    .mockResolvedValueOnce(response({ code: "provider_quota" }, 429))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveAsk = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  render(<VideoChat videoId="first" />);
  const input = await screen.findByLabelText("Your question");
  fireEvent.change(input, { target: { value: "Keep this question" } });
  fireEvent.click(screen.getByText("Send"));
  await screen.findByRole("alert");
  expect((input as HTMLTextAreaElement).value).toBe("Keep this question");
  fireEvent.click(screen.getByText("Retry question"));
  fireEvent.submit(input.closest("form")!);
  expect(fetcher).toHaveBeenCalledTimes(3);
  await act(async () => resolveAsk(response({ status: "answered", answer: "Success", citations: [] })));
  expect(screen.getAllByText("Keep this question")).toHaveLength(1);
});

test("closing or switching video aborts requests and discards late answers", async () => {
  let resolveAsk: (value: Response) => void = () => {};
  let oldSignal: AbortSignal | undefined;
  const fetcher = vi.fn().mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith("/ask")) {
      oldSignal = options.signal as AbortSignal;
      return new Promise<Response>((resolve) => { resolveAsk = resolve; });
    }
    return Promise.resolve(response({ status: "ready" }));
  });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<VideoChat key="first" videoId="first" />);
  fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "Old question" } });
  fireEvent.click(screen.getByText("Send"));
  view.rerender(<VideoChat key="second" videoId="second" />);
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => resolveAsk(response({ status: "answered", answer: "Old answer", citations: [] })));
  await screen.findByLabelText("Your question");
  expect(screen.queryByText("Old answer")).toBeNull();
  expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).value).toBe("");
  view.unmount();
});

test("pending polls stop after two minutes and allow explicit status refresh", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ status: "pending" })));
  vi.stubGlobal("fetch", fetcher);
  render(<VideoChat videoId="first" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(123_000); });
  expect(screen.getByText(/Preparation is taking longer/)).toBeTruthy();
  const count = fetcher.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  expect(fetcher).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByText("Refresh status"));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetcher).toHaveBeenCalledTimes(count + 1);
});

test("pending status polling never overlaps requests", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(response({ status: "pending" })).mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  render(<VideoChat videoId="first" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
