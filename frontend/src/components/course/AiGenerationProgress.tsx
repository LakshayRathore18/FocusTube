"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

type Progress = "starting" | "transcript" | "content" | "ready" | "failed" | "waiting";

export default function AiGenerationProgress({ videoId }: { videoId: string }) {
  const [stage, setStage] = useState<Progress>("starting");

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    async function refresh() {
      let finished = false;
      try {
        const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/ai-progress`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
        });
        if (!response.ok) throw new Error("Progress unavailable");
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (data.status === "ready" || data.status === "failed") {
          setStage(data.status);
          finished = true;
        } else if (data.status === "pending" && (data.stage === "transcript" || data.stage === "content")) {
          setStage(data.stage);
        }
      } catch {
        // Progress is optional; the generation request owns success/errors.
      }
      if (controller.signal.aborted || finished) return;
      if (++attempts >= 50) {
        setStage("waiting");
        return;
      }
      timer = setTimeout(() => void refresh(), 2_000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [videoId]);

  const label = {
    starting: "Starting AI notes…",
    transcript: "Getting video transcript…",
    content: "Creating summary and quiz…",
    ready: "Summary and quiz ready",
    failed: "Generation stopped",
    waiting: "Taking longer than usual…",
  }[stage];
  const transcriptDone = stage === "content" || stage === "ready";

  return (
    <div role="status" aria-live="polite" className="space-y-1.5 text-left">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        {stage === "ready" ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          : stage !== "failed" && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-zinc-400" aria-label="Generation steps">
        <li className="flex items-center gap-1">
          {transcriptDone && <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />}
          Transcript{transcriptDone ? " ready" : ""}
        </li>
        <li className="flex items-center gap-1">
          {stage === "ready" && <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />}
          Summary &amp; quiz
        </li>
      </ol>
    </div>
  );
}
