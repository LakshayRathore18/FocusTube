import asyncio
import json
from datetime import timedelta
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy import select, update

from app.main import logger
from app.models import AIContent, Note, Session, Video, now
from app.routers import ai, courses
from app.services.gemini import GenerationError
from app.services.transcripts import TranscriptError

NOTES = {
    "summary": {"hook": "Learn Python", "keyPoints": ["Variables"]},
    "quiz": {"questions": [{"question": "Which?", "options": ["A", "B", "C", "D"], "answer": 0}]},
}


async def test_unexpected_errors_and_origin_rejections_have_safe_request_metadata(
    setup, monkeypatch
):
    client, _, app = setup
    errors, requests = Mock(), Mock()
    monkeypatch.setattr(logger, "error", errors)
    monkeypatch.setattr(logger, "info", requests)

    @app.get("/api/test-error")
    async def fail():
        raise RuntimeError("sensitive SQL parameters and provider key")

    response = await client.get("/api/test-error?code=secret-oauth-code")
    assert response.status_code == 500
    assert response.json() == {"error": "Internal server error"}
    assert response.headers["cache-control"] == "no-store"
    error = json.loads(errors.call_args.args[0])
    assert error == {
        "event": "api_error",
        "request_id": response.headers["x-request-id"],
        "exception_type": "RuntimeError",
    }
    assert "secret" not in requests.call_args.args[0]
    denied = await client.post("/api/auth/logout", headers={"origin": "https://evil.example"})
    assert denied.status_code == 403
    assert denied.headers["x-request-id"] and denied.headers["cache-control"] == "no-store"


async def test_session_health_and_logout(setup):
    client, factory, app = setup
    response = await client.get("/api/auth/session")
    assert response.json()["user"]["id"] == "user-a"
    assert response.headers["cache-control"] == "no-store"
    assert (await client.get("/api/health/ready")).status_code == 200
    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/auth/session")).status_code == 401
    async with factory() as db:
        assert len(list(await db.scalars(select(Session)))) == 1


@pytest.mark.parametrize(
    "path",
    ["/api/courses", "/api/stats/learning", "/api/notes/overview", "/api/videos/continue-watching"],
)
async def test_unauthenticated(setup, path):
    client, _, _ = setup
    client.cookies.clear()
    assert (await client.get(path)).status_code == 401


async def test_expired_session(setup):
    client, factory, _ = setup
    async with factory() as db:
        await db.execute(update(Session).values(expires_at=now() - timedelta(seconds=1)))
        await db.commit()
    assert (await client.get("/api/auth/session")).status_code == 401


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/api/courses/course-b", None),
        ("DELETE", "/api/courses/course-b", None),
        ("POST", "/api/courses/course-b/sync", None),
        ("GET", "/api/courses/course-b/content-status", None),
        ("GET", "/api/notes/course-b", None),
        ("GET", "/api/videos/video-b/notes", None),
        ("PUT", "/api/videos/video-b/notes", {"content": "private"}),
        ("PATCH", "/api/videos/video-b", {"status": "completed"}),
        ("GET", "/api/videos/video-b/ai-content", None),
        ("POST", "/api/ai/content", {"youtubeVideoId": "lmnopqrstuv"}),
    ],
)
async def test_ownership(setup, method, path, body):
    client, _, _ = setup
    assert (await client.request(method, path, json=body)).status_code in {403, 404}


async def test_origin_protection(setup):
    client, _, _ = setup
    for origin in ("https://evil.example", "null", ""):
        response = await client.patch(
            "/api/videos/video-a", json={"status": "completed"}, headers={"Origin": origin}
        )
        assert response.status_code == 403


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"status": "bad"},
        {"status": None},
        {"lastWatchedSeconds": -1},
        {"lastWatchedSeconds": True},
        {"lastWatchedSeconds": "10"},
    ],
)
async def test_invalid_progress(setup, body):
    client, _, _ = setup
    assert (await client.patch("/api/videos/video-a", json=body)).status_code == 400


async def test_completion_can_clear_resume_position(setup):
    client, _, _ = setup
    await client.patch("/api/videos/video-a", json={"lastWatchedSeconds": 20})
    response = await client.patch(
        "/api/videos/video-a",
        json={
            "status": "completed",
            "lastWatchedSeconds": None,
        },
    )
    assert response.status_code == 200
    assert response.json()["lastWatchedSeconds"] is None
    assert response.json()["completedAt"] is not None


async def test_progress_notes_libraries_and_stats(setup):
    client, _, _ = setup
    assert (await client.get("/api/videos/video-a/notes")).json() is None
    for content in ("", "<p><br></p>", "<p>&nbsp;</p>"):
        assert (
            await client.put("/api/videos/video-a/notes", json={"content": content})
        ).status_code == 400
    note = (
        await client.put("/api/videos/video-a/notes", json={"content": "<p>My notes</p>"})
    ).json()
    assert note["videoId"] == "video-a"
    saved = (
        await client.put("/api/videos/video-a/notes", json={"content": "<p>Updated</p>"})
    ).json()
    assert saved["id"] == note["id"]
    progress = await client.patch(
        "/api/videos/video-a", json={"status": "completed", "lastWatchedSeconds": 20}
    )
    assert progress.json()["completedAt"] is not None
    assert len((await client.get("/api/notes")).json()) == 1
    library = (await client.get("/api/notes/overview")).json()[0]
    assert library["progressPct"] == 100 and library["personalNotesCount"] == 1
    assert (await client.get("/api/notes/course-a")).json()["videos"][0]["noteId"] == note["id"]
    assert (await client.get("/api/notes/course-a?tab=invalid")).status_code == 400
    assert (await client.get("/api/stats/learning")).json() == {
        "totalPlaylists": 1,
        "totalVideos": 1,
        "completedVideos": 1,
        "personalNotes": 1,
        "aiSummaries": 0,
    }
    assert (await client.get("/api/stats/weekly")).json()["videosCompletedThisWeek"] == 1
    assert (await client.get("/api/courses/course-a/content-status")).json()["video-a"]["hasNotes"]
    assert len((await client.get("/api/videos/recently-watched")).json()) == 1
    assert (await client.get("/api/videos/continue-watching")).json() == []
    await client.patch("/api/videos/video-a", json={"status": "in_progress"})
    assert len((await client.get("/api/videos/continue-watching")).json()) == 1
    assert (await client.delete("/api/videos/video-a/notes")).status_code == 200
    assert (await client.delete("/api/videos/video-a/notes")).status_code == 404


async def test_import_sync_and_delete_preserves_shared_ai(setup, monkeypatch):
    client, factory, _ = setup
    items = [
        {"youtube_video_id": "newvideo123", "title": "New", "thumbnail_url": None, "position": 0}
    ]

    async def playlist(playlist_id):
        return {"title": "New course", "thumbnail_url": None}, items

    monkeypatch.setattr(courses, "fetch_playlist", playlist)
    response = await client.post("/api/courses", json={"url": "PLnewabcdefghijk"})
    assert response.status_code == 201
    course_id = response.json()["courseId"]
    assert (await client.post("/api/courses", json={"url": "PLnewabcdefghijk"})).status_code == 409
    course = (await client.get(f"/api/courses/{course_id}")).json()
    assert course["_count"]["videos"] == 1
    assert course["videos"][0]["isAvailable"]
    await client.put("/api/videos/video-a/notes", json={"content": "Keep me"})
    synced = (await client.post("/api/courses/course-a/sync")).json()
    assert synced == {"added": 1, "updated": 0, "archived": 1, "total": 1}
    assert (await client.get("/api/videos/video-a/notes")).json()["content"] == "Keep me"
    synced_again = (await client.post("/api/courses/course-a/sync")).json()
    assert synced_again["added"] == 0 and synced_again["archived"] == 0
    items[0]["title"] = "Renamed"
    assert (await client.post("/api/courses/course-a/sync")).json()["updated"] == 1
    async with factory() as db:
        db.add(AIContent(youtube_video_id="abcdefghijk", status="ready", attempts=1, **NOTES))
        await db.commit()
    assert (await client.delete("/api/courses/course-a")).status_code == 200
    async with factory() as db:
        assert await db.get(Video, "video-a") is None
        assert list(await db.scalars(select(Note))) == []
        assert len(list(await db.scalars(select(AIContent)))) == 1


async def test_import_provider_failure_is_atomic(setup, monkeypatch):
    client, _, _ = setup

    async def fail(_):
        raise HTTPException(502, "Provider unavailable")

    monkeypatch.setattr(courses, "fetch_playlist", fail)
    assert (await client.post("/api/courses", json={"url": "PLnewabcdefghijk"})).status_code == 502
    assert len((await client.get("/api/courses")).json()) == 1


async def test_import_database_failure_rolls_back_course_and_videos(setup, monkeypatch):
    client, factory, _ = setup

    async def invalid_playlist(_):
        return {"title": "Invalid course", "thumbnail_url": None}, [
            {
                "youtube_video_id": "newvideo123",
                "title": "Bad position",
                "thumbnail_url": None,
                "position": None,
            }
        ]

    monkeypatch.setattr(courses, "fetch_playlist", invalid_playlist)
    response = await client.post("/api/courses", json={"url": "PLnewabcdefghijk"})
    assert response.status_code == 500
    assert response.json() == {"error": "Internal server error"}
    assert len((await client.get("/api/courses")).json()) == 1
    async with factory() as db:
        assert len(list(await db.scalars(select(Video)))) == 2


async def test_ai_generation_cache_and_library(setup, monkeypatch):
    client, factory, _ = setup
    calls = []

    async def transcript(_):
        return "transcript " * 3000

    async def generate(text):
        calls.append(text)
        return NOTES

    monkeypatch.setattr(ai, "get_transcript", transcript)
    monkeypatch.setattr(ai, "generate_notes", generate)
    payload = {"youtubeVideoId": "abcdefghijk", "courseId": "course-a"}
    assert (await client.post("/api/ai/content", json=payload)).json() == {
        "status": "ready",
        **NOTES,
    }
    assert (await client.post("/api/ai/content", json=payload)).json()["status"] == "ready"
    assert len(calls) == 1 and len(calls[0]) == 20_000
    async with factory() as db:
        content = await db.scalar(select(AIContent))
        assert content.attempts == 1 and len(content.transcript) == 33_000
    assert (await client.get("/api/videos/video-a/ai-content")).json() == NOTES
    assert len((await client.get("/api/notes/course-a?tab=ai")).json()["videos"]) == 1
    assert (await client.get("/api/stats/learning")).json()["aiSummaries"] == 1


async def test_ai_retries_and_stale_claim(setup, monkeypatch):
    client, factory, _ = setup
    async with factory() as db:
        db.add(
            AIContent(
                youtube_video_id="abcdefghijk",
                status="pending",
                attempts=1,
                last_attempted_at=now() - timedelta(minutes=3),
                claim_id="old-claim",
            )
        )
        await db.commit()

    async def fail(_):
        raise TranscriptError("no_captions")

    monkeypatch.setattr(ai, "get_transcript", fail)
    payload = {"youtubeVideoId": "abcdefghijk"}
    for attempt in (2, 3):
        assert (await client.post("/api/ai/content", json=payload)).json()[
            "reason"
        ] == "no_captions"
        async with factory() as db:
            assert (await db.scalar(select(AIContent))).attempts == attempt
    assert (await client.post("/api/ai/content", json=payload)).json()["reason"] == "max_attempts"


@pytest.mark.parametrize(
    "reason",
    ["service_unavailable", "rate_limited", "model_unavailable", "ai_not_configured", "timeout"],
)
async def test_ai_provider_failure_does_not_exhaust_video(setup, monkeypatch, reason):
    client, factory, _ = setup
    transcript_calls = []

    async def transcript(_):
        transcript_calls.append(1)
        return "transcript " * 10

    async def fail(_):
        raise GenerationError(reason)

    monkeypatch.setattr(ai, "get_transcript", transcript)
    monkeypatch.setattr(ai, "generate_notes", fail)
    payload = {"youtubeVideoId": "abcdefghijk"}
    for _ in range(4):
        assert (await client.post("/api/ai/content", json=payload)).json() == {
            "status": "failed",
            "reason": reason,
        }
    async with factory() as db:
        content = await db.scalar(select(AIContent))
        assert content.status == "failed" and content.attempts == 0
    assert len(transcript_calls) == 1

    async def recover(_):
        return NOTES

    monkeypatch.setattr(ai, "generate_notes", recover)
    assert (await client.post("/api/ai/content", json=payload)).json() == {
        "status": "ready",
        **NOTES,
    }


@pytest.mark.parametrize("retry", [False, True])
async def test_ai_concurrent_requests_only_generate_once(setup, monkeypatch, retry):
    client, factory, _ = setup
    if retry:
        async with factory() as db:
            db.add(AIContent(youtube_video_id="abcdefghijk", status="failed", attempts=1))
            await db.commit()
    started, finish = asyncio.Event(), asyncio.Event()
    calls = []

    async def transcript(_):
        calls.append(1)
        started.set()
        await finish.wait()
        return "transcript " * 10

    async def generate(_):
        return NOTES

    monkeypatch.setattr(ai, "get_transcript", transcript)
    monkeypatch.setattr(ai, "generate_notes", generate)
    payload = {"youtubeVideoId": "abcdefghijk"}
    winner = asyncio.create_task(client.post("/api/ai/content", json=payload))
    await asyncio.wait_for(started.wait(), timeout=5)
    try:
        assert (await client.post("/api/ai/content", json=payload)).json() == {"status": "pending"}
    finally:
        finish.set()
    assert (await winner).json()["status"] == "ready"
    assert len(calls) == 1
    async with factory() as db:
        assert (await db.scalar(select(AIContent))).attempts == (2 if retry else 1)


async def test_ai_pipeline_timeout_remains_retryable(setup, monkeypatch):
    client, factory, _ = setup

    async def timeout(_):
        raise TimeoutError

    monkeypatch.setattr(ai, "get_transcript", timeout)
    assert (
        await client.post("/api/ai/content", json={"youtubeVideoId": "abcdefghijk"})
    ).json() == {
        "status": "failed",
        "reason": "timeout",
    }
    async with factory() as db:
        content = await db.scalar(select(AIContent))
        assert content.status == "failed" and content.attempts == 0


async def test_ai_exhausted_stale_claim_does_not_retry(setup, monkeypatch):
    client, factory, _ = setup
    async with factory() as db:
        db.add(
            AIContent(
                youtube_video_id="abcdefghijk",
                status="pending",
                attempts=3,
                last_attempted_at=now() - timedelta(minutes=3),
                claim_id="expired",
            )
        )
        await db.commit()

    async def unexpected(_):
        pytest.fail("An exhausted claim must not invoke a provider")

    monkeypatch.setattr(ai, "get_transcript", unexpected)
    assert (
        await client.post("/api/ai/content", json={"youtubeVideoId": "abcdefghijk"})
    ).json() == {
        "status": "failed",
        "reason": "max_attempts",
    }


async def test_ai_replaced_worker_cannot_publish_or_unlock(setup, monkeypatch):
    client, factory, _ = setup
    started, finish = asyncio.Event(), asyncio.Event()

    async def transcript(_):
        started.set()
        await finish.wait()
        return "transcript " * 10

    async def generate(_):
        return NOTES

    monkeypatch.setattr(ai, "get_transcript", transcript)
    monkeypatch.setattr(ai, "generate_notes", generate)
    worker = asyncio.create_task(
        client.post("/api/ai/content", json={"youtubeVideoId": "abcdefghijk"})
    )
    try:
        await asyncio.wait_for(started.wait(), timeout=5)
        async with factory() as db:
            await db.execute(update(AIContent).values(claim_id="replacement", attempts=2))
            await db.commit()
    finally:
        finish.set()
        response = await worker
    assert response.json() == {"status": "pending"}
    async with factory() as db:
        content = await db.scalar(select(AIContent))
        assert content.claim_id == "replacement" and content.status == "pending"
        assert content.summary is None
        assert (await db.get(Video, "video-a")).ai_content_unlocked_at is None


async def test_ai_progress_tracks_real_phases_without_unlock_or_source_leak(setup, monkeypatch):
    client, factory, _ = setup
    transcript_started, transcript_finish = asyncio.Event(), asyncio.Event()
    generation_started, generation_finish = asyncio.Event(), asyncio.Event()

    async def transcript(_):
        transcript_started.set()
        await transcript_finish.wait()
        return "private full transcript " * 1000

    async def generate(_):
        generation_started.set()
        await generation_finish.wait()
        return NOTES

    monkeypatch.setattr(ai, "get_transcript", transcript)
    monkeypatch.setattr(ai, "generate_notes", generate)
    assert (await client.get("/api/videos/video-a/ai-progress")).json() == {"status": "not_started"}
    assert (await client.get("/api/videos/video-b/ai-progress")).status_code == 404
    worker = asyncio.create_task(
        client.post("/api/ai/content", json={"youtubeVideoId": "abcdefghijk"})
    )
    try:
        await asyncio.wait_for(transcript_started.wait(), 5)
        response = await client.get("/api/videos/video-a/ai-progress")
        assert response.json() == {"status": "pending", "stage": "transcript"}
        assert response.headers["cache-control"] == "no-store"
        transcript_finish.set()
        await asyncio.wait_for(generation_started.wait(), 5)
        assert (await client.get("/api/videos/video-a/ai-progress")).json() == {
            "status": "pending",
            "stage": "content",
        }
        async with factory() as db:
            content = await db.scalar(select(AIContent))
            assert content.transcript == "private full transcript " * 1000
            assert content.summary is None
            assert (await db.get(Video, "video-a")).ai_content_unlocked_at is None
    finally:
        transcript_finish.set()
        generation_finish.set()
        await worker
    assert (await client.get("/api/videos/video-a/ai-progress")).json() == {"status": "ready"}


async def test_ai_progress_rejects_stale_pending_work(setup):
    client, factory, _ = setup
    async with factory() as db:
        db.add(
            AIContent(
                youtube_video_id="abcdefghijk",
                status="pending",
                attempts=1,
                last_attempted_at=now() - timedelta(minutes=3),
            )
        )
        await db.commit()
    assert (await client.get("/api/videos/video-a/ai-progress")).json() == {"status": "failed"}
