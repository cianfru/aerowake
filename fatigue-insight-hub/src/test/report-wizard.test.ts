import { describe, expect, it } from 'vitest';
import type { ReportDuty, ReportSleep } from '@/lib/fatigue-report-api';
import {
  RETROSPECTIVE_EVENT_ERROR, confirmableSleeps, duringDutyError, eventTimeError, operatedCandidates, prefillEvent,
  statusBlockedReason, stepBlockers,
} from '@/lib/report-wizard';
import { formatInstant, formatUtcOffset, normaliseClock, zoneLabel } from '@/lib/report-time';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const duty = (id: string, report: string, release: string, status: ReportDuty['status'] = 'planned'): ReportDuty => ({
  id, report_utc: report, release_utc: release, sectors: [], status, duty_type: 'flight', source: 'roster',
});

describe('future-duty guard', () => {
  it('turns "Report fatigue" on an upcoming duty into a roster concern anchored to its report', () => {
    const r = prefillEvent('2026-10-30T14:30:00Z', undefined, NOW);
    expect(r).toEqual({ type: 'roster_concern', eventIso: '2026-10-30T14:30:00.000Z', futureDuty: true });
  });

  it('keeps a fatigue call for a past duty, an hour before report', () => {
    const r = prefillEvent('2026-09-28T05:00:00Z', undefined, NOW);
    expect(r).toEqual({ type: 'fatigue_call_before_duty', eventIso: '2026-09-28T04:00:00.000Z', futureDuty: false });
  });

  it('never places a fatigue call in the future for a duty starting within the hour', () => {
    const r = prefillEvent('2026-09-30T12:30:00Z', 'fatigue_call_before_duty', NOW);
    expect(Date.parse(r.eventIso)).toBeLessThanOrEqual(NOW);
  });

  it('rejects retrospective event types in the future, with a clock tolerance', () => {
    expect(eventTimeError('fatigue_during_duty', '2026-10-01T00:00:00Z', NOW)).toBe(RETROSPECTIVE_EVENT_ERROR);
    expect(eventTimeError('fatigue_call_before_duty', '2026-09-30T12:04:00Z', NOW)).toBeNull();
    expect(eventTimeError('roster_concern', '2026-12-01T00:00:00Z', NOW)).toBeNull();
  });

  it('blocks operated for duties that have not started, and fatigue cancellation unless it was a call', () => {
    const future = duty('F', '2026-10-01T05:00:00Z', '2026-10-01T12:00:00Z');
    expect(statusBlockedReason('operated', future, 'fatigue_call_before_duty', NOW)).toBeTruthy();
    expect(statusBlockedReason('cancelled_fatigue', future, 'fatigue_call_before_duty', NOW)).toBeNull();
    expect(statusBlockedReason('cancelled_fatigue', future, 'roster_concern', NOW)).toBeTruthy();
    expect(statusBlockedReason('operated', duty('P', '2026-09-29T05:00:00Z', '2026-09-29T12:00:00Z'), 'roster_concern', NOW)).toBeNull();
  });
});

describe('step blockers', () => {
  const base = {
    homeTz: 'Asia/Qatar', eventType: 'fatigue_call_before_duty' as const, eventIso: '2026-09-29T01:00:00Z',
    periodStart: '2026-09-26T00:00:00Z', periodEnd: '2026-09-29T18:00:00Z', duties: [], affectedId: null,
    dutyIssues: [], sleepIssues: [], now: NOW,
  };

  it('asks for the home base first and explains a future event', () => {
    expect(stepBlockers(0, { ...base, homeTz: '' })[0]).toBe('Enter your home base to continue.');
    expect(stepBlockers(0, { ...base, eventIso: '2026-10-02T00:00:00Z', periodEnd: '2026-10-03T00:00:00Z' })).toContain(RETROSPECTIVE_EVENT_ERROR);
    expect(stepBlockers(0, base)).toEqual([]);
  });

  it('requires the affected duty and an event inside it for fatigue during duty', () => {
    const d = duty('D1', '2026-09-28T20:00:00Z', '2026-09-29T04:00:00Z', 'operated');
    const during = { ...base, eventType: 'fatigue_during_duty' as const, duties: [d] };
    expect(stepBlockers(1, during)[0]).toMatch(/Select the duty/);
    expect(stepBlockers(1, { ...during, affectedId: 'D1' })).toEqual([]);
    expect(duringDutyError('fatigue_during_duty', d, '2026-09-29T06:00:00Z')).toMatch(/between this duty/);
  });

  it('summarises duty and sleep issues with correct plurals', () => {
    expect(stepBlockers(1, { ...base, dutyIssues: ['a'] })[0]).toBe('1 duty entry needs attention.');
    expect(stepBlockers(2, { ...base, sleepIssues: ['a', 'b'] })[0]).toBe('2 sleep entries need attention.');
  });
});

describe('bulk confirmation', () => {
  it('offers only finished planned duties before the event', () => {
    const ds = [
      duty('A', '2026-09-27T05:00:00Z', '2026-09-27T12:00:00Z'),
      duty('B', '2026-09-28T05:00:00Z', '2026-09-28T12:00:00Z', 'operated'),
      duty('C', '2026-09-29T05:00:00Z', '2026-09-29T12:00:00Z'),
    ];
    expect(operatedCandidates(ds, '2026-09-29T04:00:00Z', NOW)).toEqual(['A']);
  });

  it('offers only estimated sleep that has already ended', () => {
    const s = (key: string, end: string, source: ReportSleep['source'] = 'estimated') => ({ key, start_utc: '2026-09-28T20:00:00Z', end_utc: end, kind: 'main' as const, location: 'home' as const, source });
    expect(confirmableSleeps([s('a', '2026-09-29T03:00:00Z'), s('b', '2026-10-02T03:00:00Z'), s('c', '2026-09-29T03:00:00Z', 'reported')], '2026-10-05T00:00:00Z', NOW)).toEqual(['a']);
  });
});

describe('time presentation', () => {
  it('shows local time with the offset and the Z time', () => {
    expect(formatUtcOffset('Asia/Qatar', '2026-09-29T01:00:00Z')).toBe('UTC+3');
    expect(formatUtcOffset('Asia/Kolkata', '2026-09-29T01:00:00Z')).toBe('UTC+5:30');
    expect(zoneLabel('doh', 'Asia/Qatar', '2026-09-29T01:00:00Z')).toBe('DOH local, UTC+3');
    expect(formatInstant('2026-09-29T01:00:00Z', 'Asia/Qatar', 'DOH')).toBe('Tue 29 Sep 2026 04:00 DOH (UTC+3) / 01:00Z');
    expect(formatInstant('2026-09-28T22:30:00Z', 'Asia/Qatar', 'DOH')).toBe('Tue 29 Sep 2026 01:30 DOH (UTC+3) / 28 Sep 22:30Z');
  });

  it('accepts 24-hour times only', () => {
    expect(normaliseClock('0430')).toBe('04:30');
    expect(normaliseClock('4:30')).toBe('04:30');
    expect(normaliseClock('23:59')).toBe('23:59');
    expect(normaliseClock('24:00')).toBeNull();
    expect(normaliseClock('4:30 PM')).toBeNull();
  });
});
