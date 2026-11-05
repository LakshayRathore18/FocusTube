"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertCircle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncResult = {
  added: number;
  updated: number;
  archived: number;
  total: number;
};

type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "success"; result: SyncResult }
  | { kind: "error"; message: string };

// ─── Sync Result Banner ───────────────────────────────────────────────────────

function SyncResultBanner({
  state,
  onDismiss,
}: {
  state: SyncState;
  onDismiss: () => void;
}) {
  if (state.kind === "idle" || state.kind === "syncing") return null;

  if (state.kind === "error") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Sync failed
          </p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
            {state.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-0.5 rounded text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Success
  const { added, updated, archived } = state.result;
  const hasChanges = added > 0 || archived > 0;

  const items: string[] = [];
  if (added > 0) items.push(`${added} new video${added !== 1 ? "s" : ""} added`);
  if (updated > 0) items.push(`${updated} video${updated !== 1 ? "s" : ""} updated`);
  if (archived > 0)
    items.push(`${archived} video${archived !== 1 ? "s" : ""} archived`);
  if (!hasChanges && updated === 0) items.push("Already up to date");

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Playlist synced successfully
        </p>
        <ul className="mt-1 space-y-0.5">
          {items.map((item) => (
            <li key={item} className="text-xs text-emerald-600 dark:text-emerald-500">
              • {item}
            </li>
          ))}
        </ul>
        {archived > 0 && (
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-600 mt-1.5">
            Archived videos still show your notes, summaries, and quizzes.
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main SyncButton component ────────────────────────────────────────────────

interface SyncButtonProps {
  courseId: string;
  /** Called after a successful sync so the parent can refresh the course data */
  onSyncComplete: () => void;
}

export default function SyncButton({ courseId, onSyncComplete }: SyncButtonProps) {
  const router = useRouter();
  const [syncState, setSyncState] = useState<SyncState>({ kind: "idle" });

  const handleSync = useCallback(async () => {
    if (syncState.kind === "syncing") return;

    setSyncState({ kind: "syncing" });

    try {
      const res = await fetch(`/api/courses/${courseId}/sync`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setSyncState({
          kind: "error",
          message: data.error ?? `Server error (${res.status})`,
        });
        return;
      }

      setSyncState({ kind: "success", result: data as SyncResult });
      // Refresh server data so the video list reflects additions/archives
      router.refresh();
      onSyncComplete();
    } catch {
      setSyncState({
        kind: "error",
        message: "Network error — please check your connection and try again.",
      });
    }
  }, [courseId, router, onSyncComplete, syncState.kind]);

  const handleDismiss = useCallback(() => {
    setSyncState({ kind: "idle" });
  }, []);

  const isSyncing = syncState.kind === "syncing";

  return (
    <div>
      {/* Sync trigger button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          syncState.kind === "success"
            ? "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            : "border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
        }`}
        aria-label="Sync playlist with YouTube"
        title="Fetch the latest playlist from YouTube and update this course"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Syncing..." : "Sync Playlist"}
      </button>

      {/* Result banner — rendered below the button in the parent layout */}
      <SyncResultBanner state={syncState} onDismiss={handleDismiss} />
    </div>
  );
}
