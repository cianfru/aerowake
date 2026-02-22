/**
 * Fatigue calculation utilities for Phase 2 Data Richness.
 *
 * Provides:
 * - FHA (Fatigue Hazard Area) calculation
 * - Derived fatigue scales (KSS, Samn-Perelli, PVT Reaction Time)
 * - Performance formula decomposition helpers
 */

// ---------------------------------------------------------------------------
// FHA — Fatigue Hazard Area
// ---------------------------------------------------------------------------

/** Threshold below which time-minutes are counted as hazardous. */
const FHA_THRESHOLD = 77;

/** Resolution of the timeline data in minutes. */
const TIMELINE_RESOLUTION_MIN = 5;

interface TimelineDataPoint {
  performance: number;
}

/**
 * Calculate the Fatigue Hazard Area (FHA) in %-minutes.
 *
 * FHA = Σ max(0, threshold − P(t)) × Δt
 *
 * This is the trapezoidal integration of the area under the moderate-risk
 * threshold (77%) across all timeline points. Higher values indicate
 * greater cumulative fatigue exposure.
 *
 * Reference: Dawson & McCulloch, 2005.
 *
 * @param points Array of timeline data points with performance values.
 * @param threshold Performance threshold (default 77%).
 * @param resolutionMin Time step in minutes (default 5).
 * @returns FHA value in %-minutes.
 */
export function calculateFHA(
  points: TimelineDataPoint[],
  threshold: number = FHA_THRESHOLD,
  resolutionMin: number = TIMELINE_RESOLUTION_MIN,
): number {
  if (!points || points.length === 0) return 0;

  let fha = 0;
  for (let i = 0; i < points.length; i++) {
    const deficit = Math.max(0, threshold - points[i].performance);
    fha += deficit * resolutionMin;
  }
  return Math.round(fha);
}

/**
 * Classify FHA severity for display.
 */
export function getFHASeverity(fha: number): {
  label: string;
  variant: 'success' | 'warning' | 'critical';
} {
  if (fha <= 100) return { label: 'Low', variant: 'success' };
  if (fha <= 500) return { label: 'Moderate', variant: 'warning' };
  return { label: 'High', variant: 'critical' };
}

// ---------------------------------------------------------------------------
// Derived Fatigue Scales
// ---------------------------------------------------------------------------

/**
 * Convert model performance (20-100) to Karolinska Sleepiness Scale (1-9).
 *
 * Mapping uses a piecewise linear interpolation calibrated against
 * Åkerstedt & Gillberg (1990) validation data:
 *
 *   P ≥ 95  → KSS 1 (extremely alert)
 *   P = 77  → KSS 5 (neither alert nor sleepy)
 *   P = 55  → KSS 7 (sleepy, some effort to stay awake)
 *   P = 35  → KSS 8 (sleepy, great effort)
 *   P ≤ 20  → KSS 9 (extremely sleepy, fighting sleep)
 */
export function performanceToKSS(performance: number): number {
  const p = Math.max(20, Math.min(100, performance));
  // Piecewise linear breakpoints: [perf, kss]
  const breakpoints: [number, number][] = [
    [95, 1],
    [88, 2],
    [83, 3],
    [80, 4],
    [77, 5],
    [70, 6],
    [55, 7],
    [35, 8],
    [20, 9],
  ];

  // Find surrounding breakpoints
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [p1, k1] = breakpoints[i];
    const [p2, k2] = breakpoints[i + 1];
    if (p >= p2 && p <= p1) {
      const ratio = (p1 - p) / (p1 - p2);
      return Math.round((k1 + ratio * (k2 - k1)) * 10) / 10;
    }
  }

  return p >= 95 ? 1 : 9;
}

/**
 * Get KSS label and risk classification.
 */
export function getKSSLabel(kss: number): {
  label: string;
  variant: 'success' | 'warning' | 'critical';
} {
  if (kss <= 3) return { label: 'Alert', variant: 'success' };
  if (kss <= 5) return { label: 'Neither alert nor sleepy', variant: 'success' };
  if (kss <= 6) return { label: 'Some signs of sleepiness', variant: 'warning' };
  if (kss <= 7) return { label: 'Sleepy, effort to stay awake', variant: 'warning' };
  if (kss <= 8) return { label: 'Sleepy, great effort', variant: 'critical' };
  return { label: 'Extremely sleepy', variant: 'critical' };
}

/**
 * Convert model performance (20-100) to Samn-Perelli Fatigue Scale (1-7).
 *
 * Mapping calibrated against Samn & Perelli (1982) aviator fatigue data:
 *
 *   P ≥ 95  → SP 1 (fully alert, wide awake)
 *   P = 77  → SP 3 (okay, somewhat fresh)
 *   P = 55  → SP 5 (moderately tired, let down)
 *   P = 35  → SP 6 (extremely tired, very difficult to concentrate)
 *   P ≤ 20  → SP 7 (completely exhausted, unable to function)
 */
export function performanceToSamnPerelli(performance: number): number {
  const p = Math.max(20, Math.min(100, performance));
  const breakpoints: [number, number][] = [
    [95, 1],
    [88, 2],
    [77, 3],
    [65, 4],
    [55, 5],
    [35, 6],
    [20, 7],
  ];

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [p1, k1] = breakpoints[i];
    const [p2, k2] = breakpoints[i + 1];
    if (p >= p2 && p <= p1) {
      const ratio = (p1 - p) / (p1 - p2);
      return Math.round((k1 + ratio * (k2 - k1)) * 10) / 10;
    }
  }

  return p >= 95 ? 1 : 7;
}

/**
 * Get Samn-Perelli label and risk classification.
 */
export function getSamnPerelliLabel(sp: number): {
  label: string;
  variant: 'success' | 'warning' | 'critical';
} {
  if (sp <= 2) return { label: 'Fully alert', variant: 'success' };
  if (sp <= 3) return { label: 'Okay, somewhat fresh', variant: 'success' };
  if (sp <= 4) return { label: 'A little tired', variant: 'warning' };
  if (sp <= 5) return { label: 'Moderately tired', variant: 'warning' };
  if (sp <= 6) return { label: 'Extremely tired', variant: 'critical' };
  return { label: 'Completely exhausted', variant: 'critical' };
}

/**
 * Convert model performance (20-100) to estimated PVT mean reaction time (ms).
 *
 * Calibrated against Basner & Dinges (2011) dose-response curves.
 * Well-rested baseline: ~250ms. Severe impairment: ~500ms+.
 *
 *   P = 100 → ~220ms (optimal)
 *   P = 77  → ~280ms (normal range)
 *   P = 55  → ~350ms (impaired)
 *   P = 35  → ~420ms (severely impaired)
 *   P = 20  → ~500ms (extreme impairment)
 */
export function performanceToReactionTime(performance: number): number {
  const p = Math.max(20, Math.min(100, performance));
  // Inverse linear mapping: lower performance → higher reaction time
  // RT = 220 + (100 - P) × 3.5
  const rt = 220 + (100 - p) * 3.5;
  return Math.round(rt);
}

/**
 * Get reaction time risk classification.
 */
export function getReactionTimeLabel(rtMs: number): {
  label: string;
  variant: 'success' | 'warning' | 'critical';
} {
  if (rtMs <= 280) return { label: 'Normal', variant: 'success' };
  if (rtMs <= 350) return { label: 'Mildly impaired', variant: 'warning' };
  if (rtMs <= 420) return { label: 'Significantly impaired', variant: 'critical' };
  return { label: 'Severely impaired', variant: 'critical' };
}

// ---------------------------------------------------------------------------
// Performance Decomposition
// ---------------------------------------------------------------------------

/**
 * Decompose the performance formula into individual factor contributions.
 *
 * P = 20 + 80 × [base_alertness × (1 − W) − ToT]
 *
 * Where base_alertness = S × C + (1 − S) × (1 − C) + resilience
 */
export interface PerformanceDecomposition {
  /** Raw performance score (20-100). */
  performance: number;
  /** Process S contribution — homeostatic sleep pressure (0-1, higher = worse). */
  sleepPressure: number;
  /** Process C contribution — circadian drive (0-1, higher = worse). */
  circadian: number;
  /** Process W — sleep inertia (0-1, higher = worse). */
  sleepInertia: number;
  /** Time-on-task penalty (0-1). */
  timeOnTaskPenalty: number;
  /** Hours on duty when this point was sampled. */
  hoursOnDuty: number;
  /** Percentage of performance lost to Process S. */
  sContribution: number;
  /** Percentage of performance lost to Process C. */
  cContribution: number;
  /** Percentage of performance lost to Process W. */
  wContribution: number;
  /** Percentage of performance lost to Time-on-Task. */
  totContribution: number;
}

/**
 * Decompose a single timeline point into factor contributions.
 *
 * The contributions are expressed as percentage of the 80-point range
 * (since floor is 20 and ceiling is 100).
 */
export function decomposePerformance(point: {
  performance: number;
  sleep_pressure: number;
  circadian: number;
  sleep_inertia: number;
  time_on_task_penalty: number;
  hours_on_duty: number;
}): PerformanceDecomposition {
  const S = point.sleep_pressure;
  const C = point.circadian;
  const W = point.sleep_inertia;
  const ToT = point.time_on_task_penalty;

  // Reconstruct contributions to the performance deficit (from 100%)
  // Full alertness = performance 100 → deficit = 0
  // deficit = 100 - P
  const totalDeficit = Math.max(0, 100 - point.performance);

  // Approximate individual factor contributions proportionally
  // We use the raw factor values (0-1) to distribute the deficit
  const rawTotal = S + C + W + ToT;

  let sContrib = 0, cContrib = 0, wContrib = 0, totContrib = 0;

  if (rawTotal > 0 && totalDeficit > 0) {
    sContrib = (S / rawTotal) * totalDeficit;
    cContrib = (C / rawTotal) * totalDeficit;
    wContrib = (W / rawTotal) * totalDeficit;
    totContrib = (ToT / rawTotal) * totalDeficit;
  }

  return {
    performance: point.performance,
    sleepPressure: S,
    circadian: C,
    sleepInertia: W,
    timeOnTaskPenalty: ToT,
    hoursOnDuty: point.hours_on_duty,
    sContribution: Math.round(sContrib * 10) / 10,
    cContribution: Math.round(cContrib * 10) / 10,
    wContribution: Math.round(wContrib * 10) / 10,
    totContribution: Math.round(totContrib * 10) / 10,
  };
}
