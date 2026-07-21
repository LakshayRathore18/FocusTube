import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/videos/recently-watched
 *
 * Returns up to 6 videos with status = in_progress (or completed that were
 * recently interacted with), ordered by updatedAt desc.
 *
 * Each video includes the parent course's id and title.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch videos that have been watched (in_progress or completed), ordered by recency
  const videos = await db.video.findMany({
    where: {
      status: { in: ["in_progress", "completed"] },
      course: { userId },
    },
    include: {
      course: {
        select: { id: true, title: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

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