import { describe, expect, it } from 'vitest';
import * as impairment from '@/lib/report-impairment';
import { sleepDebtSeverity, describeRiskLevel } from '@/lib/report-impairment';
import { generateExecutiveSummary, findWorstPoint, findThresholdCrossings } from '@/lib/report-narrative';
import { getKSSLabel, performanceToKSS, decomposePerformance, calculateFHA } from '@/lib/fatigue-calculations';
import {
  DEFAULT_RISK_THRESHOLDS,
  classifyPerformance,
  indexToKss,
  kssToIndex,
  riskReferenceLines,
} from '@/lib/risk-scale';
import type { DutyAnalysis, TimelinePoint } from '@/types/fatigue';

const point = (performance: number, hours: number, rest = false) => ({performance, hours_on_duty: hours, is_in_rest: rest}) as TimelinePoint;
describe('report integrity', () => {
  it('no longer offers alcohol-equivalence converters', () => {
    const mod = impairment as Record<string, unknown>;
    expect(mod.hoursAwakeToBAC).toBeUndefined();
    expect(mod.formatBAC).toBeUndefined();
    expect(mod.performanceToEquivalentAwakeHours).toBeUndefined();
    expect(impairment.describeTimeAwakeAtPhase(10, 8, 'landing')).not.toMatch(/BAC|alcohol/i);
    expect(impairment.describeAwakeHoursImpairment(22).description).not.toMatch(/BAC|alcohol|legal/i);
  });
  it('does not invent impairment or measured sleepiness from an index', () => {
    const duty = {minPerformance: 73, landingPerformance: 74, overallRisk: 'LOW', modelVersion: 'test'} as DutyAnalysis;
    const summary = generateExecutiveSummary(duty, null, null);
    expect(summary).toContain('classification: low');
    expect(summary).not.toMatch(/BAC|significant fatigue|equivalent|subjective sleepiness|%/);
    expect(summary).toContain('not a measured fatigue state');
    // index 73 → KSS 3.7 (rounded anchor 4, "Rather alert")
    expect(summary).toContain('KSS 3.7');
    expect(summary).toContain('Rather alert');
  });
  it('prefers backend KSS over the index in the summary', () => {
    const duty = {minPerformance: 50, maxKss: 6.2, landingPerformance: 52, landingKss: 5.8, overallRisk: 'MODERATE', modelVersion: 'aerowake-4.0-kss'} as DutyAnalysis;
    const summary = generateExecutiveSummary(duty, null, null);
    expect(summary).toContain('KSS 6.2');
    expect(summary).toContain('KSS 5.8');
  });
  it('uses saved thresholds, else the KSS band defaults', () => {
    const timeline = [point(76,0),point(73,1),point(71,2)];
    // Default bands start at 55 — a 71–76 timeline never leaves the low band.
    expect(findThresholdCrossings(timeline)).toEqual([]);
    expect(findThresholdCrossings(timeline,{low:[72,100]})).toMatchObject([{threshold:72,crossedAt:2}]);
    expect(findThresholdCrossings(timeline,{low:[75,100]})).toMatchObject([{threshold:75,crossedAt:1}]);
    const declining = [point(60,0),point(54,1),point(44,2),point(34,3),point(24,4)];
    expect(findThresholdCrossings(declining).map(c => c.threshold)).toEqual([55,45,35,25]);
    expect(findThresholdCrossings(declining)[0].thresholdLabel).toContain('KSS 5.5');
  });
  it('excludes rest and invalid samples from operational extremes', () => {
    expect(findWorstPoint([point(20,0,true),point(NaN,1),point(73,2)])?.performance).toBe(73);
    expect(findWorstPoint([point(20,0,true)])).toBeNull();
  });
  it('does not equate debt to total deprivation and uses correct KSS wording', () => {
    expect(sleepDebtSeverity(7).description).not.toContain('24-48');
    expect(getKSSLabel(7).label).toContain('no effort');
    expect(getKSSLabel(8).label).toContain('some effort');
    expect(getKSSLabel(9).label).toContain('fighting sleep');
  });
});

describe('risk scale (aerowake-4.0-kss)', () => {
  it('maps the index linearly to KSS', () => {
    expect(indexToKss(100)).toBe(1);
    expect(indexToKss(60)).toBe(5);
    expect(indexToKss(20)).toBe(9);
    expect(kssToIndex(6.2)).toBeCloseTo(48);
    expect(performanceToKSS(48)).toBeCloseTo(6.2);
  });
  it('classifies with lower-bound-inclusive default bands', () => {
    expect(classifyPerformance(55)).toBe('low');
    expect(classifyPerformance(54.9)).toBe('moderate');
    expect(classifyPerformance(45)).toBe('moderate');
    expect(classifyPerformance(44.9)).toBe('high');
    expect(classifyPerformance(35)).toBe('high');
    expect(classifyPerformance(34.9)).toBe('critical');
    expect(classifyPerformance(25)).toBe('critical');
    expect(classifyPerformance(24.9)).toBe('extreme');
    expect(classifyPerformance(NaN)).toBe('unknown');
    expect(classifyPerformance(undefined)).toBe('unknown');
  });
  it('prefers backend-provided thresholds (e.g. conservative preset)', () => {
    const conservative = {low: [60, 100], moderate: [50, 60], high: [40, 50], critical: [30, 40], extreme: [0, 30]} as Record<string, [number, number]>;
    expect(classifyPerformance(57, conservative)).toBe('moderate');
    expect(classifyPerformance(57)).toBe('low');
    expect(riskReferenceLines(conservative).map(l => l.value)).toEqual([60, 50, 40, 30]);
    expect(riskReferenceLines().map(l => l.label)).toEqual(['KSS 5.5', 'KSS 6.5', 'KSS 7.5', 'KSS 8.5']);
    expect(DEFAULT_RISK_THRESHOLDS.low[0]).toBe(55);
  });
  it('describes every band including extreme without percentages', () => {
    for (const level of ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'EXTREME']) {
      const d = describeRiskLevel(level);
      expect(d.description).toContain('KSS');
      expect(d.description).not.toMatch(/%/);
    }
  });
  it('decomposes KSS into sleep-pressure and circadian contributions', () => {
    const d = decomposePerformance({performance: 48, kss: 6.2, sleep_pressure: 0.5, circadian: 0.2, hours_on_duty: 3});
    expect(d.kss).toBeCloseTo(6.2);
    expect(d.sKss).toBeCloseTo(2.7, 1);  // 0.46 · 11.9 · 0.5
    expect(d.cKss).toBeCloseTo(1.8, 1);  // 0.46 · 5 · 0.8
    expect(d.referenceKss + d.sKss + d.cKss + d.otherKss).toBeCloseTo(6.2, 0);
    expect(d.dominantFactor).toBe('sleep_pressure');
  });
  it('computes FHA in KSS-hours above the low band, excluding rest', () => {
    // 12 × 5-min samples at KSS 6.5 (1 KSS above 5.5) = 1 KSS-hour
    const pts = Array.from({length: 12}, () => ({performance: 45}));
    expect(calculateFHA(pts)).toBeCloseTo(1);
    expect(calculateFHA(pts.map(p => ({...p, is_in_rest: true})))).toBe(0);
  });
});
