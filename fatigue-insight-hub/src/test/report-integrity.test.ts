import { describe, expect, it } from 'vitest';
import { formatBAC, hoursAwakeToBAC, sleepDebtSeverity } from '@/lib/report-impairment';
import { generateExecutiveSummary, findWorstPoint, findThresholdCrossings } from '@/lib/report-narrative';
import { getKSSLabel } from '@/lib/fatigue-calculations';
import type { DutyAnalysis, TimelinePoint } from '@/types/fatigue';

const point = (performance: number, hours: number, rest = false) => ({performance, hours_on_duty: hours, is_in_rest: rest}) as TimelinePoint;
describe('report integrity', () => {
  it('formats percentage BAC once', () => {
    expect(formatBAC(hoursAwakeToBAC(17))).toContain('0.05%');
    expect(formatBAC(hoursAwakeToBAC(24))).toContain('0.10%');
  });
  it('does not invent impairment or measured sleepiness from an index', () => {
    const duty = {minPerformance: 73, landingPerformance: 74, overallRisk: 'LOW', modelVersion: 'test'} as DutyAnalysis;
    const summary = generateExecutiveSummary(duty, null, null);
    expect(summary).toContain('classification: low');
    expect(summary).not.toMatch(/BAC|significant fatigue|equivalent|subjective sleepiness/);
    expect(summary).toContain('not a measured fatigue state');
  });
  it('uses saved thresholds rather than historical hardcoded values', () => {
    const timeline = [point(76,0),point(73,1),point(71,2)];
    expect(findThresholdCrossings(timeline)).toEqual([]);
    expect(findThresholdCrossings(timeline,{low:[72,100]})).toMatchObject([{threshold:72,crossedAt:2}]);
    expect(findThresholdCrossings(timeline,{low:[75,100]})).toMatchObject([{threshold:75,crossedAt:1}]);
  });
  it('excludes rest and invalid samples from operational extremes', () => {
    expect(findWorstPoint([point(20,0,true),point(NaN,1),point(73,2)])?.performance).toBe(73);
    expect(findWorstPoint([point(20,0,true)])).toBeNull();
  });
  it('does not equate debt to total deprivation and uses correct KSS wording', () => {
    expect(sleepDebtSeverity(7).description).not.toContain('24-48');
    expect(getKSSLabel(7).label).toContain('no effort');
    expect(getKSSLabel(8).label).toContain('some effort');
  });
});
