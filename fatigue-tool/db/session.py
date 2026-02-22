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
    """Create all tables if they don't exist (safe for repeated calls)."""
    if engine is None:
        logger.warning("DATABASE_URL not set — running without persistence")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database tables initialized successfully")


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
