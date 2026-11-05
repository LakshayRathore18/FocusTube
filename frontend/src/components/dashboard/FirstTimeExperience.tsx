"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Rocket, Plus } from "lucide-react";

const DEMO_PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLxwd9rWENEb9nmHty90htveSgrtNGz2S5";

const FEATURES = [
  "Track learning progress",
  "AI-generated summaries",
  "Organize notes by course",
  "Distraction-free learning",
];

/**
 * FirstTimeExperience — shown when the user has 0 imported playlists.
 *
 * Displays:
 *   - Welcome message + feature list
 *   - "Import Demo Playlist" primary CTA (reuses POST /api/courses)
 *   - Divider + normal import input as secondary CTA
 *
 * After a successful import, navigates to the course page.
 * The parent component will re-render and show the normal dashboard
 * because the playlist count will be > 0 on next fetch.
 */
export default function FirstTimeExperience() {
  const router = useRouter();

  // Demo import state
  const [demoImporting, setDemoImporting] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Custom import state
  const [url, setUrl] = useState("");
  const [customImporting, setCustomImporting] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const importPlaylist = useCallback(async (
    playlistUrl: string,
    setImporting: (v: boolean) => void,
    setError: (v: string | null) => void,
  ) => {
    setError(null);
    setImporting(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: playlistUrl }),
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
        setImporting(false);
        return;
      }

      router.push(`/courses/${data.courseId}`);
    } catch {
      setError("Network error — please try again");
      setImporting(false);
    }
  }, [router]);

  const handleDemoImport = useCallback(() => {
    importPlaylist(DEMO_PLAYLIST_URL, setDemoImporting, setDemoError);
  }, [importPlaylist]);

  const handleCustomImport = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    importPlaylist(url, setCustomImporting, setCustomError);
  }, [url, importPlaylist]);

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* Welcome */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to FocusTube
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Turn any YouTube playlist into a structured learning course.
        </p>
      </div>

      {/* Features */}
      <div className="mb-8">
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="space-y-3">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary CTA — Demo Playlist */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
          Explore FocusTube instantly using our curated demo playlist.
        </p>
        <button
          onClick={handleDemoImport}
          disabled={demoImporting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Rocket className="w-4 h-4" />
          {demoImporting ? "Importing..." : "Import Demo Playlist"}
        </button>
        {demoError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center">{demoError}</p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">OR</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
      </div>

      {/* Secondary CTA — Custom Import */}
      <form onSubmit={handleCustomImport}>
        <label htmlFor="onboarding-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Import your own playlist
        </label>
        <div className="flex gap-3">
          <input
            id="onboarding-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube playlist URL or ID..."
            className="flex-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={customImporting}
          />
          <button
            type="submit"
            disabled={customImporting || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            {customImporting ? "Importing..." : "Import"}
          </button>
        </div>
        {customError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{customError}</p>
        )}
      </form>
    </div>
  );
}