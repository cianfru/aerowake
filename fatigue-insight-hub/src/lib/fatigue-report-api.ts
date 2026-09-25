/**
 * Automatic fatigue report — client, types and helpers.
 *
 * The backend (POST /api/fatigue-report) is stateless: the report is
 * returned to the pilot, who decides where to submit it.
 */
import { getAuthHeaders } from '@/contexts/AuthContext';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

// ── Request types ────────────────────────────────────────────

export type DutyStatus = 'operated' | 'planned' | 'cancelled_fatigue' | 'not_operated';
export type EventType = 'fatigue_call_before_duty' | 'fatigue_during_duty' | 'fatigue_after_duty';
export type SleepKind = 'main' | 'nap' | 'inflight_rest';
export type SleepLocation = 'home' | 'hotel' | 'crew_rest' | 'other';

export interface ReportSector {
  flight_number: string;
  departure: string;
  arrival: string;
  departure_utc: string;
  arrival_utc: string;
  is_deadhead?: boolean;
}

export interface ReportDuty {
  id: string;
  report_utc: string;
  release_utc: string;
  sectors: ReportSector[];
  status: DutyStatus;
  duty_type: 'flight' | 'standby' | 'simulator' | 'ground' | 'positioning' | 'other';
  description?: string;
  source: 'roster' | 'manual';
}

export interface ReportSleep {
  start_utc: string;
  end_utc: string;
  kind: SleepKind;
  location: SleepLocation;
  quality?: number | null;
  source: 'reported' | 'estimated';
}

export interface FatigueReportRequest {
  home_base?: string | null;
  home_timezone?: string | null;
  event_type: EventType;
  event_time_utc: string;
  period_start_utc: string;
  period_end_utc: string;
  affected_duty_id?: string | null;
  duties: ReportDuty[];
  sleeps: ReportSleep[];
  self_assessment: { kss?: number | null; samn_perelli?: number | null; rated_at_utc?: string | null };
  contributing_factors: string[];
  narrative: string;
  pilot: { name?: string; staff_number?: string; rank?: string; fleet?: string; operator?: string };
}

// ── Response types ───────────────────────────────────────────

export type Severity = 'info' | 'caution' | 'warning' | 'critical';

export interface ReportFinding {
  severity: Severity;
  category: 'sleep' | 'prediction' | 'roster' | 'circadian' | 'self_report';
  title: string;
  detail: string;
  time_utc: string | null;
  time_local: string | null;
  reference: string | null;
}

export interface ReportDutyRow {
  id: string;
  label: string;
  route: string;
  status: DutyStatus;
  duty_type: string;
  report_utc: string;
  release_utc: string;
  report_local: string;
  release_local: string;
  report_z: string;
  release_z: string;
  duty_hours: number;
  sectors: number;
  patterns: { early_start: boolean; very_early_start: boolean; late_finish: boolean; night_duty: boolean };
  is_affected: boolean;
  source: string;
  predicted_kss_max: number | null;
  risk_level: string;
  rest_before_hours?: number;
  rest_sleep_hours?: number;
}

export interface SleepWakeCheck {
  sleep_24h: number;
  sleep_48h: number;
  hours_awake_at_start: number | null;
  hours_awake_at_end: number | null;
  checks: { rule: string; label: string; value: number; limit: number; passed: boolean }[];
  passed: boolean;
  source: string;
}

export interface FatigueReport {
  report_id: string;
  report_version: string;
  engine_version: string;
  generated_at: string;
  home_timezone: string;
  home_base: string | null;
  pilot: Record<string, string>;
  event: {
    type: EventType;
    time_utc: string;
    time_local: string;
    time_z: string;
    affected_duty_id: string | null;
    affected_duty_label: string | null;
  };
  period: { start_utc: string; end_utc: string; start_local: string; end_local: string };
  data_quality: {
    confidence: 'high' | 'medium' | 'low';
    reported_sleeps: number;
    estimated_sleeps: number;
    duties: number;
    nights_without_sleep: string[];
    notes: string[];
    model_available: boolean;
  };
  summary: {
    overall_level: 'low' | 'moderate' | 'high' | 'critical';
    objective_support: boolean;
    headline: string;
    counts: Record<Severity, number>;
  };
  assessment: null | {
    kss_at_start: number;
    kss_max: number;
    kss_max_90: number;
    kss_max_time_local: string;
    kss_at_landing: number | null;
    p_severe_max: number;
    hours_awake_at_start: number;
    hours_awake_at_end: number;
    risk_level: string;
    kss_label: string;
  };
  prior_sleep_wake: SleepWakeCheck | null;
  cumulative_deficit: null | { days: number; sleep_hours: number; need_hours: number; deficit_hours: number; band: string };
  self_assessment: null | {
    kss: number | null;
    kss_label: string | null;
    samn_perelli: number | null;
    samn_perelli_label: string | null;
    rated_at_local: string;
    model_kss_at_rating: number | null;
  };
  contributing_factors: { code: string; label: string }[];
  pilot_narrative: string;
  findings: ReportFinding[];
  duties: ReportDutyRow[];
  sleeps: { start_local: string; end_local: string; hours: number; kind: string; location: string; quality: number | null; source: string; start_utc: string; end_utc: string }[];
  timeline: { time_utc: string; kss: number | null; kss_90: number | null; p_severe: number | null; hours_awake: number; asleep: boolean }[];
  limitations: string[];
  narrative: { title: string; text: string }[];
}

export async function generateFatigueReport(body: FatigueReportRequest): Promise<FatigueReport> {
  const response = await fetch(`${API_BASE_URL}/api/fatigue-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(formatApiError(error.detail) || `Report generation failed (${response.status})`);
  }
  return response.json();
}

function formatApiError(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d?.msg === 'string' ? d.msg.replace(/^Value error, /, '') : ''))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

// ── Labels ───────────────────────────────────────────────────

export const KSS_OPTIONS = [
  'Extremely alert', 'Very alert', 'Alert', 'Rather alert', 'Neither alert nor sleepy',
  'Some signs of sleepiness', 'Sleepy, but no effort to keep awake',
  'Sleepy, some effort to keep awake', 'Very sleepy, great effort to keep awake, fighting sleep',
];

export const SAMN_PERELLI_OPTIONS = [
  'Fully alert, wide awake', 'Very lively, responsive, but not at peak', 'Okay, somewhat fresh',
  'A little tired, less than fresh', 'Moderately tired, let down',
  'Extremely tired, very difficult to concentrate', 'Completely exhausted, unable to function effectively',
];

export const FACTOR_OPTIONS: { code: string; label: string }[] = [
  { code: 'roster_pattern', label: 'Roster pattern / scheduling' },
  { code: 'short_rest', label: 'Short rest period' },
  { code: 'early_start', label: 'Early report' },
  { code: 'late_finish', label: 'Late finish' },
  { code: 'night_duty', label: 'Night duty / WOCL' },
  { code: 'time_zones', label: 'Time-zone changes' },
  { code: 'long_duty', label: 'Long duty day' },
  { code: 'multiple_sectors', label: 'Multiple sectors' },
  { code: 'delays', label: 'Delays / disruption' },
  { code: 'commute', label: 'Commute or positioning' },
  { code: 'hotel_disturbance', label: 'Hotel / accommodation disturbance' },
  { code: 'home_disturbance', label: 'Disturbance at home' },
  { code: 'unable_to_sleep', label: 'Unable to sleep despite opportunity' },
  { code: 'illness', label: 'Illness or medication' },
  { code: 'personal', label: 'Personal / domestic reasons' },
  { code: 'workload', label: 'High workload (weather, technical, ATC)' },
  { code: 'other', label: 'Other' },
];

// ── Time-zone helpers (datetime-local <-> UTC ISO) ───────────

/** Offset of `tz` from UTC in minutes at the given instant. */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "YYYY-MM-DDTHH:mm" wall-clock in `tz` (or UTC when tz === 'UTC') → ISO UTC. */
export function localInputToUtcIso(value: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes resolve the offset across DST transitions.
  let guess = wall - tzOffsetMinutes(new Date(wall), tz) * 60000;
  guess = wall - tzOffsetMinutes(new Date(guess), tz) * 60000;
  return new Date(guess).toISOString();
}

/** ISO UTC → "YYYY-MM-DDTHH:mm" wall-clock in `tz`. */
export function utcIsoToLocalInput(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const shifted = new Date(d.getTime() + tzOffsetMinutes(d, tz) * 60000);
  return shifted.toISOString().slice(0, 16);
}

// ── Pre-fill from a roster analysis ──────────────────────────

/** Segment times are HH:mmZ; rebuild full instants by walking forward from report. */
function rollForward(cursor: Date, hhmmZ: string | undefined): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmmZ ?? '');
  if (!m) return null;
  const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), +m[1], +m[2]));
  while (candidate.getTime() < cursor.getTime() - 60000) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
}

function validIso(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function dutyFromAnalysis(duty: DutyAnalysis, index: number): ReportDuty | null {
  const report = validIso(duty.reportTimeUtc);
  const release = validIso(duty.releaseTimeUtc);
  if (!report || !release) return null;
  let cursor = new Date(report);
  const sectors: ReportSector[] = [];
  for (const seg of duty.flightSegments ?? []) {
    if (seg.activityCode === 'IR') continue;
    const dep = rollForward(cursor, seg.departureTimeUtc);
    if (!dep) continue;
    const arr = rollForward(dep, seg.arrivalTimeUtc);
    if (!arr) continue;
    sectors.push({
      flight_number: seg.flightNumber ?? '',
      departure: seg.departure,
      arrival: seg.arrival,
      departure_utc: dep.toISOString(),
      arrival_utc: arr.toISOString(),
      is_deadhead: !!seg.isDeadhead,
    });
    cursor = arr;
  }
  const dutyType = duty.dutyType === 'simulator' ? 'simulator'
    : duty.dutyType === 'ground_training' ? 'ground' : 'flight';
  return {
    id: duty.dutyId ?? `duty-${index + 1}`,
    report_utc: report,
    release_utc: release,
    sectors,
    status: 'operated',
    duty_type: sectors.length ? 'flight' : dutyType,
    description: duty.trainingCode ?? '',
    source: 'roster',
  };
}

export function estimatedSleepsFromAnalysis(results: AnalysisResults, startIso: string, endIso: string): ReportSleep[] {
  const start = new Date(startIso).getTime() - 36 * 3600e3;  // include the night before the period
  const end = new Date(endIso).getTime();
  const out: ReportSleep[] = [];
  const push = (s?: string, e?: string, kind?: string, env?: string) => {
    const a = validIso(s);
    const b = validIso(e);
    if (!a || !b || b <= a) return;
    const t0 = new Date(a).getTime();
    if (t0 < start || t0 > end) return;
    out.push({
      start_utc: a,
      end_utc: b,
      kind: kind === 'nap' ? 'nap' : kind === 'inflight_rest' ? 'inflight_rest' : 'main',
      location: env === 'home' ? 'home' : env === 'crew_rest' ? 'crew_rest' : env ? 'hotel' : 'other',
      quality: null,
      source: 'estimated',
    });
  };
  for (const d of results.duties) {
    const est = d.sleepEstimate;
    if (!est) continue;
    if (est.sleepBlocks?.length) {
      for (const b of est.sleepBlocks) push(b.sleepStartUtc, b.sleepEndUtc, b.sleepType, est.environment);
    } else {
      push(est.sleepStartIso, est.sleepEndIso, 'main', est.environment);
    }
  }
  for (const day of results.restDaysSleep ?? []) {
    for (const b of day.sleepBlocks) push(b.sleepStartIso, b.sleepEndIso, b.sleepType, b.environment);
  }
  // Deduplicate and drop overlaps (keep the earlier block).
  out.sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const clean: ReportSleep[] = [];
  for (const s of out) {
    const prev = clean[clean.length - 1];
    if (prev && s.start_utc < prev.end_utc) continue;
    clean.push(s);
  }
  return clean;
}

export function dutiesInPeriod(results: AnalysisResults, startIso: string, endIso: string): ReportDuty[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return results.duties
    .map((d, i) => dutyFromAnalysis(d, i))
    .filter((d): d is ReportDuty => !!d)
    .filter((d) => new Date(d.release_utc).getTime() > start && new Date(d.report_utc).getTime() < end)
    .sort((a, b) => a.report_utc.localeCompare(b.report_utc));
}

/** Plain-text export suitable for pasting into an operator's FRMS form. */
export function reportToText(r: FatigueReport): string {
  const lines: string[] = [];
  lines.push('FATIGUE REPORT', `Generated ${r.generated_at} · ${r.report_version} · ${r.engine_version}`, '');
  const pilot = Object.entries(r.pilot).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(' · ');
  if (pilot) lines.push(pilot, '');
  lines.push(`SUMMARY: ${r.summary.headline}`, `Data confidence: ${r.data_quality.confidence}`, '');
  for (const p of r.narrative) lines.push(`${p.title.toUpperCase()}`, p.text, '');
  if (r.findings.length) {
    lines.push('FINDINGS');
    for (const f of r.findings) {
      lines.push(`- [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}${f.reference ? ` (${f.reference})` : ''}`);
    }
    lines.push('');
  }
  if (r.pilot_narrative) lines.push('PILOT STATEMENT', r.pilot_narrative, '');
  lines.push('LIMITATIONS', ...r.limitations.map((l) => `- ${l}`));
  return lines.join('\n');
}
