import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { saveSleepEdits } from '@/lib/api-client';
import { toPayload } from '@/lib/sleep-edits';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';
import type { SleepEditItem } from '@/types/fatigue';

/**
 * Save the pilot's sleep changes (the full list) and show the recalculated
 * analysis. The analysis keeps its id; a saved analysis is updated on the server.
 */
export function useSaveSleepEdits() {
  const { state, setAnalysisResults } = useAnalysis();
  const current = state.analysisResults;

  const mutation = useMutation({
    mutationFn: async ({ edits }: { edits: SleepEditItem[]; message?: string }) => {
      if (!current?.analysisId) throw new Error('Analyse a roster first.');
      return saveSleepEdits(current.analysisId, toPayload(edits));
    },
    onSuccess: (result, { message }) => {
      if (!current) return;
      const next = transformAnalysisResult(result, current.month);
      // Fields only the first analysis knows (company detection, continuity).
      setAnalysisResults({
        ...next,
        companyDetection: next.companyDetection ?? current.companyDetection,
        continuityFromMonth: next.continuityFromMonth ?? current.continuityFromMonth,
        initialConditions: next.initialConditions ?? current.initialConditions,
        rosterId: next.rosterId ?? current.rosterId,
      });
      toast.success(message ?? 'Sleep updated and fatigue recalculated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    edits: current?.sleepEdits ?? [],
    save: (edits: SleepEditItem[], message?: string) => mutation.mutate({ edits, message }),
    saveAsync: (edits: SleepEditItem[], message?: string) => mutation.mutateAsync({ edits, message }),
    isSaving: mutation.isPending,
    canEdit: !!current?.analysisId,
  };
}
