"""Migration 004 (duty debriefs, study enrolment): offline DDL and a disposable PostgreSQL rehearsal."""
import asyncio
import json
import os
import shlex
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from db.models import DutyDebrief, User
from db.session import EXPECTED_SCHEMA_REVISION

ROOT = Path(__file__).resolve().parents[1]


def alembic(*args, url='postgresql://unused:unused@localhost/unused'):
    command = shlex.split(json.loads((ROOT / 'railway.json').read_text())['deploy']['preDeployCommand'][0])
    env = {**os.environ, 'DATABASE_URL': url}
    env.pop('PYTHONPATH', None)
    return subprocess.run([str(Path(sys.executable).parent / command[0]), *args], cwd=ROOT, env=env,
                          capture_output=True, text=True)


def offline_004():
    result = alembic('upgrade', '003:004', '--sql')
    assert result.returncode == 0, result.stderr
    return result.stdout


def test_head_is_the_revision_the_api_requires():
    result = alembic('heads')
    assert result.returncode == 0, result.stderr
    assert result.stdout.split()[0] == EXPECTED_SCHEMA_REVISION == '004'


def test_offline_ddl_links_are_nullable_and_survive_roster_deletion():
    sql = offline_004()
    assert 'CREATE TABLE duty_debriefs' in sql
    assert 'FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE' in sql
    assert 'FOREIGN KEY(roster_id) REFERENCES rosters (id) ON DELETE SET NULL' in sql
    assert 'FOREIGN KEY(analysis_id) REFERENCES analyses (id) ON DELETE SET NULL' in sql
    assert 'roster_id UUID,' in sql and 'analysis_id VARCHAR(100),' in sql
    assert 'UNIQUE (user_id, client_id)' in sql
    assert 'UNIQUE (user_id, duty_id, duty_report_utc, moment)' in sql
    assert "CHECK (operation = 'not_operated' OR kss IS NOT NULL OR samn_perelli IS NOT NULL)" in sql
    # Additive: no startup DDL, no destructive statements on existing tables.
    assert 'DROP' not in sql.upper()


def test_offline_ddl_matches_models():
    sql = offline_004()
    create = sql[sql.index('CREATE TABLE duty_debriefs'):]
    for column in DutyDebrief.__table__.columns:
        assert f'    {column.name} ' in create, column.name
    for name in ('study_enrolled_at', 'study_consent_version', 'study_withdrawn_at'):
        assert name in User.__table__.columns
        assert f'ALTER TABLE users ADD COLUMN {name} ' in sql


def test_downgrade_is_refused():
    from importlib import util
    spec = util.spec_from_file_location('m004', ROOT / 'db/migrations/versions/004_duty_debriefs.py')
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with pytest.raises(RuntimeError):
        module.downgrade()


def test_postgres_upgrade_from_003_preserves_rows_and_set_null_semantics():
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.skip('Requires disposable PostgreSQL TEST_DATABASE_URL')
    assert 'test' in url.rsplit('/', 1)[-1]
    user, roster, other = (str(uuid.UUID(int=i)) for i in (41, 42, 43))

    async def run(*statements, scalar=None):
        engine = create_async_engine(url)
        try:
            async with engine.begin() as c:
                for statement in statements:
                    await c.execute(text(statement))
                if scalar:
                    return await c.scalar(text(scalar))
        finally:
            await engine.dispose()

    def insert(debrief_id, **overrides):
        values = dict(kss='7', roster=f"'{roster}'", analysis="'a-004'", moment="'worst_moment'")
        values.update(overrides)
        return (f"INSERT INTO duty_debriefs(id,user_id,client_id,roster_id,analysis_id,duty_id,duty_report_utc,"
                f"duty_release_utc,moment,operation,kss,rated_at_utc,prediction_seen,payload,consent_version) VALUES "
                f"('{debrief_id}','{user}','{uuid.uuid4()}',{values['roster']},{values['analysis']},'D1',"
                f"'2026-09-01T04:00Z','2026-09-01T12:00Z',{values['moment']},'as_rostered',{values['kss']},"
                f"'2026-09-01T13:00Z',false,'{{}}','duty-debrief-v1')")

    asyncio.run(run('DROP SCHEMA public CASCADE', 'CREATE SCHEMA public'))
    try:
        assert alembic('upgrade', '003', url=url).returncode == 0
        asyncio.run(run(
            f"INSERT INTO users(id,email,auth_provider,is_active,is_admin,email_verified,metrics_consent,auth_version,company_role) "
            f"VALUES ('{user}','m004@example.test','email',true,false,true,false,0,'pilot')",
            f"INSERT INTO rosters(id,user_id,filename,month) VALUES ('{roster}','{user}','synthetic.csv','2026-09')",
            f"INSERT INTO analyses(id,roster_id,analysis_json) VALUES ('a-004','{roster}','{{}}')"))
        upgraded = alembic('upgrade', 'head', url=url)
        assert upgraded.returncode == 0, upgraded.stderr
        assert asyncio.run(run(scalar='SELECT version_num FROM alembic_version')) == EXPECTED_SCHEMA_REVISION
        assert asyncio.run(run(scalar=f"SELECT study_enrolled_at IS NULL FROM users WHERE id='{user}'")) is True
        asyncio.run(run(insert(other)))
        for bad in (dict(kss='10'), dict(kss='NULL'), dict(moment="'cruise'")):
            with pytest.raises(Exception):
                asyncio.run(run(insert(uuid.uuid4(), **bad)))
        asyncio.run(run(f"DELETE FROM rosters WHERE id='{roster}'"))
        assert asyncio.run(run(scalar=f"SELECT roster_id IS NULL AND analysis_id IS NULL FROM duty_debriefs WHERE id='{other}'"))
        asyncio.run(run(f"DELETE FROM users WHERE id='{user}'"))
        assert asyncio.run(run(scalar='SELECT count(*) FROM duty_debriefs')) == 0
    finally:
        asyncio.run(run('DROP SCHEMA public CASCADE', 'CREATE SCHEMA public'))
