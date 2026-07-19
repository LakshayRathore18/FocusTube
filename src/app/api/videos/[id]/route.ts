import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/videos/[id]
 *
 * Body: { status?: "not_started" | "watching" | "completed", lastWatchedSeconds?: number }
 *
 * Updates the watch state of a video. Authorization is enforced by walking
 * the relation chain: Video → Course → User.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await params;

  // Verify ownership: video → course → user
  const video = await db.video.findFirst({
    where: { id, course: { userId } },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Build update payload from allowed fields
  const allowedFields = ["status", "lastWatchedSeconds"] as const;
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await db.video.update({
    where: { id },
    data: updateData,
    select: { id: true, status: true, lastWatchedSeconds: true },
  });

  return NextResponse.json(updated);
}
