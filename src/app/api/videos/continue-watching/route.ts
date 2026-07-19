import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/videos/continue-watching
 *
 * Returns up to 3 videos with status = in_progress that belong to the
 * authenticated user, ordered by most recently updated first.
 * Each video includes the parent course's id and title so the dashboard
 * can deep-link the user back into the course player.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videos = await db.video.findMany({
    where: {
      status: "in_progress",
      course: { userId },
    },
    include: {
      course: {
        select: { id: true, title: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  // Serialize dates to strings so the client can consume them safely
  const result = videos.map((v) => ({
    id: v.id,
    youtubeVideoId: v.youtubeVideoId,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    durationSeconds: v.durationSeconds,
    lastWatchedSeconds: v.lastWatchedSeconds,
    isAvailable: v.isAvailable,
    updatedAt: v.updatedAt.toISOString(),
    course: {
      id: v.course.id,
      title: v.course.title,
    },
  }));

  return NextResponse.json(result);
}
