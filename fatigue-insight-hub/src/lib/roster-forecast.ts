import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { dutyPeakKss } from '@/components/fatigue/roster/roster-utils';
import { roundKss } from '@/lib/risk-scale';

export const DEFAULT_WATCH_KSS = 6.5;

export interface ForecastDuty {
  duty: DutyAnalysis;
  peak: number | null;
  reachesWatch: boolean;
  gapHours: number | null;
  /** True when a standby period sits between this duty and the previous one. */
  standbyInGap: boolean;
  peakChange: number | null;
  deficitChange: number | null;
}

/** A personal display reference, never a change to model parameters or risk bands. */
export function watchReference(value: number): number {
  return Number.isFinite(value) && value >= 1 && value <= 9 ? value : DEFAULT_WATCH_KSS;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function instant(value?: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Comparisons of existing model outputs; no extra biological scoring layer. */
export function buildRosterForecast(results: AnalysisResults, reference = DEFAULT_WATCH_KSS): ForecastDuty[] {
  const ordered = [...results.duties].sort((a, b) =>
    (instant(a.reportTimeUtc) ?? Infinity) - (instant(b.reportTimeUtc) ?? Infinity));
  return ordered.map((duty, index) => {
    const previous = ordered[index - 1];
    const peak = results.legacyModel ? null : dutyPeakKss(duty);
    const previousPeak = previous && !results.legacyModel ? dutyPeakKss(previous) : null;
    const start = instant(duty.reportTimeUtc);
    const end = instant(previous?.releaseTimeUtc);
    // Standby is an activity, so do not describe it as a recovery gap.
    const standbyInGap = start != null && end != null && results.standbyPeriods?.some(s =>
      Date.parse(s.startUtc) < start && Date.parse(s.endUtc) > end);
    const gapHours = start != null && end != null && start >= end && !standbyInGap
      ? (start - end) / 3600000 : null;
    const deficit = duty.sleepDeficit7d?.deficitHours;
    const previousDeficit = previous?.sleepDeficit7d?.deficitHours;
    return {
      duty, peak, reachesWatch: peak != null && roundKss(peak) >= watchReference(reference), gapHours,
      standbyInGap: !!standbyInGap,
      // Differences of the values as displayed (one decimal), so the stated
      // change always matches the two numbers the pilot sees.
      peakChange: peak != null && previousPeak != null && start != null && end != null && start >= end
        ? round1(roundKss(peak) - roundKss(previousPeak)) : null,
      deficitChange: Number.isFinite(deficit) && Number.isFinite(previousDeficit)
        ? round1(round1(deficit!) - round1(previousDeficit!)) : null,
    };
  });
}
