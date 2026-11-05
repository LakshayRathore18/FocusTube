from datetime import UTC, datetime
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Identified:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class User(Identified, Timestamps, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str | None] = mapped_column(Text)
    image: Mapped[str | None] = mapped_column(Text)


class Account(Identified, Base):
    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_account_id"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32), default="google")
    provider_account_id: Mapped[str] = mapped_column(String(255))


class Session(Identified, Base):
    __tablename__ = "sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Course(Identified, Timestamps, Base):
    __tablename__ = "courses"
    __table_args__ = (UniqueConstraint("user_id", "youtube_playlist_id"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    youtube_playlist_id: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Video(Identified, Timestamps, Base):
    __tablename__ = "videos"
    __table_args__ = (
        UniqueConstraint("course_id", "youtube_video_id"),
        CheckConstraint("status IN ('not_started','in_progress','completed')", name="video_status"),
        CheckConstraint(
            "last_watched_seconds IS NULL OR last_watched_seconds >= 0", name="watch_position"
        ),
        Index("ix_videos_course_status", "course_id", "status"),
    )
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    youtube_video_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(32), default="not_started")
    last_watched_seconds: Mapped[int | None] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_content_unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Note(Identified, Timestamps, Base):
    __tablename__ = "notes"
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), unique=True)
    content: Mapped[str] = mapped_column(Text)


class AIContent(Identified, Timestamps, Base):
    __tablename__ = "ai_content"
    __table_args__ = (
        CheckConstraint("status IN ('pending','ready','failed')", name="ai_status"),
        CheckConstraint("attempts >= 0 AND attempts <= 3", name="ai_attempts"),
    )
    youtube_video_id: Mapped[str] = mapped_column(String(32), unique=True)
    transcript: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[dict | None] = mapped_column(JSON)
    quiz: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_id: Mapped[str | None] = mapped_column(String(36))


class RagDocument(Identified, Timestamps, Base):
    __tablename__ = "rag_documents"
    __table_args__ = (CheckConstraint("state IN ('pending','ready','failed')", name="rag_state"),)
    youtube_video_id: Mapped[str] = mapped_column(String(32), unique=True)
    transcript: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str | None] = mapped_column(String(64))
    indexing_version: Mapped[str] = mapped_column(String(64))
    embedding_model: Mapped[str] = mapped_column(String(128))
    embedding_dimensions: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(16), default="pending")
    failure_reason: Mapped[str | None] = mapped_column(String(64))
    claim_id: Mapped[str | None] = mapped_column(String(36))
    claim_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RagChunk(Identified, Base):
    __tablename__ = "rag_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "position"),
        CheckConstraint("start_offset >= 0 AND end_offset > start_offset", name="rag_offsets"),
    )
    document_id: Mapped[str] = mapped_column(
        ForeignKey("rag_documents.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    start_offset: Mapped[int] = mapped_column(Integer)
    end_offset: Mapped[int] = mapped_column(Integer)
    # JSON is solely for isolated SQLite tests; production always uses pgvector.
    embedding: Mapped[list[float]] = mapped_column(Vector().with_variant(JSON(), "sqlite"))


class RagRateLimit(Base):
    __tablename__ = "rag_rate_limits"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    count: Mapped[int] = mapped_column(Integer)
