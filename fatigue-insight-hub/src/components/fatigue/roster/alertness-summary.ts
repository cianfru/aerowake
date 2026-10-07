import { homeDayKey } from '@/lib/home-time';
import type { AlertnessSample } from '@/types/fatigue';

export interface DailyAlertnessSummary {
  day: string;
  timestamp: number;
  peak: number | null;
  samples: number;
  missing: number;
  asleep: number;
}

/** Accessible summaries of supplied model samples, never filling unobserved periods. */
export function dailyAlertnessSummaries(samples: AlertnessSample[], homeTz: string): DailyAlertnessSummary[] {
  const days = new Map<string, DailyAlertnessSummary>();
  for (const s of samples) {
    if (!Number.isFinite(s.t)) continue;
    const day = homeDayKey(new Date(s.t).toISOString(), homeTz);
    if (!day) continue;
    const row = days.get(day) ?? { day, timestamp: s.t, peak: null, samples: 0, missing: 0, asleep: 0 };
    row.samples++;
    if (s.asleep) row.asleep++;
    else if (s.kss != null && Number.isFinite(s.kss) && s.kss >= 1 && s.kss <= 9) row.peak = Math.max(row.peak ?? 1, s.kss);
    else row.missing++;
    days.set(day, row);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}
