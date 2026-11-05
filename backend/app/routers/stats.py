from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from ..dependencies import DB, CurrentUser
from ..models import AIContent, Course, Note, Video, now

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/learning")
async def learning(db: DB, user: CurrentUser):
    async def count(query):
        return await db.scalar(select(func.count()).select_from(query.subquery()))

    video_query = select(Video.id).join(Course).where(Course.user_id == user.id)
    return {
        "totalPlaylists": await count(select(Course.id).where(Course.user_id == user.id)),
        "totalVideos": await count(video_query),
        "completedVideos": await count(video_query.where(Video.status == "completed")),
        "personalNotes": await count(
            select(Note.id).join(Video).join(Course).where(Course.user_id == user.id)
        ),
        "aiSummaries": await count(
            select(AIContent.id)
            .join(Video, AIContent.youtube_video_id == Video.youtube_video_id)
            .join(Course)
            .where(
                Course.user_id == user.id,
                Video.ai_content_unlocked_at.is_not(None),
                AIContent.status == "ready",
            )
            .distinct()
        ),
    }


@router.get("/weekly")
async def weekly(db: DB, user: CurrentUser):
    query = select(Video.id).join(Course).where(Course.user_id == user.id)
    completed = query.where(Video.status == "completed")
    rows = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(Video.duration_seconds), 0))
            .select_from(Video)
            .join(Course)
            .where(
                Course.user_id == user.id,
                Video.status == "completed",
                Video.completed_at >= now() - timedelta(days=7),
            )
        )
    ).one()
    return {
        "videosCompletedThisWeek": rows[0],
        "watchTimeThisWeek": rows[1],
        "totalVideosCompleted": await db.scalar(
            select(func.count()).select_from(completed.subquery())
        ),
        "totalVideosCount": await db.scalar(select(func.count()).select_from(query.subquery())),
    }
