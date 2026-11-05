from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, model_validator
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ImportCourse(Schema):
    url: str = Field(min_length=1, max_length=4096)


class VideoPatch(Schema):
    status: Literal["not_started", "in_progress", "completed"] | None = None
    last_watched_seconds: StrictInt | None = Field(default=None, ge=0, le=2_147_483_647)

    @model_validator(mode="after")
    def require_update(self):
        if not self.model_fields_set or ("status" in self.model_fields_set and self.status is None):
            raise ValueError("Provide status or lastWatchedSeconds; status cannot be null")
        return self


class NoteInput(Schema):
    content: StrictStr = Field(max_length=500_000)

    @model_validator(mode="after")
    def nonempty(self):
        import html
        import re

        if not re.sub(r"<[^>]*>", " ", html.unescape(self.content)).strip():
            raise ValueError("Note content cannot be empty")
        return self


class GenerateInput(Schema):
    youtube_video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")
    course_id: str | None = None


class StudySummary(Schema):
    hook: str = Field(min_length=1)
    key_points: list[str] = Field(min_length=1)


class Question(Schema):
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=4, max_length=4)
    answer: StrictInt = Field(ge=0, le=3)


class Quiz(Schema):
    questions: list[Question] = Field(min_length=1, max_length=10)


class GeneratedNotes(Schema):
    summary: StudySummary
    quiz: Quiz


def serialize(row, *, only: list[str] | None = None) -> dict:
    """Expose explicit model columns with the existing frontend's camelCase contract."""
    return {
        to_camel(c.name): getattr(row, c.name)
        for c in row.__table__.columns
        if only is None or c.name in only
    }
