import { describe, expect, it } from 'vitest';
import { canBeAugmented, crewLabel, inflightSleepHours } from '@/lib/crew';
import { mergeCrewOverrides } from '@/hooks/useAnalyzeRoster';
import type { DutyAnalysis } from '@/types/fatigue';

const seg = (blockHours: number) => ({ blockHours }) as DutyAnalysis['flightSegments'][number];
const duty = (over: Partial<DutyAnalysis>): DutyAnalysis => ({
  crewComposition: 'standard', ulrCrewSet: null, isUlr: false, flightSegments: [seg(2)], inflightRestBlocks: [], ...over,
}) as DutyAnalysis;

describe('augmented crew presentation', () => {
  it('labels the crew from the analysis', () => {
    expect(crewLabel(duty({}))).toBeNull();
    expect(crewLabel(duty({ crewComposition: 'augmented_3' }))).toBe('3 pilots');
    expect(crewLabel(duty({ crewComposition: 'augmented_4', isUlr: true, ulrCrewSet: 'crew_b' }))).toBe('4 pilots · ULR · Crew B');
  });

  it('lets the pilot state the crew on long sectors the roster cannot mark', () => {
    expect(canBeAugmented(duty({}))).toBe(false);
    expect(canBeAugmented(duty({ flightSegments: [seg(8.5)] }))).toBe(true);
    expect(canBeAugmented(duty({ crewComposition: 'augmented_3' }))).toBe(true);
  });

  it('marks a crew estimated from the FDP, not one read from IR or set by the pilot', () => {
    expect(crewLabel(duty({ crewComposition: 'augmented_3', crewSource: 'fdp' }))).toBe('3 pilots · estimated');
    expect(crewLabel(duty({ crewComposition: 'augmented_3', crewSource: 'roster_ir' }))).toBe('3 pilots');
    expect(crewLabel(duty({ crewComposition: 'augmented_4', ulrCrewSet: 'crew_a', isUlr: true, crewSource: 'fdp' })))
      .toBe('4 pilots · ULR · Crew A · estimated');
    expect(crewLabel(duty({ crewComposition: 'augmented_3', crewSource: 'pilot' }))).toBe('3 pilots');
  });

  it('sums credited in-flight sleep', () => {
    const blocks = [{ effectiveSleepHours: 1.2 }, { effectiveSleepHours: 2.3 }] as DutyAnalysis['inflightRestBlocks'];
    expect(inflightSleepHours(duty({ inflightRestBlocks: blocks }))).toBeCloseTo(3.5);
  });
});

describe('crew overrides sent with an analysis', () => {
  it('merges crew sets, compositions and the change made in this interaction', () => {
    const sets = new Map([['D1', 'crew_a' as const]]);
    const comps = new Map([['D2', 'augmented_3' as const]]);
    const merged = mergeCrewOverrides(sets, comps, { dutyId: 'D1', composition: 'augmented_4' });
    expect(merged.get('D1')).toEqual({ composition: 'augmented_4', crew_set: 'crew_a' });
    expect(merged.get('D2')).toEqual({ composition: 'augmented_3' });
    const cleared = mergeCrewOverrides(sets, comps, { dutyId: 'D2', composition: null });
    expect(cleared.has('D2')).toBe(false);
    expect(cleared.get('D1')).toBe('crew_a');
  });
});
