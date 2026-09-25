/**
 * Fatigue calculation utilities.
 *
 * Provides:
 * - FHA (Fatigue Hazard Area) — time spent above the low-risk KSS boundary
 * - KSS helpers (the 20–100 index is a linear re-expression of predicted KSS)
 * - S/C decomposition of predicted KSS (Three Process Model, Ingre et al. 2014)
 *
 * Retired (not supported by the aerowake-4.0-kss model): Samn-Perelli and
 * reaction-time converters derived from the index. There is no validated
 * mapping from predicted KSS to either, so the UI shows KSS only.
 */

import {
  classifyKss,
  indexToKss,
  kssLabel,
  kssToIndex,
  resolveKss,
  resolveThresholds,
  type RiskThresholds,
} from '@/lib/risk-scale';

// ---------------------------------------------------------------------------
// FHA — Fatigue Hazard Area
// ---------------------------------------------------------------------------

/** Resolution of the timeline data in minutes. */
const TIMELINE_RESOLUTION_MIN = 5;

interface TimelineDataPoint {
  performance: number;
  kss?: number;
  is_in_rest?: boolean;
}

/**
 * Calculate the Fatigue Hazard Area (FHA) in KSS-hours.
 *
 * FHA = Σ max(0, KSS(t) − KSS_low) × Δt
 *
 * where KSS_low is the upper boundary of the low-risk band (KSS 5.5 by
 * default, i.e. index 55; taken from the duty's risk thresholds when given).
 * Rest (bunk) samples are excluded. Higher values indicate greater
 * cumulative exposure to predicted sleepiness.
 *
 * Concept: Dawson & McCulloch (2005) fatigue hazard area.
 *
 * @returns FHA in KSS-hours, rounded to 0.1.
 */
export function calculateFHA(
  points: TimelineDataPoint[],
  thresholds?: RiskThresholds | null,
  resolutionMin: number = TIMELINE_RESOLUTION_MIN,
): number {
  if (!points || points.length === 0) return 0;
  const kssLimit = indexToKss(resolveThresholds(thresholds).low[0]);

  let fha = 0;
  for (const p of points) {
    if (p.is_in_rest) continue;
    const kss = resolveKss(p.kss, p.performance);
    if (kss == null) continue;
    fha += Math.max(0, kss - kssLimit) * resolutionMin;
  }
  return Math.round((fha / 60) * 10) / 10;
}

/**
 * Classify FHA severity for display (KSS-hours above the low-risk band).
 *
 *   ≤ 0.5 KSS-h → Low      (brief or marginal excursions)
 *   ≤ 2   KSS-h → Moderate (e.g. ~2 h one KSS point into the moderate band)
 *   > 2   KSS-h → High
 */
export function getFHASeverity(fha: number): {
  label: string;
  variant: 'success' | 'warning' | 'critical';
} {
  if (fha <= 0.5) return { label: 'Low', variant: 'success' };
  if (fha <= 2) return { label: 'Moderate', variant: 'warning' };
  return { label: 'High', variant: 'critical' };
}

// ---------------------------------------------------------------------------
// KSS
// ---------------------------------------------------------------------------

/**
 * Convert the 20–100 index to predicted KSS (1–9).
 *
 * Exact inverse of the backend mapping index = 110 − 10·KSS
 * (aerowake-4.0-kss). Prefer the backend `kss` field when available.
 */
export function performanceToKSS(performance: number): number {
  return indexToKss(performance);
}

/**
 * KSS verbal anchor and a display variant based on the risk bands
 * (low → success, moderate → warning, high and above → critical).
 */
export function getKSSLabel(kss: number): {
  label: string;
  variant: 'success' | 'warning' | 'critical';
} {
  const level = classifyKss(kss);
  const variant = level === 'low' ? 'success' : level === 'moderate' ? 'warning' : 'critical';
  return { label: kssLabel(kss), variant };
}

// ---------------------------------------------------------------------------
// Decomposition of predicted KSS
// ---------------------------------------------------------------------------

/*
 * Three Process Model (Ingre et al. 2014, model 5c):
 *   KSS = 9.68 − 0.46 · (S + C + U)
 * The API reports S and C normalised to 0–1:
 *   sleep_pressure = (HA − S) / (HA − LA),  HA = 14.3, LA = 2.4
 *   circadian      = (C + 2.5) / 5           (1 = circadian peak)
 * so the KSS added by each process, relative to a fully rested pilot at the
 * circadian peak, is exactly:
 *   ΔKSS_S = 0.46 · 11.9 · sleep_pressure
 *   ΔKSS_C = 0.46 · 5.0  · (1 − circadian)
 * The remainder is the small ultradian term (0–0.46 KSS) plus clamping.
 */
const KSS_SLOPE = 0.46;
const S_RANGE = 14.3 - 2.4;
const C_RANGE = 2 * 2.5;
/** Predicted KSS when fully rested (S = HA) at the circadian peak (C = +2.5), U = 0. */
export const REFERENCE_KSS = 9.68 - KSS_SLOPE * (14.3 + 2.5);

export interface PerformanceDecomposition {
  /** 20–100 index (= 110 − 10·KSS). */
  performance: number;
  /** Predicted KSS (group-average pilot). */
  kss: number;
  /** Predicted KSS for the 90th-percentile pilot, when provided by the backend. */
  kss90?: number;
  /** P(KSS ≥ 7), 0–1, when provided by the backend. */
  pSevere?: number;
  /** Normalised homeostatic sleep pressure (0 = rested, 1 = depleted). */
  sleepPressure: number;
  /** Normalised circadian phase (1 = circadian peak, 0 = trough). */
  circadian: number;
  /** Hours on duty when this point was sampled. */
  hoursOnDuty: number;
  /** Continuous hours awake, when provided by the backend. */
  hoursAwake?: number;
  /** Reference KSS (rested, circadian peak). */
  referenceKss: number;
  /** KSS points added by sleep pressure (Process S). */
  sKss: number;
  /** KSS points added by circadian phase (Process C). */
  cKss: number;
  /** Remainder (ultradian process U, clamping). */
  otherKss: number;
  /** The larger of the two drivers. */
  dominantFactor: 'sleep_pressure' | 'circadian';
}

/**
 * Decompose a timeline point's predicted KSS into the sleep-pressure and
 * circadian contributions of the Three Process Model.
 */
export function decomposePerformance(point: {
  performance: number;
  sleep_pressure: number;
  circadian: number;
  hours_on_duty: number;
  kss?: number;
  kss_90?: number;
  p_severe_sleepiness?: number;
  hours_awake?: number;
}): PerformanceDecomposition {
  const pressure = Math.max(0, Math.min(1, point.sleep_pressure ?? 0));
  const circ = Math.max(0, Math.min(1, point.circadian ?? 1));
  const kss = resolveKss(point.kss, point.performance) ?? indexToKss(point.performance);
  const sKss = KSS_SLOPE * S_RANGE * pressure;
  const cKss = KSS_SLOPE * C_RANGE * (1 - circ);
  const otherKss = kss - REFERENCE_KSS - sKss - cKss;
  const r = (v: number) => Math.round(v * 10) / 10;

  return {
    performance: point.performance,
    kss: r(kss),
    kss90: point.kss_90,
    pSevere: point.p_severe_sleepiness,
    sleepPressure: pressure,
    circadian: circ,
    hoursOnDuty: point.hours_on_duty,
    hoursAwake: point.hours_awake,
    referenceKss: r(REFERENCE_KSS),
    sKss: r(sKss),
    cKss: r(cKss),
    otherKss: r(otherKss),
    dominantFactor: sKss >= cKss ? 'sleep_pressure' : 'circadian',
  };
}

export const DECOMPOSITION_FACTOR_LABELS: Record<PerformanceDecomposition['dominantFactor'], string> = {
  sleep_pressure: 'Sleep pressure (time awake / prior sleep)',
  circadian: 'Circadian phase (body-clock time)',
};

// ---------------------------------------------------------------------------
// Illustrative simulation (education / landing charts)
// ---------------------------------------------------------------------------

export interface SimulatedPoint {
  hoursAwake: number;
  clockHour: number;
  s: number;
  c: number;
  u: number;
  kss: number;
  /** 20–100 index (= 110 − 10·KSS). */
  index: number;
}

/**
 * Predicted KSS across a day for a pilot who woke at `wakeHour` after a full
 * night's sleep, using the Three Process Model (Ingre et al. 2014, model 5c,
 * default phase, home time zone). For illustration only — the backend
 * computes the real duty predictions.
 */
export function simulateRestedDay(wakeHour: number, hours = 20, s0 = 14.0): SimulatedPoint[] {
  const LA = 2.4, D = -0.0353, PHASE = 16.8, CA = 2.5, UA = 0.5, UM = -0.5;
  const out: SimulatedPoint[] = [];
  for (let h = 0; h <= hours; h++) {
    const clockHour = (wakeHour + h) % 24;
    const sVal = LA + (s0 - LA) * Math.exp(D * h);
    const c = CA * Math.cos((2 * Math.PI / 24) * (clockHour - PHASE));
    const u = UM + UA * Math.cos((2 * Math.PI / 12) * (clockHour - PHASE - 3));
    const kss = Math.max(1, Math.min(9, 9.68 - KSS_SLOPE * (sVal + c + u)));
    out.push({ hoursAwake: h, clockHour, s: sVal, c, u, kss, index: kssToIndex(kss) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Roster-Level Aggregation
// ---------------------------------------------------------------------------

import type { DutyAnalysis } from '@/types/fatigue';

/**
 * Find the worst (highest) predicted KSS across all duties in a roster.
 * Uses the backend `maxKss` when present, otherwise derives it from the index.
 */
export function calculateRosterWorstKSS(duties: DutyAnalysis[]): number {
  let worst = 1;
  for (const duty of duties) {
    const kss = resolveKss(duty.maxKss, duty.minPerformance);
    if (kss != null && kss > worst) worst = kss;
  }
  return worst;
}
