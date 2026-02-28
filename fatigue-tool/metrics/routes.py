"""
Comparative performance metrics API routes.

GET /api/metrics/comparative       → your metrics vs. company/fleet/role peers for a month
GET /api/metrics/comparative/trend → 12-month trend of your percentile position
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.dependencies import get_current_user
from db.models import User, Roster, Analysis, AggregateMetrics
from db.session import get_db
from metrics.aggregator import MIN_SAMPLE_SIZE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


# ── Response Models ───────────────────────────────────────────────────────────


class PilotMetrics(BaseModel):
    """The requesting pilot's own metrics for comparison."""
    avg_performance: Optional[float] = None
    total_duties: int = 0
    total_sectors: int = 0
    total_duty_hours: float = 0.0
    avg_sleep_per_night: float = 0.0
    avg_sleep_debt: float = 0.0
    high_risk_duty_count: int = 0


class GroupMetrics(BaseModel):
    """Aggregated metrics for a peer group (company, fleet, role, fleet_role)."""
    group_type: str               # company | fleet | role | fleet_role
    group_value: str              # all | A320 | captain | A320_captain
    sample_size: int = 0
    avg_performance: Optional[float] = None
    min_performance: Optional[float] = None
    p25_performance: Optional[float] = None
    p75_performance: Optional[float] = None
    avg_sleep_debt: Optional[float] = None
    avg_sleep_per_night: Optional[float] = None
    avg_duty_hours: Optional[float] = None
    avg_sector_count: Optional[float] = None
    high_risk_duty_rate: Optional[float] = None


class PercentilePosition(BaseModel):
    """Where the pilot sits relative to the group distribution."""
    group_type: str
    group_value: str
    metric: str
    value: Optional[float] = None
    percentile: Optional[float] = None      # 0-100, higher = better
    vs_avg: Optional[float] = None          # difference from group average


class ComparativeResponse(BaseModel):
    """GET /api/metrics/comparative response."""
    month: str
    pilot: PilotMetrics
    groups: list[GroupMetrics]
    positions: list[PercentilePosition]
    has_sufficient_data: bool = False        # true if at least one group has sample_size >= MIN


class TrendPoint(BaseModel):
    """A single month's percentile snapshot."""
    month: str
    group_type: str
    group_value: str
    your_performance: Optional[float] = None
    group_avg_performance: Optional[float] = None
    percentile: Optional[float] = None
    sample_size: int = 0


class TrendResponse(BaseModel):
    """GET /api/metrics/comparative/trend response."""
    months: list[TrendPoint]
    primary_group: Optional[str] = None     # "fleet" or "company" depending on data


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/comparative", response_model=ComparativeResponse)
async def get_comparative_metrics(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format. Defaults to most recent."),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the pilot's metrics compared to company/fleet/role peers for a month.

    Groups with fewer than 5 pilots are suppressed for privacy.
    """
    if db is None:
        raise HTTPException(503, "Database not available")

    if not user.company_id:
        raise HTTPException(400, "No company assigned. Upload a roster first to detect your airline.")

    # Determine month — use provided or find most recent
    if month is None:
        result = await db.execute(
            select(Roster.month)
            .where(Roster.user_id == user.id)
            .order_by(Roster.month.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(404, "No rosters found. Upload and analyze a roster first.")
        month = row

    # Get pilot's own data for this month
    pilot_metrics = await _get_pilot_metrics(db, user.id, month)

    # Get aggregate metrics for the company + month
    result = await db.execute(
        select(AggregateMetrics)
        .where(AggregateMetrics.company_id == user.company_id)
        .where(AggregateMetrics.month == month)
    )
    aggregates = result.scalars().all()

    # Filter for privacy: only expose groups with >= MIN_SAMPLE_SIZE
    groups = []
    positions = []
    has_sufficient = False

    for agg in aggregates:
        if agg.sample_size < MIN_SAMPLE_SIZE:
            continue
        has_sufficient = True

        groups.append(GroupMetrics(
            group_type=agg.group_type,
            group_value=agg.group_value,
            sample_size=agg.sample_size,
            avg_performance=agg.avg_performance,
            min_performance=agg.min_performance,
            p25_performance=agg.p25_performance,
            p75_performance=agg.p75_performance,
            avg_sleep_debt=agg.avg_sleep_debt,
            avg_sleep_per_night=agg.avg_sleep_per_night,
            avg_duty_hours=agg.avg_duty_hours,
            avg_sector_count=agg.avg_sector_count,
            high_risk_duty_rate=agg.high_risk_duty_rate,
        ))

        # Compute percentile positions for key metrics
        if pilot_metrics.avg_performance and agg.avg_performance:
            perf_pct = _estimate_percentile(
                pilot_metrics.avg_performance,
                agg.p25_performance,
                agg.avg_performance,
                agg.p75_performance,
            )
            positions.append(PercentilePosition(
                group_type=agg.group_type,
                group_value=agg.group_value,
                metric="performance",
                value=pilot_metrics.avg_performance,
                percentile=perf_pct,
                vs_avg=round(pilot_metrics.avg_performance - agg.avg_performance, 1),
            ))

        if pilot_metrics.avg_sleep_debt is not None and agg.avg_sleep_debt is not None:
            # For sleep debt, LOWER is better — invert percentile
            debt_pct = _estimate_percentile_inverted(
                pilot_metrics.avg_sleep_debt,
                agg.avg_sleep_debt,
            )
            positions.append(PercentilePosition(
                group_type=agg.group_type,
                group_value=agg.group_value,
                metric="sleep_debt",
                value=pilot_metrics.avg_sleep_debt,
                percentile=debt_pct,
                vs_avg=round(pilot_metrics.avg_sleep_debt - agg.avg_sleep_debt, 1) if agg.avg_sleep_debt else None,
            ))

    return ComparativeResponse(
        month=month,
        pilot=pilot_metrics,
        groups=groups,
        positions=positions,
        has_sufficient_data=has_sufficient,
    )


@router.get("/comparative/trend", response_model=TrendResponse)
async def get_comparative_trend(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    12-month trend of the pilot's percentile position within their best-fit group.

    Uses fleet group if available (more specific), falls back to company-wide.
    """
    if db is None:
        raise HTTPException(503, "Database not available")

    if not user.company_id:
        raise HTTPException(400, "No company assigned.")

    # Get pilot's rosters (last 12 months)
    result = await db.execute(
        select(Roster)
        .where(Roster.user_id == user.id)
        .options(selectinload(Roster.analyses))
        .order_by(Roster.month.desc())
        .limit(12)
    )
    rosters = result.scalars().all()

    if not rosters:
        return TrendResponse(months=[], primary_group=None)

    # Determine primary fleet for group targeting
    fleet = rosters[0].fleet  # most recent roster's fleet
    primary_group_type = "fleet" if fleet else "company"
    primary_group_value = fleet if fleet else "all"

    trend_points: list[TrendPoint] = []

    for roster in reversed(rosters):  # chronological order
        if not roster.analyses:
            continue

        # Pilot's own performance
        analysis = roster.analyses[0]
        aj = analysis.analysis_json or {}
        duties = aj.get("duties", [])
        all_perf = [d.get("avg_performance") for d in duties if d.get("avg_performance") is not None]
        pilot_perf = round(sum(all_perf) / len(all_perf), 1) if all_perf else None

        # Get aggregate for this month + group
        agg_result = await db.execute(
            select(AggregateMetrics)
            .where(AggregateMetrics.company_id == user.company_id)
            .where(AggregateMetrics.month == roster.month)
            .where(AggregateMetrics.group_type == primary_group_type)
            .where(AggregateMetrics.group_value == primary_group_value)
        )
        agg = agg_result.scalar_one_or_none()

        if agg and agg.sample_size >= MIN_SAMPLE_SIZE and pilot_perf is not None:
            pct = _estimate_percentile(pilot_perf, agg.p25_performance, agg.avg_performance, agg.p75_performance)
            trend_points.append(TrendPoint(
                month=roster.month,
                group_type=primary_group_type,
                group_value=primary_group_value,
                your_performance=pilot_perf,
                group_avg_performance=agg.avg_performance,
                percentile=pct,
                sample_size=agg.sample_size,
            ))
        elif pilot_perf is not None:
            # No aggregate data — still show pilot's own performance
            trend_points.append(TrendPoint(
                month=roster.month,
                group_type=primary_group_type,
                group_value=primary_group_value,
                your_performance=pilot_perf,
                sample_size=0,
            ))

    return TrendResponse(
        months=trend_points,
        primary_group=f"{primary_group_type}:{primary_group_value}",
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_pilot_metrics(db: AsyncSession, user_id, month: str) -> PilotMetrics:
    """Extract the pilot's own metrics from their most recent roster+analysis for the month."""
    result = await db.execute(
        select(Roster)
        .where(Roster.user_id == user_id)
        .where(Roster.month == month)
        .options(selectinload(Roster.analyses))
        .order_by(Roster.created_at.desc())
        .limit(1)
    )
    roster = result.scalar_one_or_none()

    if not roster or not roster.analyses:
        return PilotMetrics()

    analysis = roster.analyses[0]
    aj = analysis.analysis_json or {}
    duties = aj.get("duties", [])

    all_perf = [d.get("avg_performance") for d in duties if d.get("avg_performance") is not None]
    high_risk = sum(1 for d in duties if d.get("risk_level") in ("high", "critical", "extreme"))

    return PilotMetrics(
        avg_performance=round(sum(all_perf) / len(all_perf), 1) if all_perf else None,
        total_duties=roster.total_duties or len(duties),
        total_sectors=roster.total_sectors or 0,
        total_duty_hours=round(roster.total_duty_hours or 0, 1),
        avg_sleep_per_night=round(aj.get("avg_sleep_per_night", 0) or 0, 1),
        avg_sleep_debt=round(aj.get("average_sleep_debt", 0) or 0, 1),
        high_risk_duty_count=high_risk,
    )


def _estimate_percentile(
    value: float,
    p25: Optional[float],
    mean: Optional[float],
    p75: Optional[float],
) -> Optional[float]:
    """
    Estimate percentile position from quartile summary statistics.

    Uses linear interpolation between known quartile points.
    Returns 0-100 where higher is better (for performance-type metrics).
    """
    if value is None or mean is None:
        return None

    # Simple interpolation using p25/mean/p75 as anchors at 25/50/75
    if p25 is not None and p75 is not None and p75 > p25:
        if value <= p25:
            # Below p25 — interpolate 0-25
            range_below = mean - p25 if mean > p25 else 1
            pct = max(0, 25 * (1 - (p25 - value) / range_below))
        elif value <= mean:
            # Between p25 and mean — interpolate 25-50
            pct = 25 + 25 * (value - p25) / (mean - p25) if mean > p25 else 50
        elif value <= p75:
            # Between mean and p75 — interpolate 50-75
            pct = 50 + 25 * (value - mean) / (p75 - mean) if p75 > mean else 50
        else:
            # Above p75 — interpolate 75-100
            range_above = p75 - mean if p75 > mean else 1
            pct = min(100, 75 + 25 * (value - p75) / range_above)
        return round(pct, 0)

    # Fallback: simple above/below average
    if value >= mean:
        return 60.0
    return 40.0


def _estimate_percentile_inverted(value: float, group_avg: Optional[float]) -> Optional[float]:
    """
    For metrics where lower is better (sleep debt, risk rate).

    Returns 0-100 where higher = better (less debt than peers).
    """
    if group_avg is None or group_avg == 0:
        return 50.0

    # Lower value = better percentile
    ratio = value / group_avg
    if ratio <= 0.5:
        return 90.0
    elif ratio <= 0.8:
        return 70.0
    elif ratio <= 1.0:
        return 55.0
    elif ratio <= 1.2:
        return 40.0
    elif ratio <= 1.5:
        return 25.0
    else:
        return 10.0
