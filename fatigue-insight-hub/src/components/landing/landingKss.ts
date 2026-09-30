import { classifyKss, KSS_BAND_BOUNDARIES, type RiskLevel } from '@/lib/risk-scale';

/** One decimal, exactly as displayed, so a value and its band always agree. */
export function roundKss(kss: number): number {
  return Number(kss.toFixed(1));
}

export function formatKssValue(kss: number): string {
  return kss.toFixed(1);
}

/** Band of the displayed (rounded) value; lower bounds are inclusive. */
export function kssBand(kss: number): RiskLevel {
  return classifyKss(roundKss(kss));
}

/** Position of a KSS value on a 1–9 scale as a fraction of its length. */
export function kssFraction(kss: number): number {
  return Math.min(1, Math.max(0, (kss - 1) / 8));
}

/** Band start positions on the 1–9 scale (5.5, 6.5, 7.5, 8.5). */
export const BAND_TICKS = KSS_BAND_BOUNDARIES.map((kss) => ({ kss, at: kssFraction(kss) }));

/** Label ink for text set inside a band fill: dark on the light fills, white on the deep ones. */
export function inkOnBandFill(level: RiskLevel): string {
  return level === 'low' || level === 'moderate' || level === 'unknown' ? 'text-[#0f2233]' : 'text-[#fcfdfe]';
}
