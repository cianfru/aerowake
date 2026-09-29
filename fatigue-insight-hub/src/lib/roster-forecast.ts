import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { dutyPeakKss } from '@/components/fatigue/roster/roster-utils';

export const DEFAULT_WATCH_KSS = 6.5;

export interface ForecastDuty {
  duty: DutyAnalysis;
  peak: number | null;
  reachesWatch: boolean;
  gapHours: number | null;
  peakChange: number | null;
  deficitChange: number | null;
}

/** A personal display reference, never a change to model parameters or risk bands. */
export function watchReference(value: number): number {
  return Number.isFinite(value) && value >= 1 && value <= 9 ? value : DEFAULT_WATCH_KSS;
}

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
      duty, peak, reachesWatch: peak != null && peak >= watchReference(reference), gapHours,
      peakChange: peak != null && previousPeak != null && start != null && end != null && start >= end
        ? peak - previousPeak : null,
      deficitChange: Number.isFinite(deficit) && Number.isFinite(previousDeficit)
        ? deficit! - previousDeficit! : null,
    };
  });
}
