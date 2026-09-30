"""Rehearse adoption of the actual legacy schema in the disposable CI database."""
import asyncio
import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from db.legacy_baseline import adopt_baseline, inspect_baseline
from db.session import EXPECTED_SCHEMA_REVISION

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = Path(__file__).parent / 'fixtures' / 'legacy_schema_bae4943.sql'


@pytest.fixture
def legacy_database():
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.skip('Requires disposable PostgreSQL TEST_DATABASE_URL')
    assert 'test' in url.rsplit('/', 1)[-1]

    async def reset(seed):
        engine = create_async_engine(url)
        try:
            async with engine.begin() as connection:
                await connection.execute(text('DROP SCHEMA public CASCADE'))
                await connection.execute(text('CREATE SCHEMA public'))
                if seed:
                    for statement in FIXTURE.read_text().split(';'):
                        if statement.strip():
                            await connection.execute(text(statement))
                    await connection.execute(text("INSERT INTO users (id,email,password_hash,auth_provider,is_active,is_admin,company_role) VALUES ('00000000-0000-0000-0000-000000000001','legacy@example.test','preserved-hash','email',true,false,'pilot')"))
                    await connection.execute(text("INSERT INTO rosters (id,user_id,filename,month,original_file_bytes) VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','synthetic.csv','2026-09',decode('010203','hex'))"))
                    await connection.execute(text("INSERT INTO analyses (id,roster_id,analysis_json) VALUES ('legacy-analysis','00000000-0000-0000-0000-000000000002','{\"marker\":\"synthetic legacy data\"}')"))
        finally:
            await engine.dispose()
    asyncio.run(reset(True))
    yield url
    asyncio.run(reset(False))


def test_legacy_check_and_upgrade_preserve_records(legacy_database):
    async def baseline():
        engine = create_async_engine(legacy_database)
        try:
            async with engine.begin() as connection:
                assert await connection.run_sync(inspect_baseline) == []
                assert await connection.scalar(text("SELECT to_regclass('public.alembic_version')")) is None
                before = {table: [dict(row) for row in (await connection.execute(text(f'SELECT * FROM {table}'))).mappings()] for table in ('users','rosters','analyses')}
                await connection.run_sync(adopt_baseline)
                return before
        finally:
            await engine.dispose()
    before = asyncio.run(baseline())
    env = {**os.environ, 'DATABASE_URL': legacy_database}
    env.pop('PYTHONPATH', None)
    subprocess.run([str(Path(sys.executable).parent / 'alembic'), 'upgrade', 'head'], cwd=ROOT, env=env, check=True, capture_output=True)

    async def verify():
        engine = create_async_engine(legacy_database)
        try:
            async with engine.connect() as connection:
                assert await connection.scalar(text('SELECT version_num FROM alembic_version')) == EXPECTED_SCHEMA_REVISION
                for table, rows in before.items():
                    after = (await connection.execute(text(f'SELECT * FROM {table}'))).mappings().all()
                    assert len(after) == len(rows)
                    for old, new in zip(rows, after):
                        assert all(new[key] == value for key, value in old.items())
                assert await connection.run_sync(inspect_baseline) == ['Database already has an Alembic revision; use alembic upgrade head.']
        finally:
            await engine.dispose()
    asyncio.run(verify())


@pytest.mark.parametrize('damage', [
    'ALTER TABLE users DROP COLUMN is_admin',
    'ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(100)',
    'ALTER TABLE users ALTER COLUMN is_active DROP NOT NULL',
    'ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE',
    'ALTER TABLE rosters DROP CONSTRAINT rosters_user_id_fkey',
    'DROP INDEX ix_rosters_user_month',
])
def test_schema_drift_refuses_stamp(legacy_database, damage):
    async def exercise():
        engine = create_async_engine(legacy_database)
        try:
            async with engine.begin() as connection:
                await connection.execute(text(damage))
                assert await connection.run_sync(inspect_baseline)
                with pytest.raises(RuntimeError, match='Legacy schema was not adopted'):
                    await connection.run_sync(adopt_baseline)
                assert await connection.scalar(text("SELECT to_regclass('public.alembic_version')")) is None
                assert await connection.scalar(text('SELECT count(*) FROM users')) == 1
        finally:
            await engine.dispose()
    asyncio.run(exercise())


def test_apply_requires_backup_reference_before_connecting():
    result = subprocess.run([sys.executable, '-m', 'db.legacy_baseline', '--apply'], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 2
    assert '--backup-reference' in result.stderr
