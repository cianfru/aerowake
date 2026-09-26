/**
 * Single source of truth for the alertness scale and risk bands
 * (backend engine `aerowake-4.0-kss`, see fatigue-tool/core/alertness.py).
 *
 * The 20–100 `performance` index returned by the API is a direct linear
 * re-expression of predicted KSS (Karolinska Sleepiness Scale, 1–9) from the
 * Three Process Model as validated on airline crew (Ingre et al. 2014,
 * PLoS ONE 9(10): e108679):
 *
 *     index = 110 − 10·KSS    ⇔    KSS = (110 − index) / 10
 *     (KSS 1 → 100, KSS 5 → 60, KSS 9 → 20)
 *
 * Risk bands (lower bound inclusive) on the index / KSS:
 *     low       ≥ 55   (KSS < 5.5)
 *     moderate  45–55  (KSS 5.5–6.5)
 *     high      35–45  (KSS 6.5–7.5)
 *     critical  25–35  (KSS 7.5–8.5)
 *     extreme   < 25   (KSS ≥ 8.5)
 *
 * The index is NOT a percentage, NOT a measure of cognitive capacity and NOT
 * alcohol-equivalent. It is a group-average sleepiness prediction.
 *
 * Every component that colours, classifies or labels a score must use these
 * helpers so the whole UI agrees with the backend.
 */

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'extreme' | 'unknown';
export type RiskLevelUpper = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EXTREME' | 'UNKNOWN';

/** Backend-shaped thresholds: level → [lowerInclusive, upperExclusive] on the index. */
export type RiskThresholds = Record<string, [number, number]>;

export const INDEX_MIN = 20;
export const INDEX_MAX = 100;
/** Chart y-axis domain for the index. */
export const INDEX_DOMAIN: [number, number] = [INDEX_MIN, INDEX_MAX];

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  low: [55, 100],
  moderate: [45, 55],
  high: [35, 45],
  critical: [25, 35],
  extreme: [0, 25],
};

/** Index-axis ticks that fall on whole KSS values (KSS 9, 7, 5, 3, 1). */
export const INDEX_AXIS_TICKS = [20, 40, 60, 80, 100];
/** Tick formatter for an index axis that shows the equivalent KSS. */
export const indexTickAsKss = (v: number): string => `${Math.round((110 - v) / 10)}`;

/** KSS boundaries between bands (upper bound exclusive). */
export const KSS_BAND_BOUNDARIES = [5.5, 6.5, 7.5, 8.5] as const;
/** The same boundaries on the index (55 / 45 / 35 / 25). */
export const INDEX_BAND_BOUNDARIES = [55, 45, 35, 25] as const;

/** KSS verbal anchors (Åkerstedt & Gillberg 1990). */
export const KSS_LABELS: Record<number, string> = {
  1: 'Extremely alert',
  2: 'Very alert',
  3: 'Alert',
  4: 'Rather alert',
  5: 'Neither alert nor sleepy',
  6: 'Some signs of sleepiness',
  7: 'Sleepy, no effort to stay awake',
  8: 'Sleepy, some effort to stay awake',
  9: 'Very sleepy, fighting sleep',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
  extreme: 'Extreme',
  unknown: 'Unknown',
};

/** Short KSS range description of each band. */
export const RISK_LEVEL_KSS_RANGE: Record<RiskLevel, string> = {
  low: 'KSS < 5.5',
  moderate: 'KSS 5.5–6.5',
  high: 'KSS 6.5–7.5',
  critical: 'KSS 7.5–8.5',
  extreme: 'KSS ≥ 8.5',
  unknown: '—',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Convert the 20–100 index to predicted KSS (1–9). */
export function indexToKss(index: number): number {
  return clamp((110 - index) / 10, 1, 9);
}

/** Convert predicted KSS (1–9) to the 20–100 index. */
export function kssToIndex(kss: number): number {
  return clamp(110 - 10 * kss, INDEX_MIN, INDEX_MAX);
}

/** Prefer a backend-provided KSS, otherwise derive it from the index. */
export function resolveKss(kss: number | null | undefined, index: number | null | undefined): number | null {
  if (typeof kss === 'number' && Number.isFinite(kss)) return kss;
  if (typeof index === 'number' && Number.isFinite(index)) return indexToKss(index);
  return null;
}

/** Verbal KSS anchor for a (possibly fractional) KSS value. */
export function kssLabel(kss: number): string {
  if (!Number.isFinite(kss)) return 'Unknown';
  const k = clamp(Math.round(kss), 1, 9);
  return KSS_LABELS[k];
}

/** "KSS 6.2" */
export function formatKss(kss: number | null | undefined, digits = 1): string {
  if (kss == null || !Number.isFinite(kss)) return 'KSS —';
  return `KSS ${kss.toFixed(digits)}`;
}

/** "KSS 6.2 · Some signs of sleepiness" */
export function formatKssWithLabel(kss: number | null | undefined): string {
  if (kss == null || !Number.isFinite(kss)) return 'KSS —';
  return `${formatKss(kss)} · ${kssLabel(kss)}`;
}

/** Use backend thresholds when they carry the expected bands, else defaults. */
export function resolveThresholds(thresholds?: RiskThresholds | null): RiskThresholds {
  if (
    thresholds &&
    ['low', 'moderate', 'high', 'critical'].every(
      (k) => Array.isArray(thresholds[k]) && Number.isFinite(thresholds[k][0]),
    )
  ) {
    return thresholds;
  }
  return DEFAULT_RISK_THRESHOLDS;
}

/** Lower bounds of low / moderate / high / critical for the given thresholds. */
export function bandBoundaries(thresholds?: RiskThresholds | null): number[] {
  const t = resolveThresholds(thresholds);
  return [t.low[0], t.moderate[0], t.high[0], t.critical[0]];
}

/** Classify a 20–100 index into a risk band (mirrors backend RiskThresholds.classify). */
export function classifyPerformance(
  index: number | null | undefined,
  thresholds?: RiskThresholds | null,
): RiskLevel {
  if (index == null || !Number.isFinite(index)) return 'unknown';
  const t = resolveThresholds(thresholds);
  if (index >= t.low[0]) return 'low';
  if (index >= t.moderate[0]) return 'moderate';
  if (index >= t.high[0]) return 'high';
  if (index >= t.critical[0]) return 'critical';
  return 'extreme';
}

/** Classify predicted KSS using the default KSS bands. */
export function classifyKss(kss: number | null | undefined): RiskLevel {
  if (kss == null || !Number.isFinite(kss)) return 'unknown';
  if (kss < 5.5) return 'low';
  if (kss < 6.5) return 'moderate';
  if (kss < 7.5) return 'high';
  if (kss < 8.5) return 'critical';
  return 'extreme';
}

/** Normalise any risk string ('HIGH', 'high', undefined) to a RiskLevel. */
export function normalizeRiskLevel(level: string | null | undefined): RiskLevel {
  const l = (level ?? '').toLowerCase();
  return l === 'low' || l === 'moderate' || l === 'high' || l === 'critical' || l === 'extreme'
    ? l
    : 'unknown';
}

export function toUpperRisk(level: string | null | undefined): RiskLevelUpper {
  return normalizeRiskLevel(level).toUpperCase() as RiskLevelUpper;
}

/** True for high, critical and extreme. */
export function isElevatedRisk(level: RiskLevel): boolean {
  return level === 'high' || level === 'critical' || level === 'extreme';
}

/** True for critical and extreme. */
export function isSevereRisk(level: RiskLevel): boolean {
  return level === 'critical' || level === 'extreme';
}

export interface RiskClasses {
  text: string;
  bg: string;
  border: string;
  /** Solid fill (e.g. progress bars, dots). */
  fill: string;
}

const RISK_CLASSES: Record<RiskLevel, RiskClasses> = {
  // Low risk carries no signal colour: neutral ink keeps attention on real risk.
  low: { text: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border', fill: 'bg-muted-foreground/45' },
  moderate: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', fill: 'bg-warning' },
  high: { text: 'text-high', bg: 'bg-high/10', border: 'border-high/30', fill: 'bg-high' },
  critical: { text: 'text-critical', bg: 'bg-critical/10', border: 'border-critical/30', fill: 'bg-critical' },
  // Extreme shares the critical hue (validated separation limit); its label distinguishes it.
  extreme: { text: 'text-critical', bg: 'bg-critical/15', border: 'border-critical/60', fill: 'bg-critical' },
  unknown: { text: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border', fill: 'bg-muted-foreground' },
};

/** Tailwind classes (design tokens) for a risk level. */
export function riskClasses(level: RiskLevel): RiskClasses {
  return RISK_CLASSES[level] ?? RISK_CLASSES.unknown;
}

/** Tailwind text colour class for a risk level. */
export function riskColorClass(level: RiskLevel): string {
  return riskClasses(level).text;
}

/** Tailwind text colour class for an index value. */
export function performanceColorClass(index: number | null | undefined, thresholds?: RiskThresholds | null): string {
  return riskColorClass(classifyPerformance(index, thresholds));
}

export type RiskBadgeVariant = 'success' | 'warning' | 'high' | 'critical' | 'destructive' | 'outline';

/** shadcn Badge variant for a risk level (extreme = solid destructive). */
export function riskBadgeVariant(level: RiskLevel): RiskBadgeVariant {
  switch (level) {
    case 'low': return 'outline';
    case 'moderate': return 'warning';
    case 'high': return 'high';
    case 'critical': return 'critical';
    case 'extreme': return 'destructive';
    default: return 'outline';
  }
}

/** CSS colour using theme variables (for SVG/Recharts inside the themed app). */
const RISK_CSS: Record<RiskLevel, string> = {
  low: 'hsl(var(--muted-foreground) / 0.55)',
  moderate: 'hsl(var(--warning))',
  high: 'hsl(var(--high))',
  critical: 'hsl(var(--critical))',
  extreme: 'hsl(var(--critical))',
  unknown: 'hsl(var(--muted-foreground))',
};

export function riskCssColor(level: RiskLevel): string {
  return RISK_CSS[level] ?? RISK_CSS.unknown;
}

/** Static hex colours matching the design tokens (for canvas/PDF/Mapbox). */
const RISK_HEX: Record<RiskLevel, string> = {
  // Validated with the dataviz palette checker on the dark surface.
  low: '#8e8e98',
  moderate: '#f6c453',
  high: '#ee7d33',
  critical: '#e23a67',
  extreme: '#e23a67',
  unknown: '#71717a',
};

export function riskHex(level: RiskLevel): string {
  return RISK_HEX[level] ?? RISK_HEX.unknown;
}

/** Hex colour for an index value. */
export function performanceHex(index: number | null | undefined, thresholds?: RiskThresholds | null): string {
  return riskHex(classifyPerformance(index, thresholds));
}

/** Theme-aware CSS colour for an index value. */
export function performanceCssColor(index: number | null | undefined, thresholds?: RiskThresholds | null): string {
  return riskCssColor(classifyPerformance(index, thresholds));
}

/**
 * Reference lines for charts on the index axis: one per band boundary,
 * labelled with the KSS value it corresponds to.
 */
export function riskReferenceLines(thresholds?: RiskThresholds | null): Array<{
  value: number;
  kss: number;
  label: string;
  level: RiskLevel;
  color: string;
}> {
  const t = resolveThresholds(thresholds);
  const rows: Array<[number, RiskLevel]> = [
    [t.low[0], 'moderate'],
    [t.moderate[0], 'high'],
    [t.high[0], 'critical'],
    [t.critical[0], 'extreme'],
  ];
  return rows.map(([value, level]) => {
    const kss = indexToKss(value);
    return { value, kss, label: `KSS ${kss.toFixed(1)}`, level, color: riskCssColor(level) };
  });
}

/** Deficit bands of the backend 7-day sleep ledger. */
export type SleepDeficitBand = 'none' | 'mild' | 'moderate' | 'severe';

export const SLEEP_DEFICIT_LABELS: Record<SleepDeficitBand, string> = {
  none: 'None',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

export function sleepDeficitClass(band: SleepDeficitBand | string | undefined): string {
  switch (band) {
    case 'mild': return 'text-warning';
    case 'moderate': return 'text-high';
    case 'severe': return 'text-critical';
    case 'none': return 'text-success';
    default: return 'text-muted-foreground';
  }
}
