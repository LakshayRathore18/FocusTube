"""Check the live API using a temporary account, then remove only that account.

This verifies database sessions and data APIs, not the interactive Google flow.
"""

import asyncio
import json
import secrets
from datetime import timedelta

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.dependencies import hash_token
from app.models import Course, Note, Session, User, Video, new_id, now
from app.runtime import database_event_loop
from scripts.check_database import check


async def smoke_test():
    await check()  # Refuse the archived target before creating verification data.
    settings = get_settings()
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id, course_id, video_id = new_id(), new_id(), new_id()
    token = secrets.token_urlsafe(32)
    checks = []
    try:
        async with factory() as db:
            db.add(User(id=user_id, email=f"migration-check-{user_id}@example.invalid"))
            await db.flush()
            db.add_all(
                [
                    Session(
                        user_id=user_id,
                        token_hash=hash_token(token),
                        expires_at=now() + timedelta(minutes=10),
                    ),
                    Course(
                        id=course_id,
                        user_id=user_id,
                        youtube_playlist_id=f"check-{course_id}",
                        title="Migration verification",
                    ),
                ]
            )
            await db.flush()
            db.add(
                Video(
                    id=video_id,
                    course_id=course_id,
                    youtube_video_id="abcdefghijk",
                    title="Verification video",
                    position=0,
                )
            )
            await db.commit()

        async with httpx.AsyncClient(
            base_url=settings.frontend_origin,
            headers={"Origin": settings.frontend_origin},
            cookies={"focustube_session": token},
            timeout=30,
        ) as client:

            async def request(method, path, *, body=None, status=200):
                response = await client.request(method, path, json=body)
                if response.status_code != status:
                    raise RuntimeError(f"{method} {path} returned {response.status_code}")
                return response.json() if response.content else None

            assert (await request("GET", "/api/health/ready"))["status"] == "ready"
            assert (await request("GET", "/api/auth/session"))["user"]["id"] == user_id
            checks.append("Next.js rewrite, Neon readiness, and database session lookup")
            assert any(course["id"] == course_id for course in await request("GET", "/api/courses"))
            assert (await request("GET", f"/api/courses/{course_id}"))["videos"][0][
                "id"
            ] == video_id
            checks.append("Course list and detail")
            saved = await request(
                "PUT", f"/api/videos/{video_id}/notes", body={"content": "<p>Verification note</p>"}
            )
            assert (await request("GET", f"/api/videos/{video_id}/notes"))["id"] == saved["id"]
            assert len(await request("GET", "/api/notes")) == 1
            assert len((await request("GET", f"/api/notes/{course_id}"))["videos"]) == 1
            assert len(await request("GET", "/api/notes/overview")) == 1
            checks.append("Note persistence and library APIs")
            await request(
                "PATCH",
                f"/api/videos/{video_id}",
                body={"status": "in_progress", "lastWatchedSeconds": 12},
            )
            assert (await request("GET", "/api/videos/continue-watching"))[0][
                "lastWatchedSeconds"
            ] == 12
            updated = await request(
                "PATCH",
                f"/api/videos/{video_id}",
                body={"status": "completed", "lastWatchedSeconds": None},
            )
            assert updated["completedAt"] and updated["lastWatchedSeconds"] is None
            assert (await request("GET", "/api/stats/learning"))["completedVideos"] == 1
            assert (await request("GET", "/api/stats/weekly"))["videosCompletedThisWeek"] == 1
            assert (await request("GET", f"/api/courses/{course_id}/content-status"))[video_id][
                "hasNotes"
            ]
            checks.append("Playback updates, nullable resume position, and statistics")
            await request("DELETE", f"/api/courses/{course_id}")
            async with factory() as db:
                assert await db.get(Video, video_id) is None
                assert await db.scalar(select(Note).where(Note.video_id == video_id)) is None
            checks.append("Course deletion cascades to its video and note")
            await request("POST", "/api/auth/logout", status=204)
            await request("GET", "/api/auth/session", status=401)
            async with factory() as db:
                assert await db.scalar(select(Session).where(Session.user_id == user_id)) is None
            checks.append("Logout revokes the stored database session")
    finally:
        try:
            async with factory() as db:
                await db.execute(delete(User).where(User.id == user_id))
                await db.commit()
        finally:
            await engine.dispose()
    print(json.dumps({"passed": checks, "temporary_account_removed": True}, indent=2))


if __name__ == "__main__":
    try:
        asyncio.run(smoke_test(), loop_factory=database_event_loop)
    except Exception as exc:
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
