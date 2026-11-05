"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Book, FileText, Sparkles, Clock } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type CourseOverview = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  videoCount: number;
  personalNotesCount: number;
  aiSummaryCount: number;
  progressPct: number;
  completedVideos: number;
  lastStudied: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Course Card ─────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: CourseOverview }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/learning/${course.id}`)}
      className="group w-full text-left rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 dark:bg-zinc-800 relative overflow-hidden">
        {course.thumbnailUrl && (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {/* Gradient overlay at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
          {course.title}
        </h3>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Book className="w-3.5 h-3.5" />
            {course.videoCount} video{course.videoCount !== 1 ? "s" : ""}
          </span>
          {course.personalNotesCount > 0 && (
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <FileText className="w-3.5 h-3.5" />
              {course.personalNotesCount} note{course.personalNotesCount !== 1 ? "s" : ""}
            </span>
          )}
          {course.aiSummaryCount > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              {course.aiSummaryCount} summar{course.aiSummaryCount !== 1 ? "ies" : "y"}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {course.videoCount > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400 dark:text-gray-500">
                {course.completedVideos}/{course.videoCount} completed
              </span>
              <span className="text-gray-400 dark:text-gray-500">{course.progressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${course.progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Last studied */}
        {course.lastStudied && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Studied {formatTimeAgo(course.lastStudied)}</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden animate-pulse">
          <div className="aspect-video bg-gray-200 dark:bg-zinc-800" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-gray-200 dark:bg-zinc-800 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-1/2" />
            <div className="h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-lg max-w-sm">
        No courses yet — import a YouTube playlist to start learning and taking notes.
      </p>
    </div>
  );
}

// ─── Main Course Library Component ──────────────────────────────────────────

export default function CourseLibrary() {
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadCourses = useCallback(() => {
    setFetchError(null);
    setLoading(true);
    fetch("/api/notes/overview")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCourses(data);
      })
      .catch((err) => {
        console.error("Failed to load courses:", err);
        setFetchError("Could not load course library.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const filteredCourses = courses.filter((course) => {
    if (!searchQuery.trim()) return true;
    return course.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Loading state
  if (loading) {
    return (
      <div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-red-400 text-sm mb-3">{fetchError}</p>
        <button
          onClick={loadCourses}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (courses.length === 0) {
    return (
      <div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search courses..."
          className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
        />
      </div>

      {/* No results */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No courses match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}