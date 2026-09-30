import { describe, expect, it } from 'vitest';
import { buildRosterForecast } from '@/lib/roster-forecast';
import { dutyFromAnalysis, reportToText, type FatigueReport } from '@/lib/fatigue-report-api';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { rosterFixture } from './fixtures/roster-analysis';

const results = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1));

describe('pilot fatigue outlook', () => {
  it('keeps chronological order and model outputs when the personal reference changes', () => {
    const shuffled = { ...results, duties: [...results.duties].reverse() };
    const low = buildRosterForecast(shuffled, 1);
    const high = buildRosterForecast(shuffled, 9);
    expect(low.map(r => r.duty.dutyId)).toEqual(['D1', 'D2', 'D3', 'D4']);
    expect(low.every(r => r.reachesWatch)).toBe(true);
    expect(high.every(r => !r.reachesWatch)).toBe(true);
    expect(low.map(r => r.peak)).toEqual(high.map(r => r.peak));
    expect(results.duties.map(d => d.maxKss)).toEqual(low.map(r => r.peak));
  });

  it('does not interpret legacy scores or manufacture first-duty recovery', () => {
    expect(buildRosterForecast({ ...results, legacyModel: true }).every(r => r.peak === null)).toBe(true);
    expect(buildRosterForecast(results)[0]).toMatchObject({ gapHours: null, peakChange: null, deficitChange: null });
  });

  it('does not call standby a free recovery interval', () => {
    const pair = results.duties.slice(0, 2);
    const roster = { ...results, duties: pair, standbyPeriods: [{ id: 's', type: 'home_standby' as const,
      startUtc: pair[0].releaseTimeUtc!, endUtc: pair[1].reportTimeUtc!, code: 'SBY', startHome: '', endHome: '', date: '', countedDutyHours: 1 }] };
    expect(buildRosterForecast(roster)[1].gapHours).toBeNull();
  });

  it('treats imported duties as planned until pilot confirmation', () => {
    expect(dutyFromAnalysis(results.duties[0], 0)?.status).toBe('planned');
  });

  it('carries scientific sources but keeps the personal reference out of the operator text export', () => {
    const report = { event: { type: 'roster_concern' }, pilot: {}, summary: { headline: 'Review this pattern.' },
      data_quality: { confidence: 'medium' }, narrative: [], findings: [], limitations: [],
      watch_reference: { kss: 6, duty_ids: ['D2'], explanation: 'Personal review prompt.' },
      scientific_basis: [{ citation: 'Ingre et al. (2014)', application: 'Predicted sleepiness.', url: 'https://doi.org/10.1371/journal.pone.0108679' }],
    } as unknown as FatigueReport;
    const text = reportToText(report);
    expect(text).toContain('PROSPECTIVE ROSTER CONCERN');
    expect(text).not.toContain('Personal review prompt.');
    expect(text).toContain('Ingre et al. (2014)');
  });
});
