import math

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..dependencies import DB, CurrentUser, owned_course
from ..models import AIContent, Course, Note, Video
from ..schemas import serialize

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("")
async def all_notes(db: DB, user: CurrentUser):
    rows = (
        await db.execute(
            select(Note, Video, Course)
            .join(Video, Note.video_id == Video.id)
            .join(Course, Video.course_id == Course.id)
            .where(Course.user_id == user.id)
            .order_by(Note.updated_at.desc())
        )
    ).all()
    return [
        {
            **serialize(n, only=["id", "video_id", "content", "updated_at"]),
            "video": {
                "id": v.id,
                "title": v.title,
                "youtubeVideoId": v.youtube_video_id,
                "course": {"id": c.id, "title": c.title},
            },
        }
        for n, v, c in rows
    ]


@router.get("/overview")
async def overview(db: DB, user: CurrentUser):
    courses = list(
        await db.scalars(
            select(Course).where(Course.user_id == user.id).order_by(Course.updated_at.desc())
        )
    )
    rows = (
        await db.execute(
            select(Video, Note, AIContent.status)
            .join(Course, Video.course_id == Course.id)
            .outerjoin(Note, Note.video_id == Video.id)
            .outerjoin(AIContent, AIContent.youtube_video_id == Video.youtube_video_id)
            .where(Course.user_id == user.id)
        )
    ).all()
    grouped = {}
    for row in rows:
        grouped.setdefault(row[0].course_id, []).append(row)
    result = []
    for course in courses:
        vids = grouped.get(course.id, [])
        completed = sum(v.status == "completed" for v, _, _ in vids)
        dates = [n.updated_at for _, n, _ in vids if n]
        result.append(
            {
                "id": course.id,
                "title": course.title,
                "thumbnailUrl": course.thumbnail_url,
                "videoCount": len(vids),
                "personalNotesCount": sum(n is not None for _, n, _ in vids),
                "aiSummaryCount": sum(
                    bool(v.ai_content_unlocked_at) and state == "ready" for v, _, state in vids
                ),
                "completedVideos": completed,
                "progressPct": math.floor(completed / len(vids) * 100 + 0.5) if vids else 0,
                "lastStudied": max(dates) if dates else None,
            }
        )
    return result


@router.get("/{course_id}")
async def course_notes(course_id: str, db: DB, user: CurrentUser, tab: str = "personal"):
    course = await owned_course(db, course_id, user.id)
    if tab == "personal":
        rows = (
            await db.execute(
                select(Video, Note)
                .join(Note, Note.video_id == Video.id)
                .where(Video.course_id == course_id)
                .order_by(Note.updated_at.desc())
            )
        ).all()
        videos = [
            {
                "videoId": v.id,
                "videoTitle": v.title,
                "youtubeVideoId": v.youtube_video_id,
                "thumbnailUrl": v.thumbnail_url,
                "noteId": n.id,
                "contentPreview": n.content[:150],
                "updatedAt": n.updated_at,
            }
            for v, n in rows
        ]
    elif tab == "ai":
        rows = (
            await db.execute(
                select(Video, AIContent.updated_at)
                .join(AIContent, AIContent.youtube_video_id == Video.youtube_video_id)
                .where(
                    Video.course_id == course_id,
                    Video.ai_content_unlocked_at.is_not(None),
                    AIContent.status == "ready",
                )
                .order_by(Video.ai_content_unlocked_at.desc())
            )
        ).all()
        videos = [
            {
                "videoId": v.id,
                "videoTitle": v.title,
                "youtubeVideoId": v.youtube_video_id,
                "thumbnailUrl": v.thumbnail_url,
                "status": "ready",
                "generatedAt": generated_at,
            }
            for v, generated_at in rows
        ]
    else:
        raise HTTPException(400, "Invalid tab parameter")
    return {"courseTitle": course.title, "thumbnailUrl": course.thumbnail_url, "videos": videos}
