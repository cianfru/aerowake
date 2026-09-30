/**
 * Geometry for the report's print-safe charts, in home-base local time.
 * Pure functions: no DOM, no React, so they are unit-tested and reused by the
 * on-screen, print and PNG/SVG export renderings.
 */
import type { FatigueReport, ReportDutyRow, TimelinePointRow } from '@/lib/fatigue-report-api';
import { localInputToUtcIso, utcIsoToLocalInput } from '@/lib/fatigue-report-api';
import { formatLocal } from '@/lib/report-time';

const HOUR = 3600e3;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type SleepSource = 'reported' | 'estimated';
export interface Interval { start: number; end: number }

/** Local calendar date 'YYYY-MM-DD' of an instant. */
export function localDate(ms: number, tz: string): string {
  return utcIsoToLocalInput(new Date(ms).toISOString(), tz).slice(0, 10);
}

function nextDate(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + 86400e3).toISOString().slice(0, 10);
}

/** UTC bounds of a local calendar day (23 or 25 h across DST). */
export function dayBounds(day: string, tz: string): Interval | null {
  const a = localInputToUtcIso(`${day}T00:00`, tz);
  const b = localInputToUtcIso(`${nextDate(day)}T00:00`, tz);
  return a && b ? { start: Date.parse(a), end: Date.parse(b) } : null;
}

export function dayLabel(day: string): { weekday: string; date: string; short: string } {
  const d = new Date(`${day}T12:00:00Z`);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return { weekday: WEEKDAYS[d.getUTCDay()], date, short: `${WEEKDAYS[d.getUTCDay()]} ${date}` };
}

/** Union length of intervals clipped to [from, to), in hours. */
export function unionHours(items: Interval[], from: number, to: number): number {
  const spans = items.map((i) => [Math.max(from, i.start), Math.min(to, i.end)] as const)
    .filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0, last = from;
  for (const [a, b] of spans) { total += Math.max(0, b - Math.max(a, last)); last = Math.max(last, b); }
  return total / HOUR;
}

/** Time window shown by both charts: 72 h before the event to the end of what matters. */
export function chartWindow(r: FatigueReport): Interval {
  const event = Date.parse(r.event.time_utc);
  const affected = r.duties.find((d) => d.id === r.event.affected_duty_id);
  const rated = r.self_assessment?.rated_at_utc ? Date.parse(r.self_assessment.rated_at_utc) : NaN;
  const ends = [event, affected ? Date.parse(affected.release_utc) : NaN, rated].filter(Number.isFinite);
  return { start: event - 72 * HOUR, end: Math.max(...ends) };
}

export interface DaySegment { x0: number; x1: number }
export interface ActogramSleep extends DaySegment { source: SleepSource; kind: string; title: string }
export interface ActogramDuty extends DaySegment {
  status: ReportDutyRow['status']; affected: boolean; title: string; label: string | null; clippedStart: boolean;
}
export interface ActogramRow {
  day: string;
  label: ReturnType<typeof dayLabel>;
  sleeps: ActogramSleep[];
  duties: ActogramDuty[];
  sectors: DaySegment[];
  event: number | null;
  rating: number | null;
  sleepHours: number;
  dutyHours: number;
}

/** x in local hours from midnight (0–24), scaled so 23/25 h DST days still span the row. */
function toRowX(ms: number, b: Interval): number {
  return ((ms - b.start) / (b.end - b.start)) * 24;
}

function clipTo(start: number, end: number, b: Interval): DaySegment | null {
  const a = Math.max(start, b.start), z = Math.min(end, b.end);
  return z > a ? { x0: toRowX(a, b), x1: toRowX(z, b) } : null;
}

const STATUS_TEXT: Record<string, string> = {
  operated: 'operated', planned: 'planned', cancelled_fatigue: 'not operated (fatigue)', not_operated: 'not operated',
};

/** One row per local day in the chart window. */
export function buildActogram(r: FatigueReport): { rows: ActogramRow[]; window: Interval } {
  const tz = r.home_timezone;
  const window = chartWindow(r);
  const rows: ActogramRow[] = [];
  const last = localDate(window.end, tz);
  const event = Date.parse(r.event.time_utc);
  const rated = r.self_assessment?.rated_at_utc ? Date.parse(r.self_assessment.rated_at_utc) : NaN;
  const sleepIntervals = r.sleeps.map((s) => ({ start: Date.parse(s.start_utc), end: Date.parse(s.end_utc) }));
  const activeDuties = r.duties.filter((d) => d.status === 'operated' || d.status === 'planned')
    .map((d) => ({ start: Date.parse(d.report_utc), end: Date.parse(d.release_utc) }));
  for (let day = localDate(window.start, tz); day <= last && rows.length < 8; day = nextDate(day)) {
    const b = dayBounds(day, tz);
    if (!b) continue;
    const sleeps: ActogramSleep[] = [];
    r.sleeps.forEach((s) => {
      const seg = clipTo(Date.parse(s.start_utc), Date.parse(s.end_utc), b);
      if (seg) sleeps.push({ ...seg, source: s.source === 'reported' ? 'reported' : 'estimated', kind: s.kind,
        title: `${s.kind === 'nap' ? 'Nap' : 'Sleep'} ${s.start_local} to ${s.end_local} (${s.source})` });
    });
    const duties: ActogramDuty[] = [];
    const sectors: DaySegment[] = [];
    r.duties.forEach((d) => {
      const start = Date.parse(d.report_utc);
      const seg = clipTo(start, Date.parse(d.release_utc), b);
      if (!seg) return;
      const flights = d.flights_label || '';
      const route = d.route.replace(/ → /g, '–');
      duties.push({ ...seg, status: d.status, affected: d.is_affected, clippedStart: start < b.start,
        label: start >= b.start ? [flights, route].filter(Boolean).join(' ') : null,
        title: `${[flights, route].filter(Boolean).join(' ')}: ${d.report_local} to ${d.release_local}, ${STATUS_TEXT[d.status] ?? d.status}` });
    });
    for (const d of r.duties) {
      // Sector block times are drawn only when the report lists them (roster or pilot entry).
      d.sector_times?.forEach((s) => { const seg = clipTo(Date.parse(s.departure_utc), Date.parse(s.arrival_utc), b); if (seg) sectors.push(seg); });
    }
    rows.push({
      day, label: dayLabel(day), sleeps, duties, sectors,
      event: event >= b.start && event < b.end ? toRowX(event, b) : null,
      rating: Number.isFinite(rated) && rated >= b.start && rated < b.end ? toRowX(rated, b) : null,
      sleepHours: unionHours(sleepIntervals, b.start, b.end),
      dutyHours: unionHours(activeDuties, b.start, b.end),
    });
  }
  return { rows, window };
}

export interface KssSeries {
  /** Continuous awake runs (asleep points break the line). */
  median: { t: number; kss: number }[][];
  p90: { t: number; kss: number }[][];
  peak: { t: number; kss: number } | null;
  provisional: boolean;
  domain: Interval;
}

/** Predicted KSS inside the chart window; the provisional curve when the diary is not confirmed. */
export function buildKssSeries(r: FatigueReport): KssSeries | null {
  const confirmed = r.timeline?.length ? r.timeline : null;
  const points: TimelinePointRow[] | null = confirmed ?? (r.provisional_timeline?.length ? r.provisional_timeline : null);
  if (!points) return null;
  const window = chartWindow(r);
  // Stop at the assessed point: after it no sleep is entered, so the curve would only climb.
  const inside = points.filter((p) => { const t = Date.parse(p.time_utc); return t >= window.start && t <= window.end; });
  if (inside.length < 2) return null;
  const median: KssSeries['median'] = [], p90: KssSeries['p90'] = [];
  let runA: { t: number; kss: number }[] = [], runB: { t: number; kss: number }[] = [];
  let peak: KssSeries['peak'] = null;
  for (const p of inside) {
    const t = Date.parse(p.time_utc);
    if (p.asleep || p.kss == null) {
      if (runA.length) median.push(runA);
      if (runB.length) p90.push(runB);
      runA = []; runB = [];
      continue;
    }
    runA.push({ t, kss: p.kss });
    if (p.kss_90 != null) runB.push({ t, kss: p.kss_90 });
    if (!peak || p.kss > peak.kss) peak = { t, kss: p.kss };
  }
  if (runA.length) median.push(runA);
  if (runB.length) p90.push(runB);
  // The labelled peak is the assessment's (duty or event) peak, so chart and text agree.
  const a = confirmed ? r.assessment as (FatigueReport['assessment'] & { kss_max_time_utc?: string }) : null;
  if (a?.kss_max_time_utc) peak = { t: Date.parse(a.kss_max_time_utc), kss: a.kss_max };
  const first = Date.parse(inside[0].time_utc), lastT = Date.parse(inside[inside.length - 1].time_utc);
  return { median, p90, peak, provisional: !confirmed, domain: { start: Math.max(window.start, first), end: Math.max(lastT, first + HOUR) } };
}

/** Local midnights (major) and 06/12/18 (minor) inside a domain. */
export function localTicks(domain: Interval, tz: string): { major: { t: number; day: string }[]; minor: { t: number; hour: number }[] } {
  const major: { t: number; day: string }[] = [];
  const minor: { t: number; hour: number }[] = [];
  for (let day = localDate(domain.start, tz); ; day = nextDate(day)) {
    const b = dayBounds(day, tz);
    if (!b || b.start > domain.end) break;
    if (b.start >= domain.start) major.push({ t: b.start, day });
    for (const h of [6, 12, 18]) {
      const iso = localInputToUtcIso(`${day}T${String(h).padStart(2, '0')}:00`, tz);
      const t = iso ? Date.parse(iso) : NaN;
      if (t >= domain.start && t <= domain.end) minor.push({ t, hour: h });
    }
    if (major.length > 40) break;
  }
  return { major, minor };
}

/** Model value nearest to the self-rating time (for the comparison marker). */
export function modelAtRating(r: FatigueReport): number | null {
  if (r.self_assessment?.model_kss_at_rating != null) return r.self_assessment.model_kss_at_rating;
  const at = r.self_assessment?.rated_at_utc ? Date.parse(r.self_assessment.rated_at_utc) : NaN;
  const pts = r.provisional_timeline ?? [];
  if (!Number.isFinite(at) || !pts.length) return null;
  const hit = pts.find((p) => Math.abs(Date.parse(p.time_utc) - at) < 60e3 && !p.asleep && p.kss != null);
  return hit?.kss ?? null;
}

export const KSS_BANDS = [
  { name: 'moderate', label: 'Moderate', from: 5.5, to: 6.5 },
  { name: 'high', label: 'High', from: 6.5, to: 7.5 },
  { name: 'critical', label: 'Critical', from: 7.5, to: 8.5 },
  { name: 'extreme', label: 'Extreme', from: 8.5, to: 9 },
] as const;

/** Canonical band on the value as displayed (one decimal), lower bound inclusive. */
export function kssBand(kss: number): 'low' | 'moderate' | 'high' | 'critical' | 'extreme' {
  const v = Math.round(kss * 10) / 10;
  if (v >= 8.5) return 'extreme';
  if (v >= 7.5) return 'critical';
  if (v >= 6.5) return 'high';
  if (v >= 5.5) return 'moderate';
  return 'low';
}

function hm(hours: number): string {
  const minutes = Math.round(Math.max(0, hours) * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/** Text equivalent of the actogram (figure caption). */
export function actogramCaption(r: FatigueReport): string {
  const ss = r.sleep_summary;
  const zone = `${r.home_base ? `${r.home_base} local` : r.home_timezone}${r.event.utc_offset ? `, ${r.event.utc_offset}` : ''}`;
  const parts = [`Sleep and duty in the 72 h before the ${r.event.type === 'roster_concern' ? 'concern' : 'event'}, ${zone}; WOCL 02:00–05:59 shaded.`];
  if (ss) {
    parts.push(`Sleep in 72 h: ${hm(ss.sleep_72h)} (reported ${hm(ss.reported_72h)}, estimated ${hm(ss.estimated_72h)}).`);
    if (ss.last_wake_local) parts.push(`Last wake ${ss.last_wake_local}${ss.hours_awake_at_event != null ? `, ${hm(ss.hours_awake_at_event)} before the event` : ''}.`);
  }
  parts.push(`Event ${r.event.time_local} (${r.event.time_z}).`);
  return parts.join(' ');
}

/** Text equivalent of the KSS chart. */
export function kssCaption(r: FatigueReport): string {
  const s = buildKssSeries(r);
  if (!s) return '';
  const parts: string[] = [];
  if (s.provisional) parts.push('Provisional illustration: the sleep diary is not confirmed complete, so gaps are treated as time awake and no finding is based on this curve.');
  if (s.peak) {
    const at = formatLocal(new Date(s.peak.t).toISOString(), r.home_timezone, { year: false });
    const where = r.assessment && !s.provisional ? (r.event.affected_duty_id ? 'on the assessed duty' : 'at the event') : 'in this window';
    parts.push(`Predicted KSS (model estimate for an average pilot) peaks ${where} at ${s.peak.kss.toFixed(1)}, ${kssBand(s.peak.kss)} band, ${at} local.`);
  }
  const sa = r.self_assessment;
  if (sa?.kss != null) {
    const model = modelAtRating(r);
    parts.push(`The pilot rated KSS ${sa.kss} at ${sa.rated_at_local}${model != null ? `; the model estimate at that time was ${model.toFixed(1)}` : ''}.`);
  }
  parts.push('Band thresholds 5.5 / 6.5 / 7.5 / 8.5. The pilot’s own assessment takes precedence over the model.');
  return parts.join(' ');
}
