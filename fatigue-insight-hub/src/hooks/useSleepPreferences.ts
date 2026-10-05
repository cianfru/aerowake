import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { reanalyzeRoster } from '@/lib/api-client';
import { fromSettings, samePreferences, toPayload, type SleepPreferences } from '@/lib/sleep-preferences';
import { transformAnalysisResult } from '@/lib/transform-analysis';

export type ApplyOutcome = 'recalculated' | 'saved' | 'next-time';

/**
 * The pilot's sleep preferences: read from settings, saved to the account when
 * signed in (and on this device either way), and applied to the roster on screen.
 */
export function useSleepPreferences() {
  const { state, setSettings, setAnalysisResults } = useAnalysis();
  const { isAuthenticated, updateProfile } = useAuth();
  const { runAnalysis, canReanalyse, isAnalyzing } = useAnalyzeRoster();
  const preferences = fromSettings(state.settings);
  const results = state.analysisResults;

  /** The preferences the analysis on screen was run with (when it says). */
  const used: SleepPreferences | null = results?.assumptions
    ? {
      usualBedtime: results.assumptions.usualBedtime ?? '23:00',
      usualWakeTime: results.assumptions.usualWakeTime ?? '07:00',
      napHabit: results.assumptions.napHabit ?? 'sometimes',
    }
    : null;

  const apply = async (next: SleepPreferences): Promise<ApplyOutcome> => {
    setSettings({ napHabit: next.napHabit, usualBedtime: next.usualBedtime, usualWakeTime: next.usualWakeTime });
    if (isAuthenticated) await updateProfile({ sleep_preferences: toPayload(next) });
    if (!results || (used && samePreferences(used, next))) return 'saved';
    const options = { napHabit: next.napHabit, usualBedtime: next.usualBedtime, usualWakeTime: next.usualWakeTime };
    if (canReanalyse) {
      runAnalysis({ ...options, reveal: false });
      return 'recalculated';
    }
    if (isAuthenticated && results.rosterId && results.persistenceStatus === 'saved') {
      const rerun = await reanalyzeRoster(results.rosterId, options);
      setAnalysisResults(transformAnalysisResult(rerun, results.month));
      return 'recalculated';
    }
    return 'next-time';
  };

  return { preferences, used, apply, isApplying: isAnalyzing, isAuthenticated };
}
