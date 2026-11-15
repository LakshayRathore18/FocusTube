from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..dependencies import DB, CurrentUser, owned_video
from ..models import AIContent, Course, Note, Video, now
from ..schemas import NoteInput, VideoPatch, serialize

router = APIRouter(prefix="/videos", tags=["videos"])


async def recent(db, user_id, *, continuing):
    rows = (
        await db.execute(
            select(Video, Course)
            .join(Course)
            .where(
                Course.user_id == user_id,
                Video.status.in_(["in_progress"] if continuing else ["in_progress", "completed"]),
            )
            .order_by(Video.updated_at.desc())
            .limit(3 if continuing else 6)
        )
    ).all()
    fields = [
        "id",
        "youtube_video_id",
        "title",
        "thumbnail_url",
        "duration_seconds",
        "last_watched_seconds",
        "is_available",
        "updated_at",
    ]
    return [
        {**serialize(v, only=fields), "course": {"id": c.id, "title": c.title}} for v, c in rows
    ]


@router.get("/continue-watching")
async def continue_watching(db: DB, user: CurrentUser):
    return await recent(db, user.id, continuing=True)


@router.get("/recently-watched")
async def recently_watched(db: DB, user: CurrentUser):
    return await recent(db, user.id, continuing=False)


@router.patch("/{video_id}")
async def update_video(video_id: str, body: VideoPatch, db: DB, user: CurrentUser):
    video = await owned_video(db, video_id, user.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(video, field, value)
    if body.status == "completed":
        video.completed_at = now()
    elif body.status is not None:
        video.completed_at = None
    await db.commit()
    return serialize(video, only=["id", "status", "last_watched_seconds", "completed_at"])


@router.get("/{video_id}/notes")
async def get_note(video_id: str, db: DB, user: CurrentUser):
    await owned_video(db, video_id, user.id)
    note = await db.scalar(select(Note).where(Note.video_id == video_id))
    return serialize(note) if note else None


@router.put("/{video_id}/notes")
async def save_note(video_id: str, body: NoteInput, db: DB, user: CurrentUser):
    await owned_video(db, video_id, user.id)
    note = await db.scalar(select(Note).where(Note.video_id == video_id))
    if note is None:
        note = Note(video_id=video_id, content=body.content)
        db.add(note)
    else:
        note.content = body.content
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        note = await db.scalar(select(Note).where(Note.video_id == video_id))
        if note is None:
            raise HTTPException(404, "Video not found")
        note.content = body.content
        await db.commit()
    return serialize(note)


@router.delete("/{video_id}/notes")
async def delete_note(video_id: str, db: DB, user: CurrentUser):
    await owned_video(db, video_id, user.id)
    note = await db.scalar(select(Note).where(Note.video_id == video_id))
    if note is None:
        raise HTTPException(404, "Note not found")
    await db.delete(note)
    await db.commit()
    return {"success": True}


@router.get("/{video_id}/ai-progress")
async def ai_progress(video_id: str, db: DB, user: CurrentUser):
    video = await owned_video(db, video_id, user.id)
    row = (
        await db.execute(
            select(
                AIContent.status,
                AIContent.last_attempted_at,
                AIContent.transcript.is_not(None) & (AIContent.transcript != ""),
            ).where(AIContent.youtube_video_id == video.youtube_video_id)
        )
    ).first()
    if not row:
        return {"status": "not_started"}
    state, attempted_at, has_transcript = row
    if state == "pending" and attempted_at:
        from datetime import UTC, timedelta

        if attempted_at.replace(tzinfo=UTC) < now() - timedelta(minutes=2):
            return {"status": "failed"}
    if state == "pending":
        return {"status": state, "stage": "content" if has_transcript else "transcript"}
    # Read-only: expose no generated material and never unlock this user's video.
    return {"status": state}


@router.get("/{video_id}/ai-content")
async def ai_content(video_id: str, db: DB, user: CurrentUser):
    video = await owned_video(db, video_id, user.id)
    content = await db.scalar(
        select(AIContent).where(AIContent.youtube_video_id == video.youtube_video_id)
    )
    if not video.ai_content_unlocked_at or not content or content.status != "ready":
        return {"needsRegeneration": True}
    return {"summary": content.summary, "quiz": content.quiz}
