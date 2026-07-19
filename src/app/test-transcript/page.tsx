// TEMP: manual QA page for transcript pipeline, delete once validated

"use client";

import { useState, useRef, useCallback } from "react";

// ─── Video ID extraction ─────────────────────────────────────────────────────

/**
 * Extract a YouTube video ID from a URL or bare ID.
 *
 * Handles:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   VIDEO_ID (bare 11-char string)
 */
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Bare ID — 11 characters, alphanumeric + underscore + dash
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
      // /watch?v=VIDEO_ID
      const v = url.searchParams.get("v");
      if (v) return v;
      // /embed/VIDEO_ID
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (url.hostname === "youtube.com" && pathParts[0] === "embed" && pathParts[1]) {
        return pathParts[1];
      }
    }
    // youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts[0]) return pathParts[0];
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TestResult =
  | { status: "loading" }
  | {
      status: "success";
      transcriptLength: number;
      preview: string;
    }
  | { status: "failure"; reason: string }
  | { status: "error"; message: string };

type HistoryEntry = {
  input: string;
  videoId: string;
  result: TestResult;
  timestamp: number;
};

// ─── Page ────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 10;

export default function TestTranscriptPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTranscript = useCallback(async () => {
    const videoId = extractVideoId(input);
    if (!videoId) {
      const errResult: TestResult = { status: "error", message: "Could not extract a video ID from that input." };
      setResult(errResult);
      setHistory((prev) => [
        { input, videoId: "—", result: errResult, timestamp: Date.now() },
        ...prev,
      ].slice(0, MAX_HISTORY));
      return;
    }

    setResult({ status: "loading" });

    try {
      const res = await fetch(`/api/test-transcript?videoId=${encodeURIComponent(videoId)}`);
      const data = await res.json();

      let testResult: TestResult;
      if (data.success) {
        testResult = {
          status: "success",
          transcriptLength: data.transcriptLength,
          preview: data.preview,
        };
      } else {
        testResult = { status: "failure", reason: data.reason ?? "unknown" };
      }

      setResult(testResult);
      setHistory((prev) => [
        { input, videoId, result: testResult, timestamp: Date.now() },
        ...prev,
      ].slice(0, MAX_HISTORY));
    } catch (err) {
      const errorResult: TestResult = { status: "error", message: err instanceof Error ? err.message : "Network error" };
      setResult(errorResult);
      setHistory((prev) => [
        { input, videoId, result: errorResult, timestamp: Date.now() },
        ...prev,
      ].slice(0, MAX_HISTORY));
    }
  }, [input]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchTranscript();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        Transcript Test
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Temp QA page — paste a YouTube video ID or URL to test the transcript pipeline.
      </p>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste video ID or URL..."
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || result?.status === "loading"}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {result?.status === "loading" ? "Loading..." : "Fetch Transcript"}
        </button>
      </form>

      {/* ── Current result ────────────────────────────────────────────── */}
      {result && result.status === "loading" && (
        <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="animate-pulse h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      )}

      {result && result.status === "success" && (
        <div className="mb-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
            Success — {result.transcriptLength} characters
          </p>
          <div className="max-h-48 overflow-y-auto rounded bg-white dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap border border-green-100 dark:border-green-900">
            {result.preview}
          </div>
        </div>
      )}

      {result && result.status === "failure" && (
        <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">
            Failure
          </p>
          <p className="text-sm font-mono text-amber-600 dark:text-amber-400">
            Reason: <span className="font-bold">{result.reason}</span>
          </p>
        </div>
      )}

      {result && result.status === "error" && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Error: {result.message}
          </p>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            History (last {history.length})
          </h2>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div
                key={entry.timestamp}
                className={`rounded-lg border p-3 text-xs ${
                  entry.result.status === "success"
                    ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/5"
                    : entry.result.status === "failure"
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/5"
                    : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {entry.input}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                    {entry.videoId}
                  </span>
                </div>
                {entry.result.status === "success" && (
                  <p className="text-green-600 dark:text-green-400">
                    ✓ {entry.result.transcriptLength} chars
                  </p>
                )}
                {entry.result.status === "failure" && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ✗ {entry.result.reason}
                  </p>
                )}
                {entry.result.status === "error" && (
                  <p className="text-red-600 dark:text-red-400">
                    ✗ {entry.result.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
