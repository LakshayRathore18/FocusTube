"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import NoteEditor, { type NoteEditorHandle } from "../notes/NoteEditor";

type Video = {
  id: string;
  courseId: string;
  youtubeVideoId: string;
  title: string;
  position: number;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  isAvailable: boolean;
  status: string;
  lastWatchedSeconds?: number | null;
};

type Course = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  videos: Video[];
  _count: { videos: number };
};

// ─── Status indicator SVGs ──────────────────────────────────────────────────

function NotStartedRing() {
  return (
    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="12" r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-400 dark:text-gray-500"
      />
    </svg>
  );
}

function InProgressRing({ progress = 40 }: { progress?: number }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="12" r={r}
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-300 dark:text-gray-600"
      />
      <circle
        cx="12" cy="12" r={r}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-amber-500"
      />
    </svg>
  );
}

function CompletedCheck() {
  return (
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
      <svg
        className="w-4 h-4 text-white"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={3}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 12.75 6 6 9-13.5"
        />
      </svg>
    </div>
  );
}

function StatusBadge({ video }: { video: Video }) {
  if (video.status === "completed") return <CompletedCheck />;
  if (video.status === "in_progress") {
    const pct =
      video.durationSeconds && video.lastWatchedSeconds
        ? Math.min(100, Math.round((video.lastWatchedSeconds / video.durationSeconds) * 100))
        : 40;
    return <InProgressRing progress={pct} />;
  }
  return <NotStartedRing />;
}

// ─── Notes Modal ────────────────────────────────────────────────────────────

function NotesModal({
  video,
  onClose,
  onHasContentChange,
}: {
  video: Video;
  onClose: () => void;
  onHasContentChange?: (videoId: string, hasContent: boolean) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<NoteEditorHandle>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const flushAndClose = useCallback(async () => {
    await noteEditorRef.current?.flushAndSave();
    onCloseRef.current();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") flushAndClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [flushAndClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) flushAndClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-[800px] rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Notes
            </span>
            <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate mt-0.5">
              {video.title}
            </h2>
          </div>
          <button
            onClick={flushAndClose}
            className="shrink-0 ml-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close notes"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Editor */}
        <div className="p-5">
          <NoteEditor ref={noteEditorRef} videoId={video.id} onHasContentChange={onHasContentChange} />
        </div>

        {/* Save & Close footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={flushAndClose}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Video Player Modal ─────────────────────────────────────────────────────

function VideoPlayerModal({
  video,
  onClose,
  onMarkCompleted,
  onOpenNotes,
}: {
  video: Video;
  onClose: () => void;
  onMarkCompleted: (videoId: string) => void;
  onOpenNotes: (video: Video) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">Now Playing</span>
            <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate mt-0.5">{video.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close player"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="bg-black">
          <div className="aspect-video max-h-[60vh] mx-auto">
            <iframe
              src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Bottom bar: quick actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => onOpenNotes(video)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Notes
          </button>
          {video.status !== "completed" ? (
            <button
              onClick={() => { onMarkCompleted(video.id); onClose(); }}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Mark complete
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CourseContent({ course, playVideoId }: { course: Course; playVideoId?: string }) {
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [noteModalVideoId, setNoteModalVideoId] = useState<string | null>(null);
  const [videosWithNotes, setVideosWithNotes] = useState<Record<string, boolean>>({});

  const [localStatuses, setLocalStatuses] = useState<
    Record<string, { status: string; lastWatchedSeconds?: number | null }>
  >({});

  function updateVideoStatus(videoId: string, status: string, lastWatchedSeconds?: number | null) {
    setLocalStatuses((prev) => ({
      ...prev,
      [videoId]: { status, lastWatchedSeconds },
    }));

    fetch(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, lastWatchedSeconds }),
    }).catch(() => {});
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

  const resolvedVideos = course.videos.map(resolveVideo);
  const completedCount = resolvedVideos.filter((v) => v.status === "completed").length;
  const activeVideo = playingVideo ? resolveVideo(playingVideo) : null;

  const noteModalVideo = resolvedVideos.find((v) => v.id === noteModalVideoId) ?? null;

  // Auto-play a video on mount:
  //   - If ?play=VIDEO_ID is provided, play that specific video
  //   - Otherwise play the first in_progress (or first not_started) video
  //     (used when navigating from dashboard "Continue Learning" / "Start Course" buttons)
  useEffect(() => {
    const target = playVideoId
      ? resolvedVideos.find((v) => v.id === playVideoId && v.isAvailable)
      : resolvedVideos.find((v) => v.status === "in_progress" && v.isAvailable) ??
        resolvedVideos.find((v) => v.status === "not_started" && v.isAvailable);
    if (target) {
      handlePlayVideo(target);
    }
    // We intentionally only run this on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </Link>

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

      {/* ── Video Player Modal ───────────────────────────────────────── */}
      {activeVideo && activeVideo.isAvailable && (
        <VideoPlayerModal
          video={activeVideo}
          onClose={() => setPlayingVideo(null)}
          onMarkCompleted={handleMarkCompleted}
          onOpenNotes={handleOpenNotes}
        />
      )}

      {/* Video list */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Videos
      </h2>
      <div className="space-y-2">
        {resolvedVideos.map((video) => {
          const isComplete = video.status === "completed";
          const isInProgress = video.status === "in_progress";
          const isActive = activeVideo?.id === video.id;
          const hasNotes = !!videosWithNotes[video.id];

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
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {video.title}
                  </h3>
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

                {/* Notes icon button — right of Play */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNotes(video);
                  }}
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
    </div>
  );
}
