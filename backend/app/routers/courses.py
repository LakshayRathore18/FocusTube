from datetime import timedelta

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from ..dependencies import DB, CurrentUser, owned_course
from ..models import AIContent, Course, Note, Video, new_id, now
from ..schemas import ImportCourse, serialize
from ..services.youtube import extract_playlist_id, fetch_playlist

router = APIRouter(prefix="/courses", tags=["courses"])


async def course_videos(db, course_id):
    return list(
        await db.scalars(select(Video).where(Video.course_id == course_id).order_by(Video.position))
    )


@router.get("")
async def list_courses(db: DB, user: CurrentUser):
    courses = list(
        await db.scalars(
            select(Course).where(Course.user_id == user.id).order_by(Course.updated_at.desc())
        )
    )
    videos = list(await db.scalars(select(Video).join(Course).where(Course.user_id == user.id)))
    by_course = {}
    for video in videos:
        by_course.setdefault(video.course_id, []).append(video)
    result = []
    for course in courses:
        vids = by_course.get(course.id, [])
        result.append(
            {
                **serialize(course),
                "_count": {
                    "videos": len(vids),
                    "completedVideos": sum(v.status == "completed" for v in vids),
                    "inProgressVideos": sum(v.status == "in_progress" for v in vids),
                },
                "remainingDurationSeconds": sum(
                    v.duration_seconds or 0 for v in vids if v.status != "completed"
                ),
            }
        )
    return result


@router.post("", status_code=201)
async def import_course(body: ImportCourse, db: DB, user: CurrentUser):
    playlist_id = extract_playlist_id(body.url)
    existing = await db.scalar(
        select(Course).where(Course.user_id == user.id, Course.youtube_playlist_id == playlist_id)
    )
    if existing:
        return JSONResponse(
            {"error": "You have already imported this playlist", "courseId": existing.id},
            status_code=409,
        )
    # Release read transaction before provider calls.
    user_id = user.id
    await db.rollback()
    metadata, videos = await fetch_playlist(playlist_id)
    course = Course(
        id=new_id(),
        user_id=user_id,
        youtube_playlist_id=playlist_id,
        title=metadata["title"],
        thumbnail_url=metadata["thumbnail_url"] or (videos[0]["thumbnail_url"] if videos else None),
    )
    try:
        db.add(course)
        await db.flush()
        db.add_all(Video(course_id=course.id, **v) for v in videos)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(
            select(Course).where(
                Course.user_id == user_id, Course.youtube_playlist_id == playlist_id
            )
        )
        if existing:
            return JSONResponse(
                {"error": "You have already imported this playlist", "courseId": existing.id},
                status_code=409,
            )
        raise
    return {"courseId": course.id, "title": course.title, "videoCount": len(videos)}


@router.get("/{course_id}")
async def get_course(course_id: str, db: DB, user: CurrentUser):
    course = await owned_course(db, course_id, user.id)
    videos = await course_videos(db, course_id)
    return {
        **serialize(course),
        "videos": [serialize(v) for v in videos],
        "_count": {"videos": len(videos)},
    }


@router.delete("/{course_id}")
async def delete_course(course_id: str, db: DB, user: CurrentUser):
    await owned_course(db, course_id, user.id)
    await db.execute(delete(Course).where(Course.id == course_id))
    await db.commit()
    return {"deleted": course_id}


@router.post("/{course_id}/sync")
async def sync_course(course_id: str, db: DB, user: CurrentUser):
    course = await owned_course(db, course_id, user.id)
    playlist_id, user_id = course.youtube_playlist_id, user.id
    await db.rollback()
    metadata, items = await fetch_playlist(playlist_id)
    # Serialize concurrent syncs on the course; recheck after the network call.
    course = await db.scalar(
        select(Course).where(Course.id == course_id, Course.user_id == user_id).with_for_update()
    )
    if course is None:
        from fastapi import HTTPException

        raise HTTPException(404, "Course not found")
    existing = {v.youtube_video_id: v for v in await course_videos(db, course_id)}
    current = {v["youtube_video_id"] for v in items}
    added = updated = archived = 0
    for item in items:
        video = existing.get(item["youtube_video_id"])
        if video is None:
            db.add(Video(course_id=course_id, **item))
            added += 1
        elif not video.is_available or any(
            getattr(video, key) != value for key, value in item.items()
        ):
            for key, value in item.items():
                setattr(video, key, value)
            video.is_available = True
            updated += 1
    for yt_id, video in existing.items():
        if yt_id not in current and video.is_available:
            video.is_available = False
            archived += 1
    course.title = metadata["title"]
    course.thumbnail_url = metadata["thumbnail_url"] or (
        items[0]["thumbnail_url"] if items else course.thumbnail_url
    )
    course.last_synced_at = now()
    await db.commit()
    return {"added": added, "updated": updated, "archived": archived, "total": len(items)}


@router.get("/{course_id}/content-status")
async def content_status(course_id: str, db: DB, user: CurrentUser):
    await owned_course(db, course_id, user.id)
    rows = (
        await db.execute(
            select(Video, Note.id, AIContent.status, AIContent.last_attempted_at)
            .outerjoin(Note, Note.video_id == Video.id)
            .outerjoin(AIContent, AIContent.youtube_video_id == Video.youtube_video_id)
            .where(Video.course_id == course_id)
        )
    ).all()
    result = {}
    for v, note_id, state, attempted_at in rows:
        if state == "pending" and attempted_at:
            # SQLite tests return naive datetimes; PostgreSQL returns timezone-aware values.
            from datetime import UTC

            if attempted_at.replace(tzinfo=UTC) < now() - timedelta(minutes=2):
                state = "failed"
        status = "none"
        if state == "pending":
            status = "pending"
        elif v.ai_content_unlocked_at and state in {"ready", "failed"}:
            status = state
        result[v.id] = {"hasNotes": note_id is not None, "aiStatus": status}
    return result
