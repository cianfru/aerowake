"""
Authentication API routes for Aerowake.

Endpoints:
  POST /api/auth/register  — create account (email + password)
  POST /api/auth/login     — sign in, get tokens
  POST /api/auth/refresh   — rotate refresh token
  GET  /api/auth/me        — get current user profile
  PUT  /api/auth/me        — update profile
  POST /api/auth/logout    — invalidate refresh token
"""

import os
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from auth.password import hash_password, verify_password
from auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from auth.dependencies import get_current_user
from db.models import User, RefreshToken
from db.session import get_db

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)
    pilot_id: str | None = Field(None, max_length=50)
    home_base: str | None = Field(None, max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str | None
    display_name: str | None
    pilot_id: str | None
    home_base: str | None
    auth_provider: str
    is_admin: bool = False
    created_at: str


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    pilot_id: str | None = Field(None, max_length=50)
    home_base: str | None = Field(None, max_length=10)


# ─── Helpers ───────────────────────────────────────────────────────────────────


async def _store_refresh_token(db: AsyncSession, user_id, raw_token: str):
    """Store hashed refresh token in DB."""
    token_entry = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token_entry)
    await db.commit()


def _is_admin(user: User) -> bool:
    """Check if user is admin via DB flag or ADMIN_EMAILS env var."""
    if getattr(user, "is_admin", False):
        return True
    admin_emails_raw = os.environ.get("ADMIN_EMAILS", "")
    admin_emails = [e.strip().lower() for e in admin_emails_raw.split(",") if e.strip()]
    return bool(user.email and user.email.lower() in admin_emails)


def _user_to_response(user: User) -> UserResponse:
    """Convert DB model to Pydantic response."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        pilot_id=user.pilot_id,
        home_base=user.home_base,
        auth_provider=user.auth_provider,
        is_admin=_is_admin(user),
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# ─── Routes ───────────────────────────────────────────────────────────────────


@auth_router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account with email and password."""
    if db is None:
        raise HTTPException(503, "Database not available")

    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        auth_provider="email",
        pilot_id=body.pilot_id,
        home_base=body.home_base,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate tokens
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    await _store_refresh_token(db, user.id, refresh)

    logger.info(f"New user registered: {body.email}")

    return TokenResponse(access_token=access, refresh_token=refresh)


@auth_router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Sign in with email and password."""
    if db is None:
        raise HTTPException(503, "Database not available")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Generate tokens
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    await _store_refresh_token(db, user.id, refresh)

    return TokenResponse(access_token=access, refresh_token=refresh)


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Rotate refresh token and get new access token."""
    if db is None:
        raise HTTPException(503, "Database not available")

    # Decode refresh token
    try:
        payload = decode_token(body.refresh_token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if not user_id or token_type != "refresh":
            raise HTTPException(401, "Invalid refresh token")
    except Exception:
        raise HTTPException(401, "Invalid or expired refresh token")

    # Verify token exists in DB (not revoked)
    hashed = hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hashed)
    )
    stored_token = result.scalar_one_or_none()

    if stored_token is None:
        raise HTTPException(401, "Refresh token has been revoked")

    # Delete old token (rotation)
    await db.delete(stored_token)

    # Verify user still exists and is active
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(401, "User not found or disabled")

    # Issue new tokens
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    await _store_refresh_token(db, user.id, refresh)

    return TokenResponse(access_token=access, refresh_token=refresh)


@auth_router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    return _user_to_response(user)


@auth_router.put("/me", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile fields."""
    if db is None:
        raise HTTPException(503, "Database not available")

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.pilot_id is not None:
        user.pilot_id = body.pilot_id
    if body.home_base is not None:
        user.home_base = body.home_base

    await db.commit()
    await db.refresh(user)

    return _user_to_response(user)


@auth_router.post("/logout", status_code=204)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Invalidate a refresh token (sign out)."""
    if db is None:
        return

    hashed = hash_token(body.refresh_token)
    await db.execute(
        delete(RefreshToken).where(RefreshToken.token_hash == hashed)
    )
    await db.commit()
