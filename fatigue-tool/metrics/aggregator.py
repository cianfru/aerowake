"""
Comparative metrics aggregation engine.

After each analysis upload, re-computes aggregate statistics for
the pilot's company across four group scopes:
  - 'company'    (all pilots)
  - 'fleet'      (e.g. A320, A350)
  - 'role'       (captain, first_officer)
  - 'fleet_role' (A320_captain, A350_first_officer)

Groups with sample_size < MIN_SAMPLE_SIZE are stored but suppressed
from the API response (industry de-identification standard).
"""

import logging
import statistics
from typing import Optional
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import AggregateMetrics, Roster, Analysis

logger = logging.getLogger(__name__)

MIN_SAMPLE_SIZE = 5


# ── Public API ────────────────────────────────────────────────────────────────


async def compute_aggregate_metrics(
    db: AsyncSession,
    company_id: UUID,
    month: str,
) -> None:
    """
    Re-compute and upsert all aggregate metrics for *company_id* + *month*.

    Called after every analyze_roster / reanalyze_roster for authenticated
    users with a company assignment.
    """
    try:
        # Fetch all rosters for this company+month that have analyses
        result = await db.execute(
            select(Roster)
            .where(Roster.company_id == company_id)
            .where(Roster.month == month)
            .options(selectinload(Roster.analyses))
        )
        rosters = result.scalars().all()

        # Keep only rosters with at least one analysis
        pilot_data: list[_PilotMonthData] = []
        seen_users: set[UUID] = set()

        for roster in rosters:
            if not roster.analyses or roster.user_id in seen_users:
                continue
            # Use the latest analysis per user (deduplicate)
            analysis = roster.analyses[0]
            data = _extract_pilot_data(roster, analysis)
            if data is not None:
                pilot_data.append(data)
                seen_users.add(roster.user_id)

        if not pilot_data:
            return

        # Delete existing metrics for this company+month (replace all)
        await db.execute(
            delete(AggregateMetrics)
            .where(AggregateMetrics.company_id == company_id)
            .where(AggregateMetrics.month == month)
        )

        # Compute for each grouping
        groups = _build_groups(pilot_data)
        for (group_type, group_value), members in groups.items():
            metrics = _aggregate_group(members)
            row = AggregateMetrics(
                company_id=company_id,
                month=month,
                group_type=group_type,
                group_value=group_value,
                sample_size=len(members),
                avg_performance=metrics["avg_performance"],
                min_performance=metrics["min_performance"],
                p25_performance=metrics["p25_performance"],
                p75_performance=metrics["p75_performance"],
                avg_sleep_debt=metrics["avg_sleep_debt"],
                avg_sleep_per_night=metrics["avg_sleep_per_night"],
                avg_duty_hours=metrics["avg_duty_hours"],
                avg_sector_count=metrics["avg_sector_count"],
                high_risk_duty_rate=metrics["high_risk_duty_rate"],
            )
            db.add(row)

        await db.commit()
        logger.info(
            f"Computed aggregate metrics for company={company_id} month={month}: "
            f"{len(pilot_data)} pilots, {len(groups)} groups"
        )

    except Exception as e:
        logger.warning(f"Failed to compute aggregate metrics: {e}")
        await db.rollback()


# ── Internal Data Structures ──────────────────────────────────────────────────


class _PilotMonthData:
    """Intermediate per-pilot metrics extracted from stored JSONB."""
    __slots__ = (
        "user_id", "fleet", "pilot_role",
        "avg_performance", "total_duties", "total_sectors",
        "total_duty_hours", "avg_sleep_per_night", "avg_sleep_debt",
        "high_risk_duty_count", "total_risk_duties",
    )

    def __init__(self):
        self.user_id: Optional[UUID] = None
        self.fleet: Optional[str] = None
        self.pilot_role: Optional[str] = None
        self.avg_performance: float = 0.0
        self.total_duties: int = 0
        self.total_sectors: int = 0
        self.total_duty_hours: float = 0.0
        self.avg_sleep_per_night: float = 0.0
        self.avg_sleep_debt: float = 0.0
        self.high_risk_duty_count: int = 0
        self.total_risk_duties: int = 0


def _extract_pilot_data(roster: Roster, analysis: Analysis) -> Optional[_PilotMonthData]:
    """Extract aggregate metrics from a single roster+analysis pair."""
    aj = analysis.analysis_json
    if not aj:
        return None

    d = _PilotMonthData()
    d.user_id = roster.user_id
    d.fleet = roster.fleet
    d.pilot_role = roster.pilot_role

    duties = aj.get("duties", [])
    d.total_duties = roster.total_duties or len(duties)
    d.total_sectors = roster.total_sectors or aj.get("total_sectors", 0)
    d.total_duty_hours = roster.total_duty_hours or aj.get("total_duty_hours", 0) or 0
    d.avg_sleep_per_night = aj.get("avg_sleep_per_night", 0) or 0
    d.avg_sleep_debt = aj.get("average_sleep_debt", 0) or 0

    # Compute average performance from duty-level data
    all_avg_perf = []
    high_risk = 0
    for duty in duties:
        avg_p = duty.get("avg_performance")
        if avg_p is not None:
            all_avg_perf.append(avg_p)
        rl = duty.get("risk_level", "low")
        if rl in ("high", "critical", "extreme"):
            high_risk += 1

    d.avg_performance = (sum(all_avg_perf) / len(all_avg_perf)) if all_avg_perf else 0
    d.high_risk_duty_count = high_risk
    d.total_risk_duties = len(duties)

    return d


# ── Grouping ──────────────────────────────────────────────────────────────────


def _build_groups(
    data: list[_PilotMonthData],
) -> dict[tuple[str, str], list[_PilotMonthData]]:
    """Build group memberships for each pilot."""
    groups: dict[tuple[str, str], list[_PilotMonthData]] = {}

    # Company-wide
    groups[("company", "all")] = list(data)

    for d in data:
        # Fleet group
        if d.fleet:
            key = ("fleet", d.fleet)
            groups.setdefault(key, []).append(d)

        # Role group
        if d.pilot_role:
            key = ("role", d.pilot_role)
            groups.setdefault(key, []).append(d)

        # Fleet+Role combo
        if d.fleet and d.pilot_role:
            key = ("fleet_role", f"{d.fleet}_{d.pilot_role}")
            groups.setdefault(key, []).append(d)

    return groups


# ── Percentile & Aggregation ──────────────────────────────────────────────────


def _percentile(data: list[float], p: float) -> float:
    """Simple percentile calculation (linear interpolation)."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    if n == 1:
        return sorted_data[0]
    k = (n - 1) * p / 100.0
    f = int(k)
    c = f + 1
    if c >= n:
        return sorted_data[-1]
    d = k - f
    return sorted_data[f] + d * (sorted_data[c] - sorted_data[f])


def _aggregate_group(members: list[_PilotMonthData]) -> dict:
    """Compute aggregate stats for a group of pilots."""
    perfs = [m.avg_performance for m in members if m.avg_performance > 0]
    sleep_debts = [m.avg_sleep_debt for m in members]
    sleep_per_night = [m.avg_sleep_per_night for m in members if m.avg_sleep_per_night > 0]
    duty_hours = [m.total_duty_hours for m in members if m.total_duty_hours > 0]
    sector_counts = [float(m.total_sectors) for m in members if m.total_sectors > 0]

    total_high_risk = sum(m.high_risk_duty_count for m in members)
    total_duties = sum(m.total_risk_duties for m in members)
    high_risk_rate = (total_high_risk / total_duties) if total_duties > 0 else 0.0

    return {
        "avg_performance": round(statistics.mean(perfs), 1) if perfs else None,
        "min_performance": round(min(perfs), 1) if perfs else None,
        "p25_performance": round(_percentile(perfs, 25), 1) if perfs else None,
        "p75_performance": round(_percentile(perfs, 75), 1) if perfs else None,
        "avg_sleep_debt": round(statistics.mean(sleep_debts), 1) if sleep_debts else None,
        "avg_sleep_per_night": round(statistics.mean(sleep_per_night), 1) if sleep_per_night else None,
        "avg_duty_hours": round(statistics.mean(duty_hours), 1) if duty_hours else None,
        "avg_sector_count": round(statistics.mean(sector_counts), 1) if sector_counts else None,
        "high_risk_duty_rate": round(high_risk_rate, 3),
    }
