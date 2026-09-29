"""Inspect and explicitly adopt the pre-Alembic schema without recreating tables.

Run --check first. --apply requires an independently verified backup reference;
this command does not create or verify a backup. Normal deployments keep using
alembic upgrade head and never automatically stamp an unknown database.
"""
import argparse
import asyncio
import json
import os

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

# Frozen contract of revisions 001/002. Extra tables/columns are permitted because
# the legacy application added company and continuity fields during startup.
BASELINE = {
    'users': 'id:uuid email:varchar255? password_hash:text? display_name:varchar255? auth_provider:varchar20 provider_id:varchar255? pilot_id:varchar50? home_base:varchar10? is_active:boolean is_admin:boolean created_at:timestamp updated_at:timestamp',
    'rosters': 'id:uuid user_id:uuid filename:varchar255 month:varchar7 pilot_id:varchar50? home_base:varchar10? config_preset:varchar30? total_duties:integer? total_sectors:integer? total_duty_hours:float? total_block_hours:float? original_file_bytes:bytea? created_at:timestamp',
    'analyses': 'id:varchar100 roster_id:uuid analysis_json:jsonb created_at:timestamp',
    'refresh_tokens': 'id:uuid user_id:uuid token_hash:varchar255 expires_at:timestamp created_at:timestamp',
}
FOREIGN_KEYS = {'rosters': ('user_id', 'users'), 'analyses': ('roster_id', 'rosters'), 'refresh_tokens': ('user_id', 'users')}
INDEXES = {'users': [('email',)], 'rosters': [('user_id', 'month')], 'analyses': [('roster_id',)], 'refresh_tokens': [('token_hash',)]}


def _type_name(column_type):
    name = str(column_type).lower().replace(' ', '').replace('(', '').replace(')', '')
    return {'doubleprecision': 'float', 'timestampwithtimezone': 'timestamp'}.get(name, name)


def inspect_baseline(connection):
    """Read schema metadata only; reject partial or structurally different baselines."""
    inspector = inspect(connection)
    tables = set(inspector.get_table_names(schema='public'))
    errors = []
    if 'alembic_version' in tables:
        versions = list(connection.execute(text('SELECT version_num FROM public.alembic_version')).scalars())
        if versions:
            errors.append('Database already has an Alembic revision; use alembic upgrade head.')
    for table, contract in BASELINE.items():
        if table not in tables:
            errors.append(f'{table}: missing table')
            continue
        columns = {column['name']: column for column in inspector.get_columns(table, schema='public')}
        for spec in contract.split():
            name, expected = spec.split(':')
            nullable = expected.endswith('?')
            expected = expected.rstrip('?')
            column = columns.get(name)
            if column is None:
                errors.append(f'{table}.{name}: missing column')
            elif _type_name(column['type']) != expected or column['nullable'] != nullable or (expected == 'timestamp' and not getattr(column['type'], 'timezone', False)):
                errors.append(f'{table}.{name}: incompatible type or nullability')
        if inspector.get_pk_constraint(table, schema='public')['constrained_columns'] != ['id']:
            errors.append(f'{table}: expected primary key on id')
        if table in FOREIGN_KEYS:
            column, target = FOREIGN_KEYS[table]
            if not any(fk['constrained_columns'] == [column] and fk['referred_table'] == target and fk['referred_columns'] == ['id'] and fk['referred_schema'] in (None, 'public') and fk.get('options', {}).get('ondelete') == 'CASCADE' for fk in inspector.get_foreign_keys(table, schema='public')):
                errors.append(f'{table}.{column}: missing cascading foreign key')
        indexes = inspector.get_indexes(table, schema='public')
        for columns_required in INDEXES[table]:
            if not any(tuple(index['column_names']) == columns_required and not index.get('dialect_options', {}).get('postgresql_where') and (table != 'users' or index['unique']) for index in indexes):
                errors.append(f'{table}: missing baseline index on {", ".join(columns_required)}')
    return errors


def adopt_baseline(connection):
    """Validate again and record only revision 002 within the caller's transaction."""
    # The same transaction covers validation and stamping. Lock baseline tables
    # against concurrent writes/DDL; reject instead of waiting on busy workloads.
    connection.execute(text("SET LOCAL lock_timeout = '5s'"))
    connection.execute(text('LOCK TABLE public.users, public.rosters, public.analyses, public.refresh_tokens IN SHARE ROW EXCLUSIVE MODE'))
    errors = inspect_baseline(connection)
    if errors:
        raise RuntimeError('Legacy schema was not adopted: ' + '; '.join(errors))
    connection.execute(text('CREATE TABLE IF NOT EXISTS public.alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)'))
    connection.execute(text("INSERT INTO public.alembic_version (version_num) VALUES ('002')"))


async def run(apply, backup_reference):
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        raise RuntimeError('DATABASE_URL is required.')
    for prefix in ('postgres://', 'postgresql://'):
        if url.startswith(prefix):
            url = url.replace(prefix, 'postgresql+asyncpg://', 1)
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            errors = await connection.run_sync(inspect_baseline)
            if errors:
                print(json.dumps({'compatible': False, 'errors': errors}))
                return 1
            if apply:
                await connection.run_sync(adopt_baseline)
            print(json.dumps({'compatible': True, 'revision_recorded': '002' if apply else None, 'backup_reference': backup_reference, 'next_step': 'alembic upgrade head' if apply else 'Verify a restored backup before using --apply.'}))
            return 0
    finally:
        await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--apply', action='store_true')
    parser.add_argument('--backup-reference', help='Identifier of the backup whose restore has been verified.')
    args = parser.parse_args()
    if args.apply and not (args.backup_reference or '').strip():
        parser.error('--apply requires --backup-reference after independently verifying a backup restore.')
    return asyncio.run(run(args.apply, args.backup_reference))


if __name__ == '__main__':
    raise SystemExit(main())
