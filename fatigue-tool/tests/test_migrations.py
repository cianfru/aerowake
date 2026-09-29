"""Destructive schema rehearsal restricted to the dedicated disposable test database."""
import asyncio
import os
import subprocess
import sys
import json
import shlex
from pathlib import Path
import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from db.models import Base

ROOT = Path(__file__).resolve().parents[1]


def migration_command():
    """Use Railway's console entry point, not python -m (which masks path bugs)."""
    command = shlex.split(json.loads((ROOT / 'railway.json').read_text())['deploy']['preDeployCommand'][0])
    assert command == ['alembic', 'upgrade', 'head']
    return [str(Path(sys.executable).parent / command[0]), *command[1:]]


def test_release_command_loads_migrations_without_pythonpath():
    env = {**os.environ, 'DATABASE_URL': 'postgresql://unused:unused@localhost/unused'}
    env.pop('PYTHONPATH', None)
    result = subprocess.run([*migration_command(), '--sql'], cwd=ROOT, env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert 'CREATE TABLE users' in result.stdout
    assert "SET version_num='003'" in result.stdout

def test_schema_migration_preserves_legacy_data_and_matches_models():
    url=os.environ.get('TEST_DATABASE_URL')
    if not url: pytest.skip('Requires disposable PostgreSQL TEST_DATABASE_URL')
    assert 'test' in url.rsplit('/',1)[-1]
    env={**os.environ,'DATABASE_URL':url}
    env.pop('PYTHONPATH', None)
    async def reset():
        engine=create_async_engine(url)
        async with engine.begin() as c:
            await c.execute(text('DROP SCHEMA public CASCADE'))
            await c.execute(text('CREATE SCHEMA public'))
        await engine.dispose()
    def migrate(target):
        subprocess.run([*migration_command()[:-1],target],cwd=ROOT,env=env,check=True,capture_output=True)
    async def check(seed=False):
        engine=create_async_engine(url)
        async with engine.begin() as c:
            if seed:
                await c.execute(text("INSERT INTO users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','migration@example.test')"))
            else:
                assert await c.scalar(text('SELECT version_num FROM alembic_version'))=='003'
                def columns(conn):
                    inspector=inspect(conn)
                    for table in Base.metadata.sorted_tables:
                        assert {column.name for column in table.columns} <= {column['name'] for column in inspector.get_columns(table.name)}, table.name
                await c.run_sync(columns)
        await engine.dispose()
    asyncio.run(reset());migrate('head');asyncio.run(check())
    asyncio.run(reset());migrate('002');asyncio.run(check(seed=True));migrate('head');asyncio.run(check())
    async def preserved():
        engine=create_async_engine(url)
        async with engine.connect() as c:
            assert await c.scalar(text("SELECT email FROM users WHERE id='00000000-0000-0000-0000-000000000001'"))=='migration@example.test'
        await engine.dispose()
    asyncio.run(preserved())
    asyncio.run(reset())
