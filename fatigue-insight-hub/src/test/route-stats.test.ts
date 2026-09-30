import { describe, expect, it } from 'vitest';
import type { DutyAnalysis, FlightSegment } from '@/types/fatigue';
import { buildRoutePairs, drawOrder, formatBlock, median, routeColour, routeLevel, routeWidth } from '@/components/fatigue/roster/route-stats';

const seg = (departure: string, arrival: string, extra: Partial<FlightSegment> = {}): FlightSegment => ({
  flightNumber: 'XX1', departure, arrival, departureTime: '10:00', arrivalTime: '12:00', blockHours: 2, performance: 60, ...extra,
});
const duty = (maxKss: number, segments: FlightSegment[]): DutyAnalysis => ({
  date: new Date(2026, 8, 1), dayOfWeek: 'Tue', dutyHours: 8, blockHours: 4, sectors: segments.length,
  minPerformance: 110 - 10 * maxKss, avgPerformance: 60, landingPerformance: 60, sleepDebt: 0, woclExposure: 0, priorSleep: 8,
  overallRisk: 'LOW', minPerformanceRisk: 'LOW', landingRisk: 'LOW', maxKss, modelVersion: 'aerowake-4.0-kss',
  smsReportable: false, riskAdvisory: 'routine', flightSegments: segments,
} as DutyAnalysis);

describe('route pairs', () => {
  it('merges both directions into one pair coloured by the worse direction', () => {
    // A night outbound (High) and a day return (Low): the map must show High, not whichever is drawn last.
    const pairs = buildRoutePairs([
      duty(6.8, [seg('DOH', 'LHR', { blockHours: 7.1 })]),
      duty(5.1, [seg('LHR', 'DOH', { blockHours: 6.5 })]),
    ], 'DOH');
    expect(pairs).toHaveLength(1);
    const [p] = pairs;
    expect(p.key).toBe('DOH-LHR');
    expect([p.a, p.b]).toEqual(['DOH', 'LHR']);
    expect(p.level).toBe('high');
    expect(p.peakKss).toBe(6.8);
    expect(p.sectors).toBe(2);
    expect(p.directions.map((d) => `${d.from}-${d.to}:${d.level}`)).toEqual(['DOH-LHR:high', 'LHR-DOH:low']);
  });

  it('orients a pair from the home base and skips in-flight rest and empty codes', () => {
    const pairs = buildRoutePairs([duty(5, [seg('AUH', 'DOH'), seg('DOH', 'DOH'), seg('DOH', 'BKK', { activityCode: 'IR' }), seg('', 'BKK')])], 'DOH');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toBe('DOH');
    expect(pairs[0].directions).toHaveLength(1);
  });

  it('classifies on the KSS as displayed (rounded to one decimal)', () => {
    expect(routeLevel(6.44)).toBe('moderate'); // shown as 6.4
    expect(routeLevel(6.46)).toBe('high'); // shown as 6.5, so High like the number says
    expect(routeLevel(5.449)).toBe('low');
    expect(routeLevel(5.45)).toBe('moderate');
    expect(routeLevel(null)).toBe('unknown');
  });

  it('uses the backend sector peak when present and says so', () => {
    const pairs = buildRoutePairs([duty(7.2, [seg('DOH', 'NJF', { kssPeak: 5.2 } as Partial<FlightSegment>), seg('NJF', 'DOH', { kssPeak: 7.1 } as Partial<FlightSegment>)])], 'DOH');
    expect(pairs[0].sectorBasis).toBe(true);
    expect(pairs[0].peakKss).toBe(7.1);
    expect(pairs[0].directions[0].level).toBe('low');
    const fallback = buildRoutePairs([duty(7.2, [seg('DOH', 'NJF')])], 'DOH');
    expect(fallback[0].sectorBasis).toBe(false);
    expect(fallback[0].peakKss).toBe(7.2);
  });

  it('draws in ascending severity with hovered and selected last', () => {
    const pairs = buildRoutePairs([
      duty(7.8, [seg('DOH', 'AAA')]), duty(5.0, [seg('DOH', 'BBB')]), duty(6.0, [seg('DOH', 'CCC')]),
    ], 'DOH');
    expect(drawOrder(pairs, null, null).map((p) => p.b)).toEqual(['BBB', 'CCC', 'AAA']);
    expect(drawOrder(pairs, 'BBB-DOH', 'CCC-DOH').map((p) => p.b)).toEqual(['AAA', 'CCC', 'BBB']);
  });

  it('lists the most flown routes first', () => {
    const pairs = buildRoutePairs([duty(5, [seg('DOH', 'AAA'), seg('AAA', 'DOH')]), duty(7, [seg('DOH', 'BBB')])], 'DOH');
    expect(pairs.map((p) => p.b)).toEqual(['AAA', 'BBB']);
  });
});

describe('route presentation', () => {
  it('keeps low routes neutral but visible and uses the shared tokens otherwise', () => {
    expect(routeColour('low')).toContain('--foreground');
    expect(routeColour('high')).toBe('hsl(var(--high))');
    expect(routeColour('extreme')).toBe('hsl(var(--critical))');
  });

  it('scales width with the square root of sectors', () => {
    expect(routeWidth(1, 1)).toBeCloseTo(4);
    expect(routeWidth(1, 4)).toBeCloseTo(2.75);
  });

  it('formats block time and medians', () => {
    expect(formatBlock(1.8333)).toBe('1:50');
    expect(formatBlock(0.999)).toBe('1:00');
    expect(formatBlock(null)).toBe('—');
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2])).toBe(1.5);
    expect(median([])).toBeNull();
  });
});
