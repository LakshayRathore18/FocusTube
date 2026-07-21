import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fetchPlaylistData, fetchPlaylistItems } from "@/lib/youtube";

/**
 * POST /api/courses/[id]/sync
 *
 * Synchronises the course with the current state of the YouTube playlist.
 *
 * Safety guarantee — this endpoint NEVER deletes rows:
 *   • New videos  → inserted with isAvailable = true
 *   • Existing    → metadata (title, thumbnail, position) updated, isAvailable = true
 *   • Removed     → isAvailable set to false ("archived") — all user data preserved
 *
 * Returns a summary:
 *   { added: number; updated: number; archived: number; total: number }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;

  // ── 1. Load course & verify ownership ──────────────────────────────────────
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { userId: true, youtubePlaylistId: true, title: true },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 2. Fetch current playlist from YouTube ──────────────────────────────────
  let playlistData: Awaited<ReturnType<typeof fetchPlaylistData>>;
  let ytVideos: Awaited<ReturnType<typeof fetchPlaylistItems>>;

  try {
    [playlistData, ytVideos] = await Promise.all([
      fetchPlaylistData(course.youtubePlaylistId),
      fetchPlaylistItems(course.youtubePlaylistId),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch playlist from YouTube";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // ── 3. Load all existing video rows for this course ──────────────────────────
  const existingVideos = await db.video.findMany({
    where: { courseId },
    select: {
      id: true,
      youtubeVideoId: true,
      title: true,
      thumbnailUrl: true,
      position: true,
      isAvailable: true,
    },
  });

  // Build O(1) lookup: youtubeVideoId → existing DB row
  const existingByYtId = new Map(
    existingVideos.map((v) => [v.youtubeVideoId, v])
  );

  // Build set of youtube IDs currently in the playlist
  const currentYtIdSet = new Set(ytVideos.map((v) => v.youtubeVideoId));

  // ── 4. Compute diff ─────────────────────────────────────────────────────────
  const toInsert: Array<{
    courseId: string;
    youtubeVideoId: string;
    title: string;
    position: number;
    thumbnailUrl: string | null;
    isAvailable: boolean;
  }> = [];

  const toUpdate: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    position: number;
  }> = [];

  // IDs of DB rows that are no longer in the playlist → archive them
  const toArchiveIds: string[] = [];

  // Classify each YouTube video as new or existing
  for (const ytVideo of ytVideos) {
    const existing = existingByYtId.get(ytVideo.youtubeVideoId);

    if (!existing) {
      // Brand-new video — insert
      toInsert.push({
        courseId,
        youtubeVideoId: ytVideo.youtubeVideoId,
        title: ytVideo.title,
        position: ytVideo.position,
        thumbnailUrl: ytVideo.thumbnailUrl,
        isAvailable: true,
      });
    } else {
      // Already in DB — update metadata if anything changed
      const metadataChanged =
        existing.title !== ytVideo.title ||
        existing.thumbnailUrl !== ytVideo.thumbnailUrl ||
        existing.position !== ytVideo.position ||
        !existing.isAvailable; // re-activates a previously archived video

      if (metadataChanged) {
        toUpdate.push({
          id: existing.id,
          title: ytVideo.title,
          thumbnailUrl: ytVideo.thumbnailUrl,
          position: ytVideo.position,
        });
      }
    }
  }

  // Classify each DB row that's no longer in the current playlist
  for (const existing of existingVideos) {
    if (!currentYtIdSet.has(existing.youtubeVideoId) && existing.isAvailable) {
      toArchiveIds.push(existing.id);
    }
  }

  // ── 5. Apply changes in a transaction ───────────────────────────────────────
  await db.$transaction(async (tx) => {
    // 5a. Insert new videos
    if (toInsert.length > 0) {
      await tx.video.createMany({ data: toInsert });
    }

    // 5b. Update existing videos (metadata + re-activate if previously archived)
    for (const u of toUpdate) {
      await tx.video.update({
        where: { id: u.id },
        data: {
          title: u.title,
          thumbnailUrl: u.thumbnailUrl,
          position: u.position,
          isAvailable: true, // always restore availability if still in playlist
        },
      });
    }

    // 5c. Archive removed videos — NEVER delete
    if (toArchiveIds.length > 0) {
      await tx.video.updateMany({
        where: { id: { in: toArchiveIds } },
        data: { isAvailable: false },
      });
    }

    // 5d. Update course metadata + lastSyncedAt
    await tx.course.update({
      where: { id: courseId },
      data: {
        title: playlistData.title,
        thumbnailUrl:
          playlistData.thumbnailUrl ??
          ytVideos[0]?.thumbnailUrl ??
          undefined,
        lastSyncedAt: new Date(),
      },
    });
  });

  // ── 6. Return sync summary ───────────────────────────────────────────────────
  return NextResponse.json({
    added: toInsert.length,
    updated: toUpdate.length,
    archived: toArchiveIds.length,
    total: ytVideos.length,
  });
}
