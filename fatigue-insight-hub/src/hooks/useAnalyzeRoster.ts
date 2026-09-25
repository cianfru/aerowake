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
    // `homeBase` lets the caller pass the base the pilot just confirmed
    // (settings updates are async, so we don't read them back here).
    mutationFn: async (vars?: { homeBase?: string } | void) => {
      if (!state.uploadedFile || !state.actualFileObject) {
        throw new Error('Please upload a roster file first');
      }
      const homeBase = ((vars && vars.homeBase) || state.settings.homeBase || '').trim().toUpperCase();
      if (!homeBase) {
        throw new Error('Please enter your home base (IATA code) first');
      }
      return analyzeRoster(
        state.actualFileObject,
        state.settings.pilotId,
        homeBase,
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
