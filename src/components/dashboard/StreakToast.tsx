"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Flame } from "lucide-react";

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  todayCompleted: boolean;
  weeklyActivity: boolean[];
};

/**
 * StreakToast — shows a small celebratory toast after the user's first
 * learning activity of the day (video completion, note creation, AI summary).
 *
 * It listens for a custom DOM event dispatched by other parts of the app.
 *
 * Usage (from anywhere in the app):
 *   window.dispatchEvent(new CustomEvent("streak-activity"));
 *
 * The toast automatically dismisses after 3.5 seconds.
 */
export default function StreakToast() {
  const [visible, setVisible] = useState(false);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [fading, setFading] = useState(false);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const show = useCallback(() => {
    fetch("/api/stats/streak")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.currentStreak === "number") {
          setStreak(data);
          setVisible(true);
          setFading(false);

          // Auto-dismiss after 3.5 seconds
          hideTimerRef.current = setTimeout(() => {
            setFading(true);
            fadeTimerRef.current = setTimeout(() => {
              setVisible(false);
              setStreak(null);
            }, 300);
          }, 3500);
        }
      })
      .catch((err) => { console.error("Failed to load streak:", err); });
  }, []);

  useEffect(() => {
    window.addEventListener("streak-activity", show);
    return () => {
      window.removeEventListener("streak-activity", show);
      // Cleanup timers when component unmounts or show ref changes
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-xs rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden transition-all duration-300 ${
        fading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Streak Updated
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {streak?.currentStreak ?? 0} Day Streak — See you tomorrow!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}