import { describe, expect, it } from 'vitest';
import { homeBaseTransform, utcTransform } from '@/lib/timeline-transforms';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { rosterFixture } from './fixtures/roster-analysis';

const month = new Date(2026, 8, 1);
const { duties, statistics } = transformAnalysisResult(rosterFixture, month);

describe('calendar dates and time references', () => {
  it('positions the home-base night on UTC, including midnight wrap and quarter-hour offsets', () => {
    const data = utcTransform([], statistics, month, [], 'Asia/Kathmandu');
    expect(data.woclBands.filter((band) => band.rowIndex === 1)).toEqual([
      { rowIndex: 1, startHour: 0, endHour: 0.25 },
      { rowIndex: 1, startHour: 20.25, endHour: 24 },
    ]);
  });

  it('uses the offset on each actual day across a DST change', () => {
    const data = utcTransform([], statistics, new Date(2026, 9, 1), [], 'Europe/London');
    expect(data.woclBands.find((band) => band.rowIndex === 24)).toEqual({ rowIndex: 24, startHour: 1, endHour: 5 });
    expect(data.woclBands.find((band) => band.rowIndex === 25)).toEqual({ rowIndex: 25, startHour: 2, endHour: 6 });
  });

  it('does not invent a home-base night window when timezone is unavailable', () => {
    expect(utcTransform(duties, statistics, month).woclBands).toEqual([]);
    expect(utcTransform(duties, statistics, month, [], 'invalid').woclBands).toEqual([]);
  });

  it.each([
    { date: '2026-10-25', month: new Date(2026, 9, 1), reportLocal: '01:00', expectedHour: 4 },
    { date: '2026-03-29', month: new Date(2026, 2, 1), reportLocal: '00:00', expectedHour: 5 },
  ])('places peak and FDP markers at their actual home-clock instants across DST on $date', ({ date, month, reportLocal, expectedHour }) => {
    const duty = { ...duties[0], date: new Date(`${date}T12:00:00`), dateString: date,
      reportTimeUtc: `${date}T00:00:00Z`, releaseTimeUtc: `${date}T06:00:00Z`,
      reportTimeLocal: reportLocal, releaseTimeLocal: '07:00',
      peakTimeUtc: `${date}T04:00:00Z`, maxFdpHours: 4,
    };
    const home = homeBaseTransform([duty], statistics, month, [], 'Europe/London');
    const utc = utcTransform([duty], statistics, month, [], 'Europe/London');
    expect(home.peakMarkers[0]).toMatchObject({ rowIndex: Number(date.slice(8)), hour: expectedHour });
    expect(home.fdpMarkers[0]).toMatchObject({ rowIndex: Number(date.slice(8)), hour: expectedHour });
    expect(utc.peakMarkers[0]).toMatchObject({ rowIndex: Number(date.slice(8)), hour: 4 });
    expect(utc.fdpMarkers[0]).toMatchObject({ rowIndex: Number(date.slice(8)), hour: 4 });
  });

  it('includes post-flight duty time and labels the UTC date rather than the home date', () => {
    const duty = { ...duties[0], date: new Date(2026, 8, 2), dateString: '2026-09-02',
      reportTimeUtc: '2026-09-01T22:00:00Z', releaseTimeUtc: '2026-09-02T04:30:00Z',
      flightSegments: [{ ...duties[0].flightSegments[0], departureTimeUtc: '2026-09-01T23:00:00Z', arrivalTimeUtc: '2026-09-02T04:00:00Z' }] };
    const data = utcTransform([duty], statistics, month);
    expect(data.dutyBars.map((bar) => [bar.rowIndex, bar.startHour, bar.endHour])).toEqual([[1, 22, 24], [2, 0, 4.5]]);
    expect(data.dutyBars[1].segments.some((segment) => segment.type === 'postflight')).toBe(true);
    expect(data.rowLabels[0].peakKss).toBe(duty.maxKss);
    expect(data.rowLabels[1].peakKss).toBe(duty.maxKss);
  });

  it('clips previous-month duties to their visible continuation in both time views', () => {
    const duty = { ...duties[0], date: new Date(2026, 7, 31), dateString: '2026-08-31',
      reportTimeUtc: '2026-08-31T22:00:00Z', releaseTimeUtc: '2026-09-01T04:30:00Z', reportTimeLocal: '22:00', releaseTimeLocal: '04:30',
      flightSegments: [{ ...duties[0].flightSegments[0], departureTime: '23:00', arrivalTime: '04:00', departureTimeUtc: '2026-08-31T23:00:00Z', arrivalTimeUtc: '2026-09-01T04:00:00Z' }] };
    for (const transform of [homeBaseTransform, utcTransform]) {
      const data = transform([duty], statistics, month, [], 'UTC');
      expect(data.dutyBars.map((bar) => [bar.rowIndex, bar.startHour, bar.endHour])).toEqual([[1, 0, 4.5]]);
      expect(data.rowLabels[0].hasDuty).toBe(true);
      expect(data.rowLabels[29].hasDuty).toBe(false);
    }
  });

  it('preserves sleep starting in the previous month without drawing it at this month’s end', () => {
    const duty = { ...duties[0], sleepEstimate: {
      ...duties[0].sleepEstimate!, totalSleepHours: 8, effectiveSleepHours: 8, sleepEfficiency: 1,
      sleepStrategy: 'normal' as const, woclOverlapHours: 4,
      sleepStartIso: '2026-08-31T22:00:00Z', sleepEndIso: '2026-09-01T06:00:00Z',
      sleepStartDayHomeTz: 31, sleepStartHourHomeTz: 22, sleepEndDayHomeTz: 1, sleepEndHourHomeTz: 6,
    } };
    for (const transform of [homeBaseTransform, utcTransform]) {
      const data = transform([duty], statistics, month, [], 'UTC');
      expect(data.sleepBars.map((bar) => [bar.rowIndex, bar.startHour, bar.endHour])).toEqual([[1, 0, 6]]);
    }
  });

  it('does not treat an unidentified location-clock sleep window as UTC', () => {
    const duty = { ...duties[0], sleepEstimate: {
      ...duties[0].sleepEstimate!, totalSleepHours: 8, effectiveSleepHours: 8, sleepEfficiency: 1,
      sleepStrategy: 'normal' as const, woclOverlapHours: 4,
      sleepStartDay: 1, sleepStartHour: 22, sleepEndDay: 2, sleepEndHour: 6,
    } };
    expect(utcTransform([duty], statistics, month).sleepBars).toEqual([]);
  });
});
