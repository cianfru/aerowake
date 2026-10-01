import type { DutyAnalysis } from '@/types/fatigue';

/** Sectors of at least this block time can be flown augmented, so the pilot may state the crew. */
export const LONG_SECTOR_BLOCK_HOURS = 7;

export type CrewInfo = Pick<DutyAnalysis, 'crewComposition' | 'ulrCrewSet' | 'isUlr' | 'flightSegments' | 'inflightRestBlocks'>;

export function isAugmented(duty: Pick<DutyAnalysis, 'crewComposition'>): boolean {
  return duty.crewComposition === 'augmented_3' || duty.crewComposition === 'augmented_4';
}

/** Long-haul sectors where an augmented crew is plausible, even if the roster does not say so. */
export function canBeAugmented(duty: CrewInfo): boolean {
  return isAugmented(duty) || (duty.flightSegments ?? []).some((s) => (s.blockHours ?? 0) >= LONG_SECTOR_BLOCK_HOURS);
}

/** '4 pilots · ULR · Crew B', '3 pilots', or null for a standard crew. */
export function crewLabel(duty: CrewInfo): string | null {
  if (duty.crewComposition === 'augmented_4') {
    const set = duty.ulrCrewSet === 'crew_a' ? 'Crew A' : duty.ulrCrewSet === 'crew_b' ? 'Crew B' : null;
    return ['4 pilots', duty.isUlr ? 'ULR' : null, set].filter(Boolean).join(' · ');
  }
  if (duty.crewComposition === 'augmented_3') return '3 pilots';
  return null;
}

/** Total in-flight sleep the model credited, hours. */
export function inflightSleepHours(duty: CrewInfo): number {
  return (duty.inflightRestBlocks ?? []).reduce((sum, b) => sum + (b.effectiveSleepHours ?? 0), 0);
}
