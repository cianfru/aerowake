/**
 * The pilot's sleep preferences: usual night at home and pre-duty nap habit.
 *
 * Mirrors the backend's SleepHabits (core/parameters.py): bedtime 20:00–02:00,
 * wake-up 04:00–11:00, 5–11 hours apart. Defaults 23:00–07:00, naps 'sometimes'.
 */
import { normaliseClock } from '@/lib/report-time';
import type { NapHabit, PilotSettings } from '@/types/fatigue';

export interface SleepPreferences {
  usualBedtime: string;
  usualWakeTime: string;
  napHabit: NapHabit;
}

export const DEFAULT_SLEEP_PREFERENCES: SleepPreferences = { usualBedtime: '23:00', usualWakeTime: '07:00', napHabit: 'sometimes' };

/** API shape (users.sleep_preferences, analysis assumptions). */
export interface SleepPreferencesPayload {
  usual_bedtime?: string | null;
  usual_wake_time?: string | null;
  nap_habit?: string | null;
}

const isHabit = (v: unknown): v is NapHabit => v === 'usually' || v === 'sometimes' || v === 'rarely';

function minutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

/** The night's length in hours, or null for an unreadable time. */
export function nightHours(bedtime: string, wake: string): number | null {
  const b = normaliseClock(bedtime), w = normaliseClock(wake);
  if (!b || !w) return null;
  let bed = minutes(b);
  if (bed < 12 * 60) bed += 24 * 60;
  return (minutes(w) + 24 * 60 - bed) / 60;
}

/** A message for the first problem, or null when the night is accepted. */
export function validateNight(bedtime: string, wake: string): string | null {
  const b = normaliseClock(bedtime), w = normaliseClock(wake);
  if (!b) return 'Enter your usual bedtime as a 24-hour time, e.g. 23:00.';
  if (!w) return 'Enter your usual wake-up as a 24-hour time, e.g. 07:00.';
  let bed = minutes(b);
  if (bed < 12 * 60) bed += 24 * 60;
  if (bed < 20 * 60 || bed > 26 * 60) return 'Usual bedtime must be between 20:00 and 02:00.';
  const wakeM = minutes(w);
  if (wakeM < 4 * 60 || wakeM > 11 * 60) return 'Usual wake-up must be between 04:00 and 11:00.';
  const hours = nightHours(b, w)!;
  if (hours < 5 || hours > 11) return 'Your usual night must last between 5 and 11 hours.';
  return null;
}

export function fromPayload(p: SleepPreferencesPayload | null | undefined): Partial<SleepPreferences> {
  if (!p) return {};
  const out: Partial<SleepPreferences> = {};
  const bed = p.usual_bedtime ? normaliseClock(p.usual_bedtime) : null;
  const wake = p.usual_wake_time ? normaliseClock(p.usual_wake_time) : null;
  if (bed) out.usualBedtime = bed;
  if (wake) out.usualWakeTime = wake;
  if (isHabit(p.nap_habit)) out.napHabit = p.nap_habit;
  return out;
}

export function toPayload(p: SleepPreferences): Required<SleepPreferencesPayload> {
  return { usual_bedtime: p.usualBedtime, usual_wake_time: p.usualWakeTime, nap_habit: p.napHabit };
}

export function fromSettings(s: Pick<PilotSettings, 'napHabit' | 'usualBedtime' | 'usualWakeTime'>): SleepPreferences {
  return {
    usualBedtime: s.usualBedtime ?? DEFAULT_SLEEP_PREFERENCES.usualBedtime,
    usualWakeTime: s.usualWakeTime ?? DEFAULT_SLEEP_PREFERENCES.usualWakeTime,
    napHabit: s.napHabit ?? DEFAULT_SLEEP_PREFERENCES.napHabit,
  };
}

export function samePreferences(a: SleepPreferences, b: SleepPreferences): boolean {
  return a.usualBedtime === b.usualBedtime && a.usualWakeTime === b.usualWakeTime && a.napHabit === b.napHabit;
}
