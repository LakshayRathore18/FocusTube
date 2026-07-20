"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Video, Course, StudySummary, QuizPayload, AiGenerationState } from "./types";
import StatusBadge from "./StatusBadge";
import NotesModal from "./NotesModal";
import VideoPlayerModal from "./VideoPlayerModal";
import AIContentModal from "./AIContentModal";

// ─── Main component ─────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

export default function CourseContent({ course, playVideoId }: { course: Course; playVideoId?: string }) {
  const router = useRouter();
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [noteModalVideoId, setNoteModalVideoId] = useState<string | null>(null);
  const [aiModalVideo, setAiModalVideo] = useState<Video | null>(null);
  const [aiContentData, setAiContentData] = useState<{ summary: StudySummary; quiz: QuizPayload } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videosWithNotes, setVideosWithNotes] = useState<Record<string, boolean>>({});
  const [aiGenStates, setAiGenStates] = useState<Record<string, AiGenerationState>>({});
  const pollTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const pollAttemptsRef = useRef<Record<string, number>>({});

  const [localStatuses, setLocalStatuses] = useState<
    Record<string, { status: string; lastWatchedSeconds?: number | null }>
  >({});

  // On mount: fetch existing notes and AI content status for all videos
  useEffect(() => {
    fetch(`/api/courses/${course.id}/content-status`)
      .then((res) => res.json())
      .then(
        (
          data: Record<
            string,
            { hasNotes: boolean; aiStatus: string }
          >
        ) => {
          const notesMap: Record<string, boolean> = {};
          const aiMap: Record<string, AiGenerationState> = {};

          for (const [videoId, status] of Object.entries(data)) {
            if (status.hasNotes) notesMap[videoId] = true;
            if (status.aiStatus === "ready") {
              aiMap[videoId] = { status: "ready" };
            } else if (status.aiStatus === "pending") {
              aiMap[videoId] = { status: "pending" };
            } else if (status.aiStatus === "failed") {
              aiMap[videoId] = { status: "failed" };
            }
          }

          setVideosWithNotes(notesMap);
          setAiGenStates(aiMap);
        }
      )
      .catch(() => {});
  }, [course.id]);

  // Cleanup all poll timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimersRef.current).forEach(clearInterval);
    };
  }, []);

  function updateVideoStatus(videoId: string, status: string, lastWatchedSeconds?: number | null) {
    setLocalStatuses((prev) => ({
      ...prev,
      [videoId]: { status, lastWatchedSeconds },
    }));

    fetch(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, lastWatchedSeconds }),
    })
      .then(() => window.dispatchEvent(new CustomEvent("refresh-stats")))
      .catch(() => {});
  }

  function handlePlayVideo(video: Video) {
    setPlayingVideo(video);
    if (video.status !== "in_progress" && video.status !== "completed") {
      updateVideoStatus(video.id, "in_progress");
    }
  }

  function handleMarkCompleted(videoId: string) {
    updateVideoStatus(videoId, "completed", null);
    setPlayingVideo(null);
  }

  function resolveVideo(v: Video): Video {
    const local = localStatuses[v.id];
    if (!local) return v;
    return {
      ...v,
      status: local.status,
      lastWatchedSeconds: local.lastWatchedSeconds !== undefined ? local.lastWatchedSeconds : v.lastWatchedSeconds,
    };
  }

  function handleOpenNotes(video: Video) {
    setNoteModalVideoId(video.id);
  }

  function handleCloseNotes() {
    setNoteModalVideoId(null);
  }

  function handleHasContentChange(videoId: string, hasContent: boolean) {
    if (hasContent) {
      setVideosWithNotes((prev) => ({ ...prev, [videoId]: true }));
    }
  }

  // ─── AI Content Generation ───────────────────────────────────

  async function triggerGeneration(video: Video) {
    const current = aiGenStates[video.id];
    if (current?.status === "generating" || current?.status === "pending") return;

    setAiGenStates((prev) => ({ ...prev, [video.id]: { status: "generating" } }));

    try {
      const res = await fetch("/api/ai/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeVideoId: video.youtubeVideoId, courseId: course.id }),
      });
      const data = await res.json();
      handleGenerationResponse(video, data);
    } catch (err) {
      setAiGenStates((prev) => ({
        ...prev,
        [video.id]: { status: "failed", reason: err instanceof Error ? err.message : "Network error" },
      }));
    }
  }

  function handleGenerationResponse(video: Video, data: { status: string; summary?: StudySummary; quiz?: QuizPayload; reason?: string }) {
    if (data.status === "ready") {
      stopPolling(video.id);
      setAiGenStates((prev) => ({
        ...prev,
        [video.id]: { status: "ready", summary: data.summary, quiz: data.quiz },
      }));
      setAiModalVideo(video);
      setAiContentData(data.summary && data.quiz ? { summary: data.summary, quiz: data.quiz } : null);
    } else if (data.status === "pending") {
      setAiGenStates((prev) => ({ ...prev, [video.id]: { status: "pending" } }));
      startPolling(video);
    } else if (data.status === "failed") {
      stopPolling(video.id);
      setAiGenStates((prev) => ({
        ...prev,
        [video.id]: { status: "failed", reason: data.reason ?? "unknown" },
      }));
    }
  }

  function startPolling(video: Video) {
    stopPolling(video.id);
    pollAttemptsRef.current[video.id] = 0;

    const timer = setInterval(async () => {
      const attempts = (pollAttemptsRef.current[video.id] ?? 0) + 1;
      pollAttemptsRef.current[video.id] = attempts;

      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(timer);
        delete pollTimersRef.current[video.id];
        setAiGenStates((prev) => ({
          ...prev,
          [video.id]: { status: "failed", reason: "Still processing, try again in a moment" },
        }));
        return;
      }

      try {
        const res = await fetch("/api/ai/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeVideoId: video.youtubeVideoId, courseId: course.id }),
        });
        const data = await res.json();
        handleGenerationResponse(video, data);
      } catch (err) {
        console.warn("[ai] poll fetch failed:", err);
      }
    }, POLL_INTERVAL_MS);

    pollTimersRef.current[video.id] = timer;
  }

  function stopPolling(videoId: string) {
    if (pollTimersRef.current[videoId]) {
      clearInterval(pollTimersRef.current[videoId]);
      delete pollTimersRef.current[videoId];
    }
  }

  const [aiContentLoading, setAiContentLoading] = useState(false);

  async function handleOpenAiContent(video: Video) {
    const state = aiGenStates[video.id];
    if (state?.status !== "ready") return;

    if (state.summary && state.quiz) {
      setAiContentData({ summary: state.summary, quiz: state.quiz });
      setAiModalVideo(video);
      return;
    }

    setAiContentLoading(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/ai-content`);
      if (!res.ok) throw new Error("Failed to load AI content");
      const data = await res.json();
      if (data.needsRegeneration) {
        // AIContent row is missing or stale — reset to idle so the user
        // sees the Generate button and can trigger a fresh Gemini call.
        setAiGenStates((prev) => {
          const next = { ...prev };
          delete next[video.id];
          return next;
        });
      } else if (data.summary && data.quiz) {
        setAiContentData({ summary: data.summary, quiz: data.quiz });
        setAiModalVideo(video);
      }
    } catch {
      // Fall back to showing nothing — user can retry by clicking again
    } finally {
      setAiContentLoading(false);
    }
  }

  function handleCloseAiContent() {
    setAiModalVideo(null);
    setAiContentData(null);
  }

  // ─── Delete Course ────────────────────────────────────────

  async function handleDeleteCourse() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const resolvedVideos = course.videos.map(resolveVideo);
  const completedCount = resolvedVideos.filter((v) => v.status === "completed").length;
  const activeVideo = playingVideo ? resolveVideo(playingVideo) : null;
  const noteModalVideo = resolvedVideos.find((v) => v.id === noteModalVideoId) ?? null;

  // On mount: if ?play=VIDEO_ID is provided, auto-play that specific video
  useEffect(() => {
    if (!playVideoId) return;
    const target = course.videos.find((v) => v.id === playVideoId && v.isAvailable);
    if (target) {
      handlePlayVideo(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top bar: back link + delete button */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </Link>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          Delete course
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_20px_80px_rgba(0,0,0,.45)]"
          >
            <div className="p-7">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                  <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008M10.29 3.86 1.82 18a2 2 0 001.73 3h16.9a2 2 0 001.73-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white">Delete course?</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    This will permanently delete{" "}
                    <span className="font-semibold text-white">{course.title}</span> and all{" "}
                    <span className="font-semibold text-white">{course._count.videos} videos</span> with their notes.
                  </p>
                  <p className="mt-2 text-sm text-red-400">This action cannot be undone.</p>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="h-11 rounded-xl border border-zinc-700 px-5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  disabled={deleting}
                  onClick={handleDeleteCourse}
                  className="flex h-11 min-w-[120px] items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {deleting ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    "Delete Course"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-full sm:w-72 aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
          {course.thumbnailUrl && (
            <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {course.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              {course._count.videos} video{course._count.videos !== 1 ? "s" : ""}
            </span>
            {completedCount > 0 && (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {completedCount} completed
              </span>
            )}
          </div>
          {course._count.videos > 0 && (
            <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${Math.round((completedCount / course._count.videos) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {activeVideo && activeVideo.isAvailable && (
        <VideoPlayerModal
          video={activeVideo}
          onClose={() => setPlayingVideo(null)}
          onMarkCompleted={handleMarkCompleted}
          onOpenNotes={handleOpenNotes}
        />
      )}

      {/* Video list */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Videos</h2>
      <div className="space-y-2">
        {resolvedVideos.map((video) => {
          const isComplete = video.status === "completed";
          const isInProgress = video.status === "in_progress";
          const isActive = activeVideo?.id === video.id;
          const hasNotes = !!videosWithNotes[video.id];
          const aiState = aiGenStates[video.id];
          const aiIsGenerating = aiState?.status === "generating" || aiState?.status === "pending";
          const aiIsReady = aiState?.status === "ready";
          const aiIsFailed = aiState?.status === "failed";

          let accentColor = "";
          let statusTextColor = "text-gray-400 dark:text-gray-500";

          if (isComplete) {
            accentColor = "bg-green-500";
            statusTextColor = "text-green-600 dark:text-green-400";
          } else if (isInProgress) {
            accentColor = "bg-amber-500";
            statusTextColor = "text-amber-600 dark:text-amber-400";
          }

          return (
            <div key={video.id}>
              <div
                onClick={() => video.isAvailable && handlePlayVideo(video)}
                className={`relative group flex items-center gap-4 rounded-xl border p-3 pl-4 transition-all duration-150 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  isActive
                    ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                } ${!video.isAvailable ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isComplete && <div className="absolute inset-0 pointer-events-none bg-green-500/5" />}
                {accentColor && <div className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full ${accentColor}`} />}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!video.isAvailable) return;
                    const newStatus = video.status === "completed" ? "not_started" : "completed";
                    updateVideoStatus(video.id, newStatus, newStatus === "completed" ? null : undefined);
                  }}
                  className="flex items-center justify-center w-8 h-8 shrink-0"
                  aria-label={video.status === "completed" ? "Mark as not started" : "Mark as completed"}
                >
                  <StatusBadge video={video} />
                </button>

                <div className="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                  {video.thumbnailUrl && (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{video.title}</h3>
                  <p className={`text-xs mt-0.5 capitalize transition-colors duration-150 ${statusTextColor}`}>
                    {video.status === "in_progress" ? "In Progress" : video.status.replace("_", " ")}
                    {video.durationSeconds &&
                      ` · ${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, "0")}`}
                  </p>
                </div>

                {video.isAvailable ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlayVideo(video); }}
                    className="flex items-center gap-1.5 shrink-0 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out overflow-hidden w-9 group-hover:w-[4.2rem]"
                    aria-label={`Play ${video.title}`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0 ml-[0.5625rem]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">Play</span>
                  </button>
                ) : (
                  <span className="text-xs text-red-500 dark:text-red-400 shrink-0">Unavailable</span>
                )}

                {/* Generate Notes / AI Study Notes button */}
                {video.isAvailable && (
                  aiIsGenerating ? (
                    <div className="shrink-0 flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-2">
                      <svg className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        {aiState?.status === "pending" ? "Processing..." : "Generating..."}
                      </span>
                    </div>
                  ) : aiIsReady ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenAiContent(video); }}
                      className="shrink-0 rounded-lg border border-emerald-500/60 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-400/10 p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-400/20 transition-colors"
                      aria-label="View study notes"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); triggerGeneration(video); }}
                      disabled={aiIsFailed}
                      className={`shrink-0 rounded-lg border p-2 transition-all ${
                        aiIsFailed
                          ? "border-red-300 dark:border-red-800 text-red-400 dark:text-red-500 opacity-60 cursor-not-allowed"
                          : "border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-600"
                      }`}
                      aria-label="Generate study notes"
                      title={aiIsFailed ? `Notes unavailable: ${aiState.reason ?? "error"}. Click to retry.` : "Generate AI study notes"}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                    </button>
                  )
                )}

                {/* Notes icon button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenNotes(video); }}
                  className={`shrink-0 rounded-lg border p-2 transition-all ${
                    hasNotes
                      ? "border-blue-500/60 dark:border-blue-400/50 bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400"
                      : "border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-600"
                  }`}
                  aria-label="Open notes"
                >
                  {hasNotes ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes modal */}
      {noteModalVideo && (
        <NotesModal
          video={noteModalVideo}
          onClose={handleCloseNotes}
          onHasContentChange={handleHasContentChange}
        />
      )}

      {/* AI Content modal */}
      {aiModalVideo && aiContentData && (
        <AIContentModal
          video={aiModalVideo}
          content={aiContentData}
          onClose={handleCloseAiContent}
        />
      )}
    </div>
  );
}
