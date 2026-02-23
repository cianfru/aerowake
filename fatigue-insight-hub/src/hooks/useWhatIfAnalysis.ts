import { useMutation } from '@tanstack/react-query';
import { runWhatIf, WhatIfModification } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { AnalysisResults, DutyModification } from '@/types/fatigue';

/**
 * TanStack Query mutation for what-if scenario analysis.
 *
 * Sends duty modifications to backend, transforms the response
 * using the same pipeline as regular analysis.
 */
export function useWhatIfAnalysis() {
  const { state } = useAnalysis();

  const mutation = useMutation({
    mutationFn: async (modifications: DutyModification[]) => {
      const analysisId = state.analysisResults?.analysisId;
      if (!analysisId) {
        throw new Error('No analysis loaded');
      }

      // Convert frontend DutyModification to API format
      const apiMods: WhatIfModification[] = modifications.map((m) => ({
        duty_id: m.dutyId,
        report_shift_minutes: m.reportShiftMinutes,
        release_shift_minutes: m.releaseShiftMinutes,
        crew_composition: m.crewComposition,
        crew_set: m.crewSet,
        excluded: m.excluded,
      }));

      return runWhatIf(analysisId, apiMods, state.settings.configPreset);
    },
  });

  // Transform the raw result into AnalysisResults
  const whatIfResults: AnalysisResults | null = mutation.data
    ? transformAnalysisResult(mutation.data, state.settings.selectedMonth)
    : null;

  return {
    runScenario: mutation.mutate,
    runScenarioAsync: mutation.mutateAsync,
    isRunning: mutation.isPending,
    whatIfResults,
    error: mutation.error,
    reset: mutation.reset,
  };
}
