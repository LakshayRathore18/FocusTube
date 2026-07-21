import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/stats/streak
 *
 * Computes the user's learning streak from video completion data.
 *
 * Streak logic:
 *   - A "study day" is any day with at least one completed video
 *     OR any day where a note was updated (studied without completing).
 *   - Current streak: number of consecutive days ending today (or yesterday
 *     if today hasn't seen any activity yet).
 *   - Longest streak: longest consecutive run of study days on record.
 *
 * Returns:
 *   - currentStreak: number of consecutive days
 *   - longestStreak: longest ever streak
 *   - todayCompleted: whether the user has studied today
 *   - weeklyActivity: array of 7 booleans for Mon-Sun this week
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all video completion dates and note update dates for this user
  const [completedVideos, updatedNotes] = await Promise.all([
    db.video.findMany({
      where: { course: { userId }, completedAt: { not: null } },
      select: { completedAt: true },
    }),
    db.note.findMany({
      where: { video: { course: { userId } } },
      select: { updatedAt: true },
    }),
  ]);

  // Collect all unique study dates (UTC date strings)
  const studyDates = new Set<string>();

  for (const v of completedVideos) {
    if (v.completedAt) {
      const d = new Date(v.completedAt);
      studyDates.add(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
  }
  for (const n of updatedNotes) {
    const d = new Date(n.updatedAt);
    studyDates.add(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }

  // Sort unique dates
  const sorted = [...studyDates].sort();
  if (sorted.length === 0) {
    return NextResponse.json({
      currentStreak: 0,
      longestStreak: 0,
      todayCompleted: false,
      weeklyActivity: [false, false, false, false, false, false, false],
    });
  }

  // ── Compute longest streak (any consecutive run) ──────────────
  let longestStreak = 1;
  let currentRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentRun);

  // ── Compute current streak ──────────────────────────────────
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // If today or yesterday is a study day, walk backwards from the most
  // recent study day to count consecutive days.
  const lastStudyDay = sorted[sorted.length - 1];
  const isTodayActive = studyDates.has(todayStr);

  let currentStreak = 0;
  if (isTodayActive || studyDates.has(yesterdayStr)) {
    // Walk backwards from the most recent study day
    let walkDate = new Date(lastStudyDay);
    while (true) {
      const walkStr = walkDate.toISOString().slice(0, 10);
      if (studyDates.has(walkStr)) {
        currentStreak++;
        walkDate.setDate(walkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // ── Weekly activity (Mon-Sun for current week) ─────────────
  // Get Monday of this week
  const monday = new Date(today);
  const dayOfWeek = monday.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + mondayOffset);

  const weeklyActivity: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    weeklyActivity.push(studyDates.has(dStr));
  }

  return NextResponse.json({
    currentStreak,
    longestStreak,
    todayCompleted: isTodayActive,
    weeklyActivity,
  });
}