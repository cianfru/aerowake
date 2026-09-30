/**
 * Route statistics for the route map: directional sectors merged into
 * undirected airport pairs. Pure helpers, kept free of React for tests.
 *
 * Colour basis: when the backend supplies a sector peak (`kssPeak`, the
 * highest model KSS between departure and arrival) it is used; otherwise the
 * whole-duty peak KSS stands in. The map never invents per-sector values.
 */
import type { DutyAnalysis, FlightSegment } from '@/types/fatigue';
import { classifyKss, riskCssColor, type RiskLevel } from '@/lib/risk-scale';
import { dutyPeakKss } from './roster-utils';

export const SEVERITY: RiskLevel[] = ['unknown', 'low', 'moderate', 'high', 'critical', 'extreme'];
export const severityRank = (level: RiskLevel) => Math.max(0, SEVERITY.indexOf(level));

/** Band of a KSS value as displayed (rounded to one decimal), so number and band agree. */
export function routeLevel(kss: number | null): RiskLevel {
  return kss == null ? 'unknown' : classifyKss(Math.round(kss * 10) / 10);
}

export interface RouteDirection {
  key: string;
  from: string;
  to: string;
  sectors: number;
  peakKss: number | null;
  level: RiskLevel;
  /** True when every sector carried its own backend peak. */
  sectorBasis: boolean;
  blockHours: number[];
}

export interface RoutePair {
  /** Sorted codes, e.g. "DOH-NJF". */
  key: string;
  /** The home base when it is an endpoint, otherwise the first code alphabetically. */
  a: string;
  b: string;
  sectors: number;
  peakKss: number | null;
  level: RiskLevel;
  sectorBasis: boolean;
  /** Outbound (a → b) first. */
  directions: RouteDirection[];
}

function segmentPeak(segment: FlightSegment): number | null {
  const value = (segment as FlightSegment & { kssPeak?: unknown }).kssPeak;
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 9 ? value : null;
}

export const pairKey = (x: string, y: string) => [x, y].sort().join('-');

/** Flight sectors (not in-flight rest) merged into airport pairs. */
export function buildRoutePairs(duties: DutyAnalysis[], homeBase = ''): RoutePair[] {
  const directions = new Map<string, RouteDirection>();
  for (const duty of duties) {
    const dutyKss = dutyPeakKss(duty);
    for (const s of duty.flightSegments ?? []) {
      if (!s.departure || !s.arrival || s.departure === s.arrival || s.activityCode === 'IR') continue;
      const key = `${s.departure}-${s.arrival}`;
      const own = segmentPeak(s);
      const kss = own ?? dutyKss;
      const cur = directions.get(key) ?? { key, from: s.departure, to: s.arrival, sectors: 0, peakKss: null, level: 'unknown' as RiskLevel, sectorBasis: true, blockHours: [] };
      cur.sectors += 1;
      cur.sectorBasis = cur.sectorBasis && own != null;
      if (kss != null && (cur.peakKss == null || kss > cur.peakKss)) cur.peakKss = kss;
      if (Number.isFinite(s.blockHours) && s.blockHours > 0) cur.blockHours.push(s.blockHours);
      directions.set(key, cur);
    }
  }
  const pairs = new Map<string, RoutePair>();
  for (const dir of directions.values()) {
    dir.level = routeLevel(dir.peakKss);
    const key = pairKey(dir.from, dir.to);
    const [first, second] = key.split('-');
    const a = second === homeBase ? second : first;
    const b = a === first ? second : first;
    const pair = pairs.get(key) ?? { key, a, b, sectors: 0, peakKss: null, level: 'unknown' as RiskLevel, sectorBasis: true, directions: [] };
    pair.sectors += dir.sectors;
    pair.sectorBasis = pair.sectorBasis && dir.sectorBasis;
    if (dir.peakKss != null && (pair.peakKss == null || dir.peakKss > pair.peakKss)) pair.peakKss = dir.peakKss;
    pair.directions.push(dir);
    pairs.set(key, pair);
  }
  for (const pair of pairs.values()) {
    pair.level = routeLevel(pair.peakKss);
    pair.directions.sort((x, y) => (x.from === pair.a ? -1 : 0) - (y.from === pair.a ? -1 : 0));
  }
  return listOrder([...pairs.values()]);
}

/** List order: most flown first, then the more demanding, then by code. */
export function listOrder(pairs: RoutePair[]): RoutePair[] {
  return [...pairs].sort((x, y) => y.sectors - x.sectors || severityRank(y.level) - severityRank(x.level) || x.key.localeCompare(y.key));
}

/** Draw order: ascending severity so the worst is on top; hovered, then selected, last. */
export function drawOrder(pairs: RoutePair[], selected: string | null, hovered: string | null): RoutePair[] {
  const bump = (p: RoutePair) => (p.key === selected ? 2 : p.key === hovered ? 1 : 0);
  return [...pairs].sort((x, y) => bump(x) - bump(y) || severityRank(x.level) - severityRank(y.level) || y.sectors - x.sectors || x.key.localeCompare(y.key));
}

/** Stroke width: square root so a 6-sector route does not dwarf single sectors. */
export const routeWidth = (sectors: number, max: number) => 1.5 + 2.5 * Math.sqrt(sectors / Math.max(1, max));

/** Low routes stay visible but neutral; other bands use the shared risk tokens. */
export function routeColour(level: RiskLevel): string {
  if (level === 'low') return 'hsl(var(--foreground) / 0.6)';
  return riskCssColor(level);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 1.83 → "1:50" */
export function formatBlock(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
