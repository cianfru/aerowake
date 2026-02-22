import { PilotSettings } from '@/types/fatigue';

const STORAGE_KEY = 'aerowake-pilot-settings';

/** Fields persisted to localStorage (theme excluded — managed by useTheme). */
interface PersistedFields {
  pilotId?: string;
  homeBase?: string;
  configPreset?: string;
  crewSet?: 'crew_a' | 'crew_b';
  analysisType?: 'single' | 'range';
  selectedMonth?: string; // ISO string
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
    if (parsed.configPreset) result.configPreset = parsed.configPreset;
    if (parsed.crewSet) result.crewSet = parsed.crewSet;
    if (parsed.analysisType) result.analysisType = parsed.analysisType;
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
      configPreset: settings.configPreset,
      crewSet: settings.crewSet,
      analysisType: settings.analysisType,
      selectedMonth: settings.selectedMonth.toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Silently ignore storage errors (private browsing, quota)
  }
}
