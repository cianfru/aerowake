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
