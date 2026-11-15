"""Allow MiniLM vectors while retaining every existing 768-dimensional vector.

Removing the vector type's dimension restriction preserves stored values. Model,
dimension and indexing-version checks still prevent searching incompatible data.
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE vector")


def downgrade():
    raise RuntimeError("Dimension-restricting downgrade disabled. Disable RAG instead.")
