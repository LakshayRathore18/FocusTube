"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

/** Empty gray ring — not_started */
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

/** Partially filled amber ring — watching / in_progress */
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

/** Solid green circle with white checkmark — completed */
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

// ─── Status badge component ─────────────────────────────────────────────────

function StatusBadge({ video }: { video: Video }) {
  if (video.status === "completed") return <CompletedCheck />;
  if (video.status === "watching") {
    const pct =
      video.durationSeconds && video.lastWatchedSeconds
        ? Math.min(
            100,
            Math.round((video.lastWatchedSeconds / video.durationSeconds) * 100)
          )
        : 40;
    return <InProgressRing progress={pct} />;
  }
  return <NotStartedRing />;
}

// ─── Video modal ────────────────────────────────────────────────────────────

function VideoModal({
  video,
  onClose,
  onMarkCompleted,
}: {
  video: Video;
  onClose: () => void;
  onMarkCompleted: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-colors"
          aria-label="Close video"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="absolute top-0 left-0 right-0 z-10 px-5 pt-4 pb-12 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <p className="text-sm font-medium text-white truncate pr-10">
            {video.title}
          </p>
        </div>

        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        {/* Bottom bar: Mark as completed */}
        <div className="flex items-center justify-between px-5 py-3 bg-zinc-900">
          <span className="text-xs text-zinc-400 truncate">
            {video.title}
          </span>
          {video.status !== "completed" && (
            <button
              onClick={onMarkCompleted}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
              Mark as completed
            </button>
          )}
          {video.status === "completed" && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
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

export default function CourseContent({ course }: { course: Course }) {
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);

  // Local overrides for video statuses — keyed by video.id
  // Merged on top of the server-supplied `course.videos` so UI updates instantly.
  const [localStatuses, setLocalStatuses] = useState<
    Record<string, { status: string; lastWatchedSeconds?: number | null }>
  >({});

  /** Merge a status change into local state and persist via API */
  function updateVideoStatus(
    videoId: string,
    status: string,
    lastWatchedSeconds?: number | null
  ) {
    setLocalStatuses((prev) => ({
      ...prev,
      [videoId]: { status, lastWatchedSeconds },
    }));

    fetch(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, lastWatchedSeconds }),
    }).catch(() => {
      // Revert on failure (silent — user can retry)
    });
  }

  /** Open modal for a video and mark it as "watching" if not already done */
  function handlePlayVideo(video: Video) {
    setPlayingVideo(video);
    if (video.status !== "watching" && video.status !== "completed") {
      updateVideoStatus(video.id, "watching");
    }
  }

  /** Mark video as completed, close modal */
  function handleMarkCompleted(videoId: string) {
    updateVideoStatus(videoId, "completed", null);
    setPlayingVideo(null);
  }

  /** Resolve a video's effective status by merging local overrides on top of server data */
  function resolveVideo(v: Video): Video {
    const local = localStatuses[v.id];
    if (!local) return v;
    return {
      ...v,
      status: local.status,
      lastWatchedSeconds: local.lastWatchedSeconds !== undefined ? local.lastWatchedSeconds : v.lastWatchedSeconds,
    };
  }

  const resolvedVideos = course.videos.map(resolveVideo);
  const completedCount = resolvedVideos.filter(
    (v) => v.status === "completed"
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        Back to Dashboard
      </Link>

      {/* Course header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-full sm:w-72 aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
          {course.thumbnailUrl && (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {course.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              {course._count.videos} video{course._count.videos !== 1 ? "s" : ""}
            </span>
            {completedCount > 0 && (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {completedCount} completed
              </span>
            )}
          </div>
          {/* Progress bar */}
          {course._count.videos > 0 && (
            <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(
                    (completedCount / course._count.videos) * 100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Video list */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Videos
      </h2>
      <div className="space-y-2">
        {resolvedVideos.map((video) => {
          const isComplete = video.status === "completed";
          const isInProgress = video.status === "watching";

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
            <div
              key={video.id}
              onClick={() => video.isAvailable && handlePlayVideo(video)}
              className={`relative group flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 pl-4 transition-all duration-150 overflow-hidden cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${!video.isAvailable ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {/* Completed row green tint overlay */}
              {isComplete && (
                <div className="absolute inset-0 pointer-events-none bg-green-500/5" />
              )}

              {/* Vertical accent bar on far-left edge */}
              {accentColor && (
                <div
                  className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full ${accentColor}`}
                />
              )}

              {/* Status indicator — click to toggle completed */}
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

              {/* Thumbnail */}
              <div className="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                {video.thumbnailUrl && (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {video.title}
                </h3>
                <p
                  className={`text-xs mt-0.5 capitalize transition-colors duration-150 ${statusTextColor}`}
                >
                  {video.status === "watching"
                    ? "In Progress"
                    : video.status.replace("_", " ")}
                  {video.durationSeconds &&
                    ` · ${Math.floor(video.durationSeconds / 60)}:${String(
                      video.durationSeconds % 60
                    ).padStart(2, "0")}`}
                </p>
              </div>

              {/* Play button */}
              {video.isAvailable ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayVideo(video);
                  }}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out overflow-hidden w-9 group-hover:w-[4.2rem]"
                  aria-label={`Play ${video.title}`}
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0 ml-[0.5625rem]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                    Play
                  </span>
                </button>
              ) : (
                <span className="text-xs text-red-500 dark:text-red-400 shrink-0">
                  Unavailable
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Video modal */}
      {playingVideo && (
        <VideoModal
          video={resolveVideo(playingVideo)}
          onClose={() => setPlayingVideo(null)}
          onMarkCompleted={() => handleMarkCompleted(playingVideo.id)}
        />
      )}
    </div>
  );
}
