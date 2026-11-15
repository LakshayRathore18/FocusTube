"""Explicit isolated PostgreSQL checks. Never imported by ordinary pytest.

Uses a dedicated focustube_rag_test database on the confirmed active server.
Creates it if absent, applies additive migrations, and removes only rows created
by this run. The database/schema remain for repeat checks; no DROP/reset is used.
"""

import asyncio
import json
import os
import subprocess
import sys
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.models import Course, RagChunk, RagDocument, RagRateLimit, User, Video, new_id, now
from app.runtime import database_event_loop
from app.services import rag, rag_provider
from scripts.check_database import check


async def verify():
    await check()
    active = make_url(get_settings().database_url)
    if active.database == "focustube_rag_test":
        raise RuntimeError("ActiveDatabaseMustNotBeTestDatabase")
    test_url = active.set(database="focustube_rag_test")
    admin = create_async_engine(active, poolclass=NullPool, isolation_level="AUTOCOMMIT")
    try:
        async with admin.connect() as connection:
            exists = await connection.scalar(
                text("SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='focustube_rag_test')")
            )
            if not exists:
                await connection.execute(text('CREATE DATABASE "focustube_rag_test"'))
    finally:
        await admin.dispose()
    environment = dict(os.environ, DATABASE_URL=test_url.render_as_string(hide_password=False))
    # Capture migration output so failures never print a connection URL or SQL parameters.
    result = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        env=environment,
        capture_output=True,
    )
    if result.returncode:
        raise RuntimeError("TestDatabaseMigrationFailed")
    engine = create_async_engine(test_url, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id, course_id, video_id = new_id(), new_id(), new_id()
    youtube_id = "rag-test-" + new_id()[:20]
    vector = [1.0] + [0.0] * 383
    checks = []
    try:
        async with factory() as db:
            db.add(User(id=user_id, email=f"{user_id}@rag-test.invalid"))
            await db.flush()
            db.add(
                Course(
                    id=course_id, user_id=user_id, title="RAG test", youtube_playlist_id=course_id
                )
            )
            await db.flush()
            db.add(
                Video(
                    id=video_id,
                    course_id=course_id,
                    title="RAG test",
                    youtube_video_id=youtube_id,
                    position=0,
                )
            )
            await db.commit()
        started, release = asyncio.Event(), asyncio.Event()

        async def embedding(texts, **kwargs):
            started.set()
            await release.wait()
            return [vector for _ in texts]

        async def prepare():
            async with factory() as db:
                return await rag.prepare(db, await db.get(Video, video_id))

        with (
            patch.object(
                rag,
                "get_transcript",
                AsyncMock(return_value="A full transcript with examples. " * 1200),
            ),
            patch.object(rag_provider, "embed", embedding),
        ):
            first = asyncio.create_task(prepare())
            try:
                await asyncio.wait_for(started.wait(), 15)
                assert (await prepare())["status"] == "pending"
                async with factory() as db:
                    assert (
                        await db.scalar(
                            select(func.count())
                            .select_from(RagChunk)
                            .join(RagDocument)
                            .where(RagDocument.youtube_video_id == youtube_id)
                        )
                        == 0
                    )
                    await db.execute(
                        update(RagDocument)
                        .where(RagDocument.youtube_video_id == youtube_id)
                        .values(claim_expires_at=now() - timedelta(seconds=1))
                    )
                    await db.commit()
                with patch.object(
                    rag_provider,
                    "embed",
                    AsyncMock(side_effect=lambda texts, **kwargs: [vector for _ in texts]),
                ):
                    assert (await prepare())["status"] == "ready"
            finally:
                release.set()
                await first
        checks.append(
            "migration, concurrent claim exclusion, expired-claim replacement and stale publisher rejection"
        )
        async with factory() as db:
            document = await rag.document_for(db, youtube_id)
            assert document.state == "ready"
            # Keep a legacy 768-dimensional document beside MiniLM's 384 values.
            # Retrieval must filter by document before comparing vector sizes.
            legacy = RagDocument(
                youtube_video_id=youtube_id + "old",
                indexing_version="legacy",
                embedding_model="legacy-768",
                embedding_dimensions=768,
                state="ready",
            )
            db.add(legacy)
            await db.flush()
            db.add(
                RagChunk(
                    document_id=legacy.id,
                    position=0,
                    text="Legacy passage",
                    start_offset=0,
                    end_offset=14,
                    embedding=[1.0] + [0.0] * 767,
                )
            )
            await db.commit()
            rows = await rag.retrieve(db, document.id, vector)
            assert len(rows) == 6
            distance = await db.scalar(
                select(RagChunk.embedding.cosine_distance(vector)).where(RagChunk.id == rows[0].id)
            )
            assert abs(distance) < 0.00001
            # A known opposite vector must sort behind matching vectors.
            rows[0].embedding = [-value for value in vector]
            await db.commit()
            nearest = await rag.retrieve(db, document.id, vector)
            assert nearest[0].id != rows[0].id
        checks.append("mixed 384/768-dimensional storage, exact cosine ranking and document filter")

        async def throttle():
            async with factory() as db:
                try:
                    await rag.throttle(db, user_id)
                    return True
                except rag_provider.RagError as exc:
                    assert exc.code == "rate_limited"
                    return False

        results = await asyncio.gather(*(throttle() for _ in range(14)))
        assert sum(results) == 10
        checks.append("atomic throttle across fourteen independent PostgreSQL sessions")
    finally:
        async with factory() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.execute(
                delete(RagDocument).where(
                    RagDocument.youtube_video_id.in_([youtube_id, youtube_id + "old"])
                )
            )
            await db.commit()
            assert await db.get(RagRateLimit, user_id) is None
        await engine.dispose()
    print(
        json.dumps(
            {
                "passed": checks,
                "isolated_database": "focustube_rag_test",
                "temporary_rows_removed": True,
            }
        )
    )


if __name__ == "__main__":
    try:
        asyncio.run(verify(), loop_factory=database_event_loop)
    except Exception as exc:
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
