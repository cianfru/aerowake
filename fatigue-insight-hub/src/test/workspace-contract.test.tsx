import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AnalysisResult, Duty } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { homeBaseTransform } from '@/lib/timeline-transforms';
import { classifyKss } from '@/lib/risk-scale';
import { formatHomeTime, homeDayKey, zoneOffsetLabel } from '@/lib/home-time';
import { groupDutiesToWatch, selectDutiesToWatch } from '@/components/fatigue/roster/roster-utils';
import { groupCoverage } from '@/components/fatigue/roster/EasaChecksCard';
import { assumptionsLine } from '@/components/fatigue/roster/RosterForecast';
import { MonthStrip } from '@/components/fatigue/roster/MonthStrip';
import { shortfallPoints } from '@/components/fatigue/SleepDebtTrendChart';
import { rosterFixture } from './fixtures/roster-analysis';

const month = new Date(2026, 8, 1);

/** The shared fixture plus the additive per-sector contract on D1 and D4. */
function withSectorFields(): AnalysisResult {
  const clone: AnalysisResult = JSON.parse(JSON.stringify(rosterFixture));
  const d1 = clone.duties[0] as Duty;
  d1.segments[0].kss_peak = 2.4;
  d1.segments[0].kss_at_arrival = 2.2;
  d1.segments[0].risk_level = 'low';
  d1.segments[1].kss_peak = 5.46; // displays as 5.5: moderate, the band must agree
  d1.segments[1].kss_at_arrival = 5.1;
  d1.segments[1].risk_level = 'moderate';
  d1.peak_time_utc = '2026-09-02T10:30:00Z';
  d1.kss_peak_fdp = 3.0;
  clone.assumptions = { nap_habit: 'Rarely', headline_risk_window: 'fdp' };
  return clone;
}

describe('additive per-sector API contract', () => {
  it('maps sector KSS, peak time, FDP peak and assumptions when present', () => {
    const results = transformAnalysisResult(withSectorFields(), month);
    const d1 = results.duties[0];
    expect(d1.flightSegments[0]).toMatchObject({ kssPeak: 2.4, kssAtArrival: 2.2, riskLevel: 'low' });
    expect(d1.flightSegments[1]).toMatchObject({ kssPeak: 5.46, riskLevel: 'moderate' });
    expect(d1.peakTimeUtc).toBe('2026-09-02T10:30:00Z');
    expect(d1.kssPeakFdp).toBe(3.0);
    expect(results.assumptions).toEqual({ napHabit: 'rarely', headlineRiskWindow: 'fdp' });
    expect(assumptionsLine(results)).toContain('rarely');
    expect(assumptionsLine(results)).toContain('last on-blocks');
  });

  it('falls back without inventing values when the fields are absent', () => {
    const results = transformAnalysisResult(rosterFixture, month);
    for (const duty of results.duties) {
      for (const seg of duty.flightSegments) {
        expect(seg.kssPeak).toBeNull();
        expect(seg.kssAtArrival).toBeNull();
        expect(seg.riskLevel).toBeNull();
        expect(seg.performance).toBeUndefined();
      }
    }
    expect(results.assumptions).toBeUndefined();
    expect(assumptionsLine(results)).not.toContain('nap');
  });

  it('colours calendar sectors by the model sector band, else by the duty peak band', () => {
    const withFields = transformAnalysisResult(withSectorFields(), month);
    const data = homeBaseTransform(withFields.duties, withFields.statistics, month);
    const d1Flights = data.dutyBars.filter((b) => b.duty.dutyId === 'D1').flatMap((b) => b.segments).filter((s) => s.type === 'flight');
    expect(d1Flights.map((s) => s.level)).toEqual(['low', 'moderate']);
    expect(d1Flights.map((s) => s.kss)).toEqual([2.4, 5.46]);

    const fallback = transformAnalysisResult(rosterFixture, month);
    const fbData = homeBaseTransform(fallback.duties, fallback.statistics, month);
    const d4Flights = fbData.dutyBars.filter((b) => b.duty.dutyId === 'D4').flatMap((b) => b.segments).filter((s) => s.type === 'flight');
    expect(d4Flights.length).toBe(2);
    // No per-sector values: every sector shows the duty peak band (6.9 → high), never an interpolation.
    expect(d4Flights.every((s) => s.level === 'high' && s.kss === null)).toBe(true);
    // Every non-flight slice is neutral duty time in the duty band, without a value.
    for (const bar of fbData.dutyBars) {
      for (const seg of bar.segments) if (seg.type !== 'flight') expect(seg.kss).toBeNull();
    }
  });

  it('places a peak marker at peak_time_utc, measured from report on the duty row', () => {
    const results = transformAnalysisResult(withSectorFields(), month);
    const data = homeBaseTransform(results.duties, results.statistics, month);
    const marker = (data.peakMarkers ?? []).find((m) => m.duty.dutyId === 'D1');
    expect(marker).toBeDefined();
    // Report 06:00 on the row (the fixture's home-base report time); the peak is 4.5h after report.
    expect(marker!.hour).toBeCloseTo(10.5, 5);
    expect(marker!.level).toBe('low');
  });
});

describe('band classification on the displayed value', () => {
  it('rounds to one decimal before classifying, lower bound inclusive', () => {
    expect(classifyKss(6.46)).toBe('high');
    expect(classifyKss(6.44)).toBe('moderate');
    expect(classifyKss(5.5)).toBe('moderate');
    expect(classifyKss(8.5)).toBe('extreme');
    expect(classifyKss(null)).toBe('unknown');
  });
});

describe('home-base time helpers', () => {
  it('formats instants in the home zone on a 24-hour clock', () => {
    expect(formatHomeTime('2026-10-30T21:40:00Z', 'Asia/Qatar')).toBe('00:40');
    expect(homeDayKey('2026-10-30T21:40:00Z', 'Asia/Qatar')).toBe('2026-10-31');
    expect(zoneOffsetLabel('Asia/Qatar', '2026-10-30T21:40:00Z')).toBe('UTC+3');
    expect(formatHomeTime('not a date', 'Asia/Qatar')).toBe('');
  });
});

describe('outlook helpers', () => {
  it('keeps duties to watch worst first and lifts shared reasons into the band group', () => {
    const results = transformAnalysisResult(rosterFixture, month);
    const high = results.duties.find((d) => d.dutyId === 'D4')!;
    const twin = { ...high, dutyId: 'D5', maxKss: 7.1, riskReasons: ['Early report after a late finish', 'Only one sector'] };
    const watch = selectDutiesToWatch({ duties: [...results.duties, twin] });
    expect(watch.map((d) => d.dutyId)).toEqual(['D3', 'D5', 'D4']);
    const groups = groupDutiesToWatch(watch);
    expect(groups.map((g) => g.level)).toEqual(['critical', 'high']);
    expect([...groups[1].shared]).toEqual(['Early report after a late finish']);
    expect(groups[0].shared.size).toBe(0);
  });

  it('states a coverage reason once for all the checks it applies to', () => {
    const grouped = groupCoverage({
      duty_7d: { status: 'incomplete_history', reason: 'Only supplied activities were assessed.' },
      duty_28d: { status: 'incomplete_history', reason: 'Only supplied activities were assessed.' },
      fdp_max: { status: 'passed', reason: 'n/a' },
      min_rest: { status: 'not_assessed', reason: 'Home base identity is missing.' },
    });
    expect(grouped).toHaveLength(2);
    expect(grouped[0].rules.map((r) => r.rule)).toEqual(['duty_7d', 'duty_28d']);
  });

  it('plots the backend 7-day ledger only, in time order', () => {
    const results = transformAnalysisResult(rosterFixture, month);
    const duties = results.duties.map((d, i) => ({ ...d, sleepDeficit7d: { days: 7, sleepHours: 52 - i, needHours: 56, deficitHours: 4 + i, band: 'none' as const } }));
    const pts = shortfallPoints([duties[2], duties[0], duties[1]]);
    expect(pts.map((p) => p.hours)).toEqual([4, 5, 6]);
    expect(shortfallPoints(results.duties)).toEqual([]);
  });

  it('draws one month strip column per day and opens details from a duty day', () => {
    const results = transformAnalysisResult(rosterFixture, month);
    const onDetails = vi.fn();
    render(<MonthStrip results={results} reference={6.5} onDetails={onDetails} />);
    const list = screen.getByRole('list', { name: /Duty peaks and estimated sleep by day/ });
    expect(list.querySelectorAll(':scope > li')).toHaveLength(30);
    const d3 = screen.getByRole('button', { name: /Wed 9 Sep: LGW → TFS, peak KSS 8\.0, Critical/ });
    fireEvent.click(d3);
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ dutyId: 'D3' }));
  });
});
