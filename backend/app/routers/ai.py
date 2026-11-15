import asyncio
import logging
from datetime import UTC, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError

from ..dependencies import DB, CurrentUser
from ..models import AIContent, Course, Video, new_id, now
from ..schemas import GenerateInput
from ..services.gemini import GenerationError, generate_notes
from ..services.transcripts import TranscriptError, get_transcript

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("focustube.ai")


async def unlock(db, video_id: str, user_id: str):
    await db.execute(
        update(Video)
        .where(
            Video.id == video_id,
            Video.course_id.in_(select(Course.id).where(Course.user_id == user_id)),
        )
        .values(ai_content_unlocked_at=now())
    )
    await db.commit()


@router.post("/content")
async def generate(body: GenerateInput, db: DB, user: CurrentUser):
    query = (
        select(Video)
        .join(Course)
        .where(Course.user_id == user.id, Video.youtube_video_id == body.youtube_video_id)
    )
    if body.course_id is not None:
        query = query.where(Video.course_id == body.course_id)
    video = await db.scalar(query.order_by(Video.updated_at.desc()).limit(1))
    if video is None:
        raise HTTPException(404, "Video not found")
    video_id, user_id, yt_id = video.id, user.id, body.youtube_video_id
    existing = await db.scalar(select(AIContent).where(AIContent.youtube_video_id == yt_id))
    if existing and existing.status == "ready":
        result = {"status": "ready", "summary": existing.summary, "quiz": existing.quiz}
        await unlock(db, video_id, user_id)
        return result
    claim_id, claimed_at = new_id(), now()
    stale_before = claimed_at - timedelta(minutes=2)
    if existing:
        row_id = existing.id
        eligible = or_(
            AIContent.status == "failed",
            and_(
                AIContent.status == "pending",
                or_(
                    AIContent.last_attempted_at < stale_before,
                    AIContent.last_attempted_at.is_(None),
                ),
            ),
        )
        claim = await db.execute(
            update(AIContent)
            .where(AIContent.id == row_id, AIContent.attempts < 3, eligible)
            .values(
                status="pending",
                claim_id=claim_id,
                attempts=AIContent.attempts + 1,
                last_attempted_at=claimed_at,
            )
            # Let the database evaluate timestamp predicates, including on SQLite.
            .execution_options(synchronize_session=False)
        )
        if claim.rowcount == 0:
            await db.refresh(existing)
            result = {"status": "pending"}
            if existing.status == "ready":
                result = {"status": "ready", "summary": existing.summary, "quiz": existing.quiz}
            elif existing.attempts >= 3 and (
                existing.status == "failed"
                or existing.last_attempted_at is None
                or (
                    existing.last_attempted_at.replace(tzinfo=UTC)
                    if existing.last_attempted_at.tzinfo is None
                    else existing.last_attempted_at
                )
                < stale_before
            ):
                result = {"status": "failed", "reason": "max_attempts"}
            await db.commit()
            if result["status"] == "ready":
                await unlock(db, video_id, user_id)
            return result
        await db.commit()
    else:
        row_id = new_id()
        db.add(
            AIContent(
                id=row_id,
                youtube_video_id=yt_id,
                attempts=1,
                status="pending",
                claim_id=claim_id,
                last_attempted_at=claimed_at,
            )
        )
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return {"status": "pending"}
    # No database transaction is held during the network pipeline.
    transcript = existing.transcript if existing else None
    try:
        async with asyncio.timeout(90):
            if not transcript:
                transcript = await get_transcript(yt_id)
            # Persist the source before generation, both for safe retries and
            # honest progress reporting. Only the current claim may advance.
            saved = await db.execute(
                update(AIContent)
                .where(
                    AIContent.id == row_id,
                    AIContent.claim_id == claim_id,
                    AIContent.status == "pending",
                )
                .values(transcript=transcript)
                .execution_options(synchronize_session=False)
            )
            await db.commit()
            if saved.rowcount == 0:
                return {"status": "pending"}
            notes = await generate_notes(transcript[:20_000])
        values = {
            "status": "ready",
            "transcript": transcript,
            "summary": notes["summary"],
            "quiz": notes["quiz"],
        }
        result = {"status": "ready", **notes}
    except (TranscriptError, GenerationError) as exc:
        values = {"status": "failed", "transcript": transcript}
        result = {"status": "failed", "reason": str(exc)}
        if isinstance(exc, GenerationError) and str(exc) in {
            "service_unavailable",
            "rate_limited",
            "model_unavailable",
            "ai_not_configured",
            "timeout",
        }:
            # Provider outages/configuration must not permanently lock this video.
            values["attempts"] = AIContent.attempts - 1
    except TimeoutError:
        values = {"status": "failed", "transcript": transcript, "attempts": AIContent.attempts - 1}
        result = {"status": "failed", "reason": "timeout"}
    except Exception:
        logger.error("Unexpected generation failure", extra={"claim_id": claim_id})
        values = {"status": "failed", "transcript": transcript}
        result = {"status": "failed", "reason": "api_error"}
    update_result = await db.execute(
        update(AIContent)
        .where(
            AIContent.id == row_id, AIContent.claim_id == claim_id, AIContent.status == "pending"
        )
        .values(**values)
    )
    await db.commit()
    if update_result.rowcount == 0:
        return {"status": "pending"}
    if result["status"] == "ready":
        await unlock(db, video_id, user_id)
    return result
