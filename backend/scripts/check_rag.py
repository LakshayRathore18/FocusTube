"""Explicit read-only DB checks and a local CPU embedding probe. No source data printed."""

import asyncio
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.runtime import database_event_loop
from app.services.rag_provider import RagError, embed
from scripts.check_database import check


async def main():
    await check()  # Refuses the archived target before any further database access.
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            available = await connection.scalar(
                text("SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='vector')")
            )
            installed = await connection.scalar(
                text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector')")
            )
        print(json.dumps({"vector_available": available, "vector_installed": installed}))
    finally:
        await engine.dispose()
    try:
        vectors = await embed(["A short educational passage for a configuration check."])
        print(json.dumps({"embedding_available": True, "dimensions": len(vectors[0])}))
    except RagError as exc:
        print(json.dumps({"embedding_available": False, "reason": exc.code}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    try:
        asyncio.run(main(), loop_factory=database_event_loop)
    except Exception as exc:
        print(json.dumps({"check_failed": type(exc).__name__}))
        raise SystemExit(1) from None
