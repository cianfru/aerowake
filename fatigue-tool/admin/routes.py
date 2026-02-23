"""
Admin API routes for Aerowake.

Provides platform-wide visibility for admin users.
All endpoints are gated by the get_admin_user dependency.

Endpoints:
  GET /api/admin/stats    — Platform-wide statistics
  GET /api/admin/users    — All registered users with metrics
  GET /api/admin/rosters  — All uploaded rosters across all users
  GET /api/admin/activity — Recent activity feed (signups + uploads)
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.dependencies import get_admin_user
from db.models import User, Roster, Analysis
from db.session import get_db

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── Response Models ──────────────────────────────────────────────────────────


class MostActiveUser(BaseModel):
    email: str | None
    display_name: str | None
    roster_count: int


class PlatformStatsResponse(BaseModel):
    total_users: int
    total_rosters: int
    total_analyses: int
    users_last_7_days: int
    rosters_last_7_days: int
    avg_rosters_per_user: float
    most_active_users: list[MostActiveUser]


class AdminUserResponse(BaseModel):
    id: str
    email: str | None
    display_name: str | None
    pilot_id: str | None
    home_base: str | None
    is_active: bool
    is_admin: bool
    created_at: str
    updated_at: str
    roster_count: int
    last_upload: str | None


class AdminRosterResponse(BaseModel):
    id: str
    filename: str
    month: str
    pilot_id: str | None
    home_base: str | None
    config_preset: str | None
    total_duties: int | None
    total_sectors: int | None
    total_duty_hours: float | None
    total_block_hours: float | None
    created_at: str
    has_analysis: bool
    user_id: str
    user_email: str | None
    user_display_name: str | None


class ActivityEvent(BaseModel):
    event_type: str  # "roster_upload" | "user_signup"
    timestamp: str
    user_email: str | None
    user_display_name: str | None
    details: dict


# ─── Endpoints ────────────────────────────────────────────────────────────────


@admin_router.get("/stats", response_model=PlatformStatsResponse)
async def get_platform_stats(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide summary statistics."""
    if db is None:
        raise HTTPException(503, "Database not available")

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # Total counts
    total_users = (await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )).scalar_one()

    total_rosters = (await db.execute(
        select(func.count()).select_from(Roster)
    )).scalar_one()

    total_analyses = (await db.execute(
        select(func.count()).select_from(Analysis)
    )).scalar_one()

    # Last 7 days
    users_last_7 = (await db.execute(
        select(func.count()).select_from(User).where(User.created_at >= week_ago)
    )).scalar_one()

    rosters_last_7 = (await db.execute(
        select(func.count()).select_from(Roster).where(Roster.created_at >= week_ago)
    )).scalar_one()

    # Average rosters per user
    avg_per_user = round(total_rosters / max(total_users, 1), 1)

    # Top 5 most active users by roster count
    top_users_q = (
        select(
            User.email,
            User.display_name,
            func.count(Roster.id).label("roster_count"),
        )
        .outerjoin(Roster, Roster.user_id == User.id)
        .group_by(User.id, User.email, User.display_name)
        .order_by(desc("roster_count"))
        .limit(5)
    )
    top_users_result = await db.execute(top_users_q)
    most_active = [
        MostActiveUser(
            email=row.email,
            display_name=row.display_name,
            roster_count=row.roster_count,
        )
        for row in top_users_result.all()
    ]

    return PlatformStatsResponse(
        total_users=total_users,
        total_rosters=total_rosters,
        total_analyses=total_analyses,
        users_last_7_days=users_last_7,
        rosters_last_7_days=rosters_last_7,
        avg_rosters_per_user=avg_per_user,
        most_active_users=most_active,
    )


@admin_router.get("/users", response_model=list[AdminUserResponse])
async def list_all_users(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """All registered users with roster metrics."""
    if db is None:
        raise HTTPException(503, "Database not available")

    # Subquery for per-user roster stats
    roster_stats = (
        select(
            Roster.user_id,
            func.count(Roster.id).label("roster_count"),
            func.max(Roster.created_at).label("last_upload"),
        )
        .group_by(Roster.user_id)
        .subquery()
    )

    # Main query: all users LEFT JOIN roster stats
    query = (
        select(User, roster_stats.c.roster_count, roster_stats.c.last_upload)
        .outerjoin(roster_stats, User.id == roster_stats.c.user_id)
        .order_by(desc(User.created_at))
    )
    result = await db.execute(query)

    users = []
    for row in result.all():
        user = row[0]
        roster_count = row[1] or 0
        last_upload = row[2]
        users.append(AdminUserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            pilot_id=user.pilot_id,
            home_base=user.home_base,
            is_active=user.is_active,
            is_admin=getattr(user, "is_admin", False),
            created_at=user.created_at.isoformat() if user.created_at else "",
            updated_at=user.updated_at.isoformat() if user.updated_at else "",
            roster_count=roster_count,
            last_upload=last_upload.isoformat() if last_upload else None,
        ))

    return users


@admin_router.get("/rosters", response_model=list[AdminRosterResponse])
async def list_all_rosters(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """All rosters across all users with uploader identity."""
    if db is None:
        raise HTTPException(503, "Database not available")

    # Query rosters joined with users, eagerly load analyses (just to check existence)
    query = (
        select(Roster, User.email, User.display_name)
        .join(User, Roster.user_id == User.id)
        .options(selectinload(Roster.analyses))
        .order_by(desc(Roster.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)

    rosters = []
    for row in result.all():
        roster = row[0]
        user_email = row[1]
        user_display_name = row[2]
        rosters.append(AdminRosterResponse(
            id=str(roster.id),
            filename=roster.filename,
            month=roster.month,
            pilot_id=roster.pilot_id,
            home_base=roster.home_base,
            config_preset=roster.config_preset,
            total_duties=roster.total_duties,
            total_sectors=roster.total_sectors,
            total_duty_hours=roster.total_duty_hours,
            total_block_hours=roster.total_block_hours,
            created_at=roster.created_at.isoformat() if roster.created_at else "",
            has_analysis=len(roster.analyses) > 0,
            user_id=str(roster.user_id),
            user_email=user_email,
            user_display_name=user_display_name,
        ))

    return rosters


@admin_router.get("/activity", response_model=list[ActivityEvent])
async def get_recent_activity(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
):
    """Recent activity feed: signups + roster uploads merged by timestamp."""
    if db is None:
        raise HTTPException(503, "Database not available")

    events: list[ActivityEvent] = []

    # Recent signups
    signups_q = (
        select(User)
        .order_by(desc(User.created_at))
        .limit(limit)
    )
    signups = (await db.execute(signups_q)).scalars().all()
    for user in signups:
        events.append(ActivityEvent(
            event_type="user_signup",
            timestamp=user.created_at.isoformat() if user.created_at else "",
            user_email=user.email,
            user_display_name=user.display_name,
            details={
                "pilot_id": user.pilot_id,
                "home_base": user.home_base,
            },
        ))

    # Recent uploads
    uploads_q = (
        select(Roster, User.email, User.display_name)
        .join(User, Roster.user_id == User.id)
        .order_by(desc(Roster.created_at))
        .limit(limit)
    )
    uploads = (await db.execute(uploads_q)).all()
    for row in uploads:
        roster = row[0]
        events.append(ActivityEvent(
            event_type="roster_upload",
            timestamp=roster.created_at.isoformat() if roster.created_at else "",
            user_email=row[1],
            user_display_name=row[2],
            details={
                "filename": roster.filename,
                "month": roster.month,
                "total_duties": roster.total_duties,
                "home_base": roster.home_base,
            },
        ))

    # Merge and sort by timestamp descending
    events.sort(key=lambda e: e.timestamp, reverse=True)

    return events[:limit]
