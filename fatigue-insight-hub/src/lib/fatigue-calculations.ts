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
  // API value semantics (from backend api_server.py):
  //   sleep_pressure (S): 0-1, higher = MORE pressure = WORSE (deficit form)
  //   circadian (C):      0-1, higher = MORE alertness = BETTER (alertness form)
  //   sleep_inertia (W):  0-1, 1.0 = no inertia, <1 = grogginess (alertness form)
  //   time_on_task (ToT): 0-1, 1.0 = no penalty, <1 = fatigued (alertness form)
  //
  // Convert all to deficit form (higher = worse) before proportional attribution.
  const S_deficit = point.sleep_pressure;            // already deficit form
  const C_deficit = 1 - point.circadian;             // invert: low alertness → high deficit
  const W_deficit = 1 - point.sleep_inertia;         // invert: 1.0 (no inertia) → 0 deficit
  const ToT_deficit = 1 - point.time_on_task_penalty; // invert: 1.0 (no penalty) → 0 deficit

  // Total performance deficit from 100%
  const totalDeficit = Math.max(0, 100 - point.performance);

  // Distribute deficit proportionally across factors
  const rawTotal = S_deficit + C_deficit + W_deficit + ToT_deficit;

  let sContrib = 0, cContrib = 0, wContrib = 0, totContrib = 0;

  if (rawTotal > 0 && totalDeficit > 0) {
    sContrib = (S_deficit / rawTotal) * totalDeficit;
    cContrib = (C_deficit / rawTotal) * totalDeficit;
    wContrib = (W_deficit / rawTotal) * totalDeficit;
    totContrib = (ToT_deficit / rawTotal) * totalDeficit;
  }

  return {
    performance: point.performance,
    sleepPressure: point.sleep_pressure,
    circadian: point.circadian,
    sleepInertia: point.sleep_inertia,
    timeOnTaskPenalty: point.time_on_task_penalty,
    hoursOnDuty: point.hours_on_duty,
    sContribution: Math.round(sContrib * 10) / 10,
    cContribution: Math.round(cContrib * 10) / 10,
    wContribution: Math.round(wContrib * 10) / 10,
    totContribution: Math.round(totContrib * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Roster-Level Aggregation
// ---------------------------------------------------------------------------

import type { DutyAnalysis } from '@/types/fatigue';

/**
 * Sum per-duty FHA values across all duties in a roster.
 *
 * Each duty's FHA is computed from its own timeline points.
 * Total FHA gives a single monthly cumulative fatigue exposure metric.
 */
export function calculateRosterFHA(duties: DutyAnalysis[]): number {
  let total = 0;
  for (const duty of duties) {
    if (!duty.timelinePoints || duty.timelinePoints.length === 0) continue;
    const validPoints = duty.timelinePoints.filter(pt => pt.performance != null);
    if (validPoints.length === 0) continue;
    total += calculateFHA(validPoints.map(pt => ({ performance: pt.performance ?? 0 })));
  }
  return total;
}

/**
 * Find the worst (highest) KSS across all duties in a roster.
 *
 * Returns the KSS value at the worst performance point of any duty.
 */
export function calculateRosterWorstKSS(duties: DutyAnalysis[]): number {
  let worstPerf = 100;
  for (const duty of duties) {
    const minPerf = duty.minPerformance ?? 100;
    if (minPerf < worstPerf) worstPerf = minPerf;
  }
  return performanceToKSS(worstPerf);
}

/**
 * Compute per-duty FHA values for sparkline display.
 * Returns array sorted chronologically (same order as input duties).
 */
export function computePerDutyFHA(duties: DutyAnalysis[]): number[] {
  return duties.map(duty => {
    if (!duty.timelinePoints || duty.timelinePoints.length === 0) return 0;
    const validPoints = duty.timelinePoints.filter(pt => pt.performance != null);
    if (validPoints.length === 0) return 0;
    return calculateFHA(validPoints.map(pt => ({ performance: pt.performance ?? 0 })));
  });
}
