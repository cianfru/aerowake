"""
Database session management for Aerowake.

Reads DATABASE_URL from environment (Railway auto-provisions this).
Provides async engine, session factory, and FastAPI dependency.
"""

import os
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from db.models import Base

logger = logging.getLogger(__name__)

# ─── Connection Setup ────────────────────────────────────────────────────────

_raw_url = os.environ.get("DATABASE_URL", "")

# Railway provisions postgres:// but asyncpg requires postgresql+asyncpg://
if _raw_url.startswith("postgres://"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://"):
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _raw_url  # May be empty in development without DB

# Only create engine if we have a DB URL
engine = None
AsyncSessionLocal = None

if DATABASE_URL:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )
    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


def is_db_available() -> bool:
    """Check if database is configured and available."""
    return engine is not None


async def init_db():
    """Create all tables if they don't exist (safe for repeated calls).

    Also runs lightweight migrations for new columns on existing tables,
    since create_all() only creates new tables — it won't add columns
    to tables that already exist.
    """
    if engine is None:
        logger.warning("DATABASE_URL not set — running without persistence")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # ── Inline migrations (add columns to existing tables) ────────────────
    # These are idempotent — safe to run on every startup.
    async with engine.begin() as conn:
        # Migration 002: add is_admin to users
        await _add_column_if_missing(conn, "users", "is_admin", "BOOLEAN NOT NULL DEFAULT false")

        # Migration 003: company groups + fleet/role
        await _add_column_if_missing(conn, "users", "company_id", "UUID REFERENCES companies(id) ON DELETE SET NULL")
        await _add_column_if_missing(conn, "users", "company_role", "VARCHAR(20) NOT NULL DEFAULT 'pilot'")
        await _add_column_if_missing(conn, "rosters", "company_id", "UUID REFERENCES companies(id) ON DELETE SET NULL")
        await _add_column_if_missing(conn, "rosters", "fleet", "VARCHAR(10)")
        await _add_column_if_missing(conn, "rosters", "pilot_role", "VARCHAR(20)")

    logger.info("Database tables initialized successfully")


async def _add_column_if_missing(conn, table: str, column: str, column_def: str):
    """Add a column to an existing table if it doesn't exist (idempotent)."""
    from sqlalchemy import text
    result = await conn.execute(text(
        f"SELECT column_name FROM information_schema.columns "
        f"WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    if result.first() is None:
        await conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {column_def}'))
        logger.info(f"Added column {table}.{column}")


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    if AsyncSessionLocal is None:
        yield None
        return

    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
