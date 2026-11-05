"""Reusable video transcript indexing and exact, document-scoped retrieval."""

import asyncio
import hashlib
import json
import logging
import re
from datetime import UTC, timedelta
from time import monotonic

from sqlalchemy import and_, case, delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import AIContent, RagChunk, RagDocument, RagRateLimit, Video, new_id, now
from . import rag_provider as provider
from .transcripts import TranscriptError, get_transcript

VERSION = "chars-2400-overlap-400-minilm-token240-pool-v3"


def operation(phase: str, started: float, *, chunk_count: int = 0, failure: str | None = None):
    logging.getLogger("focustube").info(
        json.dumps(
            {
                "event": "rag_operation",
                "phase": phase,
                "duration_ms": round((monotonic() - started) * 1000),
                "chunk_count": chunk_count,
                "failure_category": failure,
            }
        )
    )


def chunks(text: str) -> list[tuple[int, int, str]]:
    result = []
    start = 0
    while start < len(text):
        end = min(start + 2400, len(text))
        if end < len(text):
            tail = text[start + 1800 : end]
            boundaries = list(re.finditer(r"[.!?]\s+", tail)) or list(re.finditer(r"\s+", tail))
            if boundaries:
                end = start + 1800 + boundaries[-1].end()
        result.append((start, end, text[start:end]))
        if end == len(text):
            break
        start = end - 400
    return result


def insert_for(db: AsyncSession, model):
    return (pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert)(model)


def compatible(document: RagDocument) -> bool:
    return (
        document.indexing_version == VERSION
        and document.embedding_model == get_settings().rag_embedding_model
        and document.embedding_dimensions == provider.DIMENSIONS
    )


def status(document: RagDocument | None) -> dict:
    if document is None:
        return {"status": "not_prepared"}
    if document.state == "pending":
        expiry = document.claim_expires_at
        if expiry is not None and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=UTC)
        if expiry is None or expiry <= now():
            return {"status": "failed", "reason": "preparation_interrupted"}
        return {"status": "pending"}
    if document.state == "ready" and not compatible(document):
        return {"status": "not_prepared", "reason": "index_incompatible"}
    return {
        "status": document.state,
        **({"reason": document.failure_reason} if document.failure_reason else {}),
    }


async def document_for(db: AsyncSession, youtube_id: str) -> RagDocument | None:
    return await db.scalar(select(RagDocument).where(RagDocument.youtube_video_id == youtube_id))


async def throttle(db: AsyncSession, user_id: str):
    timestamp = now()
    expired = RagRateLimit.window_start <= timestamp - timedelta(minutes=1)
    stmt = insert_for(db, RagRateLimit).values(user_id=user_id, window_start=timestamp, count=1)
    stmt = stmt.on_conflict_do_update(
        index_elements=[RagRateLimit.user_id],
        set_={
            "count": case((expired, 1), else_=RagRateLimit.count + 1),
            "window_start": case((expired, timestamp), else_=RagRateLimit.window_start),
        },
        where=or_(expired, RagRateLimit.count < 10),
    ).returning(RagRateLimit.count)
    count = await db.scalar(stmt)
    await db.commit()
    if count is None:
        raise provider.RagError("rate_limited", 429)


async def prepare(db: AsyncSession, video: Video) -> dict:
    started = monotonic()
    youtube_id = video.youtube_video_id
    document = await document_for(db, youtube_id)
    if document and status(document)["status"] == "ready":
        return {"status": "ready"}
    claim = new_id()
    timestamp = now()
    values = dict(
        id=new_id(),
        youtube_video_id=video.youtube_video_id,
        indexing_version=VERSION,
        embedding_model=get_settings().rag_embedding_model,
        embedding_dimensions=provider.DIMENSIONS,
        state="pending",
        failure_reason=None,
        claim_id=claim,
        claim_expires_at=timestamp + timedelta(minutes=5),
        created_at=timestamp,
        updated_at=timestamp,
    )
    stmt = insert_for(db, RagDocument).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[RagDocument.youtube_video_id],
        set_={k: v for k, v in values.items() if k not in {"id", "youtube_video_id", "created_at"}},
        where=and_(
            or_(
                RagDocument.state != "pending",
                RagDocument.claim_expires_at <= timestamp,
                RagDocument.claim_expires_at.is_(None),
            ),
            # A racing request must not replace a newly compatible ready index.
            or_(
                RagDocument.state != "ready",
                RagDocument.indexing_version != VERSION,
                RagDocument.embedding_model != get_settings().rag_embedding_model,
                RagDocument.embedding_dimensions != provider.DIMENSIONS,
            ),
        ),
    ).returning(RagDocument.id)
    document_id = await db.scalar(stmt)
    await db.commit()
    if document_id is None:
        db.expire_all()
        return status(await document_for(db, youtube_id))

    guard = and_(
        RagDocument.id == document_id,
        RagDocument.claim_id == claim,
        RagDocument.state == "pending",
        RagDocument.claim_expires_at > now(),
    )
    try:
        async with asyncio.timeout(90):
            db.expire_all()
            document = await db.get(RagDocument, document_id)
            transcript = document.transcript
            if not transcript:
                transcript = await db.scalar(
                    select(AIContent.transcript).where(
                        AIContent.youtube_video_id == values["youtube_video_id"]
                    )
                )
            await db.commit()
            if not transcript:
                transcript = await get_transcript(values["youtube_video_id"])
            if not transcript.strip():
                raise provider.RagError("no_captions", 422)
            # Save source independently, before embedding, for retries after provider failure.
            saved = await db.execute(
                update(RagDocument)
                .where(guard)
                .values(
                    transcript=transcript,
                    content_hash=hashlib.sha256(transcript.encode()).hexdigest(),
                )
                .execution_options(synchronize_session=False)
            )
            await db.commit()
            if not saved.rowcount:
                return {"status": "pending"}
            passages = chunks(transcript)
            vectors = []
            for offset in range(0, len(passages), 16):
                vectors.extend(await provider.embed([p[2] for p in passages[offset : offset + 16]]))
            # Row update locks the claim until all chunks and ready state commit together.
            published = await db.execute(
                update(RagDocument)
                .where(
                    RagDocument.id == document_id,
                    RagDocument.claim_id == claim,
                    RagDocument.state == "pending",
                    RagDocument.claim_expires_at > now(),
                )
                .values(state="ready", claim_id=None, claim_expires_at=None)
                .execution_options(synchronize_session=False)
            )
            if not published.rowcount:
                await db.rollback()
                return {"status": "pending"}
            await db.execute(delete(RagChunk).where(RagChunk.document_id == document_id))
            db.add_all(
                [
                    RagChunk(
                        document_id=document_id,
                        position=i,
                        start_offset=start,
                        end_offset=end,
                        text=text,
                        embedding=vectors[i],
                    )
                    for i, (start, end, text) in enumerate(passages)
                ]
            )
            await db.commit()
            operation("prepare", started, chunk_count=len(passages))
            return {"status": "ready"}
    except Exception as exc:
        await db.rollback()
        if isinstance(exc, provider.RagError):
            safe = exc
        elif isinstance(exc, TranscriptError):
            reason = str(exc)
            safe = provider.RagError(
                reason
                if reason in {"no_captions", "video_unavailable"}
                else "provider_quota"
                if reason == "rate_limited"
                else "transcript_unavailable",
                422
                if reason in {"no_captions", "video_unavailable"}
                else 429
                if reason == "rate_limited"
                else 503,
            )
        else:
            safe = provider.provider_error(exc)
        await db.execute(
            update(RagDocument)
            .where(RagDocument.id == document_id, RagDocument.claim_id == claim)
            .values(
                state="failed",
                failure_reason=safe.code,
                claim_id=None,
                claim_expires_at=None,
            )
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        operation("prepare", started, failure=safe.code)
        raise safe from None


async def retrieve(db: AsyncSession, document_id: str, vector: list[float]) -> list[RagChunk]:
    if db.bind.dialect.name == "postgresql":
        return list(
            await db.scalars(
                select(RagChunk)
                .where(RagChunk.document_id == document_id)
                .order_by(RagChunk.embedding.cosine_distance(vector), RagChunk.position)
                .limit(6)
            )
        )
    # Test-only fallback: PostgreSQL distance/operator behavior needs separate integration checks.
    rows = list(await db.scalars(select(RagChunk).where(RagChunk.document_id == document_id)))
    return sorted(rows, key=lambda row: -sum(a * b for a, b in zip(row.embedding, vector)))[:6]


async def ask(db: AsyncSession, video: Video, question: str, history: list[dict]) -> dict:
    async with asyncio.timeout(60):
        document = await document_for(db, video.youtube_video_id)
        if not document or status(document)["status"] != "ready":
            raise provider.RagError("not_prepared", 409)
        document_id = document.id
        video_id, title, youtube_id = video.id, video.title, video.youtube_video_id
        await db.commit()
        retrieval_question = await provider.rewrite(question, history)
        vector = (await provider.embed([retrieval_question], query=True))[0]
        # Recheck compatibility after the provider call; a reindex may have started.
        db.expire_all()
        document = await db.get(RagDocument, document_id)
        if not document or status(document)["status"] != "ready":
            raise provider.RagError("not_prepared", 409)
        records = await retrieve(db, document_id, vector)
        passages = [{"id": f"S{i + 1}", "text": row.text} for i, row in enumerate(records)]
        await db.commit()
        if not passages:
            raise provider.RagError("not_prepared", 409)
        result = await provider.answer(question, history, passages)
        sources = {p["id"]: p["text"] for p in passages}
        if any(source not in sources for source in result.source_ids):
            raise provider.RagError("invalid_citations", 502)
        if not result.sufficient:
            return {
                "status": "insufficient_evidence",
                "answer": "The retrieved transcript passages do not provide enough evidence to answer this question. Try a more specific question about the video.",
                "citations": [],
            }
        if not result.source_ids:
            raise provider.RagError("invalid_citations", 502)
        return {
            "status": "answered",
            "answer": result.answer,
            "citations": [
                {
                    "sourceId": source,
                    "excerpt": sources[source],
                    "videoId": video_id,
                    "videoTitle": title,
                    "videoUrl": f"https://www.youtube.com/watch?v={youtube_id}",
                }
                for source in dict.fromkeys(result.source_ids)
            ],
        }
