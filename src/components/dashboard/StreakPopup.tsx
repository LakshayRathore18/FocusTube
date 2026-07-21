"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame } from "lucide-react";

const SHOWN_KEY = "focustube-streak-popup-date";

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  todayCompleted: boolean;
  weeklyActivity: boolean[];
};

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * StreakPopup — shown once per calendar day when the user first opens the app.
 * Stores the last shown date in localStorage so it doesn't reappear on refresh.
 */
export default function StreakPopup() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if we've already shown the popup today
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(SHOWN_KEY);

    if (lastShown === today) {
      setLoading(false);
      setDismissed(true);
      return;
    }

    // Fetch streak data
    fetch("/api/stats/streak")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.currentStreak === "number") {
          setStreak(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load streak:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(SHOWN_KEY, today);
    setDismissed(true);
  }, []);

  // Don't render anything if not visible
  if (loading || dismissed || !streak) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Content */}
        <div className="p-6 text-center">
          {/* Fire + Welcome */}
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Flame className="w-7 h-7 text-orange-500" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Welcome Back!
          </h2>

          {/* Streak count */}
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-4">
            {streak.currentStreak}
            <span className="text-base font-medium text-gray-400 dark:text-gray-500 ml-1">
              Day{streak.currentStreak !== 1 ? "s" : ""}
            </span>
          </p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
            Current Streak
          </p>

          {/* Weekly tracker */}
          <div className="flex items-center justify-center gap-2 mt-5 mb-4">
            {WEEK_LABELS.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{day}</span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                    streak.weeklyActivity[i]
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {streak.weeklyActivity[i] ? "●" : "○"}
                </div>
              </div>
            ))}
          </div>

          {/* Longest streak */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="text-xs text-gray-400 dark:text-gray-500">Longest: {streak.longestStreak} Days</span>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Keep learning today to maintain your streak.
          </p>

          {/* Button */}
          <button
            onClick={handleDismiss}
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Continue Learning
          </button>
        </div>
      </div>
    </div>
  );
}