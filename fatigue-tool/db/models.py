"""
SQLAlchemy 2.0 ORM models for Aerowake persistence layer.

Tables:
  - users: pilot accounts (email/password baseline, OAuth-ready)
  - rosters: uploaded roster files with metadata
  - analyses: full JSON analysis results (~150-200KB JSONB)
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
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    rosters = relationship("Roster", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="rosters")
    analyses = relationship("Analysis", back_populates="roster", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_rosters_user_month", "user_id", "month"),
    )


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
