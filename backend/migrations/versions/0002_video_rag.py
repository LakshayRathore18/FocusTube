"""Add video transcript retrieval without changing existing application tables."""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "rag_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("youtube_video_id", sa.String(32), nullable=False, unique=True),
        sa.Column("transcript", sa.Text()),
        sa.Column("content_hash", sa.String(64)),
        sa.Column("indexing_version", sa.String(64), nullable=False),
        sa.Column("embedding_model", sa.String(128), nullable=False),
        sa.Column("embedding_dimensions", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("failure_reason", sa.String(64)),
        sa.Column("claim_id", sa.String(36)),
        sa.Column("claim_expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("state IN ('pending','ready','failed')", name="rag_state"),
    )
    op.create_table(
        "rag_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("rag_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_offset", sa.Integer(), nullable=False),
        sa.Column("end_offset", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(768), nullable=False),
        sa.UniqueConstraint("document_id", "position"),
        sa.CheckConstraint("start_offset >= 0 AND end_offset > start_offset", name="rag_offsets"),
    )
    op.create_index("ix_rag_chunks_document_id", "rag_chunks", ["document_id"])
    op.create_table(
        "rag_rate_limits",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
    )


def downgrade():
    raise RuntimeError("Destructive downgrade disabled. Disable RAG to roll back operationally.")
