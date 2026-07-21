"use client";

import { useState, useEffect, useRef } from "react";
import QuizPlayer from "@/components/shared/QuizPlayer";
import type { Video, StudySummary, QuizPayload } from "./types";

export default function AIContentModal({
  video,
  content,
  onClose,
}: {
  video: Video;
  content: { summary: StudySummary; quiz: QuizPayload };
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "quiz">("summary");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-[800px] max-h-[85vh] flex flex-col rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              AI Study Notes
            </span>
            <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate mt-0.5">
              {video.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close study notes"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-zinc-800 shrink-0 px-5">
          <button
            onClick={() => setActiveTab("summary")}
            className={`relative pb-3 pt-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "summary"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            Summary
            {activeTab === "summary" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={`relative pb-3 pt-3 ml-6 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "quiz"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            Quiz ({content.quiz.questions.length})
            {activeTab === "quiz" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "summary" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  {content.summary.hook}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Key Points
                </h4>
                <ul className="space-y-2">
                  {content.summary.keyPoints.map((point, pi) => (
                    <li
                      key={pi}
                      className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-3 border border-gray-100 dark:border-zinc-800"
                    >
                      <span className="flex items-center justify-center w-5 h-5 shrink-0 mt-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                        {pi + 1}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "quiz" && (
            <QuizPlayer questions={content.quiz.questions} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-gray-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
