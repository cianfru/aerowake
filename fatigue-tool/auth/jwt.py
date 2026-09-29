"""
JWT token creation and verification for Aerowake.

Access tokens (30 min) for API authentication.
Refresh tokens (30 days) for silent re-authentication.
"""

import os
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from jwt.exceptions import InvalidTokenError as JWTError

# Secret key from environment — Railway env var
SECRET_KEY = os.environ.get("JWT_SECRET", "")
if len(SECRET_KEY) < 32:
    if os.environ.get("DATABASE_URL") or os.environ.get("ENVIRONMENT") == "production":
        raise RuntimeError("JWT_SECRET must be a random secret of at least 32 characters")
    SECRET_KEY = secrets.token_urlsafe(48)  # ephemeral, local development only
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None, auth_version: int = 0) -> str:
    """Create a short-lived JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": user_id,
        "jti": str(uuid.uuid4()),
        "version": auth_version,
        "iat": datetime.now(timezone.utc),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, expires_delta: Optional[timedelta] = None, auth_version: int = 0) -> str:
    """Create a long-lived JWT refresh token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    payload = {
        "sub": user_id,
        "jti": str(uuid.uuid4()),
        "version": auth_version,
        "iat": datetime.now(timezone.utc),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Returns the payload dict with 'sub' (user_id) and 'type'.
    Raises JWTError on invalid/expired tokens.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def hash_token(token: str) -> str:
    """Hash a refresh token for DB storage (SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()
