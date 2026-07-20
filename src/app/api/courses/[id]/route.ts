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
    _count: { videos: videoCount },
  });
}

