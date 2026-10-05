"""Add the pilot's sleep preferences (usual bedtime, wake-up, nap habit).

Additive only: one nullable JSONB column on users; existing rows are untouched.
Deploy with ``alembic upgrade head`` before the API starts (docs/LAUNCH_HARDENING.md).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('sleep_preferences', postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('users', 'sleep_preferences')
