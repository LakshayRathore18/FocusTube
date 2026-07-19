import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/notes
 *
 * Returns all notes for the authenticated user, each with:
 *   - note id, content, updatedAt
 *   - video id, title, youtubeVideoId
 *   - course id, title
 *
 * Ownership is enforced by walking the relation chain:
 *   Note → Video → Course → User
 * Ordered by most recently updated note first.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await db.note.findMany({
    where: {
      video: {
        course: { userId },
      },
    },
    include: {
      video: {
        select: {
          id: true,
          title: true,
          youtubeVideoId: true,
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Serialize dates so the client can consume them safely
  const result = notes.map((n) => ({
    id: n.id,
    videoId: n.videoId,
    content: n.content,
    updatedAt: n.updatedAt.toISOString(),
    video: {
      id: n.video.id,
      title: n.video.title,
      youtubeVideoId: n.video.youtubeVideoId,
      course: {
        id: n.video.course.id,
        title: n.video.course.title,
      },
    },
  }));

  return NextResponse.json(result);
}
