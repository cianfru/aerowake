"""Complete the legacy schema and add account privacy controls.

Existing installations created outside Alembic must follow docs/LAUNCH_HARDENING.md.
This migration intentionally preserves analyses and original uploads.
"""
from alembic import op
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None

STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS companies (
	id UUID NOT NULL,
	name VARCHAR(255) NOT NULL,
	icao_code VARCHAR(4),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (name)
)""",
    """CREATE TABLE IF NOT EXISTS aggregate_metrics (
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	month VARCHAR(7) NOT NULL,
	group_type VARCHAR(20) NOT NULL,
	group_value VARCHAR(50) NOT NULL,
	sample_size INTEGER NOT NULL,
	avg_performance FLOAT,
	min_performance FLOAT,
	p25_performance FLOAT,
	p75_performance FLOAT,
	avg_sleep_debt FLOAT,
	avg_sleep_per_night FLOAT,
	avg_duty_hours FLOAT,
	avg_sector_count FLOAT,
	high_risk_duty_rate FLOAT,
	computed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_aggregate_metrics_group UNIQUE (company_id, month, group_type, group_value),
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
)""",
    """CREATE TABLE IF NOT EXISTS users (
	id UUID NOT NULL,
	email VARCHAR(255),
	password_hash TEXT,
	display_name VARCHAR(255),
	auth_provider VARCHAR(20) NOT NULL,
	provider_id VARCHAR(255),
	pilot_id VARCHAR(50),
	home_base VARCHAR(10),
	is_active BOOLEAN NOT NULL,
	is_admin BOOLEAN NOT NULL,
	email_verified BOOLEAN NOT NULL,
	metrics_consent BOOLEAN NOT NULL,
	auth_version INTEGER NOT NULL,
	company_id UUID,
	company_role VARCHAR(20) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE SET NULL
)""",
    """CREATE TABLE IF NOT EXISTS account_action_tokens (
	id UUID NOT NULL,
	user_id UUID NOT NULL,
	token_hash VARCHAR(64) NOT NULL,
	purpose VARCHAR(20) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
	UNIQUE (token_hash)
)""",
    """CREATE TABLE IF NOT EXISTS pilot_observations (
	id UUID NOT NULL,
	user_id UUID NOT NULL,
	client_id UUID NOT NULL,
	payload JSONB NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, client_id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)""",
    """CREATE TABLE IF NOT EXISTS refresh_tokens (
	id UUID NOT NULL,
	user_id UUID NOT NULL,
	token_hash VARCHAR(255) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)""",
    """CREATE TABLE IF NOT EXISTS rosters (
	id UUID NOT NULL,
	user_id UUID NOT NULL,
	filename VARCHAR(255) NOT NULL,
	month VARCHAR(7) NOT NULL,
	pilot_id VARCHAR(50),
	home_base VARCHAR(10),
	config_preset VARCHAR(30),
	total_duties INTEGER,
	total_sectors INTEGER,
	total_duty_hours FLOAT,
	total_block_hours FLOAT,
	original_file_bytes BYTEA,
	company_id UUID,
	fleet VARCHAR(10),
	pilot_role VARCHAR(20),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE SET NULL
)""",
    """CREATE TABLE IF NOT EXISTS analyses (
	id VARCHAR(100) NOT NULL,
	roster_id UUID NOT NULL,
	analysis_json JSONB NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(roster_id) REFERENCES rosters (id) ON DELETE CASCADE
)""",
    """CREATE TABLE IF NOT EXISTS fatigue_states (
	id UUID NOT NULL,
	user_id UUID NOT NULL,
	roster_id UUID NOT NULL,
	month VARCHAR(7) NOT NULL,
	period_end_utc TIMESTAMP WITH TIME ZONE NOT NULL,
	final_process_s FLOAT NOT NULL,
	final_sleep_debt FLOAT NOT NULL,
	final_phase_shift FLOAT NOT NULL,
	final_phase_tz VARCHAR(50) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_fatigue_states_user_roster UNIQUE (user_id, roster_id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
	FOREIGN KEY(roster_id) REFERENCES rosters (id) ON DELETE CASCADE
)""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS company_role VARCHAR(20) NOT NULL DEFAULT 'pilot'""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS metrics_consent BOOLEAN NOT NULL DEFAULT false""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0""",
    """ALTER TABLE rosters ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL""",
    """ALTER TABLE rosters ADD COLUMN IF NOT EXISTS fleet VARCHAR(10)""",
    """ALTER TABLE rosters ADD COLUMN IF NOT EXISTS pilot_role VARCHAR(20)""",
    """DELETE FROM refresh_tokens WHERE token_hash IN (SELECT token_hash FROM refresh_tokens GROUP BY token_hash HAVING count(*) > 1)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_token_hash ON refresh_tokens(token_hash)""",
    """CREATE INDEX IF NOT EXISTS ix_aggregate_metrics_company_month ON aggregate_metrics (company_id, month)""",
    """CREATE INDEX IF NOT EXISTS ix_users_company_id ON users (company_id)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)""",
    """CREATE INDEX IF NOT EXISTS ix_pilot_observations_user_id ON pilot_observations (user_id)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash)""",
    """CREATE INDEX IF NOT EXISTS ix_rosters_company_id ON rosters (company_id)""",
    """CREATE INDEX IF NOT EXISTS ix_rosters_user_month ON rosters (user_id, month)""",
    """CREATE INDEX IF NOT EXISTS ix_analyses_roster ON analyses (roster_id)""",
    """CREATE INDEX IF NOT EXISTS ix_fatigue_states_user_month ON fatigue_states (user_id, month)""",
]

STATEMENTS.append('ALTER TABLE fatigue_states ADD COLUMN IF NOT EXISTS engine_version VARCHAR(40)')

def upgrade():
    for statement in STATEMENTS:
        op.execute(statement)

def downgrade():
    raise RuntimeError('Forward-only migration: restore a tested backup to roll back the schema.')
