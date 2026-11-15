import hashlib
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import Course, Session, User, Video, now

DB = Annotated[AsyncSession, Depends(get_db)]
SESSION_COOKIE = "focustube_session"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def current_user(request: Request, db: DB) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    user = None
    if token:
        user = await db.scalar(
            select(User)
            .join(Session)
            .where(Session.token_hash == hash_token(token), Session.expires_at > now())
        )
    if user is None:
        raise HTTPException(401, "Unauthorized")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def owned_course(db: AsyncSession, course_id: str, user_id: str) -> Course:
    course = await db.get(Course, course_id)
    if course is None:
        raise HTTPException(404, "Course not found")
    if course.user_id != user_id:
        raise HTTPException(403, "Forbidden")
    return course


async def owned_video(db: AsyncSession, video_id: str, user_id: str) -> Video:
    video = await db.scalar(
        select(Video).join(Course).where(Video.id == video_id, Course.user_id == user_id)
    )
    if video is None:
        raise HTTPException(404, "Video not found")
    return video
