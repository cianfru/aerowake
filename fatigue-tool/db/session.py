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

# Alembic head this release requires; migrations run before the API starts.
EXPECTED_SCHEMA_REVISION = '005'

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
    """Validate the schema; migrations run once in the deployment release phase."""
    if engine is None:
        if os.environ.get('ENVIRONMENT') == 'production':
            raise RuntimeError('DATABASE_URL is required in production')
        logger.warning('Running in local guest mode without persistence')
        return
    from sqlalchemy import text
    async with engine.connect() as conn:
        version = await conn.scalar(text('SELECT version_num FROM alembic_version'))
        if version != EXPECTED_SCHEMA_REVISION:
            raise RuntimeError('Database migration required: run alembic upgrade head before starting the API')

async def database_ready():
    if engine is None:
        return False
    from sqlalchemy import text
    try:
        async with engine.connect() as conn:
            return await conn.scalar(text('SELECT 1')) == 1
    except Exception:
        logger.error('Database readiness check failed')
        return False


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
