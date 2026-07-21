"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import NoteEditor, { type NoteEditorHandle } from "@/components/notes/NoteEditor";
import QuizPlayer from "@/components/shared/QuizPlayer";
import type { StudySummary, QuizPayload, LearningResourceType } from "@/components/course/types";
import { FileText, Sparkles, Brain, X } from "lucide-react";

// ─── Tab configuration ──────────────────────────────────────────────────────
// To add a new learning tool (Flashcards, Transcript, Bookmarks, etc.),
// add a new entry to this array with a unique id, label, and icon.
// Then create the tab content component and wire it in the switch below.

type TabId = LearningResourceType;

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: "notes",   label: "Notes",     icon: <FileText className="w-4 h-4" /> },
  { id: "summary", label: "AI Summary", icon: <Sparkles className="w-4 h-4" /> },
  { id: "quiz",    label: "Quiz",      icon: <Brain className="w-4 h-4" /> },
];

// ─── Tab Button ─────────────────────────────────────────────────────────────

function TabBar({
  activeTab,
  onTabChange,
  aiReady,
  quizCount,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  aiReady: boolean;
  quizCount: number;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-900/50 px-4">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        // Disable AI Summary / Quiz tabs if AI content isn't loaded yet
        const disabled = (tab.id === "summary" || tab.id === "quiz") && !aiReady;

        return (
          <button
            key={tab.id}
            onClick={() => !disabled && onTabChange(tab.id)}
            disabled={disabled}
            className={`relative flex items-center gap-2 px-3 py-3 text-xs font-semibold transition-all ${
              isActive
                ? "text-blue-400"
                : disabled
                  ? "text-zinc-600 cursor-not-allowed"
                  : "text-zinc-400 hover:text-zinc-200"
            }`}
            title={disabled ? "Generate AI content first" : tab.label}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === "quiz" && quizCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                {quizCount}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── AI Summary Tab ─────────────────────────────────────────────────────────

function SummaryTab({ summary }: { summary: StudySummary }) {
  return (
    <div className="space-y-4 p-5">
      {/* Hook / TL;DR */}
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
        <p className="text-sm font-medium text-emerald-200 leading-relaxed">
          {summary.hook}
        </p>
      </div>

      {/* Key Takeaways */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Key Takeaways
        </h4>
        <ul className="space-y-2">
          {summary.keyPoints.map((point, pi) => (
            <li
              key={pi}
              className="flex items-start gap-3 rounded-xl bg-zinc-800/50 p-3 border border-zinc-800"
            >
              <span className="flex items-center justify-center w-5 h-5 shrink-0 mt-0.5 rounded-full bg-blue-900/30 text-[11px] font-semibold text-blue-300">
                {pi + 1}
              </span>
              <span className="text-sm text-zinc-300 leading-relaxed">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Quiz Tab ───────────────────────────────────────────────────────────────

function QuizTab({ quiz }: { quiz: QuizPayload }) {
  return (
    <div className="p-5">
      <QuizPlayer questions={quiz.questions} resetLabel="Reset" />
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-20 rounded-xl bg-zinc-800/50" />
      <div className="h-4 bg-zinc-800/50 rounded w-1/3" />
      <div className="h-10 bg-zinc-800/50 rounded" />
      <div className="h-10 bg-zinc-800/50 rounded" />
      <div className="h-10 bg-zinc-800/50 rounded" />
    </div>
  );
}

// ─── Main LearningWorkspace Component ────────────────────────────────────────

interface LearningWorkspaceProps {
  videoId: string;
  youtubeVideoId: string;
  videoTitle: string;
  courseId: string;
  /** Optional — which tab to open initially (defaults to "notes") */
  initialTab?: TabId;
  onClose: () => void;
}

export default function LearningWorkspace({
  videoId,
  youtubeVideoId,
  videoTitle,
  courseId,
  initialTab = "notes",
  onClose,
}: LearningWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [aiContent, setAiContent] = useState<{
    summary: StudySummary;
    quiz: QuizPayload;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiContent = useCallback(() => {
    if (aiLoading || aiGenerating) return;
    setAiError(null);
    setAiLoading(true);
    fetch(`/api/videos/${videoId}/ai-content`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.summary && data.quiz) {
          setAiContent({ summary: data.summary, quiz: data.quiz });
          setAiError(null);
        } else if (data?.error) {
          setAiError(data.error);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch AI content:", err);
        setAiError("Could not load AI content. Please try again.");
      })
      .finally(() => setAiLoading(false));
  }, [videoId, aiLoading, aiGenerating]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const handleGenerateAi = useCallback(async () => {
    if (aiGenerating || !youtubeVideoId) return;
    setAiError(null);
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeVideoId, courseId }),
      });
      const data = await res.json();
      if (data.status === "ready" && data.summary && data.quiz) {
        setAiContent({ summary: data.summary, quiz: data.quiz });
        setAiError(null);
        setAiGenerating(false);
      } else if (data.status === "pending") {
        // Poll for completion — interval stored in ref so it can be cleaned up
        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch("/api/ai/content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ youtubeVideoId, courseId }),
            });
            const pollData = await pollRes.json();
            if (pollData.status === "ready" && pollData.summary && pollData.quiz) {
              setAiContent({ summary: pollData.summary, quiz: pollData.quiz });
              setAiError(null);
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setAiGenerating(false);
            } else if (pollData.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setAiError(pollData.reason ?? "AI generation failed.");
              setAiGenerating(false);
            }
          } catch (err) {
            console.error("AI generation poll error:", err);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setAiError("AI generation failed. Please try again.");
            setAiGenerating(false);
          }
        }, 3000);
        return; // Don't set aiGenerating false yet — poll handles it
      }
    } catch (err) {
      console.error("AI generation request error:", err);
      setAiError("Could not start AI generation. Please try again.");
    }
    setAiGenerating(false);
  }, [youtubeVideoId, courseId, aiGenerating]);

  // Fetch AI content once — shared across Summary and Quiz tabs
  useEffect(() => {
    if (initialTab === "summary" || initialTab === "quiz") {
      fetchAiContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, initialTab]);

  // Lazy-fetch AI content when switching to summary or quiz tab if not loaded
  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      if ((tab === "summary" || tab === "quiz") && !aiContent && !aiLoading && !aiGenerating) {
        fetchAiContent();
      }
    },
    [fetchAiContent, aiContent, aiLoading, aiGenerating]
  );

  const aiReady = aiContent !== null;
  const quizCount = aiContent?.quiz.questions.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[800px] max-h-[85vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Learning
            </span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Everything you need to master this video.
            </p>
            <h2 className="text-sm font-medium text-zinc-100 truncate mt-0.5">
              {videoTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────── */}
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          aiReady={aiReady}
          quizCount={quizCount}
        />

        {/* ── Tab content ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "notes" && (
            <div className="p-5">
              <NoteEditor videoId={videoId} />
            </div>
          )}

          {activeTab === "summary" &&
            (aiLoading && !aiGenerating ? (
              <LoadingSkeleton />
            ) : aiContent ? (
              <SummaryTab summary={aiContent.summary} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Sparkles className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-zinc-500 text-sm max-w-xs">
                  {aiGenerating
                    ? "Generating AI summary... this may take a moment."
                    : aiError
                      ? aiError
                      : "This video doesn't have AI content yet."}
                </p>
                {aiGenerating ? (
                  <div className="flex items-center gap-2 mt-4">
                    <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs text-zinc-400">Generating...</span>
                  </div>
                ) : (
                  <>
                    {aiError && (
                      <p className="mt-2 text-xs text-red-400 max-w-xs">{aiError}</p>
                    )}
                    <button
                      onClick={handleGenerateAi}
                      disabled={!youtubeVideoId}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiError ? "Retry" : "Generate AI Content"}
                    </button>
                  </>
                )}
              </div>
            ))}

          {activeTab === "quiz" &&
            (aiLoading && !aiGenerating ? (
              <LoadingSkeleton />
            ) : aiContent ? (
              <QuizTab quiz={aiContent.quiz} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Brain className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-zinc-500 text-sm max-w-xs">
                  {aiGenerating
                    ? "Generating quiz... this may take a moment."
                    : aiError
                      ? aiError
                      : "This video doesn't have AI content yet."}
                </p>
                {aiGenerating ? (
                  <div className="flex items-center gap-2 mt-4">
                    <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs text-zinc-400">Generating...</span>
                  </div>
                ) : (
                  <>
                    {aiError && (
                      <p className="mt-2 text-xs text-red-400 max-w-xs">{aiError}</p>
                    )}
                    <button
                      onClick={handleGenerateAi}
                      disabled={!youtubeVideoId}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiError ? "Retry" : "Generate AI Content"}
                    </button>
                  </>
                )}
              </div>
            ))}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
