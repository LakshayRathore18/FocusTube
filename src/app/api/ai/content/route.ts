import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getTranscript } from "@/lib/transcript";
import { geminiProvider } from "@/lib/ai/gemini";

/**
 * POST /api/ai/content
 *
 * Body: { youtubeVideoId: string }
 *
 * Generates or retrieves AI content for a YouTube video.
 * AIContent is SHARED across all users (keyed by youtubeVideoId) so
 * only one Gemini call is ever needed per video globally.
 *
 * Per-user unlock tracking is done via the user's own Video row:
 * when content becomes ready (either newly generated or already existing),
 * the current user's Video row gets aiContentUnlockedAt = now().
 * This lets the content-status endpoint show the green button per-user
 * without duplicating AI content rows.
 *
 * Concurrency: the unique constraint on youtubeVideoId acts as the
 * dedup lock. First insert wins and generates; concurrent inserts
 * hit P2002 and return the existing pending row.
 *
 * Response shapes:
 *   { status: "pending" }                        — generation in progress
 *   { status: "ready", summary, quiz }           — content available
 *   { status: "failed", reason }                 — generation failed (retryable if attempts < 3)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── Parse body ──────────────────────────────────────────────
  let body: { youtubeVideoId: string; courseId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.youtubeVideoId || typeof body.youtubeVideoId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'youtubeVideoId' field" },
      { status: 400 }
    );
  }

  const { youtubeVideoId, courseId } = body;
  const now = new Date();

  // Helper: stamp the user's specific Video row as unlocked.
  // The frontend sends courseId so we can pin the exact Video row.
  async function unlockForCurrentUser() {
    const video = courseId
      ? await db.video.findFirst({
          where: {
            youtubeVideoId,
            courseId,
            course: { userId },
          },
          select: { id: true },
        })
      : await db.video.findFirst({
          where: {
            youtubeVideoId,
            course: { userId },
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
    if (video) {
      await db.video.update({
        where: { id: video.id },
        data: { aiContentUnlockedAt: now },
      });
    }
  }

  // ─── Step 1: Check for existing AIContent row ────────────────
  const existing = await db.aIContent.findUnique({
    where: { youtubeVideoId },
    select: {
      id: true,
      status: true,
      summary: true,
      quiz: true,
      attempts: true,
      lastAttemptedAt: true,
    },
  });

  if (existing) {
    switch (existing.status) {
      case "ready":
        // Content already exists — stamp unlock for this user and return
        await unlockForCurrentUser();
        return NextResponse.json({
          status: "ready",
          summary: existing.summary,
          quiz: existing.quiz,
        });

      case "pending":
        return NextResponse.json({ status: "pending" });

      case "failed":
        if (existing.attempts >= 3) {
          return NextResponse.json({
            status: "failed",
            reason: "max_attempts",
          });
        }
      // fall through — retry if attempts < 3
    }
  }

  // ─── Step 2: Claim and generate ────────────────────────────

  async function claimGeneration(): Promise<
    | { claimed: true; rowId: string }
    | { claimed: false; status: "pending" }
  > {
    if (existing) {
      // Optimistic-lock retry: only claim the row if it's still "failed"
      // updateMany returns the count of rows matched — if 0, another
      // request already claimed this retry.
      const { count } = await db.aIContent.updateMany({
        where: { id: existing.id, status: "failed" },
        data: {
          status: "pending",
          attempts: existing.attempts,
          lastAttemptedAt: now,
        },
      });
      if (count === 0) {
        return { claimed: false, status: "pending" };
      }
      return { claimed: true, rowId: existing.id };
    }

    // Insert a new row — may hit P2002 if another request raced ahead
    try {
      const row = await db.aIContent.create({
        data: {
          youtubeVideoId,
          status: "pending",
          attempts: 0,
          lastAttemptedAt: now,
        },
      });
      return { claimed: true, rowId: row.id };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return { claimed: false, status: "pending" };
      }
      throw err;
    }
  }

  const claim = await claimGeneration();

  if (!claim.claimed) {
    return NextResponse.json({ status: claim.status });
  }

  // ─── Generate content ────────────────────────────────────────
  // We own the claim — call the transcript API then Gemini

  const transcriptResult = await getTranscript(youtubeVideoId);

  if (!transcriptResult.success) {
    await db.aIContent.update({
      where: { id: claim.rowId },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        lastAttemptedAt: now,
      },
    });

    return NextResponse.json({
      status: "failed",
      reason: transcriptResult.reason,
    });
  }

  // TEMPORARY: truncate transcript to 20,000 chars to avoid Vercel Hobby's 60s
  // function timeout on very long videos. Proper fix: streaming response or
  // background job (out of scope for this change).
  const TRUNCATED_TRANSCRIPT_LENGTH = 20_000;
  const truncatedTranscript = transcriptResult.transcript.slice(
    0,
    TRUNCATED_TRANSCRIPT_LENGTH
  );

  const notesResult = await geminiProvider.generateNotes(truncatedTranscript);

  if (!notesResult.success) {
    await db.aIContent.update({
      where: { id: claim.rowId },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        lastAttemptedAt: now,
      },
    });

    return NextResponse.json({
      status: "failed",
      reason: notesResult.reason,
    });
  }

  // Success — save to AIContent and stamp the user's Video row
  await db.aIContent.update({
    where: { id: claim.rowId },
    data: {
      status: "ready",
      transcript: transcriptResult.transcript,
      summary: notesResult.summary,
      quiz: notesResult.quiz,
      attempts: { increment: 1 },
      lastAttemptedAt: now,
    },
  });

  await unlockForCurrentUser();

  return NextResponse.json({
    status: "ready",
    summary: notesResult.summary,
    quiz: notesResult.quiz,
  });
}
