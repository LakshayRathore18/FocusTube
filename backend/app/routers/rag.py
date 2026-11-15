from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..config import get_settings
from ..dependencies import DB, CurrentUser, owned_video
from ..services import rag
from ..services.rag_provider import RagError

router = APIRouter(prefix="/rag", tags=["video chat"])


class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=2000)
    history: list[HistoryItem] = Field(default_factory=list, max_length=6)

    @field_validator("question")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Question cannot be blank")
        return value.strip()


def enabled():
    if not get_settings().rag_enabled:
        raise RagError("feature_disabled")


@router.get("/capabilities")
async def capabilities():
    return {"videoChat": get_settings().rag_enabled}


@router.get("/videos/{video_id}/status")
async def video_status(video_id: str, db: DB, user: CurrentUser):
    video = await owned_video(db, video_id, user.id)
    enabled()
    return rag.status(await rag.document_for(db, video.youtube_video_id))


@router.post("/videos/{video_id}/prepare")
async def prepare(video_id: str, db: DB, user: CurrentUser):
    video = await owned_video(db, video_id, user.id)
    enabled()
    await rag.throttle(db, user.id)
    result = await rag.prepare(db, video)
    return JSONResponse(result, status_code=202 if result["status"] == "pending" else 200)


@router.post("/videos/{video_id}/ask")
async def ask(video_id: str, body: AskRequest, db: DB, user: CurrentUser):
    video = await owned_video(db, video_id, user.id)
    enabled()
    await rag.throttle(db, user.id)
    try:
        return await rag.ask(db, video, body.question, [item.model_dump() for item in body.history])
    except TimeoutError:
        raise RagError("timeout", 504) from None
