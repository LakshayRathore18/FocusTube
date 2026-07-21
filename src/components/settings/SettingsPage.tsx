"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Book, Play, Percent, FileText, Sparkles, LogOut, ExternalLink, Flame } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type LearningStats = {
  totalPlaylists: number;
  totalVideos: number;
  completedVideos: number;
  personalNotes: number;
  aiSummaries: number;
};

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  todayCompleted: boolean;
  weeklyActivity: boolean[];
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {subtext && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="h-5 bg-gray-200 dark:bg-zinc-800 rounded w-24" />
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-5 bg-gray-200 dark:bg-zinc-800 rounded w-32" />
              <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-48" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-800" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-20" />
                <div className="h-7 bg-gray-200 dark:bg-zinc-800 rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Settings Page Component ────────────────────────────────────────────

export default function SettingsPageClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in");
    }
  }, [status, router]);

  useEffect(() => {
    fetch("/api/stats/learning")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalPlaylists === "number") {
          setStats(data);
        }
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/stats/streak")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.currentStreak === "number") {
          setStreak(data);
        }
      })
      .catch(() => {})
      .finally(() => setStreakLoading(false));
  }, []);

  // Loading state
  if (status === "loading" || (status === "authenticated" && statsLoading && !stats)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Manage your account and view your learning overview.
        </p>
        <LoadingSkeleton />
      </div>
    );
  }

  // Auth guard — redirect handled by useEffect
  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  const user = session.user;
  const completionRate =
    stats && stats.totalVideos > 0
      ? Math.round((stats.completedVideos / stats.totalVideos) * 100)
      : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Page Header */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Settings
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Manage your account and view your learning overview.
      </p>

      <div className="space-y-6">
        {/* ── Section 1: Account ──────────────────────────────────────── */}
        <SectionCard title="Account">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="shrink-0">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "Profile"}
                  width={64}
                  height={64}
                  className="rounded-full ring-2 ring-gray-200 dark:ring-zinc-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-zinc-700 flex items-center justify-center text-xl font-semibold text-gray-700 dark:text-gray-300">
                  {user.name?.[0] ?? "U"}
                </div>
              )}
            </div>

            {/* Name + Email */}
            <div className="min-w-0 flex-1">
              {user.name && (
                <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {user.name}
                </p>
              )}
              {user.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          {/* Sign Out */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </SectionCard>

        {/* ── Section 2: Your Learning ─────────────────────────────────── */}
        {stats && (
          <SectionCard title="Your Learning">
            {stats.totalPlaylists > 0 ? (
              <>
                {/* Streak info */}
                {streak && !streakLoading && (
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <Flame className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Current Streak: {streak.currentStreak} Days
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Longest: {streak.longestStreak} Days
                      </p>
                    </div>
                    {streak.todayCompleted && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Today: ✅</span>
                    )}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard
                    icon={<Book className="w-5 h-5" />}
                    label="Playlists Imported"
                    value={stats.totalPlaylists}
                  />
                  <StatCard
                    icon={<Play className="w-5 h-5" />}
                    label="Videos Completed"
                    value={`${stats.completedVideos} / ${stats.totalVideos}`}
                    subtext={stats.totalVideos > 0 ? `${stats.totalVideos - stats.completedVideos} remaining` : undefined}
                  />
                  <StatCard
                    icon={<Percent className="w-5 h-5" />}
                    label="Completion Rate"
                    value={`${completionRate}%`}
                  />
                  <StatCard
                    icon={<FileText className="w-5 h-5" />}
                    label="Personal Notes"
                    value={stats.personalNotes}
                  />
                  {stats.aiSummaries > 0 && (
                    <StatCard
                      icon={<Sparkles className="w-5 h-5" />}
                      label="AI Summaries"
                      value={stats.aiSummaries}
                    />
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                Import a YouTube playlist to start tracking your learning progress.
              </p>
            )}
          </SectionCard>
        )}

        {/* ── Section 3: About ────────────────────────────────────────── */}
        <SectionCard title="About">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                FocusTube
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                v{process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              FocusTube helps you learn from YouTube without distractions by organizing playlists, notes, and AI-powered learning resources.
            </p>
            <div className="pt-2">
              <a
                href="https://github.com/LakshayRathore18/FocusTube"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Source
              </a>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}