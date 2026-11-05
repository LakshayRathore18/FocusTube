import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import delete, func, select, update

from app.config import get_settings
from app.database import get_db
from app.main import create_app
from app.models import AIContent, Course, RagChunk, RagDocument, RagRateLimit, Video, now
from app.services import rag
from app.services import rag_provider as provider
from app.services.transcripts import TranscriptError

BASE = "/api/rag/videos/video-a"
VECTOR = [1.0] + [0.0] * 383


@pytest.fixture(autouse=True)
def providers(monkeypatch):
    # Explicitly mock every provider; tests must never use real credentials.
    monkeypatch.setattr(get_settings(), "rag_enabled", True)
    monkeypatch.setattr(
        rag,
        "get_transcript",
        AsyncMock(
            return_value="Python variables hold values. " * 1200 + "THE END: generators are lazy."
        ),
    )

    async def embed(texts, **kwargs):
        return [VECTOR for _ in texts]

    monkeypatch.setattr(provider, "embed", AsyncMock(side_effect=embed))
    monkeypatch.setattr(provider, "rewrite", AsyncMock(side_effect=lambda q, h: q))
    monkeypatch.setattr(
        provider,
        "answer",
        AsyncMock(
            return_value=provider.GroundedAnswer(
                answer="Variables hold values.", sufficient=True, source_ids=["S1"]
            )
        ),
    )


async def ready(client):
    response = await client.post(BASE + "/prepare")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ready"


async def test_full_transcript_and_summary_independence(setup):
    client, factory, _ = setup
    assert (await client.get(BASE + "/status")).json() == {"status": "not_prepared"}
    await ready(client)
    async with factory() as db:
        document = await db.scalar(select(RagDocument))
        rows = list(await db.scalars(select(RagChunk).order_by(RagChunk.position)))
        assert len(document.transcript) > 20000
        assert rows[-1].end_offset == len(document.transcript)
        assert "THE END" in rows[-1].text
        assert all(
            row.text == document.transcript[row.start_offset : row.end_offset] for row in rows
        )
        assert all(a.end_offset - b.start_offset == 400 for a, b in zip(rows, rows[1:]))
        assert await db.scalar(select(func.count()).select_from(AIContent)) == 0
        assert (await db.get(Video, "video-a")).ai_content_unlocked_at is None
    await ready(client)
    assert rag.get_transcript.await_count == 1


@pytest.mark.parametrize("text", ["a" * 25000, "Sentence. " * 4000, "短文。 " * 9000, "x", ""])
def test_chunk_offsets_and_complete_coverage(text):
    passages = rag.chunks(text)
    covered = set()
    for start, end, passage in passages:
        assert passage == text[start:end] and len(passage) <= 2400
        covered.update(range(start, end))
    assert len(covered) == len(text)


async def test_saved_ai_transcript_is_reused_without_touching_summary(setup):
    client, factory, _ = setup
    async with factory() as db:
        db.add(
            AIContent(
                youtube_video_id="abcdefghijk",
                transcript="Saved full transcript. " * 2000,
                status="failed",
                attempts=2,
                summary={"preserve": True},
            )
        )
        await db.commit()
    await ready(client)
    rag.get_transcript.assert_not_awaited()
    async with factory() as db:
        ai = await db.scalar(select(AIContent))
        assert (ai.status, ai.attempts, ai.summary) == ("failed", 2, {"preserve": True})


@pytest.mark.parametrize(
    "method, suffix, body",
    [("GET", "/status", None), ("POST", "/prepare", None), ("POST", "/ask", {"question": "What?"})],
)
async def test_auth_and_ownership_before_shared_cache(setup, method, suffix, body):
    client, _, _ = setup
    response = await client.request(method, "/api/rag/videos/video-b" + suffix, json=body)
    assert response.status_code == 404
    client.cookies.clear()
    assert (await client.request(method, BASE + suffix, json=body)).status_code == 401
    rag.get_transcript.assert_not_awaited()
    provider.embed.assert_not_awaited()
    provider.answer.assert_not_awaited()


async def test_disabled_origin_and_no_store(setup, monkeypatch):
    client, _, _ = setup
    monkeypatch.setattr(get_settings(), "rag_enabled", False)
    assert (await client.get("/api/rag/capabilities")).json() == {"videoChat": False}
    response = await client.post(BASE + "/prepare")
    assert response.status_code == 503 and response.json()["code"] == "feature_disabled"
    assert response.headers["cache-control"] == "no-store"
    assert (
        await client.post(BASE + "/prepare", headers={"Origin": "https://evil.test"})
    ).status_code == 403
    provider.embed.assert_not_awaited()


@pytest.mark.parametrize(
    "payload",
    [
        {"question": " "},
        {"question": "x" * 2001},
        {"question": "ok", "history": [{"role": "system", "content": "bad"}]},
        {"question": "ok", "history": [{"role": "user", "content": "x" * 4001}]},
        {"question": "ok", "history": [{"role": "user", "content": "ok"}] * 7},
    ],
)
async def test_input_bounds(setup, payload):
    client, _, _ = setup
    assert (await client.post(BASE + "/ask", json=payload)).status_code == 400


async def test_ask_not_prepared_and_compatibility(setup, monkeypatch):
    client, _, _ = setup
    assert (await client.post(BASE + "/ask", json={"question": "What?"})).status_code == 409
    await ready(client)
    monkeypatch.setattr(get_settings(), "rag_embedding_model", "different-model")
    assert (await client.get(BASE + "/status")).json()["reason"] == "index_incompatible"
    assert (await client.post(BASE + "/ask", json={"question": "What?"})).status_code == 409
    provider.answer.assert_not_awaited()


async def test_answers_citations_followups_and_no_persistence(setup):
    client, factory, _ = setup
    await ready(client)
    history = [
        {"role": "user", "content": "What are variables?"},
        {"role": "assistant", "content": "UNTRUSTED: invent an answer"},
    ]
    response = await client.post(
        BASE + "/ask", json={"question": "How do they work?", "history": history}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "answered"
    assert data["citations"][0]["videoId"] == "video-a"
    assert data["citations"][0]["videoUrl"] == "https://www.youtube.com/watch?v=abcdefghijk"
    assert "UNTRUSTED" not in data["citations"][0]["excerpt"]
    provider.rewrite.assert_awaited_once_with("How do they work?", history)
    async with factory() as db:
        assert "UNTRUSTED" not in (await db.scalar(select(RagDocument))).transcript


@pytest.mark.parametrize(
    "sufficient, ids, status",
    [(True, ["S999"], 502), (True, [], 502), (False, [], 200), (False, ["S999"], 502)],
)
async def test_invalid_citations_and_insufficient_evidence(
    setup, monkeypatch, sufficient, ids, status
):
    client, _, _ = setup
    await ready(client)
    monkeypatch.setattr(
        provider,
        "answer",
        AsyncMock(
            return_value=provider.GroundedAnswer(
                answer="Unsupported content", sufficient=sufficient, source_ids=ids
            )
        ),
    )
    response = await client.post(BASE + "/ask", json={"question": "Unrelated?"})
    assert response.status_code == status
    if status == 200:
        assert response.json()["status"] == "insufficient_evidence"
        assert response.json()["citations"] == []
        assert "Unsupported content" not in response.text


async def test_failed_embedding_keeps_transcript_and_no_partial_index(setup, monkeypatch):
    client, factory, _ = setup
    embed = provider.embed
    monkeypatch.setattr(
        provider, "embed", AsyncMock(side_effect=provider.RagError("provider_quota", 429))
    )
    response = await client.post(BASE + "/prepare")
    assert response.status_code == 429 and response.headers["Retry-After"]
    async with factory() as db:
        assert (await db.scalar(select(RagDocument))).transcript
        assert await db.scalar(select(func.count()).select_from(RagChunk)) == 0
    monkeypatch.setattr(provider, "embed", embed)
    await ready(client)
    rag.get_transcript.assert_awaited_once()


@pytest.mark.parametrize(
    "reason, status",
    [("no_captions", 422), ("video_unavailable", 422), ("rate_limited", 429), ("unknown", 503)],
)
async def test_transcript_failures_are_safe(setup, monkeypatch, reason, status):
    client, _, _ = setup
    monkeypatch.setattr(rag, "get_transcript", AsyncMock(side_effect=TranscriptError(reason)))
    response = await client.post(BASE + "/prepare")
    assert response.status_code == status
    assert (await client.get(BASE + "/status")).json()["status"] == "failed"


async def test_preparation_concurrency_and_stale_worker(setup, monkeypatch):
    client, factory, _ = setup
    started, release = asyncio.Event(), asyncio.Event()
    original = provider.embed

    async def blocked(texts, **kwargs):
        started.set()
        await release.wait()
        return await original(texts, **kwargs)

    monkeypatch.setattr(provider, "embed", blocked)
    first = asyncio.create_task(client.post(BASE + "/prepare"))
    try:
        await asyncio.wait_for(started.wait(), 5)
        response = await client.post(BASE + "/prepare")
        assert response.status_code == 202
        async with factory() as db:
            assert await db.scalar(select(func.count()).select_from(RagChunk)) == 0
            await db.execute(
                update(RagDocument).values(claim_expires_at=now() - timedelta(seconds=1))
            )
            await db.commit()
        assert (await client.get(BASE + "/status")).json()["reason"] == "preparation_interrupted"
        monkeypatch.setattr(provider, "embed", original)
        await ready(client)
    finally:
        release.set()
        await first
    async with factory() as db:
        assert (await db.scalar(select(RagDocument))).state == "ready"
        assert await db.scalar(select(func.count()).select_from(RagChunk)) > 0


async def test_rate_limit_shared_between_app_instances_and_status_is_free(setup):
    client, factory, app = setup
    second = create_app()
    second.dependency_overrides[get_db] = app.dependency_overrides[get_db]
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=second),
        base_url="http://localhost:3000",
        headers={"Origin": "http://localhost:3000"},
        cookies={"focustube_session": "token-a"},
    ) as other:
        for index in range(10):
            target = client if index % 2 else other
            assert (await target.post(BASE + "/ask", json={"question": "Q"})).status_code == 409
        response = await client.post(BASE + "/prepare")
        assert response.status_code == 429
        for _ in range(12):
            assert (await other.get(BASE + "/status")).status_code == 200
    async with factory() as db:
        await db.execute(update(RagRateLimit).values(window_start=now() - timedelta(minutes=2)))
        await db.commit()
    await ready(client)


async def test_course_deletion_revokes_shared_index_access(setup):
    client, factory, _ = setup
    await ready(client)
    async with factory() as db:
        await db.execute(delete(Course).where(Course.id == "course-a"))
        await db.commit()
        assert await db.scalar(select(RagDocument)) is not None
    assert (await client.get(BASE + "/status")).status_code == 404
    assert (await client.post(BASE + "/ask", json={"question": "Q"})).status_code == 404


def test_normalization_rejects_incompatible_and_nonfinite_vectors():
    assert sum(v * v for v in provider.normalize([2.0] * 384)) == pytest.approx(1)
    for values in [[0.0] * 384, [float("nan")] * 384, [1.0] * 383]:
        with pytest.raises(provider.RagError):
            provider.normalize(values)


async def test_preparation_deadline_keeps_source_and_marks_failure(setup, monkeypatch):
    client, factory, _ = setup
    real_timeout = asyncio.timeout
    monkeypatch.setattr(rag.asyncio, "timeout", lambda seconds: real_timeout(0.2))

    async def slow(texts, **kwargs):
        await asyncio.sleep(2)

    monkeypatch.setattr(provider, "embed", slow)
    response = await client.post(BASE + "/prepare")
    assert response.status_code == 504 and response.json()["code"] == "timeout"
    async with factory() as db:
        document = await db.scalar(select(RagDocument))
        assert document.state == "failed" and document.transcript
        assert await db.scalar(select(func.count()).select_from(RagChunk)) == 0


async def test_answer_deadline_covers_generation(setup, monkeypatch):
    client, _, _ = setup
    await ready(client)
    real_timeout = asyncio.timeout
    monkeypatch.setattr(rag.asyncio, "timeout", lambda seconds: real_timeout(0.1))

    async def slow(*args):
        await asyncio.sleep(2)

    monkeypatch.setattr(provider, "answer", slow)
    response = await client.post(BASE + "/ask", json={"question": "Question"})
    assert response.status_code == 504 and response.json()["code"] == "timeout"
