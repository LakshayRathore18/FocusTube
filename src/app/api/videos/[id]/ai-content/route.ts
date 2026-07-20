import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/videos/[id]/ai-content
 *
 * Lazily returns the AI-generated summary + quiz for a single video.
 * Called when the user opens the AI modal, so the bulk content-status
 * endpoint doesn't need to include these potentially large payloads.
 *
 * Response: { summary: string; quiz: QuizPayload } | { error: string }
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

  // Verify ownership: video → course → user
  const video = await db.video.findFirst({
    where: { id, course: { userId } },
    select: { youtubeVideoId: true, aiContentUnlockedAt: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Check that the user has unlocked AI content for this video
  if (!video.aiContentUnlockedAt) {
    return NextResponse.json(
      { error: "AI content not unlocked for this video" },
      { status: 404 }
    );
  }

  // Fetch the shared AIContent row
  const aiContent = await db.aIContent.findUnique({
    where: { youtubeVideoId: video.youtubeVideoId },
    select: { summary: true, quiz: true, status: true },
  });

  if (!aiContent || aiContent.status !== "ready") {
    return NextResponse.json(
      { error: "AI content not ready yet" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    summary: aiContent.summary,
    quiz: aiContent.quiz,
  });
}
