"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Book, FileText, Sparkles, Clock, Plus } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContinueVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  lastWatchedSeconds: number | null;
  isAvailable: boolean;
  updatedAt: string;
  course: { id: string; title: string };
};

type LearningStats = {
  totalPlaylists: number;
  totalVideos: number;
  completedVideos: number;
  personalNotes: number;
  aiSummaries: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getMotivationalLine(): string {
  const lines = [
    "Continue where you left off.",
    "Ready for another learning session?",
    "Pick up where you stopped.",
    "One more video today?",
    "Keep the momentum going.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
// Continue Learning — Compact Horizontal Card
// ═══════════════════════════════════════════════════════════════════════════

function ContinueLearning({ video }: { video: ContinueVideo | null }) {
  if (!video) return null;

  const progress = video.durationSeconds && video.lastWatchedSeconds
    ? Math.min(100, Math.round((video.lastWatchedSeconds / video.durationSeconds) * 100))
    : 0;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Continue Learning
      </h2>
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:shadow-md transition-shadow">
        {/* Thumbnail — fixed 180px width, 16:9 ratio */}
        <div className="relative w-[180px] shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800">
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
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
            {video.course.title}
          </p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate mt-0.5">
            {video.title}
          </h3>

          {/* Progress */}
          {progress > 0 && (
            <div className="mt-2 max-w-[200px]">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-gray-400 dark:text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Resume Button */}
        <Link
          href={`/courses/${video.course.id}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 px-4 py-2 text-xs font-semibold text-white transition-colors"
        >
          <Play className="w-3.5 h-3.5" fill="currentColor" />
          Resume
        </Link>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Recently Watched — max 4 items
// ═══════════════════════════════════════════════════════════════════════════

function RecentlyWatched({ videos }: { videos: ContinueVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Recently Watched
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {videos.slice(0, 4).map((video) => (
          <Link
            key={video.id}
            href={`/courses/${video.course.id}`}
            className="group flex gap-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all"
          >
            <div className="relative w-[88px] shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800">
              {video.thumbnailUrl && (
                <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="text-xs font-medium text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {video.title}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">
                {video.course.title}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-2.5 h-2.5 text-gray-400" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatTimeAgo(video.updatedAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick Stats
// ═══════════════════════════════════════════════════════════════════════════

function QuickStats({ stats }: { stats: LearningStats | null }) {
  if (!stats) return null;

  const items = [
    { icon: <Book className="w-4 h-4" />, label: "Playlists", value: stats.totalPlaylists },
    { icon: <Play className="w-4 h-4" />, label: "Videos Done", value: `${stats.completedVideos} / ${stats.totalVideos}` },
    { icon: <FileText className="w-4 h-4" />, label: "Notes", value: stats.personalNotes },
    { icon: <Sparkles className="w-4 h-4" />, label: "AI Summaries", value: stats.aiSummaries },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Overview
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {item.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Import Playlist
// ═══════════════════════════════════════════════════════════════════════════

function ImportPlaylist() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(async (e: React.FormEvent) => {
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
      try { data = await res.json(); } catch {
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
  }, [url, router]);

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Import Playlist
      </h2>
      <form onSubmit={handleImport}>
        <div className="flex gap-3">
          <input
            id="playlist-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube playlist URL or ID..."
            className="flex-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={importing}
          />
          <button
            type="submit"
            disabled={importing || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { data: session } = useSession();
  const [continueVideo, setContinueVideo] = useState<ContinueVideo | null>(null);
  const [recentVideos, setRecentVideos] = useState<ContinueVideo[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    setFetchError(null);
    fetch("/api/videos/continue-watching")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data) && data.length > 0) setContinueVideo(data[0]); })
      .catch((err) => { console.error("Failed to load continue-watching:", err); setFetchError("Could not load dashboard data."); });

    fetch("/api/videos/recently-watched")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setRecentVideos(data); })
      .catch((err) => { console.error("Failed to load recently watched:", err); setFetchError("Could not load dashboard data."); });

    fetch("/api/stats/learning")
      .then((res) => res.json())
      .then((data) => { if (data && typeof data.totalPlaylists === "number") setStats(data); })
      .catch((err) => { console.error("Failed to load stats:", err); setFetchError("Could not load dashboard data."); });
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const greeting = getGreeting();
  const line = getMotivationalLine();
  const userName = session?.user?.name ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-10">
      {/* Greeting — compact */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {greeting}, {userName ?? "Learner"} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{line}</p>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-700/50 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{fetchError}</p>
          <button
            onClick={loadDashboard}
            className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Continue Learning */}
      <ContinueLearning video={continueVideo} />

      {/* Recently Watched */}
      <RecentlyWatched videos={recentVideos} />

      {/* Quick Statistics */}
      <QuickStats stats={stats} />

      {/* Import Playlist */}
      <ImportPlaylist />
    </div>
  );
}