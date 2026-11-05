"""Read-only target preflight; never prints connection strings or exception messages."""

import asyncio
import json
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.runtime import database_event_loop


async def check():
    settings = get_settings()
    target = make_url(settings.database_url)
    legacy_value = dotenv_values(Path(__file__).resolve().parents[1] / ".env.legacy.local").get(
        "DATABASE_URL"
    )
    if legacy_value:
        legacy = make_url(legacy_value)
        if (
            (target.host or "").replace("-pooler.", "."),
            target.database,
        ) == ((legacy.host or "").replace("-pooler.", "."), legacy.database):
            raise RuntimeError("ArchivedTargetRefused")
    engine = create_async_engine(
        settings.database_url, poolclass=NullPool, connect_args={"connect_timeout": 15}
    )
    try:
        async with engine.connect() as connection:
            tables = (
                await connection.execute(
                    text(
                        "SELECT table_schema, table_name FROM information_schema.tables "
                        "WHERE table_type = 'BASE TABLE' "
                        "AND table_schema NOT IN ('pg_catalog', 'information_schema') "
                        "ORDER BY table_schema, table_name"
                    )
                )
            ).all()
            revision = None
            google_session_active = False
            if ("public", "alembic_version") in tables:
                revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
            if ("public", "accounts") in tables and ("public", "sessions") in tables:
                google_session_active = await connection.scalar(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM accounts a JOIN sessions s "
                        "ON s.user_id = a.user_id WHERE a.provider = 'google' "
                        "AND s.expires_at > CURRENT_TIMESTAMP)"
                    )
                )
            print(
                json.dumps(
                    {
                        "connected": True,
                        "separate_from_archived_target": True,
                        "empty": not tables,
                        "tables": [f"{schema}.{name}" for schema, name in tables],
                        "alembic_revision": revision,
                        "active_google_session_persisted": google_session_active,
                    },
                    indent=2,
                )
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(check(), loop_factory=database_event_loop)
    except Exception as exc:
        print(json.dumps({"connected": False, "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
