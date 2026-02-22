"""Initial schema — users, rosters, analyses, refresh_tokens.

Revision ID: 001
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("auth_provider", sa.String(20), nullable=False, server_default="email"),
        sa.Column("provider_id", sa.String(255), nullable=True),
        sa.Column("pilot_id", sa.String(50), nullable=True),
        sa.Column("home_base", sa.String(10), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Rosters table
    op.create_table(
        "rosters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("pilot_id", sa.String(50), nullable=True),
        sa.Column("home_base", sa.String(10), nullable=True),
        sa.Column("config_preset", sa.String(30), nullable=True, server_default="default"),
        sa.Column("total_duties", sa.Integer(), nullable=True),
        sa.Column("total_sectors", sa.Integer(), nullable=True),
        sa.Column("total_duty_hours", sa.Float(), nullable=True),
        sa.Column("total_block_hours", sa.Float(), nullable=True),
        sa.Column("original_file_bytes", sa.LargeBinary(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rosters_user_month", "rosters", ["user_id", "month"])

    # Analyses table
    op.create_table(
        "analyses",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("roster_id", UUID(as_uuid=True), sa.ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_json", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_analyses_roster", "analyses", ["roster_id"])

    # Refresh tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("analyses")
    op.drop_table("rosters")
    op.drop_table("users")
