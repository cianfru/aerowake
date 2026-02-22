import { useMutation } from '@tanstack/react-query';
import { analyzeRoster } from '@/lib/api-client';
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

  return {
    runAnalysis: mutation.mutate,
    isAnalyzing: mutation.isPending,
  };
}
