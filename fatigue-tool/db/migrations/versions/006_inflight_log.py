"""Add the in-flight sleepiness log (ratings a pilot logs during a duty).

Additive only. Rows are owner-scoped and deleted with the account; the analysis
link is nullable (ON DELETE SET NULL) so a rating survives roster deletion.
Deploy with ``alembic upgrade head`` before the API starts (docs/LAUNCH_HARDENING.md).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'inflight_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('analysis_id', sa.String(100),
                  sa.ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('duty_id', sa.String(64), nullable=True),
        sa.Column('duty_report_utc', sa.DateTime(timezone=True), nullable=True),
        sa.Column('recorded_at_utc', sa.DateTime(timezone=True), nullable=False),
        sa.Column('kss', sa.SmallInteger(), nullable=False),
        sa.Column('phase', sa.String(20), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('predicted_kss', sa.Float(), nullable=True),
        sa.Column('engine_version', sa.String(40), nullable=True),
        sa.Column('recorded_offline', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('prediction_seen', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('study_enrolled', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'client_id', name='uq_inflight_logs_client'),
        sa.CheckConstraint('kss BETWEEN 1 AND 9', name='ck_inflight_logs_kss'),
    )
    op.create_index('ix_inflight_logs_user_recorded', 'inflight_logs', ['user_id', 'recorded_at_utc'])


def downgrade():
    op.drop_index('ix_inflight_logs_user_recorded', table_name='inflight_logs')
    op.drop_table('inflight_logs')
