-- Frozen create_all schema from production release bae4943e5e06e23fcd7a9b02cbd50f326122fae9.
-- Structural fixture only: no production records.

CREATE TABLE companies (
	id UUID NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	icao_code VARCHAR(4), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE aggregate_metrics (
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
);

CREATE INDEX ix_aggregate_metrics_company_month ON aggregate_metrics (company_id, month);

CREATE TABLE users (
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
	company_id UUID, 
	company_role VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE SET NULL
);

CREATE INDEX ix_users_company_id ON users (company_id);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE pilot_observations (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	client_id UUID NOT NULL, 
	payload JSONB NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, client_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_pilot_observations_user_id ON pilot_observations (user_id);

CREATE TABLE refresh_tokens (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	token_hash VARCHAR(255) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);

CREATE TABLE rosters (
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
);

CREATE INDEX ix_rosters_company_id ON rosters (company_id);

CREATE INDEX ix_rosters_user_month ON rosters (user_id, month);

CREATE TABLE analyses (
	id VARCHAR(100) NOT NULL, 
	roster_id UUID NOT NULL, 
	analysis_json JSONB NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(roster_id) REFERENCES rosters (id) ON DELETE CASCADE
);

CREATE INDEX ix_analyses_roster ON analyses (roster_id);

CREATE TABLE fatigue_states (
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
);

CREATE INDEX ix_fatigue_states_user_month ON fatigue_states (user_id, month);
