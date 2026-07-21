import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/notes/overview
 *
 * Returns course-level aggregated data for the Notes Course Library:
 *   - Course id, title, thumbnail, video count
 *   - Personal notes count (videos that have at least one note)
 *   - AI summaries count (videos where AI content is unlocked and ready)
 *   - Progress percentage
 *   - Last studied date (most recent note update per course, or null)
 *
 * Ownership enforced via: Course → User.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all courses for this user
  const courses = await db.course.findMany({
    where: { userId },
    include: { _count: { select: { videos: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (courses.length === 0) {
    return NextResponse.json([]);
  }

  const courseIds = courses.map((c) => c.id);

  // Fetch all video ids grouped by course
  const videos = await db.video.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true, courseId: true, youtubeVideoId: true, aiContentUnlockedAt: true },
  });

  // Build per-course video id sets and youtubeVideoId lists
  const courseVideoIds = new Map<string, string[]>();
  const courseYoutubeIds = new Map<string, string[]>();
  for (const v of videos) {
    if (!courseVideoIds.has(v.courseId)) courseVideoIds.set(v.courseId, []);
    if (!courseYoutubeIds.has(v.courseId)) courseYoutubeIds.set(v.courseId, []);
    courseVideoIds.get(v.courseId)!.push(v.id);
    courseYoutubeIds.get(v.courseId)!.push(v.youtubeVideoId);
  }

  // Batch: find all notes across these videos
  const notesRows = await db.note.findMany({
    where: { videoId: { in: videos.map((v) => v.id) } },
    select: { videoId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Build set of videoIds that have notes
  const videoIdsWithNotes = new Set(notesRows.map((n) => n.videoId));

  // For each course, find the most recent note update
  const latestNotePerCourse = new Map<string, Date>();
  for (const note of notesRows) {
    const video = videos.find((v) => v.id === note.videoId);
    if (video) {
      const existing = latestNotePerCourse.get(video.courseId);
      if (!existing || note.updatedAt > existing) {
        latestNotePerCourse.set(video.courseId, note.updatedAt);
      }
    }
  }

  // Batch: find AI content status
  const allYoutubeIds = [...new Set(videos.map((v) => v.youtubeVideoId))];
  const aiRows = await db.aIContent.findMany({
    where: { youtubeVideoId: { in: allYoutubeIds } },
    select: { youtubeVideoId: true, status: true },
  });
  const aiByYoutubeId = new Map(aiRows.map((a) => [a.youtubeVideoId, a]));

  // Also get per-course completed video counts for progress
  const completedGroups = await db.video.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds }, status: "completed" },
    _count: { id: true },
  });
  const completedMap = new Map(completedGroups.map((g) => [g.courseId, g._count.id]));

  // Build result
  const result = courses.map((course) => {
    const vids = courseVideoIds.get(course.id) ?? [];
    const youtubeIds = courseYoutubeIds.get(course.id) ?? [];
    const totalVideos = course._count.videos;

    // Count personal notes: videos in this course that have a note
    const personalNotesCount = vids.filter((vidId) => videoIdsWithNotes.has(vidId)).length;

    // Count AI summaries: videos where aiContentUnlockedAt is set AND AIContent status is "ready"
    const aiSummaryCount = vids.reduce((count, vidId, idx) => {
      const youtubeId = youtubeIds[idx];
      const video = videos.find((v) => v.id === vidId);
      if (!video) return count;
      if (!video.aiContentUnlockedAt) return count;
      const ai = aiByYoutubeId.get(youtubeId);
      if (ai && ai.status === "ready") return count + 1;
      return count;
    }, 0);

    // Progress
    const completedVideos = completedMap.get(course.id) ?? 0;
    const progressPct = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

    // Last studied date
    const lastStudied = latestNotePerCourse.get(course.id) ?? null;

    return {
      id: course.id,
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      videoCount: totalVideos,
      personalNotesCount,
      aiSummaryCount,
      progressPct,
      completedVideos,
      lastStudied: lastStudied ? lastStudied.toISOString() : null,
    };
  });

  return NextResponse.json(result);
}