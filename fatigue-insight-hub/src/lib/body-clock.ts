import type { BodyClockTimelineEntry } from '@/types/fatigue';
import { homeDayKey } from './home-time';

/** Actual model samples only: no frontend adaptation model or extrapolation. */
export function bodyClockSamples(entries: BodyClockTimelineEntry[], monthKey: string, homeTimezone: string) {
  return entries.filter(entry => Number.isFinite(Date.parse(entry.timestampUtc)) && Number.isFinite(entry.phaseShiftHours))
    .map(entry => ({ ...entry, day: homeDayKey(entry.timestampUtc, homeTimezone), instant: Date.parse(entry.timestampUtc) }))
    .filter(entry => entry.day.startsWith(`${monthKey}-`))
    .sort((a, b) => a.instant - b.instant);
}
