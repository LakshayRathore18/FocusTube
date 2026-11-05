"""Prepare/retrieve a saved transcript with local vectors on the guarded active DB.

No Gemini or Supadata calls. Removes its temporary course/account; the useful
reindexed shared transcript is retained. Does not validate generated answers.
"""

import asyncio
import json
from time import monotonic

from sqlalchemy import delete, select

from app.database import session_factory
from app.models import AIContent, Course, User, Video, new_id
from app.runtime import database_event_loop
from app.services import rag, rag_provider
from scripts.check_database import check


async def main():
    await check()
    factory = session_factory()
    user_id, course_id, video_id = new_id(), new_id(), new_id()
    started = monotonic()
    try:
        async with factory() as db:
            source = (
                await db.execute(
                    select(Video.youtube_video_id, AIContent.transcript)
                    .join(AIContent, AIContent.youtube_video_id == Video.youtube_video_id)
                    .where(AIContent.transcript.is_not(None))
                    .limit(1)
                )
            ).first()
            if not source or not source.transcript:
                raise RuntimeError("SavedTranscriptRequired")
            db.add(User(id=user_id, email=f"{user_id}@local-rag-check.invalid"))
            await db.flush()
            db.add(
                Course(
                    id=course_id,
                    user_id=user_id,
                    title="Local embedding verification",
                    youtube_playlist_id=course_id,
                )
            )
            await db.flush()
            db.add(
                Video(
                    id=video_id,
                    course_id=course_id,
                    title="Local embedding verification",
                    youtube_video_id=source.youtube_video_id,
                    position=0,
                )
            )
            await db.commit()
            result = await rag.prepare(db, await db.get(Video, video_id))
            assert result["status"] == "ready"
            db.expire_all()
            document = await rag.document_for(db, source.youtube_video_id)
            assert rag.compatible(document)
            document_id = document.id
            model = document.embedding_model
            await db.commit()
            vector = (
                await rag_provider.embed(
                    ["Explain the main ideas in this educational video."], query=True
                )
            )[0]
            rows = await rag.retrieve(db, document_id, vector)
            assert rows and all(row.text in source.transcript for row in rows)
        print(
            json.dumps(
                {
                    "passed": True,
                    "embedding_model": model,
                    "dimensions": len(vector),
                    "retrieved_passages": len(rows),
                    "gemini_calls": 0,
                    "seconds": round(monotonic() - started, 2),
                    "shared_index_retained": True,
                }
            )
        )
    finally:
        async with factory() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()
        await factory.kw["bind"].dispose()
        session_factory.cache_clear()


if __name__ == "__main__":
    try:
        asyncio.run(main(), loop_factory=database_event_loop)
    except Exception as exc:
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
