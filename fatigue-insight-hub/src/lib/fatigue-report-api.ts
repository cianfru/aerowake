import { apiFetch } from '@/lib/auth-session';
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
export type EventType = 'roster_concern' | 'fatigue_call_before_duty' | 'fatigue_during_duty' | 'fatigue_after_duty';
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
  crew_composition?: 'standard' | 'augmented_3' | 'augmented_4' | 'unknown';
  acclimatization?: 'acclimatized' | 'unknown';
  id: string;
  report_utc: string;
  release_utc: string;
  sectors: ReportSector[];
  status: DutyStatus;
  duty_type: 'flight' | 'standby' | 'home_standby' | 'airport_standby' | 'simulator' | 'ground' | 'positioning' | 'other';
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
  watch_reference_kss?: number;
  diary_complete?: boolean;
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
  crew_position?: CrewPosition | '';
  pilot_role?: PilotRole | '';
  phase_of_flight?: PhaseOfFlight | '';
  mitigations?: MitigationCode[];
  effect_on_operation?: EffectCode | '';
  suggested_action?: string;
}

export type CrewPosition = 'captain' | 'first_officer' | 'second_officer' | 'other';
export type PilotRole = 'pilot_flying' | 'pilot_monitoring';
export type PhaseOfFlight = 'pre_flight' | 'taxi' | 'takeoff_climb' | 'cruise' | 'descent_approach' | 'landing' | 'post_flight';
export type MitigationCode = 'strategic_nap' | 'controlled_rest' | 'caffeine' | 'informed_crew' | 'informed_operator' | 'removed_from_duty' | 'none';
export type EffectCode = 'none_noticed' | 'reduced_performance' | 'error_or_lapse' | 'microsleep' | 'duty_not_operated';

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
  /** Flight numbers in sector order (report 1.3+). */
  flights?: string[];
  /** Compact flight numbers, e.g. 'QR460/461' (report 1.3+). */
  flights_label?: string;
  /** Sector block times as supplied (report 1.3+). */
  sector_times?: { flight_number: string; departure: string; arrival: string; departure_utc: string; arrival_utc: string; is_deadhead: boolean }[];
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

/** Supplied sleep before the event, independent of the model (report 1.3+). */
export interface SleepSummary {
  anchor_utc: string;
  anchor_local: string;
  sleep_24h: number;
  sleep_48h: number;
  sleep_72h: number;
  reported_72h: number;
  estimated_72h: number;
  last_wake_utc: string | null;
  last_wake_local: string | null;
  last_wake_z: string | null;
  hours_awake_at_event: number | null;
  /** Since the last sleep entered; equals time awake only with a complete diary. */
  hours_since_last_sleep?: number | null;
  basis: 'reported' | 'estimated' | 'mixed' | 'none';
  diary_complete: boolean;
}

export interface OperationalContext {
  crew_position: CrewPosition | null;
  crew_position_label: string | null;
  pilot_role: PilotRole | null;
  pilot_role_label: string | null;
  phase_of_flight: PhaseOfFlight | null;
  phase_of_flight_label: string | null;
  mitigations: { code: MitigationCode; label: string }[];
  effect_on_operation: EffectCode | null;
  effect_on_operation_label: string | null;
  suggested_action: string;
}

export interface TimelinePointRow { time_utc: string; kss: number | null; kss_90: number | null; p_severe?: number | null; hours_awake: number; asleep: boolean }

export interface EasaCoverage { status: string; reason?: string; assessed?: number; eligible?: number }

export interface FatigueReport {
  watch_reference?: { kss: number; kind: string; duty_ids: string[]; explanation: string };
  scientific_basis?: { title: string; citation: string; url: string; application: string }[];
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
    /** 'Tue 29 Sep 2026 04:00' (report 1.3+). */
    time_local_long?: string;
    /** 'UTC+3' at the event (report 1.3+). */
    utc_offset?: string;
    affected_duty_id: string | null;
    affected_duty_label: string | null;
  };
  period: { start_utc: string; end_utc: string; start_local: string; end_local: string; start_local_long?: string; end_local_long?: string };
  sleep_summary?: SleepSummary;
  operational?: OperationalContext;
  easa_summary?: { status?: string; coverage?: Record<string, EasaCoverage>; [key: string]: unknown };
  data_quality: {
    confidence: 'high' | 'medium' | 'low';
    reported_sleeps: number;
    estimated_sleeps: number;
    duties: number;
    nights_without_sleep: string[];
    notes: string[];
    model_available: boolean;
    prediction_basis?: 'reported_sleep' | 'estimated_sleep' | 'mixed_sleep' | 'unavailable';
    diary_complete?: boolean;
  };
  summary: {
    /** Canonical band of the predicted peak KSS (report 1.3+); 'unknown' without a prediction. */
    overall_level: 'low' | 'moderate' | 'high' | 'critical' | 'extreme' | 'unknown';
    highest_severity?: Severity | null;
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
    rated_at_utc?: string;
    rated_at_z?: string;
    model_kss_at_rating: number | null;
  };
  contributing_factors: { code: string; label: string }[];
  pilot_narrative: string;
  findings: ReportFinding[];
  duties: ReportDutyRow[];
  sleeps: { start_local: string; end_local: string; hours: number; kind: string; location: string; quality: number | null; source: string; start_utc: string; end_utc: string }[];
  timeline: TimelinePointRow[];
  /** Diary not confirmed: an illustration only, never used for findings (report 1.3+). */
  provisional_timeline?: TimelinePointRow[];
  limitations: string[];
  narrative: { title: string; text: string }[];
}

export async function generateFatigueReport(body: FatigueReportRequest): Promise<FatigueReport> {
  const response = await apiFetch(`${API_BASE_URL}/api/fatigue-report`, {
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

export const CREW_POSITION_OPTIONS: { code: CrewPosition; label: string }[] = [
  { code: 'captain', label: 'Captain' },
  { code: 'first_officer', label: 'First officer' },
  { code: 'second_officer', label: 'Second officer' },
  { code: 'other', label: 'Other crew position' },
];

export const PILOT_ROLE_OPTIONS: { code: PilotRole; label: string }[] = [
  { code: 'pilot_flying', label: 'Pilot flying' },
  { code: 'pilot_monitoring', label: 'Pilot monitoring' },
];

export const PHASE_OPTIONS: { code: PhaseOfFlight; label: string }[] = [
  { code: 'pre_flight', label: 'Pre-flight' },
  { code: 'taxi', label: 'Taxi' },
  { code: 'takeoff_climb', label: 'Take-off and climb' },
  { code: 'cruise', label: 'Cruise' },
  { code: 'descent_approach', label: 'Descent and approach' },
  { code: 'landing', label: 'Landing' },
  { code: 'post_flight', label: 'Post-flight' },
];

export const MITIGATION_OPTIONS: { code: MitigationCode; label: string }[] = [
  { code: 'strategic_nap', label: 'Strategic nap before duty' },
  { code: 'controlled_rest', label: 'Controlled rest per operator procedure' },
  { code: 'caffeine', label: 'Caffeine' },
  { code: 'informed_crew', label: 'Informed the other pilot / crew' },
  { code: 'informed_operator', label: 'Informed crew control / duty manager' },
  { code: 'removed_from_duty', label: 'Removed from duty or replaced' },
  { code: 'none', label: 'None taken' },
];

export const EFFECT_OPTIONS: { code: EffectCode; label: string }[] = [
  { code: 'none_noticed', label: 'No effect noticed' },
  { code: 'reduced_performance', label: 'Reduced performance noticed' },
  { code: 'error_or_lapse', label: 'Error or lapse' },
  { code: 'microsleep', label: 'Microsleep or involuntary sleep' },
  { code: 'duty_not_operated', label: 'Duty not operated' },
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
  // Reject skipped and repeated wall times: the pilot must use UTC to disambiguate.
  const offsets = new Set([-2, -1, 0, 1, 2].map(day => tzOffsetMinutes(new Date(wall + day * 86400000), tz)));
  const candidates = [...offsets].map(offset => new Date(wall - offset * 60000).toISOString())
    .filter(iso => utcIsoToLocalInput(iso, tz) === value.slice(0, 16));
  return candidates.length === 1 ? candidates[0] : null;
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
    : duty.dutyType === 'ground_training' ? 'ground' : duty.dutyType === 'airport_standby' ? 'airport_standby' : 'flight';
  return {
    id: duty.dutyId ?? `duty-${index + 1}`,
    report_utc: report,
    release_utc: release,
    sectors,
    status: 'planned',
    duty_type: sectors.length ? 'flight' : dutyType,
    description: duty.trainingCode ?? '',
    source: 'roster',
    crew_composition: duty.crewComposition ?? 'unknown',
    acclimatization: 'unknown',
  };
}

/** Backend sleep environments mapped onto report locations; unknown values stay undefined. */
export function reportLocationFromEnvironment(env: string | null | undefined): SleepLocation | undefined {
  switch (env) {
    case 'home': return 'home';
    case 'hotel': case 'layover': case 'airport_hotel': return 'hotel';
    case 'crew_rest': return 'crew_rest';
    case 'other': return 'other';
    default: return undefined;
  }
}

/**
 * Where the pilot was when a sleep started: the arrival airport of the last
 * sector landed before it, else the home base. Home base → 'home'; anywhere
 * else → 'hotel' (layover).
 */
function inferLocation(startIso: string, arrivals: { at: number; airport: string }[], base: string | undefined): SleepLocation {
  const t = Date.parse(startIso);
  let where = base;
  for (const a of arrivals) {
    if (a.at <= t) where = a.airport;
    else break;
  }
  if (!base || !where) return 'home';
  return where.toUpperCase() === base.toUpperCase() ? 'home' : 'hotel';
}

export function estimatedSleepsFromAnalysis(results: AnalysisResults, startIso: string, endIso: string): ReportSleep[] {
  const start = new Date(startIso).getTime() - 36 * 3600e3;  // include the night before the period
  const end = new Date(endIso).getTime();
  const base = results.pilotBase?.trim() || undefined;
  const arrivals = results.duties
    .map((d, i) => dutyFromAnalysis(d, i))
    .filter((d): d is ReportDuty => !!d)
    .flatMap((d) => d.sectors.map((s) => ({ at: Date.parse(s.arrival_utc), airport: s.arrival })))
    .filter((a) => Number.isFinite(a.at))
    .sort((a, b) => a.at - b.at);
  const out: ReportSleep[] = [];
  const push = (s?: string, e?: string, kind?: string, env?: string | null) => {
    const a = validIso(s);
    const b = validIso(e);
    if (!a || !b || b <= a) return;
    const t0 = new Date(a).getTime();
    if (t0 < start || t0 > end) return;
    out.push({
      start_utc: a,
      end_utc: b,
      kind: kind === 'nap' ? 'nap' : kind === 'inflight_rest' ? 'inflight_rest' : 'main',
      // Per block first; otherwise where the pilot was. Never a silent 'other'.
      location: reportLocationFromEnvironment(env) ?? inferLocation(a, arrivals, base),
      quality: null,
      source: 'estimated',
    });
  };
  for (const d of results.duties) {
    const est = d.sleepEstimate;
    if (!est) continue;
    if (est.sleepBlocks?.length) {
      for (const b of est.sleepBlocks) {
        // Block environment when the API passes it through; a single block may use the estimate's.
        const blockEnv = (b as { environment?: string | null }).environment;
        push(b.sleepStartUtc, b.sleepEndUtc, b.sleepType, blockEnv ?? (est.sleepBlocks.length === 1 ? est.environment : undefined));
      }
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

const SEVERITY_WORD: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', caution: 'Caution', info: 'Info' };

function titleCaseKey(key: string): string {
  const k = key.replace(/_/g, ' ');
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/** '30 Sep 2026 12:14Z' from an ISO instant. */
export function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`;
}

function formatH(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return '—';
  const minutes = Math.round(Math.max(0, h) * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

export const FTL_RULE_LABELS: Record<string, string> = {
  duty_7d: 'Duty hours, 7 days (ORO.FTL.210)',
  duty_14d: 'Duty hours, 14 days (ORO.FTL.210)',
  duty_28d: 'Duty hours, 28 days (ORO.FTL.210)',
  block_28d: 'Flight time, 28 days (ORO.FTL.210)',
  min_rest: 'Minimum rest (ORO.FTL.235)',
  recovery_rest: 'Recovery rest (ORO.FTL.235(d))',
  fdp_max: 'Maximum FDP (OM-A 7.6)',
  fdp_extension: 'Planned FDP extensions (OM-A 7.6.5)',
  standby: 'Standby (ORO.FTL.225)',
};

export const FTL_STATUS_LABELS: Record<string, string> = {
  passed: 'No exceedance found',
  failed: 'Exceedance found',
  incomplete_history: 'Partial: supplied records only',
  not_assessed: 'Not assessed',
};

/**
 * Full plain-text report for an operator's FRM form or e-mail. Each section
 * appears once. The personal watch reference is a private roster setting and
 * stays in the JSON export only.
 */
export function reportToText(r: FatigueReport): string {
  const lines: string[] = [];
  const section = (title: string) => lines.push('', title.toUpperCase());
  lines.push(r.event?.type === 'roster_concern' ? 'PROSPECTIVE ROSTER CONCERN' : 'FATIGUE REPORT');
  lines.push([
    `Generated ${formatGeneratedAt(r.generated_at)}`, r.report_id ? `Report ${r.report_id}` : '',
    r.report_version, `model ${r.engine_version}`,
  ].filter(Boolean).join(' · '));
  const pilot = Object.entries(r.pilot ?? {}).filter(([, v]) => v).map(([k, v]) => `${titleCaseKey(k)}: ${v}`);
  if (r.home_base) pilot.push(`Base: ${r.home_base}`);
  if (pilot.length) lines.push(pilot.join(' · '));
  if (r.event?.time_z) {
    const zone = [r.home_base, `(${r.event.utc_offset ?? r.home_timezone})`].filter(Boolean).join(' ');
    lines.push(`Event: ${r.event.time_local_long ?? r.event.time_local} ${zone} / ${r.event.time_z}`);
  }
  lines.push('', `SUMMARY: ${r.summary.headline}`, `Record coverage: ${r.data_quality.confidence}`);
  if (r.pilot_narrative) { section('Pilot statement'); lines.push(r.pilot_narrative); }
  for (const p of r.narrative ?? []) { section(p.title); lines.push(p.text); }
  const ss = r.sleep_summary;
  if (ss) {
    section('Sleep before the event');
    lines.push(`24 h ${formatH(ss.sleep_24h)} · 48 h ${formatH(ss.sleep_48h)} · 72 h ${formatH(ss.sleep_72h)} (in 72 h: reported ${formatH(ss.reported_72h)}, estimated ${formatH(ss.estimated_72h)})`);
    if (ss.last_wake_local) lines.push(`Last wake ${ss.last_wake_local} (${ss.last_wake_z})${ss.hours_awake_at_event != null ? `; awake ${formatH(ss.hours_awake_at_event)} at the event` : ''}`);
  }
  if (r.duties?.length) {
    section('Duties (home-base time, Z in brackets)');
    for (const d of r.duties) {
      const flights = d.flights_label ? `${d.flights_label} ` : '';
      const kss = d.predicted_kss_max != null ? `; predicted peak KSS ${d.predicted_kss_max.toFixed(1)}` : '';
      lines.push(`- ${d.report_local} to ${d.release_local} (${d.report_z}) ${flights}${d.route}; ${formatH(d.duty_hours)}; ${d.status.replace(/_/g, ' ')}${d.is_affected ? '; affected duty' : ''}${kss}`);
    }
  }
  if (r.sleeps?.length) {
    section('Sleep (reported and estimated shown separately)');
    for (const s of r.sleeps) lines.push(`- ${s.start_local} to ${s.end_local}: ${formatH(s.hours)}, ${s.kind.replace(/_/g, ' ')}, ${s.location.replace(/_/g, ' ')}; ${s.source}`);
  }
  if (r.findings?.length) {
    section('Findings');
    for (const f of r.findings) lines.push(`- [${SEVERITY_WORD[f.severity].toUpperCase()}] ${f.title}: ${f.detail}${f.reference ? ` (${f.reference})` : ''}`);
  }
  const coverage = r.easa_summary?.coverage;
  if (coverage && Object.keys(coverage).length) {
    section('FTL checks performed (supplied records only)');
    for (const [rule, c] of Object.entries(coverage)) lines.push(`- ${FTL_RULE_LABELS[rule] ?? rule}: ${FTL_STATUS_LABELS[c.status] ?? c.status.replace(/_/g, ' ')}`);
  }
  if (r.scientific_basis?.length) { section('Scientific basis'); lines.push(...r.scientific_basis.map((s) => `${s.citation}: ${s.application} ${s.url}`)); }
  const notes = [...new Set([...(r.data_quality?.notes ?? []), ...(r.limitations ?? [])])];
  if (notes.length) { section('Data quality and limitations'); lines.push(...notes.map((l) => `- ${l}`)); }
  return lines.join('\n');
}
