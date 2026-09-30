"""Add duty debriefs and voluntary study enrolment.

Additive only: existing rows are untouched. Roster and analysis links are
nullable and use ON DELETE SET NULL so a debrief (with its frozen forecast
snapshot) survives roster deletion; account deletion cascades.
Deploy with ``alembic upgrade head`` before the API starts (docs/LAUNCH_HARDENING.md).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('study_enrolled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('study_consent_version', sa.String(40), nullable=True))
    op.add_column('users', sa.Column('study_withdrawn_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'duty_debriefs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('roster_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('rosters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('analysis_id', sa.String(100),
                  sa.ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('duty_id', sa.String(64), nullable=False),
        sa.Column('duty_report_utc', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duty_release_utc', sa.DateTime(timezone=True), nullable=False),
        sa.Column('moment', sa.String(20), nullable=False),
        sa.Column('operation', sa.String(20), nullable=False),
        sa.Column('kss', sa.SmallInteger(), nullable=True),
        sa.Column('samn_perelli', sa.SmallInteger(), nullable=True),
        sa.Column('felt_vs_prediction', sa.String(12), nullable=True),
        sa.Column('rated_at_utc', sa.DateTime(timezone=True), nullable=False),
        sa.Column('prediction_seen', sa.Boolean(), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('schema_version', sa.SmallInteger(), nullable=False, server_default='1'),
        sa.Column('consent_version', sa.String(40), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'client_id', name='uq_duty_debriefs_client'),
        sa.UniqueConstraint('user_id', 'duty_id', 'duty_report_utc', 'moment', name='uq_duty_debriefs_moment'),
        sa.CheckConstraint("moment IN ('worst_moment', 'top_of_descent', 'end_of_duty')",
                           name='ck_duty_debriefs_moment'),
        sa.CheckConstraint("operation IN ('as_rostered', 'times_changed', 'not_operated')",
                           name='ck_duty_debriefs_operation'),
        sa.CheckConstraint('kss IS NULL OR kss BETWEEN 1 AND 9', name='ck_duty_debriefs_kss'),
        sa.CheckConstraint('samn_perelli IS NULL OR samn_perelli BETWEEN 1 AND 7', name='ck_duty_debriefs_sp'),
        sa.CheckConstraint("felt_vs_prediction IS NULL OR felt_vs_prediction IN ('worse', 'about_right', 'better')",
                           name='ck_duty_debriefs_felt'),
        sa.CheckConstraint("operation = 'not_operated' OR kss IS NOT NULL OR samn_perelli IS NOT NULL",
                           name='ck_duty_debriefs_rating'),
    )
    op.create_index('ix_duty_debriefs_user_report', 'duty_debriefs', ['user_id', 'duty_report_utc'])


def downgrade():
    raise RuntimeError('Forward-only migration: restore a tested backup to roll back the schema.')
