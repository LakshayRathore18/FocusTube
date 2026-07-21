"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, CheckCircle2, RefreshCw, BookOpen } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  _count: { videos: number; completedVideos: number; inProgressVideos: number };
  remainingDurationSeconds: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Courses</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Loading your courses...</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden animate-pulse">
            <div className="aspect-video bg-gray-200 dark:bg-zinc-800" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-gray-200 dark:bg-zinc-800 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-2 bg-gray-200 dark:bg-zinc-800 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Error State
// ═══════════════════════════════════════════════════════════════════════════

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Courses</h1>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
          Failed to load your courses.
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty State (only shown after successful fetch with zero results)
// ═══════════════════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Courses</h1>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-md">
          No courses yet. Import your first YouTube playlist from the Dashboard to get started.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Course Card
// ═══════════════════════════════════════════════════════════════════════════

function CourseCard({ course }: { course: Course }) {
  const completed = course._count.completedVideos;
  const total = course._count.videos;
  const pct = progressPercent(completed, total);
  const hasInProgress = course._count.inProgressVideos > 0;
  const timeLeft = course.remainingDurationSeconds;

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-lg transition-shadow">
      <Link href={`/courses/${course.id}`} className="block">
        <div className="aspect-video bg-gray-100 dark:bg-zinc-800 relative">
          {course.thumbnailUrl && (
            <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
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

        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400">{completed}/{total} completed</span>
              <span className="text-gray-500 dark:text-gray-400">{pct}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            {timeLeft > 0 && pct < 100 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">~{formatTimeLeft(timeLeft)}</p>
            )}
          </div>
        )}

        <div className="flex-1" />

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
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Courses Page (Client Component)
// ═══════════════════════════════════════════════════════════════════════════

export default function CoursesClientPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<CourseFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  // ── Explicit loading and error states ──────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch("/api/courses", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setCourses(data);
        } else {
          throw new Error("Invalid response format");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load courses");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const processedCourses = useMemo(() => {
    let filtered = [...courses];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => c.title.toLowerCase().includes(q));
    }
    if (activeFilter !== "all") {
      filtered = filtered.filter((c) => getCourseFilterKey(c) === activeFilter);
    }
    if (sortKey === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortKey === "progress") {
      filtered.sort((a, b) => {
        const pctA = progressPercent(a._count.completedVideos, a._count.videos);
        const pctB = progressPercent(b._count.completedVideos, b._count.videos);
        return pctB - pctA;
      });
    }
    return filtered;
  }, [courses, searchQuery, activeFilter, sortKey]);

  // ── Four distinct render paths ─────────────────────────────────

  // 1. Loading
  if (loading) {
    return <LoadingSkeleton />;
  }

  // 2. Error
  if (error) {
    return <ErrorState onRetry={fetchCourses} />;
  }

  // 3. Loaded and empty (courses.length === 0 AFTER loading finished)
  if (courses.length === 0) {
    return <EmptyState />;
  }

  // 4. Loaded with courses
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Courses</h1>

      {/* Search + Filter + Sort */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses by title..."
            className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === f.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="appearance-none rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Course grid */}
      {processedCourses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">No courses match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {processedCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}