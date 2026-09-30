"""
SQLAlchemy 2.0 ORM models for Aerowake persistence layer.

Tables:
  - companies: airline organizations (Qatar Airways, easyJet, etc.)
  - users: pilot accounts (email/password baseline, OAuth-ready)
  - rosters: uploaded roster files with metadata
  - analyses: full JSON analysis results (~150-200KB JSONB)
  - fatigue_states: end-of-roster fatigue state for chaining across months
  - aggregate_metrics: pre-computed comparative stats per company/fleet/role
  - refresh_tokens: JWT refresh token rotation
  - pilot_observations / duty_debriefs: voluntary, owner-scoped study data
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    LargeBinary,
    ForeignKey,
    Index,
    UniqueConstraint,
    CheckConstraint,
    SmallInteger,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── Company ──────────────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False)       # "Qatar Airways"
    icao_code = Column(String(4), nullable=True)                  # "QTR", "EZY"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    users = relationship("User", back_populates="company")


# ── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(Text, nullable=True)
    display_name = Column(String(255), nullable=True)
    auth_provider = Column(
        String(20), nullable=False, default="email"
    )  # email | google | apple | anonymous
    provider_id = Column(
        String(255), nullable=True
    )  # OAuth provider user ID (future)
    pilot_id = Column(String(50), nullable=True)
    home_base = Column(String(10), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    metrics_consent = Column(Boolean, default=False, nullable=False)
    # Voluntary duty-debrief study enrolment (migration 004). Withdrawal is recorded, not erased.
    study_enrolled_at = Column(DateTime(timezone=True), nullable=True)
    study_consent_version = Column(String(40), nullable=True)
    study_withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    auth_version = Column(Integer, default=0, nullable=False)

    # Company membership (auto-detected from roster, confirmed by pilot)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    company_role = Column(String(20), nullable=False, default="pilot")  # pilot | company_admin

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    company = relationship("Company", back_populates="users")
    rosters = relationship("Roster", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_users_company_id", "company_id"),
    )


# ── Roster ───────────────────────────────────────────────────────────────────

class Roster(Base):
    __tablename__ = "rosters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename = Column(String(255), nullable=False)
    month = Column(String(7), nullable=False)  # e.g. "2026-02"
    pilot_id = Column(String(50), nullable=True)
    home_base = Column(String(10), nullable=True)
    config_preset = Column(String(30), nullable=True, default="default")
    total_duties = Column(Integer, nullable=True)
    total_sectors = Column(Integer, nullable=True)
    total_duty_hours = Column(Float, nullable=True)
    total_block_hours = Column(Float, nullable=True)
    original_file_bytes = Column(LargeBinary, nullable=True)  # Store uploaded PDF

    # Company + fleet/role (auto-extracted from PDF)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    fleet = Column(String(10), nullable=True)         # "A320", "A350", "B777" (from PDF)
    pilot_role = Column(String(20), nullable=True)     # "captain", "first_officer" (from PDF)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="rosters")
    analyses = relationship("Analysis", back_populates="roster", cascade="all, delete-orphan",
                            order_by="(Analysis.created_at.desc(), Analysis.id.desc())")
    fatigue_states = relationship("FatigueState", back_populates="roster", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_rosters_user_month", "user_id", "month"),
        Index("ix_rosters_company_id", "company_id"),
    )


# ── Analysis ─────────────────────────────────────────────────────────────────

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String(100), primary_key=True)  # matches analysis_id format
    roster_id = Column(
        UUID(as_uuid=True), ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False
    )
    analysis_json = Column(JSONB, nullable=False)  # Full response (~150-200KB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    roster = relationship("Roster", back_populates="analyses")

    __table_args__ = (
        Index("ix_analyses_roster", "roster_id"),
    )


# ── FatigueState (for multi-roster continuity) ──────────────────────────────

class FatigueState(Base):
    """
    Stores the end-of-roster fatigue state for chaining across months.
    When analyzing month N, the system looks up the most recent FatigueState
    for month < N and injects it as initial conditions.

    Lightweight (~100 bytes/row) to avoid querying the ~200KB analysis JSONB.
    """
    __tablename__ = "fatigue_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    roster_id = Column(
        UUID(as_uuid=True), ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False
    )
    month = Column(String(7), nullable=False)                     # "2026-02"
    period_end_utc = Column(DateTime(timezone=True), nullable=False)  # last duty release time
    engine_version = Column(String(40), nullable=True)
    final_process_s = Column(Float, nullable=False)               # homeostatic sleep pressure (0-1)
    final_sleep_debt = Column(Float, nullable=False)              # cumulative hours
    final_phase_shift = Column(Float, nullable=False)             # circadian phase shift hours
    final_phase_tz = Column(String(50), nullable=False)           # reference timezone
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    roster = relationship("Roster", back_populates="fatigue_states")

    __table_args__ = (
        UniqueConstraint("user_id", "roster_id", name="uq_fatigue_states_user_roster"),
        Index("ix_fatigue_states_user_month", "user_id", "month"),
    )


# ── AggregateMetrics (for comparative performance) ────────────────────────────

class AggregateMetrics(Base):
    """
    Pre-computed aggregate statistics per company/fleet/role group.

    Re-computed after each analysis upload. Groups with sample_size < 5
    are stored but NOT exposed via API (industry de-identification standard).
    """
    __tablename__ = "aggregate_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    month = Column(String(7), nullable=False)               # "2026-02"
    group_type = Column(String(20), nullable=False)          # company | fleet | role | fleet_role
    group_value = Column(String(50), nullable=False)         # all | A320 | captain | A320_captain

    # Privacy & validity
    sample_size = Column(Integer, nullable=False, default=0)  # must be >= 5 to expose

    # Performance aggregates
    avg_performance = Column(Float, nullable=True)
    min_performance = Column(Float, nullable=True)           # worst individual average
    p25_performance = Column(Float, nullable=True)           # 25th percentile
    p75_performance = Column(Float, nullable=True)           # 75th percentile

    # Sleep aggregates
    avg_sleep_debt = Column(Float, nullable=True)
    avg_sleep_per_night = Column(Float, nullable=True)

    # Duty aggregates
    avg_duty_hours = Column(Float, nullable=True)
    avg_sector_count = Column(Float, nullable=True)

    # Risk distribution
    high_risk_duty_rate = Column(Float, nullable=True)       # proportion of high+ risk duties

    computed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "month", "group_type", "group_value",
                         name="uq_aggregate_metrics_group"),
        Index("ix_aggregate_metrics_company_month", "company_id", "month"),
    )


# ── RefreshToken ─────────────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = Column(String(255), nullable=False, index=True, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")


class PilotObservation(Base):
    """Private, voluntary study diary; excluded from company reporting."""
    __tablename__ = 'pilot_observations'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'client_id'),)


class DutyDebrief(Base):
    """One blinded rating of a flown duty (migration 004). Owner-scoped study data.

    The forecast snapshot in ``payload`` is taken by the server from the saved
    analysis at submission. Roster/analysis links become NULL when the pilot
    deletes the roster, so the snapshot survives; account deletion cascades.
    """
    __tablename__ = 'duty_debriefs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    roster_id = Column(UUID(as_uuid=True), ForeignKey('rosters.id', ondelete='SET NULL'), nullable=True)
    analysis_id = Column(String(100), ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True)
    duty_id = Column(String(64), nullable=False)
    duty_report_utc = Column(DateTime(timezone=True), nullable=False)
    duty_release_utc = Column(DateTime(timezone=True), nullable=False)
    moment = Column(String(20), nullable=False)
    operation = Column(String(20), nullable=False)
    kss = Column(SmallInteger, nullable=True)
    samn_perelli = Column(SmallInteger, nullable=True)
    felt_vs_prediction = Column(String(12), nullable=True)
    rated_at_utc = Column(DateTime(timezone=True), nullable=False)
    prediction_seen = Column(Boolean, nullable=False)
    payload = Column(JSONB, nullable=False)
    schema_version = Column(SmallInteger, nullable=False, default=1)
    consent_version = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint('user_id', 'client_id', name='uq_duty_debriefs_client'),
        UniqueConstraint('user_id', 'duty_id', 'duty_report_utc', 'moment', name='uq_duty_debriefs_moment'),
        CheckConstraint("moment IN ('worst_moment', 'top_of_descent', 'end_of_duty')", name='ck_duty_debriefs_moment'),
        CheckConstraint("operation IN ('as_rostered', 'times_changed', 'not_operated')", name='ck_duty_debriefs_operation'),
        CheckConstraint('kss IS NULL OR kss BETWEEN 1 AND 9', name='ck_duty_debriefs_kss'),
        CheckConstraint('samn_perelli IS NULL OR samn_perelli BETWEEN 1 AND 7', name='ck_duty_debriefs_sp'),
        CheckConstraint("felt_vs_prediction IS NULL OR felt_vs_prediction IN ('worse', 'about_right', 'better')",
                        name='ck_duty_debriefs_felt'),
        CheckConstraint("operation = 'not_operated' OR kss IS NOT NULL OR samn_perelli IS NOT NULL",
                        name='ck_duty_debriefs_rating'),
        Index('ix_duty_debriefs_user_report', 'user_id', 'duty_report_utc'),
    )


class AccountActionToken(Base):
    __tablename__ = 'account_action_tokens'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    purpose = Column(String(20), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
