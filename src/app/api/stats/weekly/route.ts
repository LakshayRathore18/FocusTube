import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/stats/weekly
 *
 * Returns weekly progress stats for the sidebar's "Weekly Progress" card:
 *   - videosCompletedThisWeek: count of videos completed in last 7 days
 *   - watchTimeThisWeek: total durationSeconds sum of those videos
 *   - totalVideosCompleted: all-time completed count
 *   - totalVideosCount: total videos owned by user
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [thisWeekCompleted, totalCompleted, totalVideosCount] = await Promise.all([
    // Videos completed this week with their durations
    db.video.findMany({
      where: {
        course: { userId },
        status: "completed",
        completedAt: { gte: sevenDaysAgo },
      },
      select: { durationSeconds: true },
    }),
    // All-time completed count
    db.video.count({
      where: { course: { userId }, status: "completed" },
    }),
    // Total videos in all courses
    db.video.count({
      where: { course: { userId } },
    }),
  ]);

  const videosCompletedThisWeek = thisWeekCompleted.length;
  const watchTimeThisWeek = thisWeekCompleted.reduce(
    (sum, v) => sum + (v.durationSeconds ?? 0),
    0
  );

  return NextResponse.json({
    videosCompletedThisWeek,
    watchTimeThisWeek,
    totalVideosCompleted: totalCompleted,
    totalVideosCount,
  });
}
