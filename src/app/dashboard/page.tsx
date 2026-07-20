"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Play, ArrowUpDown } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  _count: { videos: number; completedVideos: number; inProgressVideos: number };
  remainingDurationSeconds: number;
};

type ContinueVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  lastWatchedSeconds: number | null;
  isAvailable: boolean;
  updatedAt: string;
  course: {
    id: string;
    title: string;
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function progressPercent(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function formatTimeLeft(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

type CourseFilter = "all" | "in_progress" | "completed" | "not_started";
type SortKey = "recent" | "title" | "progress";

const FILTERS: { key: CourseFilter; label: string }[] = [
  { key: "all", label: "All Courses" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "not_started", label: "Not Started" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently Updated" },
  { key: "title", label: "Title A-Z" },
  { key: "progress", label: "Progress" },
];

function getCourseFilterKey(course: Course): CourseFilter | null {
  const { videos, completedVideos, inProgressVideos } = course._count;
  if (videos === 0) return null;
  if (completedVideos === videos) return "completed";
  if (inProgressVideos > 0) return "in_progress";
  return "not_started";
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueVideo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<CourseFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  // Fetch courses on mount
  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCourses(data);
      })
      .catch(() => {});
  }, []);

  // Fetch continue-watching videos
  useEffect(() => {
    fetch("/api/videos/continue-watching")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setContinueWatching(data);
      })
      .catch(() => {});
  }, []);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setImporting(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        // Response wasn't JSON — try reading as text to show the actual error
        const text = await res.text().catch(() => "");
        setError(text ? `Server error: ${text.slice(0, 200)}` : "Server returned an invalid response");
        setImporting(false);
        return;
      }

      if (!res.ok) {
        if (res.status === 409 && data.courseId) {
          router.push(`/courses/${data.courseId}`);
          return;
        }
        setError((data.error as string) ?? "Failed to import playlist");
        return;
      }

      router.push(`/courses/${data.courseId}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setImporting(false);
    }
  }

  // Compute derived data
  const processedCourses = useMemo(() => {
    // 1. Filter
    let filtered = [...courses];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => c.title.toLowerCase().includes(q));
    }

    if (activeFilter !== "all") {
      filtered = filtered.filter((c) => getCourseFilterKey(c) === activeFilter);
    }

    // 2. Sort
    if (sortKey === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortKey === "progress") {
      filtered.sort((a, b) => {
        const pctA = progressPercent(a._count.completedVideos, a._count.videos);
        const pctB = progressPercent(b._count.completedVideos, b._count.videos);
        return pctB - pctA; // highest progress first
      });
    }
    // "recent" is already sorted by API (updatedAt desc), keep that order

    return filtered;
  }, [courses, searchQuery, activeFilter, sortKey]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-0 pb-8">
      {/* ── Continue Watching ──────────────────────────────────────────── */}
      {continueWatching.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Continue Watching
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueWatching.map((video) => (
              <Link
                key={video.id}
                href={`/courses/${video.course.id}`}
                className="group relative flex gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700 transition-all"
              >
                {/* Thumbnail */}
                <div className="relative w-28 shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {video.isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  )}
                  {video.durationSeconds && (
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[10px] font-medium text-white">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {video.course.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      In Progress
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Import form ────────────────────────────────────────────────── */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        My Courses
      </h1>

      <form onSubmit={handleImport} className="mb-6">
        <label htmlFor="playlist-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Import a YouTube playlist
        </label>
        <div className="flex gap-3">
          <input
            id="playlist-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube playlist URL or ID..."
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={importing}
          />
          <button
            type="submit"
            disabled={importing || !url.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </form>

      {/* ── Search + Filter + Sort bar ─────────────────────────────────── */}
      {courses.length > 0 && (
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses by title..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter chips + Sort */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* ── Course list ─────────────────────────────────────────────────── */}
      {courses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No courses yet. Import a YouTube playlist to get started.
          </p>
        </div>
      ) : processedCourses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No courses match your filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {processedCourses.map((course) => {
            const completed = course._count.completedVideos;
            const total = course._count.videos;
            const pct = progressPercent(completed, total);
            const hasInProgress = course._count.inProgressVideos > 0;
            const timeLeft = course.remainingDurationSeconds;

            return (
              <div
                key={course.id}
                className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link href={`/courses/${course.id}`} className="block">
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative">
                    {course.thumbnailUrl && (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <Link href={`/courses/${course.id}`}>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {total} video{total !== 1 ? "s" : ""}
                  </p>

                  {/* Progress bar + time left */}
                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">
                          {completed}/{total} completed
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {/* Time left estimate */}
                      {timeLeft > 0 && pct < 100 && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                          ~{formatTimeLeft(timeLeft)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Continue Learning button */}
                  {total > 0 && pct < 100 && (
                    <Link
                      href={`/courses/${course.id}`}
                      className="mt-4 block w-full text-center rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      {hasInProgress ? "Continue Learning" : "Start Course"}
                    </Link>
                  )}
                  {pct === 100 && total > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Completed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
