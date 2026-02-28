import { useMutation } from '@tanstack/react-query';
import { analyzeRoster, reanalyzeRoster } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { toast } from 'sonner';

/**
 * TanStack Query mutation for roster analysis.
 *
 * Reads file + settings from AnalysisContext, calls the backend,
 * transforms the response, and dispatches the result back into context.
 */
export function useAnalyzeRoster() {
  const { state, setAnalysisResults } = useAnalysis();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!state.uploadedFile || !state.actualFileObject) {
        throw new Error('Please upload a roster file first');
      }
      return analyzeRoster(
        state.actualFileObject,
        state.settings.pilotId,
        state.settings.homeBase,
        state.settings.configPreset,
        state.settings.crewSet,
        state.dutyCrewOverrides,
      );
    },
    onSuccess: (result) => {
      const transformed = transformAnalysisResult(result, state.settings.selectedMonth);
      setAnalysisResults(transformed);
      toast.success('Analysis complete!');
    },
    onError: (error: Error) => {
      console.error('[Analysis] API call failed:', error.message, error);
      toast.error('Analysis failed: ' + error.message);
    },
  });

  // Re-analyze uploaded file with different settings (no toast — silent refresh)
  const rerunMutation = useMutation({
    mutationFn: async (overrides: { configPreset?: string; crewSet?: string }) => {
      if (!state.actualFileObject) {
        throw new Error('No file in memory');
      }
      return analyzeRoster(
        state.actualFileObject,
        state.settings.pilotId,
        state.settings.homeBase,
        overrides.configPreset ?? state.settings.configPreset,
        overrides.crewSet ?? state.settings.crewSet,
        state.dutyCrewOverrides,
      );
    },
    onSuccess: (result) => {
      const transformed = transformAnalysisResult(result, state.settings.selectedMonth);
      setAnalysisResults(transformed);
    },
    onError: (error: Error) => {
      console.error('[Re-analysis] failed:', error.message);
      toast.error('Re-analysis failed: ' + error.message);
    },
  });

  // Re-analyze a saved roster by ID with different settings
  const reanalyzeSavedMutation = useMutation({
    mutationFn: async ({ rosterId, configPreset, crewSet }: {
      rosterId: string;
      configPreset?: string;
      crewSet?: string;
    }) => {
      return reanalyzeRoster(
        rosterId,
        configPreset ?? state.settings.configPreset,
        crewSet ?? state.settings.crewSet,
      );
    },
    onSuccess: (result) => {
      const transformed = transformAnalysisResult(result, state.settings.selectedMonth);
      setAnalysisResults(transformed);
    },
    onError: (error: Error) => {
      console.error('[Saved roster re-analysis] failed:', error.message);
      toast.error('Re-analysis failed: ' + error.message);
    },
  });

  return {
    runAnalysis: mutation.mutate,
    isAnalyzing: mutation.isPending,
    rerunWithSettings: rerunMutation.mutate,
    reanalyzeSaved: reanalyzeSavedMutation.mutate,
    isRerunning: rerunMutation.isPending || reanalyzeSavedMutation.isPending,
  };
}
