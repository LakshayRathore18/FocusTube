"""Explicit live RAG acceptance using temporary accounts and real configured providers.

Uses ASGI HTTP requests against real Neon; does not require running servers.
Never prints questions, answers, transcript excerpts or credentials. Keeps the
successful shared transcript index; removes only its own users/courses/videos.
"""

import asyncio
import json
import secrets
from datetime import timedelta
from time import monotonic

import httpx
from sqlalchemy import delete, select

from app.config import get_settings
from app.database import session_factory
from app.dependencies import hash_token
from app.main import create_app
from app.models import AIContent, Course, RagDocument, Session, User, Video, new_id, now
from app.runtime import database_event_loop
from scripts.check_database import check


async def main():
    await check()
    settings = get_settings()
    # Enable only in this verification process. Persisted configuration is unchanged.
    settings.rag_enabled = True
    factory = session_factory()
    user_id, outsider_id, course_id, video_id = new_id(), new_id(), new_id(), new_id()
    token, outsider_token = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    timings = []
    retry_failures = []
    try:
        async with factory() as db:
            source = (
                await db.execute(
                    select(Video.youtube_video_id, Video.title, AIContent.transcript)
                    .join(AIContent, AIContent.youtube_video_id == Video.youtube_video_id)
                    .where(AIContent.transcript.is_not(None))
                    .limit(1)
                )
            ).first()
            if not source or not source.transcript:
                raise RuntimeError("NoOwnedCaptionedSourceAvailable")
            db.add_all(
                [
                    User(id=user_id, email=f"{user_id}@rag-smoke.invalid"),
                    User(id=outsider_id, email=f"{outsider_id}@rag-smoke.invalid"),
                ]
            )
            await db.flush()
            db.add_all(
                [
                    Session(
                        user_id=user_id,
                        token_hash=hash_token(token),
                        expires_at=now() + timedelta(minutes=15),
                    ),
                    Session(
                        user_id=outsider_id,
                        token_hash=hash_token(outsider_token),
                        expires_at=now() + timedelta(minutes=15),
                    ),
                    Course(
                        id=course_id,
                        user_id=user_id,
                        title="RAG acceptance",
                        youtube_playlist_id=course_id,
                    ),
                ]
            )
            await db.flush()
            db.add(
                Video(
                    id=video_id,
                    course_id=course_id,
                    youtube_video_id=source.youtube_video_id,
                    title=source.title,
                    position=0,
                )
            )
            await db.commit()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app()),
            base_url=settings.frontend_origin,
            headers={"Origin": settings.frontend_origin},
            cookies={"focustube_session": token},
            timeout=110,
        ) as client:
            base = f"/api/rag/videos/{video_id}"
            started = monotonic()
            prepared = await client.post(base + "/prepare")
            if prepared.status_code != 200 or prepared.json().get("status") != "ready":
                raise RuntimeError(
                    "Preparation_" + prepared.json().get("code", str(prepared.status_code))
                )
            timings.append({"phase": "prepare", "seconds": round(monotonic() - started, 2)})
            history = []

            async def ask(payload):
                response = await client.post(base + "/ask", json=payload)
                if response.status_code in {503, 504} and len(retry_failures) < 3:
                    retry_failures.append(response.json().get("code", "temporary_failure"))
                    # One explicit retry; never hide an outage or reset the user's counter.
                    response = await client.post(base + "/ask", json=payload)
                return response

            for section, fraction in [("beginning", 0.05), ("middle", 0.5), ("end", 0.9)]:
                offset = int(len(source.transcript) * fraction)
                passage = source.transcript[offset : offset + 350]
                question = "Explain what the instructor means in this part of the video: " + passage
                started = monotonic()
                response = await ask({"question": question, "history": []})
                if response.status_code != 200:
                    raise RuntimeError(
                        "Answer_" + response.json().get("code", str(response.status_code))
                    )
                result = response.json()
                print(
                    json.dumps(
                        {
                            "phase": section,
                            "status": result["status"],
                            "citation_count": len(result["citations"]),
                        }
                    ),
                    flush=True,
                )
                assert result["status"] == "answered" and result["citations"]
                assert all(c["excerpt"] in source.transcript for c in result["citations"])
                timings.append(
                    {
                        "phase": section,
                        "seconds": round(monotonic() - started, 2),
                        "status": result["status"],
                    }
                )
                history = [
                    {"role": "user", "content": question[:4000]},
                    {"role": "assistant", "content": result["answer"][:4000]},
                ]
            for phase, question, context in [
                ("followup", "Can you explain that more simply?", history),
                (
                    "unrelated",
                    "What are the exact GPS coordinates of the Mars rover Perseverance today?",
                    [],
                ),
            ]:
                started = monotonic()
                response = await ask({"question": question, "history": context})
                if response.status_code != 200:
                    raise RuntimeError(
                        "Answer_" + response.json().get("code", str(response.status_code))
                    )
                data = response.json()
                print(
                    json.dumps(
                        {
                            "phase": phase,
                            "status": data["status"],
                            "citation_count": len(data["citations"]),
                        }
                    ),
                    flush=True,
                )
                assert data["status"] == (
                    "insufficient_evidence" if phase == "unrelated" else "answered"
                )
                timings.append(
                    {
                        "phase": phase,
                        "seconds": round(monotonic() - started, 2),
                        "status": data["status"],
                    }
                )
            # A fresh app instance uses the durable index; it does not need a conversation.
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=create_app()),
                base_url=settings.frontend_origin,
                cookies={"focustube_session": token},
            ) as reopened:
                assert (await reopened.get(base + "/status")).json()["status"] == "ready"
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=create_app()),
                base_url=settings.frontend_origin,
                cookies={"focustube_session": outsider_token},
            ) as outsider:
                assert (await outsider.get(base + "/status")).status_code == 404
            async with factory() as db:
                assert (await db.get(Video, video_id)).ai_content_unlocked_at is None
                assert (
                    await db.scalar(
                        select(RagDocument).where(
                            RagDocument.youtube_video_id == source.youtube_video_id
                        )
                    )
                ).state == "ready"
    finally:
        async with factory() as db:
            await db.execute(delete(User).where(User.id.in_([user_id, outsider_id])))
            await db.commit()
        await factory.kw["bind"].dispose()
        session_factory.cache_clear()
    print(
        json.dumps(
            {
                "passed": True,
                "timings": timings,
                "temporary_users_removed": True,
                "shared_index_retained": True,
                "manual_factual_review_pending": True,
                "temporary_provider_failures": retry_failures,
            }
        )
    )


if __name__ == "__main__":
    try:
        asyncio.run(main(), loop_factory=database_event_loop)
    except Exception as exc:
        # RuntimeError messages here are constructed exclusively from safe server codes.
        reason = str(exc) if type(exc) is RuntimeError else type(exc).__name__
        print(json.dumps({"passed": False, "reason": reason}))
        raise SystemExit(1) from None
