"""
FastAPI dependencies for authentication.

get_current_user: requires valid JWT → returns User
get_optional_user: returns User or None (for endpoints that work with/without auth)
"""

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt import decode_token
from db.models import User
from db.session import get_db

logger = logging.getLogger(__name__)

# auto_error=False: don't raise 401 automatically (allows optional auth)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession | None = Depends(get_db),
) -> User:
    """
    Require authenticated user.

    Decodes JWT, looks up user in DB.
    Raises HTTP 401 if invalid/expired or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None or db is None:
        raise credentials_exception

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession | None = Depends(get_db),
) -> User | None:
    """
    Optional authentication — returns User if valid token, None otherwise.

    Used for endpoints that work both authenticated and anonymously
    (e.g., POST /api/analyze persists when authenticated, uses in-memory otherwise).
    """
    if token is None or db is None:
        return None

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    return user
