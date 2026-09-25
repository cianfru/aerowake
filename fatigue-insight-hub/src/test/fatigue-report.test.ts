import { describe, expect, it } from 'vitest';
import {
  dutyFromAnalysis, estimatedSleepsFromAnalysis, localInputToUtcIso, reportToText, utcIsoToLocalInput,
  type FatigueReport,
} from '@/lib/fatigue-report-api';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';

describe('time-zone conversion', () => {
  it('round-trips wall-clock time in a DST zone', () => {
    // London is UTC+1 in September.
    expect(localInputToUtcIso('2026-09-08T05:30', 'Europe/London')).toBe('2026-09-08T04:30:00.000Z');
    expect(utcIsoToLocalInput('2026-09-08T04:30:00.000Z', 'Europe/London')).toBe('2026-09-08T05:30');
  });

  it('handles zones ahead of UTC and UTC itself', () => {
    expect(localInputToUtcIso('2026-09-08T01:00', 'Asia/Qatar')).toBe('2026-09-07T22:00:00.000Z');
    expect(localInputToUtcIso('2026-09-08T01:00', 'UTC')).toBe('2026-09-08T01:00:00.000Z');
  });

  it('crosses the spring-forward boundary', () => {
    // 29 Mar 2026 London: 01:00 GMT -> 02:00 BST
    expect(localInputToUtcIso('2026-03-29T03:00', 'Europe/London')).toBe('2026-03-29T02:00:00.000Z');
    expect(localInputToUtcIso('2026-03-28T23:00', 'Europe/London')).toBe('2026-03-28T23:00:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(localInputToUtcIso('', 'UTC')).toBeNull();
  });
});

describe('pre-fill from roster analysis', () => {
  const duty = {
    dutyId: 'D1',
    reportTimeUtc: '2026-09-07T13:00:00Z',
    releaseTimeUtc: '2026-09-07T23:45:00Z',
    flightSegments: [
      { flightNumber: 'EZY1', departure: 'LGW', arrival: 'FCO', departureTimeUtc: '14:00Z', arrivalTimeUtc: '16:30Z' },
      // Arrival after midnight UTC must roll to the next day.
      { flightNumber: 'EZY2', departure: 'FCO', arrival: 'LGW', departureTimeUtc: '21:30Z', arrivalTimeUtc: '00:15Z' },
    ],
  } as unknown as DutyAnalysis;

  it('rebuilds full sector instants chronologically', () => {
    const d = dutyFromAnalysis(duty, 0)!;
    expect(d.sectors.map((s) => [s.departure_utc, s.arrival_utc])).toEqual([
      ['2026-09-07T14:00:00.000Z', '2026-09-07T16:30:00.000Z'],
      ['2026-09-07T21:30:00.000Z', '2026-09-08T00:15:00.000Z'],
    ]);
    expect(d.source).toBe('roster');
  });

  it('marks roster sleep as estimated and drops overlaps', () => {
    const results = {
      duties: [{
        ...duty,
        sleepEstimate: {
          environment: 'home',
          sleepBlocks: [
            { sleepStartUtc: '2026-09-06T22:00:00Z', sleepEndUtc: '2026-09-07T06:00:00Z', sleepType: 'main' },
            { sleepStartUtc: '2026-09-07T05:00:00Z', sleepEndUtc: '2026-09-07T07:00:00Z', sleepType: 'nap' },
          ],
        },
      }],
      restDaysSleep: [],
    } as unknown as AnalysisResults;
    const sleeps = estimatedSleepsFromAnalysis(results, '2026-09-07T00:00:00Z', '2026-09-08T12:00:00Z');
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toMatchObject({ source: 'estimated', location: 'home', kind: 'main' });
  });
});

describe('text export', () => {
  it('includes headline, findings and limitations', () => {
    const text = reportToText({
      generated_at: 'now', report_version: 'v', engine_version: 'e', pilot: { name: 'A' },
      summary: { headline: 'Supported.' }, data_quality: { confidence: 'high' },
      narrative: [{ title: 'Event', text: 'Called fatigue.' }],
      findings: [{ severity: 'warning', title: 'Short rest', detail: '4h45', reference: 'ORO.FTL.235' }],
      pilot_narrative: '', limitations: ['Average pilot.'],
    } as unknown as FatigueReport);
    expect(text).toContain('SUMMARY: Supported.');
    expect(text).toContain('[WARNING] Short rest: 4h45 (ORO.FTL.235)');
    expect(text).toContain('- Average pilot.');
  });
});
