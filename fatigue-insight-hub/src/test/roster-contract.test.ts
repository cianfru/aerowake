import { describe, expect, it } from 'vitest';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { applyTab, resolveTab } from '@/lib/navigation';
import { standbyBarsForMonth } from '@/lib/standby-bars';
import { buildRosterRows, dutyRoute, selectDutiesToWatch } from '@/components/fatigue/roster/roster-utils';
import { rosterFixture } from './fixtures/roster-analysis';

describe('transform: aerowake-4.0-kss roster fields', () => {
  const r = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1));

  it('maps duties_to_watch, easa_findings, easa_summary and standby_periods to camelCase', () => {
    expect(r.dutiesToWatch).toEqual(['D3', 'D4']);
    expect(r.easaFindings).toHaveLength(2);
    expect(r.easaFindings?.[0]).toMatchObject({
      rule: 'rest_between_duties', reference: 'ORO.FTL.235(a)', severity: 'warning',
      windowStartUtc: '2026-09-11T18:30:00Z', value: 10.5, limit: 12,
    });
    expect(r.easaFindings?.[1].value).toBeUndefined();
    expect(r.easaSummary).toEqual({
      duty7dMax: 38.2, duty14dMax: 71, duty28dMax: 128, block28dMax: 62,
      limits: { duty7d: 60, duty14d: 110, duty28d: 190, block28d: 100 },
    });
    expect(r.standbyPeriods?.[0]).toMatchObject({
      id: 'SB1', type: 'home_standby', startHome: '15:00', endHome: '22:00', date: '2026-09-07', countedDutyHours: 1.75,
    });
  });

  it('maps risk_reasons (max 3) per duty', () => {
    expect(r.duties.find((d) => d.dutyId === 'D3')?.riskReasons).toHaveLength(3);
    expect(r.duties.find((d) => d.dutyId === 'D1')?.riskReasons).toBeUndefined();
  });

  it('is defensive when the backend omits the new fields', () => {
    const legacy = { ...rosterFixture };
    delete legacy.duties_to_watch;
    delete legacy.easa_findings;
    delete legacy.easa_summary;
    delete legacy.standby_periods;
    const t = transformAnalysisResult(legacy, new Date(2026, 8, 1));
    expect(t.dutiesToWatch).toBeUndefined();
    expect(t.easaFindings).toBeUndefined();
    expect(t.easaSummary).toBeUndefined();
    expect(t.standbyPeriods).toBeUndefined();
    // Fallback: elevated duties, worst KSS first
    expect(selectDutiesToWatch(t).map((d) => d.dutyId)).toEqual(['D3', 'D4']);
  });

  it('uses the backend watch list (order and emptiness) when present', () => {
    expect(selectDutiesToWatch({ ...r, dutiesToWatch: ['D4', 'D3'] }).map((d) => d.dutyId)).toEqual(['D4', 'D3']);
    expect(selectDutiesToWatch({ ...r, dutiesToWatch: [] })).toEqual([]);
  });

  it('builds compact rows with standby in chronological order', () => {
    const rows = buildRosterRows(r.duties, r.standbyPeriods);
    expect(rows.map((x) => (x.kind === 'duty' ? x.duty.dutyId : x.standby.id))).toEqual(['D1', 'D2', 'SB1', 'D3', 'D4']);
    expect(dutyRoute(r.duties[0])).toBe('LGW → NCE → LGW');
  });

  it('turns standby periods into chronogram bars for the month', () => {
    expect(standbyBarsForMonth(r.standbyPeriods, new Date(2026, 8, 1))).toEqual([
      expect.objectContaining({ rowIndex: 7, startHour: 15, endHour: 22 }),
    ]);
    expect(standbyBarsForMonth(r.standbyPeriods, new Date(2026, 9, 1))).toEqual([]);
  });
});

describe('navigation: legacy tab ids map onto the four hubs', () => {
  it.each([
    ['summary', 'roster', undefined],
    ['analysis', 'roster', undefined],
    ['insights', 'roster', undefined],
    ['reports', 'roster', undefined],
    ['rosters', 'history', 'rosters'],
    ['yearly', 'history', 'yearly'],
    ['compare', 'history', 'compare'],
    ['about', 'learn', 'about'],
    ['pilot-study', 'learn', 'pilot-study'],
    ['fatigue-report', 'fatigue-report', undefined],
    ['history', 'history', undefined],
    ['learn', 'learn', undefined],
    ['learn:model', 'learn', 'model'],
    ['nonsense', 'roster', undefined],
  ])('%s → %s (%s)', (id, tab, sub) => {
    expect(resolveTab(id)).toEqual(sub ? { tab, subTab: sub } : { tab });
  });

  it('opens a hub at its default sub-tab and keeps the sub-tab when re-selecting the same hub', () => {
    expect(applyTab({ activeTab: 'roster', activeSubTab: null }, 'history')).toEqual({ activeTab: 'history', activeSubTab: 'rosters' });
    expect(applyTab({ activeTab: 'history', activeSubTab: 'yearly' }, 'history')).toEqual({ activeTab: 'history', activeSubTab: 'yearly' });
    expect(applyTab({ activeTab: 'roster', activeSubTab: null }, 'about')).toEqual({ activeTab: 'learn', activeSubTab: 'about' });
    expect(applyTab({ activeTab: 'learn', activeSubTab: 'about' }, 'analysis')).toEqual({ activeTab: 'roster', activeSubTab: null });
  });
});
