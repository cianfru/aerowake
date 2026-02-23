/**
 * Shared utility functions for fatigue visualization components.
 *
 * Extracted from Chronogram.tsx and HumanPerformanceTimeline.tsx to
 * eliminate duplication and ensure consistent behavior.
 */

import type { DutyAnalysis } from '@/types/fatigue';

/** Parse "HH:mm" time string to decimal hours (e.g., "18:30" → 18.5). */
export const parseTimeToHours = (timeStr: string | undefined): number | undefined => {
  if (!timeStr) return undefined;
  const parts = timeStr.split(':').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] + parts[1] / 60;
  }
  return undefined;
};

/**
 * Convert decimal hours to "HH:mm" string (e.g., 18.5 → "18:30").
 * Handles overflow (values > 24 or < 0) via modulo wrapping.
 */
export const decimalToHHmm = (h: number): string => {
  const hrs = Math.floor(((h % 24) + 24) % 24);
  const mins = Math.round((h - Math.floor(h)) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(Math.abs(mins)).padStart(2, '0')}`;
};

/** Extract UTC (Zulu) time as "HH:mmZ" from an ISO timestamp string. */
export const isoToZulu = (isoStr?: string): string | null => {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
  } catch { return null; }
};

/** Calculate recovery score from a sleep estimate (0–100 scale). */
export const getRecoveryScore = (estimate: NonNullable<DutyAnalysis['sleepEstimate']>): number => {
  const baseScore = (estimate.effectiveSleepHours / 8) * 100;
  const efficiencyBonus = estimate.sleepEfficiency * 20;
  const woclPenalty = estimate.woclOverlapHours * 5;
  return Math.min(100, Math.max(0, baseScore + efficiencyBonus - woclPenalty));
};

/** Map recovery score to Tailwind semantic color classes. */
export const getRecoveryClasses = (score: number): { border: string; bg: string; text: string } => {
  if (score >= 80) return { border: 'border-success', bg: 'bg-success/10', text: 'text-success' };
  if (score >= 65) return { border: 'border-success/70', bg: 'bg-success/10', text: 'text-success/80' };
  if (score >= 50) return { border: 'border-warning', bg: 'bg-warning/10', text: 'text-warning' };
  if (score >= 35) return { border: 'border-high', bg: 'bg-high/10', text: 'text-high' };
  return { border: 'border-critical', bg: 'bg-critical/10', text: 'text-critical' };
};

/** Map sleep strategy to its display emoji. */
export const getStrategyIcon = (strategy: string): string => {
  switch (strategy) {
    case 'anchor': return '⚓';
    case 'split': return '✂️';
    case 'nap': return '💤';
    case 'afternoon_nap': return '☀️';
    case 'early_bedtime': return '🌙';
    case 'extended': return '🛏️';
    case 'restricted': return '⏰';
    case 'recovery': return '🔋';
    case 'post_duty_recovery': return '🛏️';
    case 'normal': return '😴';
    case 'ulr_pre_duty': return '✈️🌙';
    case 'augmented_3_pilot': return '✈️😴';
    default: return '😴';
  }
};

/** Map performance percentage (0–100) to an HSL color string. */
export const getPerformanceColor = (performance: number): string => {
  if (performance >= 80) return 'hsl(120, 70%, 45%)';
  if (performance >= 70) return 'hsl(90, 70%, 50%)';
  if (performance >= 60) return 'hsl(55, 90%, 55%)';
  if (performance >= 50) return 'hsl(40, 95%, 50%)';
  if (performance >= 40) return 'hsl(20, 95%, 50%)';
  return 'hsl(0, 80%, 50%)';
};

// --- Training duty helpers ---

/** Check if a duty is a training duty (simulator or ground training) */
export const isTrainingDuty = (duty: { dutyType?: string }): boolean =>
  duty.dutyType === 'simulator' || duty.dutyType === 'ground_training';

/** Background color for training duty chronogram bars (uses CSS variables for theme support) */
export const getTrainingDutyColor = (dutyType: string): string => {
  switch (dutyType) {
    case 'simulator':       return 'hsl(var(--simulator))';
    case 'ground_training': return 'hsl(var(--ground-training))';
    default:                return 'hsl(var(--muted))';
  }
};

/** Human-readable label for training duty type */
export const getTrainingDutyLabel = (dutyType: string): string => {
  switch (dutyType) {
    case 'simulator':       return 'Simulator';
    case 'ground_training': return 'Ground Training';
    default:                return 'Training';
  }
};

// ---------------------------------------------------------------------------
// Timeline shared helpers (extracted from HomeBase, UTC, HPT to eliminate duplication)
// ---------------------------------------------------------------------------

import type { FlightPhase, RestDaySleep } from '@/types/fatigue';
import type { TimelineSleepBar, TimelineDutyBar } from '@/lib/timeline-types';
import { format } from 'date-fns';

/** Default check-in time before first sector (EASA typically 60 min) */
export const DEFAULT_CHECK_IN_MINUTES = 60;

/** Row height constant for chronogram rows (px) */
export const ROW_HEIGHT = 40;

/** WOCL (Window of Circadian Low) boundaries in hours */
export const WOCL_START = 2;
export const WOCL_END = 6;

/** Circadian adaptation rates (hours/day) — HPT view */
export const ADAPTATION_RATE_EAST = 1.0;
export const ADAPTATION_RATE_WEST = 1.5;

/** Nadir hour (circadian low point) */
export const NADIR_HOUR = 4.5;

/**
 * Create a pseudo-duty object for rest day sleep bars.
 * Used by the tooltip/popover to display context about rest day recovery sleep.
 */
export function createRestDayPseudoDuty(restDay: RestDaySleep): DutyAnalysis {
  return {
    date: restDay.date,
    dayOfWeek: format(restDay.date, 'EEE'),
    dutyHours: 0,
    blockHours: 0,
    sectors: 0,
    minPerformance: 100,
    avgPerformance: 100,
    landingPerformance: 100,
    sleepDebt: 0,
    woclExposure: 0,
    priorSleep: restDay.totalSleepHours,
    overallRisk: 'LOW',
    minPerformanceRisk: 'LOW',
    landingRisk: 'LOW',
    smsReportable: false,
    flightSegments: [],
    crewComposition: 'standard',
    restFacilityClass: null,
    isUlr: false,
    acclimatizationState: 'acclimatized',
    ulrCompliance: null,
    inflightRestBlocks: [],
    returnToDeckPerformance: null,
    preDutyAwakeHours: 0,
  };
}

/**
 * Deduplicate timeline bars by position.
 *
 * Two bars occupying the same slot on the same row are visual duplicates
 * regardless of which code path generated them. The first one encountered wins.
 * Keys on rowIndex + startHour (rounded to 2dp) + endHour (rounded to 2dp).
 */
export function deduplicateTimelineBars<T extends { rowIndex: number; startHour: number; endHour: number }>(bars: T[]): T[] {
  const seen = new Set<string>();
  return bars.filter(bar => {
    const key = `${bar.rowIndex}|${bar.startHour.toFixed(2)}|${bar.endHour.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Split a time range that crosses midnight into two row-aligned bars.
 *
 * @param rowIndex The row of the start portion
 * @param startHour Start hour (0-24)
 * @param endHour End hour (0-24) — may be < startHour for overnight
 * @param maxRow Maximum valid row index
 * @returns Array of 1-2 {rowIndex, startHour, endHour} slices
 */
export function splitOvernightBar(
  rowIndex: number,
  startHour: number,
  endHour: number,
  maxRow: number,
): { rowIndex: number; startHour: number; endHour: number; isOvernightStart?: boolean; isOvernightContinuation?: boolean }[] {
  // Same-day bar (no crossing)
  if (startHour < endHour) {
    return [{ rowIndex, startHour, endHour }];
  }

  const results: { rowIndex: number; startHour: number; endHour: number; isOvernightStart?: boolean; isOvernightContinuation?: boolean }[] = [];

  // Part 1: startHour to 24:00 on start row
  if (rowIndex >= 1 && rowIndex <= maxRow) {
    results.push({ rowIndex, startHour, endHour: 24, isOvernightStart: true });
  }

  // Part 2: 00:00 to endHour on next row
  const nextRow = rowIndex + 1;
  if (nextRow >= 1 && nextRow <= maxRow && endHour > 0) {
    results.push({ rowIndex: nextRow, startHour: 0, endHour, isOvernightContinuation: true });
  }

  return results;
}

/**
 * Build standard flight phase breakdown for a flight segment.
 * Phases: Takeoff (15%), Climb (10%), Cruise (50%), Descent (10%), Approach (10%), Landing (5%).
 */
export function buildFlightPhases(
  segPerformance: number,
  landingPerformance: number | undefined,
): { phase: FlightPhase; performance: number; widthPercent: number }[] {
  return [
    { phase: 'takeoff', performance: segPerformance + 5, widthPercent: 15 },
    { phase: 'climb', performance: segPerformance + 3, widthPercent: 10 },
    { phase: 'cruise', performance: segPerformance, widthPercent: 50 },
    { phase: 'descent', performance: segPerformance - 2, widthPercent: 10 },
    { phase: 'approach', performance: segPerformance - 4, widthPercent: 10 },
    { phase: 'landing', performance: landingPerformance ?? segPerformance - 5, widthPercent: 5 },
  ];
}

/**
 * Get duty-related warnings for a given day label.
 *
 * Used by the Y-axis row labels in all timeline views.
 */
export function getDayWarnings(
  duties: DutyAnalysis[],
  dayOfMonth: number,
): { warnings: string[]; risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' } | null {
  const duty = duties.find(d => {
    const dom = d.dateString ? Number(d.dateString.split('-')[2]) : d.date.getDate();
    return dom === dayOfMonth;
  });
  if (!duty) return null;

  const warnings: string[] = [];

  if (duty.woclExposure > 0) {
    warnings.push(`WOCL ${duty.woclExposure.toFixed(1)}h`);
  }
  if (duty.priorSleep < 8) {
    warnings.push(`Sleep ${duty.priorSleep.toFixed(1)}h`);
  }
  if (duty.minPerformance < 60) {
    warnings.push(`Perf ${Math.round(duty.minPerformance)}%`);
  }
  if (duty.sleepDebt > 4) {
    warnings.push(`Debt ${duty.sleepDebt.toFixed(1)}h`);
  }

  return { warnings, risk: duty.overallRisk };
}

/** Quality factor display labels (shared across all sleep popovers). */
export const QUALITY_FACTOR_LABELS: Record<string, string> = {
  base_efficiency: 'Base Efficiency',
  wocl_boost: 'WOCL Boost',
  late_onset_penalty: 'Late Onset',
  recovery_boost: 'Recovery Boost',
  time_pressure_factor: 'Time Pressure',
  insufficient_penalty: 'Duration Penalty',
  pre_duty_awake_hours: 'Pre-Duty Awake',
};

/**
 * Parse "HH:mmZ" or "HH:mm" to decimal hours (used by UTC transform).
 */
export const parseUtcTimeStr = (timeStr: string | undefined): number | null => {
  if (!timeStr) return null;
  const cleaned = timeStr.replace('Z', '');
  const [h, m] = cleaned.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
};

/**
 * Parse an ISO timestamp string directly (no Date constructor).
 *
 * IMPORTANT: Does NOT use `new Date(iso)` because that converts to the
 * browser's local timezone, which can shift sleep blocks onto the wrong
 * day/hour and create visual overlap. We parse the date/time as written
 * in the ISO string.
 */
export function parseIsoDirectly(isoStr: string): { dayOfMonth: number; hour: number } | null {
  if (!isoStr) return null;

  // Fast-path for standard ISO strings: YYYY-MM-DDTHH:mm...
  const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) {
    const dayOfMonth = Number(m[3]);
    const hour = Number(m[4]) + Number(m[5]) / 60;
    if (!Number.isFinite(dayOfMonth) || !Number.isFinite(hour)) return null;
    return { dayOfMonth, hour };
  }

  // Fallback: attempt Date parse (less reliable for positioning)
  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return null;
    return {
      dayOfMonth: date.getDate(),
      hour: date.getHours() + date.getMinutes() / 60,
    };
  } catch {
    return null;
  }
}
