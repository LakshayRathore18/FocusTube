import os
from datetime import timedelta

import httpx
import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("AUTH_SECRET", "test-only-secret-with-at-least-32-characters")

from app.database import get_db
from app.dependencies import hash_token
from app.main import create_app
from app.models import Base, Course, Session, User, Video, now


@pytest.fixture
async def setup(tmp_path):
    # An isolated database for every test; never reads backend/.env or the old DB.
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        db.add_all(
            [User(id="user-a", email="a@example.com"), User(id="user-b", email="b@example.com")]
        )
        await db.flush()
        db.add_all(
            [
                Session(
                    user_id="user-a",
                    token_hash=hash_token("token-a"),
                    expires_at=now() + timedelta(days=1),
                ),
                Session(
                    user_id="user-b",
                    token_hash=hash_token("token-b"),
                    expires_at=now() + timedelta(days=1),
                ),
                Course(
                    id="course-a",
                    user_id="user-a",
                    youtube_playlist_id="PLabcdefghijklm",
                    title="Python",
                ),
                Course(
                    id="course-b",
                    user_id="user-b",
                    youtube_playlist_id="PLabcdefghijklm",
                    title="Private",
                ),
            ]
        )
        await db.flush()
        db.add_all(
            [
                Video(
                    id="video-a",
                    course_id="course-a",
                    youtube_video_id="abcdefghijk",
                    title="Intro",
                    position=0,
                ),
                Video(
                    id="video-b",
                    course_id="course-b",
                    youtube_video_id="lmnopqrstuv",
                    title="Private intro",
                    position=0,
                ),
            ]
        )
        await db.commit()
    app = create_app()

    async def database():
        async with factory() as db:
            yield db

    app.dependency_overrides[get_db] = database
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://localhost:3000",
        headers={"Origin": "http://localhost:3000"},
    ) as client:
        client.cookies.set("focustube_session", "token-a", domain="localhost.local", path="/")
        yield client, factory, app
    await engine.dispose()
