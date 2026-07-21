import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isNoteContentEmpty } from "@/lib/utils";

/**
 * GET /api/videos/[id]/notes
 *
 * Returns the note for this video, or null if none exists.
 * Ownership verified via: Video → Course → User.
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

  // Verify ownership before reading
  const video = await db.video.findFirst({
    where: { id, course: { userId } },
    select: { id: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const note = await db.note.findUnique({
    where: { videoId: id },
  });

  return NextResponse.json(note);
}

/**
 * PUT /api/videos/[id]/notes
 *
 * Body: { content: string } — Tiptap HTML content
 * Upserts the note for this video using the unique videoId constraint.
 * Ownership verified before writing.
 * Returns 400 if content is empty after stripping HTML.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'content' field" }, { status: 400 });
  }

  // ── Backend validation: reject empty content ────────────────────────
  if (isNoteContentEmpty(body.content)) {
    return NextResponse.json(
      { error: "Note content cannot be empty" },
      { status: 400 }
    );
  }

  const { id } = await params;

  // Verify ownership: video → course → user
  const video = await db.video.findFirst({
    where: { id, course: { userId } },
    select: { id: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Upsert note using the unique videoId constraint
  const note = await db.note.upsert({
    where: { videoId: id },
    create: {
      videoId: id,
      content: body.content,
    },
    update: {
      content: body.content,
    },
  });

  return NextResponse.json(note);
}

/**
 * DELETE /api/videos/[id]/notes
 *
 * Deletes the note for this video if it exists.
 * Ownership verified before deleting.
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

  // Verify ownership: video → course → user
  const video = await db.video.findFirst({
    where: { id, course: { userId } },
    select: { id: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Check if a note exists before trying to delete
  const existing = await db.note.findUnique({
    where: { videoId: id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await db.note.delete({
    where: { videoId: id },
  });

  return NextResponse.json({ success: true });
}
