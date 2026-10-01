/**
 * Fatigue report wizard rules (pure, unit-tested).
 *
 * A fatigue report within the operator's FRM (ORO.FTL.120) describes fatigue
 * that has happened; a concern about an upcoming duty is a roster concern.
 * These rules mirror the backend so the pilot learns about a problem on the
 * step where it can be fixed, not after pressing Generate.
 */
import type { DutyStatus, EventType, ReportDuty, ReportSleep } from './fatigue-report-api';

/** Clock tolerance for "now" (matches the backend). */
export const FUTURE_TOLERANCE_MS = 5 * 60_000;

export const isFuture = (iso: string, now: number) => Date.parse(iso) > now + FUTURE_TOLERANCE_MS;

export const RETROSPECTIVE_EVENT_ERROR =
  'Fatigue you called or experienced must be in the past. For an upcoming duty, choose “I am concerned about a planned roster”.';

export const FUTURE_DUTY_NOTICE =
  'This duty has not started yet, so the report is set up as a roster concern. If you have already called fatigue for it, choose “I called fatigue before a duty”.';

/** Event type and time when "Report fatigue" is pressed on a roster duty. */
export function prefillEvent(reportIso: string, purpose: EventType | undefined, now: number): {
  type: EventType; eventIso: string; futureDuty: boolean;
} {
  const reportMs = Date.parse(reportIso);
  const futureDuty = reportMs > now + FUTURE_TOLERANCE_MS;
  const type: EventType = purpose ?? (futureDuty ? 'roster_concern' : 'fatigue_call_before_duty');
  // A concern is anchored to the report; a call is an hour before it, but never in the future.
  const eventMs = type === 'roster_concern' ? reportMs : Math.min(reportMs - 3600e3, now);
  return { type, eventIso: new Date(eventMs).toISOString(), futureDuty };
}

/** Error for the event time field, or null. */
export function eventTimeError(type: EventType, eventIso: string, now: number): string | null {
  if (!eventIso || Number.isNaN(Date.parse(eventIso))) return 'Enter when this happened.';
  if (type !== 'roster_concern' && isFuture(eventIso, now)) return RETROSPECTIVE_EVENT_ERROR;
  return null;
}

/** Why a status cannot be chosen for this duty, or null when it can. */
export function statusBlockedReason(status: DutyStatus, duty: Pick<ReportDuty, 'report_utc'>, type: EventType, now: number): string | null {
  if (!isFuture(duty.report_utc, now)) return null;
  if (status === 'operated') return 'Not started yet';
  if (status === 'cancelled_fatigue' && type !== 'fatigue_call_before_duty') return 'Only after a fatigue call';
  return null;
}

/** Planned duties that have finished before the event and before now. */
export function operatedCandidates(duties: ReportDuty[], eventIso: string, now: number): string[] {
  const limit = Math.min(Date.parse(eventIso), now);
  return duties.filter((d) => d.status === 'planned' && Date.parse(d.release_utc) <= limit).map((d) => d.id);
}

/** Estimated sleep that has already ended (and so can be confirmed as actual). */
export function confirmableSleeps<T extends ReportSleep & { key: string }>(sleeps: T[], eventIso: string, now: number): string[] {
  const limit = Math.min(Date.parse(eventIso), now + FUTURE_TOLERANCE_MS);
  return sleeps.filter((s) => s.source === 'estimated' && Date.parse(s.end_utc) <= limit).map((s) => s.key);
}

/** First problem that blocks fatigue-during-duty reports, or null. */
export function duringDutyError(type: EventType, affected: ReportDuty | undefined, eventIso: string): string | null {
  if (type !== 'fatigue_during_duty') return null;
  if (!affected) return 'Select the duty during which you became fatigued.';
  const t = Date.parse(eventIso);
  if (t < Date.parse(affected.report_utc) || t > Date.parse(affected.release_utc)) {
    return 'The time you became fatigued must fall between this duty’s report and release. Adjust it in step 1.';
  }
  return null;
}

export interface StepState {
  homeTz: string;
  eventType: EventType;
  eventIso: string;
  periodStart: string;
  periodEnd: string;
  duties: ReportDuty[];
  affectedId: string | null;
  dutyIssues: string[];
  sleepIssues: string[];
  now: number;
}

/** Messages that stop the pilot leaving `step`; the first is shown beside Next. */
export function stepBlockers(step: number, s: StepState): string[] {
  const out: string[] = [];
  if (step === 0) {
    if (!s.homeTz) out.push('Enter your home base to continue.');
    const eventError = eventTimeError(s.eventType, s.eventIso, s.now);
    if (eventError) out.push(eventError);
    const a = Date.parse(s.periodStart), b = Date.parse(s.periodEnd), e = Date.parse(s.eventIso);
    if (!(b > a)) out.push('The reporting period must end after it starts.');
    else if (b - a > 31 * 86400e3) out.push('Choose a reporting period of 31 days or less.');
    else if (e < a || e > b) out.push('The event must fall inside the reporting period.');
  }
  if (step === 1) {
    if (s.dutyIssues.length) out.push(`${s.dutyIssues.length === 1 ? '1 duty entry needs' : `${s.dutyIssues.length} duty entries need`} attention.`);
    const affected = s.duties.find((d) => d.id === s.affectedId);
    const during = duringDutyError(s.eventType, affected, s.eventIso);
    if (during) out.push(during);
    s.duties.forEach((d, i) => {
      const reason = statusBlockedReason(d.status, d, s.eventType, s.now);
      if (reason) out.push(`Duty ${i + 1} has not started yet; set it to planned.`);
    });
  }
  if (step === 2 && s.sleepIssues.length) {
    out.push(`${s.sleepIssues.length === 1 ? '1 sleep entry needs' : `${s.sleepIssues.length} sleep entries need`} attention.`);
  }
  return out;
}
