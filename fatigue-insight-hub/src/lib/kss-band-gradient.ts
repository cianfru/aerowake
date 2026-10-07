import { createContext } from 'react';
import { classifyKss, riskCssColor, type RiskLevel } from '@/lib/risk-scale';
import type { AlertnessSample } from '@/types/fatigue';

/** The month's predicted KSS samples, for colouring duty bars as the prediction changes. */
export const AlertnessSamplesContext = createContext<AlertnessSample[]>([]);

export interface BandRun {
  level: RiskLevel;
  /** Fractions of the span, 0–1. */
  from: number;
  to: number;
}

/**
 * Split [startMs, endMs] into runs of one KSS band, from the model's own
 * samples (awake, on duty). A band changes halfway between two samples in
 * different bands; the ends take the nearest sample. Null when the span has
 * no samples (older analyses), so callers keep the solid sector colour.
 */
export function bandRuns(samples: AlertnessSample[], startMs: number, endMs: number): BandRun[] | null {
  if (!(endMs > startMs)) return null;
  const pts = samples
    .filter((s) => s.kss != null && !s.asleep && s.t >= startMs && s.t <= endMs)
    .sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  const span = endMs - startMs;
  const runs: BandRun[] = [];
  let level = classifyKss(pts[0].kss!);
  let from = 0;
  for (let i = 1; i < pts.length; i++) {
    const next = classifyKss(pts[i].kss!);
    if (next !== level) {
      const at = ((pts[i - 1].t + pts[i].t) / 2 - startMs) / span;
      runs.push({ level, from, to: at });
      level = next;
      from = at;
    }
  }
  runs.push({ level, from, to: 1 });
  return runs;
}

/** Hard-stop gradient for the runs (no blending: every colour is a real band). */
export function bandGradient(runs: BandRun[]): string {
  if (runs.length === 1) return riskCssColor(runs[0].level);
  const stops = runs.map((r) => `${riskCssColor(r.level)} ${(r.from * 100).toFixed(2)}% ${(r.to * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** The band at a point of the span (e.g. where a label sits). */
export function bandAt(runs: BandRun[], fraction: number): RiskLevel {
  return (runs.find((r) => fraction >= r.from && fraction <= r.to) ?? runs[runs.length - 1]).level;
}
