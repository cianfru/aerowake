/**
 * Unified bar types for all 3 grid-based chronogram timelines.
 *
 * HomeBase, UTC, and HPT (Elapsed) views all share these types.
 * Each view provides a thin "transform" function that converts
 * DutyAnalysis[] → TimelineData using these types.
 *
 * ContinuousPerformanceTimeline (SAFTE view) is a Recharts chart
 * with a fundamentally different architecture and does NOT use these types.
 */

import type { DutyAnalysis, FlightPhase, SleepQualityFactors, SleepReference } from '@/types/fatigue';

// ---------------------------------------------------------------------------
// Flight segment within a duty bar
// ---------------------------------------------------------------------------

export interface TimelineSegment {
  type: 'checkin' | 'flight' | 'ground' | 'postflight' | 'training';
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  startHour: number;
  endHour: number;
  /** Percentage of the parent duty bar (used in elapsed view) */
  widthPercent?: number;
  performance: number;
  activityCode?: string | null;
  isDeadhead?: boolean;
  /** Flight phase breakdown (visible when zoomed in ≥ 2x) */
  phases?: {
    phase: FlightPhase;
    performance: number;
    widthPercent: number;
  }[];
}

// ---------------------------------------------------------------------------
// Duty bar (one per visible day-slice of a duty)
// ---------------------------------------------------------------------------

export interface TimelineDutyBar {
  /** Row index: day-of-month (1-31) for homebase/utc, 0-based row for elapsed */
  rowIndex: number;
  startHour: number; // 0-24 within the row
  endHour: number;   // 0-24 within the row
  duty: DutyAnalysis;
  isOvernightStart?: boolean;
  isOvernightContinuation?: boolean;
  segments: TimelineSegment[];
}

// ---------------------------------------------------------------------------
// Sleep bar
// ---------------------------------------------------------------------------

export interface TimelineSleepBar {
  rowIndex: number;
  startHour: number;
  endHour: number;
  recoveryScore: number;
  effectiveSleep: number;
  sleepEfficiency: number;
  sleepStrategy: string;
  isPreDuty: boolean;
  relatedDuty: DutyAnalysis;
  isOvernightStart?: boolean;
  isOvernightContinuation?: boolean;
  /** Original full sleep window hours (for display in popover) */
  originalStartHour?: number;
  originalEndHour?: number;
  /** Zulu (UTC) times for display */
  sleepStartZulu?: string;
  sleepEndZulu?: string;
  /** Quality factor data from backend */
  qualityFactors?: SleepQualityFactors;
  explanation?: string;
  confidenceBasis?: string;
  confidence?: number;
  references?: SleepReference[];
  woclOverlapHours?: number;
  /** Duty ID of the related duty — used for sleep edit tracking */
  sleepId?: string;
  /** ISO start timestamp in UTC — for what-if sleep modifications */
  sleepStartIso?: string;
  /** ISO end timestamp in UTC — for what-if sleep modifications */
  sleepEndIso?: string;
  /** Unique key per sleep block: "${dutyId}::${blockIndex}" — used as pendingEdits Map key */
  blockKey?: string;
}

// ---------------------------------------------------------------------------
// In-flight rest bar
// ---------------------------------------------------------------------------

export interface TimelineIRBar {
  rowIndex: number;
  startHour: number;
  endHour: number;
  durationHours: number;
  effectiveSleepHours: number;
  isDuringWocl: boolean;
  crewSet: string | null;
  relatedDuty: DutyAnalysis;
}

// ---------------------------------------------------------------------------
// FDP limit marker (vertical dashed line)
// ---------------------------------------------------------------------------

export interface TimelineFdpMarker {
  rowIndex: number;
  hour: number; // Position within the row (0-24)
  maxFdp: number;
  duty: DutyAnalysis;
}

// ---------------------------------------------------------------------------
// WOCL band
// ---------------------------------------------------------------------------

export interface WoclBand {
  /** Row index — -1 means "all rows" (static band) */
  rowIndex: number;
  startHour: number;
  endHour: number;
}

// ---------------------------------------------------------------------------
// WMZ band (Wake Maintenance Zone — ~18:00-21:00 home base time)
// ---------------------------------------------------------------------------

export interface WmzBand {
  /** Row index — -1 means "all rows" (static band) */
  rowIndex: number;
  startHour: number;
  endHour: number;
}

// ---------------------------------------------------------------------------
// Row label (Y-axis)
// ---------------------------------------------------------------------------

export interface RowLabel {
  rowIndex: number;
  /** Display text, e.g. "Thu 15" or "Day 3" */
  label: string;
  /** Date object for this row (if applicable) */
  date?: Date;
  hasDuty: boolean;
  risk?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  warnings: string[];
  /** Circadian shift annotation (HPT only), e.g. "→E +2.5h" */
  circadianAnnotation?: string;
}

// ---------------------------------------------------------------------------
// Unified output from any transform function
// ---------------------------------------------------------------------------

export type TimelineVariant = 'homebase' | 'utc' | 'elapsed';

export interface TimelineData {
  variant: TimelineVariant;
  dutyBars: TimelineDutyBar[];
  sleepBars: TimelineSleepBar[];
  inflightRestBars: TimelineIRBar[];
  fdpMarkers: TimelineFdpMarker[];
  woclBands: WoclBand[];
  /** Wake Maintenance Zone bands (~18:00-21:00 home base, shifted in elapsed view) */
  wmzBands: WmzBand[];
  rowLabels: RowLabel[];
  /** Total number of rows to render */
  totalRows: number;
  /** X-axis label (e.g. "Time of Day (Home Base)") */
  xAxisLabel: string;
}
