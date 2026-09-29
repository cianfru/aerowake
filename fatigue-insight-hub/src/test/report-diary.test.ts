import { describe, expect, it } from 'vitest';
import { buildDiaryDays, formatHours, priorSleepHours, recordedHours } from '@/lib/report-diary';
import type { ReportDuty, ReportSleep } from '@/lib/fatigue-report-api';

const sleep = (start: string, end: string, source: 'reported' | 'estimated' = 'reported'): ReportSleep => ({ start_utc: start, end_utc: end, source, kind: 'main', location: 'home' });
const duty = (status: ReportDuty['status']): ReportDuty => ({ id: status, report_utc: '2026-09-08T22:00:00Z', release_utc: '2026-09-09T06:00:00Z', status, sectors: [], source: 'manual', duty_type: 'ground' });

describe('report diary calendar accounting', () => {
  it('splits overnight duties at local midnight and excludes cancelled work from totals', () => {
    const days = buildDiaryDays('2026-09-08T00:00:00Z', '2026-09-09T12:00:00Z', '2026-09-09T08:00:00Z', 'UTC', [duty('operated'), duty('cancelled_fatigue')], []);
    expect(days.map(d => d.dutyHours)).toEqual([2, 6]);
    expect(days[1].duties).toHaveLength(2);
    expect(days[1].event).toBe(true);
    expect(days[0].sleeps).toEqual([]); // missing data, not confirmed no sleep
  });
  it('measures elapsed sleep on spring-forward and fall-back days', () => {
    const spring = buildDiaryDays('2026-03-29T00:00:00Z', '2026-03-29T12:00:00Z', '2026-03-29T10:00:00Z', 'Europe/London', [], [sleep('2026-03-28T23:00:00Z', '2026-03-29T07:00:00Z')]);
    expect((Date.parse(spring[0].end) - Date.parse(spring[0].start)) / 3600000).toBe(23);
    expect(spring[0].reportedSleep).toBe(7);
    const autumn = buildDiaryDays('2026-10-25T00:00:00Z', '2026-10-25T12:00:00Z', '2026-10-25T10:00:00Z', 'Europe/London', [], [sleep('2026-10-24T23:00:00Z', '2026-10-25T07:00:00Z')]);
    expect((Date.parse(autumn[0].end) - Date.parse(autumn[0].start)) / 3600000).toBe(25);
    expect(autumn[0].reportedSleep).toBe(8);
  });
  it('does not count estimates or future sleep in prior reported sleep', () => {
    const sleeps = [sleep('2026-09-07T22:00:00Z', '2026-09-08T06:00:00Z'), sleep('2026-09-08T22:00:00Z', '2026-09-09T06:00:00Z', 'estimated'), sleep('2026-09-09T06:00:00Z', '2026-09-09T10:00:00Z')];
    expect(priorSleepHours(sleeps, '2026-09-09T08:00:00Z', 24)).toBe(2);
    expect(priorSleepHours(sleeps, '2026-09-09T08:00:00Z', 48)).toBe(10);
  });
  it('unions overlapping entries instead of inflating totals', () => {
    expect(recordedHours([{ start: '2026-09-09T01:00Z', end: '2026-09-09T06:00Z' }, { start: '2026-09-09T04:00Z', end: '2026-09-09T08:00Z' }], '2026-09-09T00:00Z', '2026-09-09T12:00Z')).toBe(7);
    expect(formatHours(1.999)).toBe('2h 00m');
  });
  it('keeps planned duty and estimated sleep separate from reported activity', () => {
    const days = buildDiaryDays('2026-09-08T00:00:00Z', '2026-09-09T12:00:00Z', '2026-09-09T08:00:00Z', 'UTC', [duty('planned')], [sleep('2026-09-08T01:00:00Z', '2026-09-08T06:00:00Z', 'estimated')]);
    expect(days[0]).toMatchObject({ dutyHours: 0, plannedHours: 2, reportedSleep: 0, estimatedSleep: 5 });
  });
});
