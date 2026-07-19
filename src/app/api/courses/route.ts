import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extractPlaylistId, fetchPlaylistData, fetchPlaylistItems } from "@/lib/youtube";

/**
 * GET /api/courses
 *
 * Returns all courses for the authenticated user, with video count.
 * Sorted by most recently updated first.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch courses with total video count, and aggregate per-course stats
  // in parallel to avoid an n+1 pattern.
  const [courses, completedGroups, inProgressGroups, durationGroups] = await Promise.all([
    db.course.findMany({
      where: { userId },
      include: { _count: { select: { videos: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.video.groupBy({
      by: ["courseId"],
      where: { course: { userId }, status: "completed" },
      _count: { id: true },
    }),
    db.video.groupBy({
      by: ["courseId"],
      where: { course: { userId }, status: "in_progress" },
      _count: { id: true },
    }),
    db.video.groupBy({
      by: ["courseId"],
      where: { course: { userId }, status: { not: "completed" }, durationSeconds: { not: null } },
      _sum: { durationSeconds: true },
    }),
  ]);

  // Build lookups
  const completedMap = new Map(completedGroups.map((g) => [g.courseId, g._count.id]));
  const inProgressMap = new Map(inProgressGroups.map((g) => [g.courseId, g._count.id]));
  const remainingDurationMap = new Map(
    durationGroups.map((g) => [g.courseId, g._sum.durationSeconds ?? 0])
  );

  // Merge stats into each course response
  const enriched = courses.map((c) => ({
    ...c,
    _count: {
      videos: c._count.videos,
      completedVideos: completedMap.get(c.id) ?? 0,
      inProgressVideos: inProgressMap.get(c.id) ?? 0,
    },
    remainingDurationSeconds: remainingDurationMap.get(c.id) ?? 0,
  }));

  return NextResponse.json(enriched);
}

/**
 * POST /api/courses
 *
 * Body: { url: string }
 *   — A YouTube playlist URL (any format) or bare playlist ID.
 *
 * Flow:
 *   1. Auth check — requires valid JWT session
 *   2. Extract playlist ID from URL
 *   3. Fetch playlist metadata from YouTube API
 *   4. Fetch all video items from playlist (paginated)
 *   5. Create Course + Video rows in a Prisma transaction
 *   6. Return the created course
 *
 * Constraints:
 *   — A user cannot import the same playlist twice (unique on [userId, youtubePlaylistId])
 *   — Private/deleted videos are skipped
 *   — Thumbnail: use playlist thumbnail, fall back to first video thumbnail
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'url' field" }, { status: 400 });
  }

  // Extract playlist ID
  const playlistId = extractPlaylistId(body.url);
  if (!playlistId) {
    return NextResponse.json(
      { error: "Could not extract a valid YouTube playlist ID from the provided URL" },
      { status: 400 }
    );
  }

  // Check if user already imported this playlist
  const existing = await db.course.findUnique({
    where: {
      userId_youtubePlaylistId: {
        userId,
        youtubePlaylistId: playlistId,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You have already imported this playlist", courseId: existing.id },
      { status: 409 }
    );
  }

  // Fetch playlist metadata from YouTube
  let playlistData: Awaited<ReturnType<typeof fetchPlaylistData>>;
  try {
    playlistData = await fetchPlaylistData(playlistId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch playlist data";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Fetch video items from YouTube
  let videos: Awaited<ReturnType<typeof fetchPlaylistItems>>;
  try {
    videos = await fetchPlaylistItems(playlistId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch playlist videos";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Determine thumbnail: use playlist thumbnail, fall back to first video thumbnail
  const thumbnailUrl = playlistData.thumbnailUrl ?? videos[0]?.thumbnailUrl ?? null;

  // Create course + videos in a transaction
  const course = await db.$transaction(async (tx) => {
    const createdCourse = await tx.course.create({
      data: {
        userId,
        youtubePlaylistId: playlistId,
        title: playlistData.title,
        thumbnailUrl,
      },
    });

    if (videos.length > 0) {
      await tx.video.createMany({
        data: videos.map((v) => ({
          courseId: createdCourse.id,
          youtubeVideoId: v.youtubeVideoId,
          title: v.title,
          position: v.position,
          thumbnailUrl: v.thumbnailUrl,
          isAvailable: true,
        })),
      });
    }

    return createdCourse;
  });

  return NextResponse.json(
    {
      courseId: course.id,
      title: course.title,
      videoCount: videos.length,
    },
    { status: 201 }
  );
}