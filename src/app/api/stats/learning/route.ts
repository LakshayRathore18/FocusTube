import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/stats/learning
 *
 * Returns learning statistics for the authenticated user:
 *   - totalPlaylists: number of courses imported
 *   - completedVideos: count of videos with status "completed"
 *   - totalVideos: count of all videos across all courses
 *   - personalNotes: count of all notes (one per video)
 *   - aiSummaries: count of videos where aiContentUnlockedAt is set
 *                    AND the shared AIContent row has status "ready"
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalPlaylists,
    totalVideos,
    completedVideos,
    personalNotes,
    unlockedVideos,
  ] = await Promise.all([
    db.course.count({ where: { userId } }),
    db.video.count({ where: { course: { userId } } }),
    db.video.count({ where: { course: { userId }, status: "completed" } }),
    db.note.count({
      where: { video: { course: { userId } } },
    }),
    db.video.findMany({
      where: { course: { userId }, aiContentUnlockedAt: { not: null } },
      select: { youtubeVideoId: true },
    }),
  ]);

  // Count only those with aiContentUnlockedAt where AIContent.status === "ready"
  let aiSummaries = 0;
  if (unlockedVideos.length > 0) {
    const youtubeIds = unlockedVideos.map((v) => v.youtubeVideoId);
    const aiRows = await db.aIContent.findMany({
      where: { youtubeVideoId: { in: youtubeIds }, status: "ready" },
      select: { id: true },
    });
    aiSummaries = aiRows.length;
  }

  return NextResponse.json({
    totalPlaylists,
    totalVideos,
    completedVideos,
    personalNotes,
    aiSummaries,
  });
}