import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/courses/[id]/content-status
 *
 * Returns which videos have notes and which have AI content unlocked,
 * so the UI can pre-populate button states on page load.
 *
 * AI content is SHARED (keyed by youtubeVideoId). Per-user unlock is
 * tracked via Video.aiContentUnlockedAt — when a user triggers or
 * reuses AI content, their Video row gets a timestamp stamp.
 *
 * Response shape:
 *   Record<videoId, { hasNotes: boolean; aiStatus: string }>
 *
 * aiStatus values: "ready" | "pending" | "failed" | "none"
 *
 * Note: summary + quiz are intentionally excluded from this bulk endpoint.
 * The frontend lazily fetches them via GET /api/videos/[id]/ai-content
 * when the user opens the AI modal.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const course = await db.course.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!course || course.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch video rows with their aiContentUnlockedAt field
  const videos = await db.video.findMany({
    where: { courseId: id },
    select: { id: true, youtubeVideoId: true, aiContentUnlockedAt: true },
  });

  const videoIds = videos.map((v) => v.id);
  const youtubeVideoIds = videos.map((v) => v.youtubeVideoId);

  // Batch: which videos have notes?
  const notesRows = await db.note.findMany({
    where: { videoId: { in: videoIds } },
    select: { videoId: true },
  });
  const videoIdsWithNotes = new Set(notesRows.map((n) => n.videoId));

  // Batch: which videos have AI content (any status — ready, pending, or failed)?
  // summary + quiz are intentionally excluded — fetched lazily on modal open.
  const aiRows = await db.aIContent.findMany({
    where: { youtubeVideoId: { in: youtubeVideoIds } },
    select: { youtubeVideoId: true, status: true },
  });
  const aiByYoutubeId = new Map(
    aiRows.map((a) => [a.youtubeVideoId, a])
  );

  // Build per-video result (status only, no summary/quiz payload)
  const result: Record<
    string,
    { hasNotes: boolean; aiStatus: string }
  > = {};

  for (const video of videos) {
    const ai = aiByYoutubeId.get(video.youtubeVideoId);
    const isUnlocked = video.aiContentUnlockedAt !== null;

    let aiStatus = "none";

    if (isUnlocked && ai?.status === "ready") {
      aiStatus = "ready";
    } else if (ai?.status === "pending") {
      aiStatus = "pending";
    } else if (ai?.status === "failed") {
      aiStatus = isUnlocked ? "failed" : "none";
    }

    result[video.id] = {
      hasNotes: videoIdsWithNotes.has(video.id),
      aiStatus,
    };
  }

  return NextResponse.json(result);
}
