/**
 * Client for the private study: enrolment, duty debriefs and the pilot diary.
 * Every request goes through apiFetch, so an expired access token is refreshed
 * once and the request retried with the new bearer token.
 */
import { apiFetch, getAuthHeaders } from '@/lib/auth-session';
import { DEBRIEF_WINDOW_DAYS, FLAG_KSS, STUDY_CONSENT_VERSION } from '@/lib/study-config';
import type { DutyAnalysis } from '@/types/fatigue';

const API = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

// ── Types ────────────────────────────────────────────────────

export type DebriefMoment = 'worst_moment' | 'top_of_descent' | 'end_of_duty';
export type DebriefOperation = 'as_rostered' | 'times_changed' | 'not_operated';
export type FeltVsPrediction = 'worse' | 'about_right' | 'better';
export type Countermeasure = 'nap' | 'strategic_sleep' | 'caffeine' | 'controlled_rest' | 'inflight_rest' | 'other' | 'none';

export interface ReportedSleepInput { start_utc: string; end_utc: string; kind: 'main' | 'nap' }

export interface DebriefRequest {
  client_id: string;
  analysis_id: string;
  duty_id: string;
  duty_report_utc: string;
  operation: DebriefOperation;
  moment: DebriefMoment;
  kss?: number | null;
  samn_perelli?: number | null;
  rated_at_utc: string;
  prediction_seen: boolean;
  sleeps?: ReportedSleepInput[];
  sleep_complete?: boolean;
  countermeasures?: Countermeasure[];
  note?: string | null;
}

export interface DebriefForecast {
  engine_version: string | null;
  max_kss: number | null;
  landing_kss: number | null;
  kss_at_event: number | null;
  event_time_utc: string | null;
  risk_level: string | null;
  flagged: boolean | null;
  home_timezone?: string | null;
}

export interface Debrief {
  id: string;
  analysis_id: string | null;
  roster_id: string | null;
  duty_id: string;
  duty_report_utc: string;
  duty_release_utc: string;
  moment: DebriefMoment;
  operation: DebriefOperation;
  kss: number | null;
  samn_perelli: number | null;
  felt_vs_prediction: FeltVsPrediction | null;
  rated_at_utc: string;
  prediction_seen: boolean;
  created_at: string | null;
  forecast: DebriefForecast;
  published_tpm: { kss: number; model_version: string } | null;
  sleeps: Array<ReportedSleepInput & { source: 'reported' }>;
  countermeasures: Countermeasure[];
  note: string | null;
  duty: { date: string | null; route: string[]; sectors: number | null };
  quality: { recall_delay_hours: number; stream: 'momentary' | 'same_day' | 'recalled' | 'late'; exclusions: string[] };
}

export interface StudyEnrolment {
  enrolled: boolean;
  enrolled_at: string | null;
  withdrawn_at: string | null;
  consent_version: string | null;
  debriefs: number;
  observations: number;
  last_activity_at: string | null;
}

// ── Labels ───────────────────────────────────────────────────

export const MOMENT_LABELS: Record<DebriefMoment, string> = {
  worst_moment: 'Sleepiest point',
  top_of_descent: 'Top of descent, last sector',
  end_of_duty: 'End of duty',
};

export const OPERATION_LABELS: Record<DebriefOperation, string> = {
  as_rostered: 'As rostered',
  times_changed: 'Times changed',
  not_operated: 'Did not operate',
};

export const FELT_LABELS: Record<FeltVsPrediction, string> = {
  worse: 'Worse than forecast',
  about_right: 'About right',
  better: 'Better than forecast',
};

export const COUNTERMEASURE_LABELS: Record<Countermeasure, string> = {
  nap: 'Nap before duty',
  strategic_sleep: 'Extra sleep beforehand',
  caffeine: 'Caffeine',
  controlled_rest: 'Controlled rest (where permitted)',
  inflight_rest: 'In-flight rest',
  other: 'Other',
  none: 'None',
};

// ── Requests ─────────────────────────────────────────────────

export class StudyApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Sign in again; what you entered here is kept until you reload.';

function detailText(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d?.msg === 'string' ? d.msg.replace(/^Value error, /, '') : '')).filter(Boolean).join(' ');
  }
  return '';
}

export async function studyRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes('session') ? error.message : 'Could not reach Aerowake. Check your connection and retry.';
    throw new StudyApiError(message, 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new StudyApiError(SESSION_EXPIRED_MESSAGE, 401);
    if (response.status === 429) throw new StudyApiError(detailText(data.detail) || 'Too many requests. Please wait a minute.', 429);
    throw new StudyApiError(detailText(data.detail) || 'Could not complete the request. Please retry.', response.status);
  }
  return data as T;
}

export const getEnrolment = () => studyRequest<StudyEnrolment>('/api/study/enrolment');
export const enrol = () => studyRequest<StudyEnrolment>('/api/study/enrolment', { method: 'PUT', body: { consent_version: STUDY_CONSENT_VERSION, accepted: true } });
export const withdraw = (deleteData: boolean) =>
  studyRequest<StudyEnrolment & { deleted: { debriefs: number; observations: number; inflight?: number } }>(`/api/study/enrolment?delete_data=${deleteData}`, { method: 'DELETE' });
export const listDebriefs = () => studyRequest<{ debriefs: Debrief[] }>('/api/debriefs').then((r) => r.debriefs);
export const createDebrief = (body: DebriefRequest) => studyRequest<Debrief>('/api/debriefs', { method: 'POST', body });
export const setFelt = (id: string, felt: FeltVsPrediction | null) =>
  studyRequest<Debrief>(`/api/debriefs/${encodeURIComponent(id)}`, { method: 'PATCH', body: { felt_vs_prediction: felt } });
export const deleteDebrief = (id: string) => studyRequest<void>(`/api/debriefs/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const deleteAllDebriefs = () => studyRequest<{ deleted: number }>('/api/debriefs', { method: 'DELETE' });
export const exportDebriefs = () => studyRequest<unknown>('/api/debriefs/export');

/** Save JSON the pilot asked for as a file download. */
export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

// ── Duty helpers (pure) ──────────────────────────────────────

function instant(value?: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** A duty is flown once its planned release time has passed. */
export function isFlown(duty: Pick<DutyAnalysis, 'releaseTimeUtc'>, now: number = Date.now()): boolean {
  const release = instant(duty.releaseTimeUtc);
  return release !== null && release < now;
}

/** Flagged = forecast duty peak KSS, rounded to one decimal, in the high band or above. */
export function isFlagged(duty: Pick<DutyAnalysis, 'maxKss'>): boolean {
  return typeof duty.maxKss === 'number' && Math.round(duty.maxKss * 10) / 10 >= FLAG_KSS;
}

export function dutyKey(dutyId: string | undefined, reportUtc: string | undefined): string | null {
  const report = instant(reportUtc);
  return dutyId && report !== null ? `${dutyId}|${new Date(report).toISOString()}` : null;
}

export function debriefsFor(duty: Pick<DutyAnalysis, 'dutyId' | 'reportTimeUtc'>, debriefs: Debrief[]): Debrief[] {
  const key = dutyKey(duty.dutyId, duty.reportTimeUtc);
  return key ? debriefs.filter((d) => dutyKey(d.duty_id, d.duty_report_utc) === key) : [];
}

export function dutyRoute(duty: Pick<DutyAnalysis, 'flightSegments'>): string {
  const legs = (duty.flightSegments ?? []).filter((s) => s.activityCode !== 'IR');
  if (!legs.length) return '';
  return [legs[0].departure, ...legs.map((s) => s.arrival)].join('–');
}

/**
 * Flown duties in the recall window without a debrief, most recent first.
 * The order never depends on the forecast: prioritising flagged duties would
 * reveal the hidden prediction and over-sample flagged duties, biasing the
 * flag-discrimination evaluation (docs/PILOT_STUDY.md).
 */
export function debriefQueue(duties: DutyAnalysis[], debriefs: Debrief[], now: number = Date.now()): DutyAnalysis[] {
  const oldest = now - DEBRIEF_WINDOW_DAYS * 86400e3;
  return duties
    .filter((d) => d.dutyId && isFlown(d, now) && (instant(d.releaseTimeUtc) ?? 0) >= oldest && debriefsFor(d, debriefs).length === 0)
    .sort((a, b) => (instant(b.releaseTimeUtc) ?? 0) - (instant(a.releaseTimeUtc) ?? 0));
}

/** Descriptive personal summary once there are enough debriefs to be worth showing. */
export function personalSummary(debriefs: Debrief[], minimum = 5): { n: number; meanDifference: number } | null {
  const pairs = debriefs.filter((d) => d.moment === 'worst_moment' && d.kss !== null && d.forecast?.max_kss != null);
  if (pairs.length < minimum) return null;
  const meanDifference = pairs.reduce((sum, d) => sum + (d.kss as number) - (d.forecast.max_kss as number), 0) / pairs.length;
  return { n: pairs.length, meanDifference };
}
