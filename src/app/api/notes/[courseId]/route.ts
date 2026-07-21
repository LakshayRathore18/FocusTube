import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/notes/[courseId]?tab=personal|ai
 *
 * Returns videos in a course that have either personal notes or AI summaries.
 *
 * For tab=personal: Returns videos that have at least one Note, ordered by note updatedAt desc.
 *   Each item includes: video info + note id, note content preview, note updatedAt
 *
 * For tab=ai: Returns videos where aiContentUnlockedAt is set AND AIContent status is "ready",
 *   ordered by video updatedAt desc (most recent AI unlock first).
 *   Each item includes: video info + AIContent status, AIContent updatedAt (generation date)
 *
 * Ownership enforced via: Course → User.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  // Verify ownership
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { userId: true, title: true, thumbnailUrl: true },
  });

  if (!course || course.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(_request.url);
  const tab = url.searchParams.get("tab") ?? "personal";

  // ── Personal Notes Tab ──────────────────────────────────────────
  if (tab === "personal") {
    // Fetch only videos that have notes, including the note data
    const notes = await db.note.findMany({
      where: {
        video: {
          courseId,
        },
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            youtubeVideoId: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = notes.map((note) => ({
      videoId: note.video.id,
      videoTitle: note.video.title,
      youtubeVideoId: note.video.youtubeVideoId,
      thumbnailUrl: note.video.thumbnailUrl,
      noteId: note.id,
      contentPreview: note.content.slice(0, 150),
      updatedAt: note.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      courseTitle: course.title,
      thumbnailUrl: course.thumbnailUrl,
      videos: result,
    });
  }

  // ── AI Summaries Tab ────────────────────────────────────────────
  if (tab === "ai") {
    // Fetch videos that have AI content unlocked
    const videosWithAi = await db.video.findMany({
      where: {
        courseId,
        aiContentUnlockedAt: { not: null },
      },
      include: {
        notes: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { aiContentUnlockedAt: "desc" },
    });

    // Get the shared AIContent status for each video's youtubeVideoId
    const youtubeIds = videosWithAi.map((v) => v.youtubeVideoId);
    const aiRows = await db.aIContent.findMany({
      where: { youtubeVideoId: { in: youtubeIds } },
      select: { youtubeVideoId: true, status: true, updatedAt: true },
    });
    const aiByYoutubeId = new Map(aiRows.map((a) => [a.youtubeVideoId, a]));

    const result = videosWithAi
      .map((video) => {
        const ai = aiByYoutubeId.get(video.youtubeVideoId);
        // Only include if status is "ready"
        if (!ai || ai.status !== "ready") return null;
        return {
          videoId: video.id,
          videoTitle: video.title,
          youtubeVideoId: video.youtubeVideoId,
          thumbnailUrl: video.thumbnailUrl,
          status: "ready",
          generatedAt: ai.updatedAt.toISOString(),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      courseTitle: course.title,
      thumbnailUrl: course.thumbnailUrl,
      videos: result,
    });
  }

  return NextResponse.json({ error: "Invalid tab parameter" }, { status: 400 });
}