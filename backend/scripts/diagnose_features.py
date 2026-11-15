"""Redacted provider diagnostics; --verify-api uses and removes a temporary account."""

import argparse
import asyncio
import json
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

import httpx
from sqlalchemy import delete, select

from app.config import get_settings
from app.database import session_factory
from app.dependencies import hash_token
from app.models import AIContent, Course, Session, User, Video, new_id, now
from app.runtime import database_event_loop
from app.services.gemini import GenerationError, generate_notes
from app.services.transcripts import TranscriptError, get_transcript
from scripts.check_database import check as check_target


async def verify_api(youtube_video_id):
    await check_target()  # Refuse the archived database before any temporary writes.
    user_id, course_id, video_id = new_id(), new_id(), new_id()
    token = secrets.token_urlsafe(32)
    factory = session_factory()
    try:
        async with factory() as db:
            db.add(User(id=user_id, email=f"ai-check-{user_id}@example.invalid"))
            await db.flush()
            db.add_all(
                [
                    Session(
                        user_id=user_id,
                        token_hash=hash_token(token),
                        expires_at=now() + timedelta(minutes=5),
                    ),
                    Course(
                        id=course_id,
                        user_id=user_id,
                        youtube_playlist_id=f"check-{course_id}",
                        title="AI verification",
                    ),
                ]
            )
            await db.flush()
            db.add(
                Video(
                    id=video_id,
                    course_id=course_id,
                    youtube_video_id=youtube_video_id,
                    title="AI verification",
                    position=0,
                )
            )
            await db.commit()
        async with httpx.AsyncClient(
            base_url=get_settings().frontend_origin,
            cookies={"focustube_session": token},
            headers={"Origin": get_settings().frontend_origin},
            timeout=110,
        ) as client:
            response = await client.post(
                "/api/ai/content", json={"youtubeVideoId": youtube_video_id, "courseId": course_id}
            )
            data = response.json()
            print(
                json.dumps(
                    {
                        "generation_http_status": response.status_code,
                        "generation_status": data.get("status"),
                        "reason": data.get("reason"),
                    }
                ),
                flush=True,
            )
            assert response.status_code == 200 and data.get("status") == "ready", (
                f"GenerationNotReady:{data.get('reason', response.status_code)}"
            )
            response = await client.get(f"/api/videos/{video_id}/ai-content")
            print(
                json.dumps(
                    {
                        "retrieval_http_status": response.status_code,
                        "summary_matches": response.json().get("summary") == data["summary"],
                    }
                ),
                flush=True,
            )
            assert response.status_code == 200 and response.json().get("summary") == data["summary"]
            response = await client.post(
                "/api/ai/content", json={"youtubeVideoId": youtube_video_id, "courseId": course_id}
            )
            assert response.json().get("summary") == data["summary"]
        async with factory() as db:
            cached = await db.scalar(
                select(AIContent).where(AIContent.youtube_video_id == youtube_video_id)
            )
            assert cached.status == "ready" and cached.transcript
        print(
            json.dumps(
                {
                    "api_generation_ready": True,
                    "persisted_and_cached": True,
                    "summary_and_quiz_retrievable": True,
                }
            )
        )
    finally:
        async with factory() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()
        print(json.dumps({"temporary_account_removed": True}))


async def check():
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe-model")
    parser.add_argument("--list-models", action="store_true")
    parser.add_argument("--verify-api", action="store_true")
    parser.add_argument(
        "--fresh", action="store_true", help="Verify a course video without cached AI content"
    )
    args = parser.parse_args()
    if args.list_models:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                headers={"x-goog-api-key": get_settings().gemini_api_key},
            )
            print(
                json.dumps(
                    {
                        "status": response.status_code,
                        "models": [
                            model["name"]
                            for model in response.json().get("models", [])
                            if "flash" in model["name"]
                            and "generateContent" in model.get("supportedGenerationMethods", [])
                        ],
                    }
                )
            )
        return
    if args.probe_model:
        get_settings().gemini_model = args.probe_model
        try:
            notes = await generate_notes(
                "Python variables refer to objects. A variable can hold a number or a string. Assignment uses an equals sign. print displays a value. "
                * 3
            )
            print(
                json.dumps(
                    {
                        "model": args.probe_model,
                        "generation_ok": True,
                        "key_points": len(notes["summary"]["keyPoints"]),
                    }
                )
            )
        except GenerationError as exc:
            print(
                json.dumps(
                    {
                        "model": args.probe_model,
                        "reason": str(exc),
                        "provider_code": getattr(exc.__cause__, "code", None),
                    }
                )
            )
        return
    async with session_factory()() as db:
        image = await db.scalar(select(User.image).where(User.image.is_not(None)).limit(1))
        failed = await db.scalar(select(AIContent).where(AIContent.status == "failed").limit(1))
        video_id = (
            failed.youtube_video_id
            if failed
            else await db.scalar(select(Video.youtube_video_id).limit(1))
        )
        if args.fresh:
            video_id = await db.scalar(
                select(Video.youtube_video_id)
                .where(
                    Video.is_available.is_(True),
                    Video.youtube_video_id.not_in(select(AIContent.youtube_video_id)),
                )
                .limit(1)
            )
            if not video_id:
                raise RuntimeError("NoUncachedVideo")
        print(
            json.dumps(
                {
                    "profile_image_saved": bool(image),
                    "failed_ai_attempts": failed.attempts if failed else None,
                }
            )
        )
    async with httpx.AsyncClient(timeout=30) as client:
        if image:
            for label, url, params in [
                ("profile_direct", image, None),
                (
                    "profile_optimizer",
                    "http://localhost:3000/_next/image",
                    {"url": image, "w": 64, "q": 75},
                ),
            ]:
                try:
                    response = await client.get(url, params=params)
                    print(
                        json.dumps(
                            {
                                "check": label,
                                "host": urlsplit(image).hostname,
                                "status": response.status_code,
                                "content_type": response.headers.get("content-type"),
                            }
                        )
                    )
                except Exception as exc:
                    print(json.dumps({"check": label, "error_type": type(exc).__name__}))
    if video_id:
        if args.verify_api:
            await verify_api(video_id)
            return
        try:
            transcript = await get_transcript(video_id)
            print(json.dumps({"transcript_ok": True, "characters": len(transcript)}))
            notes = await generate_notes(transcript[:20_000])
            print(
                json.dumps(
                    {"generation_ok": True, "key_points": len(notes["summary"]["keyPoints"])}
                )
            )
        except (TranscriptError, GenerationError) as exc:
            cause = exc.__cause__
            print(
                json.dumps(
                    {
                        "stage": type(exc).__name__,
                        "reason": str(exc),
                        "cause_type": type(cause).__name__,
                        "provider_code": getattr(cause, "code", None),
                        "provider_status": getattr(cause, "status", None),
                    }
                )
            )


if __name__ == "__main__":
    try:
        asyncio.run(check(), loop_factory=database_event_loop)
    except Exception as exc:
        print(json.dumps({"error_type": type(exc).__name__}))
        raise SystemExit(1) from None
