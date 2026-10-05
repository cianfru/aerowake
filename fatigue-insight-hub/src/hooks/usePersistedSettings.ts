import { PilotSettings, NapHabit } from '@/types/fatigue';
import { validateNight } from '@/lib/sleep-preferences';

const STORAGE_KEY = 'aerowake-pilot-settings';

/** Fields persisted to localStorage (theme excluded — managed by useTheme). */
interface PersistedFields {
  pilotId?: string;
  homeBase?: string;
  /** Legacy (pre-4.0 presets). Read-tolerated, never written. */
  configPreset?: string;
  analysisType?: 'single' | 'range';
  selectedMonth?: string; // ISO string
  napHabit?: NapHabit;
  usualBedtime?: string;
  usualWakeTime?: string;
}

/**
 * Load persisted pilot settings from localStorage.
 * Returns a partial PilotSettings to merge into defaults.
 */
export function loadPersistedSettings(): Partial<PilotSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: PersistedFields = JSON.parse(raw);

    const result: Partial<PilotSettings> = {};
    if (parsed.pilotId) result.pilotId = parsed.pilotId;
    if (parsed.homeBase) result.homeBase = parsed.homeBase;
    // parsed.configPreset (legacy) is intentionally ignored — one model only.
    if (parsed.analysisType) result.analysisType = parsed.analysisType;
    if (parsed.napHabit === 'usually' || parsed.napHabit === 'sometimes' || parsed.napHabit === 'rarely') result.napHabit = parsed.napHabit;
    if (parsed.usualBedtime && parsed.usualWakeTime && !validateNight(parsed.usualBedtime, parsed.usualWakeTime)) {
      result.usualBedtime = parsed.usualBedtime;
      result.usualWakeTime = parsed.usualWakeTime;
    }
    if (parsed.selectedMonth) {
      const d = new Date(parsed.selectedMonth);
      if (!isNaN(d.getTime())) result.selectedMonth = d;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Save pilot settings to localStorage.
 * Theme is excluded (managed by useTheme under 'fatigue-theme' key).
 */
export function savePersistedSettings(settings: PilotSettings): void {
  try {
    const toStore: PersistedFields = {
      pilotId: settings.pilotId,
      homeBase: settings.homeBase,
      analysisType: settings.analysisType,
      selectedMonth: settings.selectedMonth.toISOString(),
      napHabit: settings.napHabit,
      usualBedtime: settings.usualBedtime,
      usualWakeTime: settings.usualWakeTime,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Silently ignore storage errors (private browsing, quota)
  }
}
