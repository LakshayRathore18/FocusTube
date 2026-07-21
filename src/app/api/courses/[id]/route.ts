import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/courses/[id]
 *
 * Returns a single course with all its videos (ordered by position).
 * Only the owner of the course can access it.
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

  // Run course fetch & video count in parallel
  const [course, videoCount] = await Promise.all([
    db.course.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { position: "asc" },
        },
      },
    }),
    db.video.count({
      where: { courseId: id },
    }),
  ]);

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Ownership check
  if (course.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ...course,
    lastSyncedAt: course.lastSyncedAt?.toISOString() ?? null,
    _count: { videos: videoCount },
  });
}

/**
 * DELETE /api/courses/[id]
 *
 * Deletes a course and all associated data (videos, notes, AI content
 * references cleaned up). Only the owner can delete their course.
 *
 * Returns the deleted course id on success.
 */
export async function DELETE(
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

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (course.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete the course — cascades to videos → notes.
  // AIContent is shared (not per-user) and is NOT deleted here.
  await db.course.delete({ where: { id } });

  return NextResponse.json({ deleted: id });
}

