"""Fresh FastAPI database. Never apply to the legacy Prisma database."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def identity():
    return sa.Column("id", sa.String(36), primary_key=True)


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.create_table(
        "users",
        identity(),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.Text()),
        sa.Column("image", sa.Text()),
        *timestamps(),
    )
    op.create_table(
        "accounts",
        identity(),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_account_id", sa.String(255), nullable=False),
        sa.UniqueConstraint("provider", "provider_account_id"),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])
    op.create_table(
        "sessions",
        identity(),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])
    op.create_table(
        "courses",
        identity(),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("youtube_playlist_id", sa.String(255), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("thumbnail_url", sa.Text()),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.UniqueConstraint("user_id", "youtube_playlist_id"),
    )
    op.create_index("ix_courses_user_id", "courses", ["user_id"])
    op.create_table(
        "videos",
        identity(),
        sa.Column(
            "course_id",
            sa.String(36),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("youtube_video_id", sa.String(32), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Integer()),
        sa.Column("thumbnail_url", sa.Text()),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("last_watched_seconds", sa.Integer()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("ai_content_unlocked_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.UniqueConstraint("course_id", "youtube_video_id"),
        sa.CheckConstraint(
            "status IN ('not_started','in_progress','completed')", name="video_status"
        ),
        sa.CheckConstraint(
            "last_watched_seconds IS NULL OR last_watched_seconds >= 0", name="watch_position"
        ),
    )
    op.create_index("ix_videos_youtube_video_id", "videos", ["youtube_video_id"])
    op.create_index("ix_videos_course_status", "videos", ["course_id", "status"])
    op.create_table(
        "notes",
        identity(),
        sa.Column(
            "video_id",
            sa.String(36),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        *timestamps(),
    )
    op.create_table(
        "ai_content",
        identity(),
        sa.Column("youtube_video_id", sa.String(32), nullable=False, unique=True),
        sa.Column("transcript", sa.Text()),
        sa.Column("summary", sa.JSON()),
        sa.Column("quiz", sa.JSON()),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_attempted_at", sa.DateTime(timezone=True)),
        sa.Column("claim_id", sa.String(36)),
        *timestamps(),
        sa.CheckConstraint("status IN ('pending','ready','failed')", name="ai_status"),
        sa.CheckConstraint("attempts >= 0 AND attempts <= 3", name="ai_attempts"),
    )


def downgrade():
    raise RuntimeError("Destructive downgrade disabled. Restore a reviewed backup instead.")
