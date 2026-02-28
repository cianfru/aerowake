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
    analyses = relationship("Analysis", back_populates="roster", cascade="all, delete-orphan")
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
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
