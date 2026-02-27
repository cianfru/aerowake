import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getRoster, type RosterSummary } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAuth } from '@/contexts/AuthContext';
import { useRosterHistory } from './useRosterHistory';
import { useAnalysis } from '@/contexts/AnalysisContext';
import type { DutyAnalysis } from '@/types/fatigue';

/**
 * Fetches all stored roster analyses in parallel and combines their duties
 * into a single array for the route network map and other aggregate views.
 *
 * Deduplicates duties from the current in-memory analysis (by analysisId)
 * so we never double-count the active roster.
 */
export function useAllDuties() {
  const { isAuthenticated } = useAuth();
  const { rosters } = useRosterHistory();
  const { state } = useAnalysis();

  // Only fetch rosters that have an analysis stored
  const analyzedRosters = useMemo(
    () => rosters.filter((r): r is RosterSummary & { analysis_id: string } => !!r.analysis_id),
    [rosters],
  );

  // Parallel-fetch all roster analyses
  const queries = useQueries({
    queries: analyzedRosters.map((roster) => ({
      queryKey: ['roster-duties', roster.id] as const,
      queryFn: async (): Promise<DutyAnalysis[]> => {
        const detail = await getRoster(roster.id);
        if (!detail.analysis) return [];
        const [year, month] = roster.month.split('-');
        const fallbackMonth = new Date(Number(year), Number(month) - 1, 1);
        const transformed = transformAnalysisResult(detail.analysis, fallbackMonth);
        return transformed.duties;
      },
      enabled: isAuthenticated,
      staleTime: 5 * 60_000, // 5 minutes
      gcTime: 10 * 60_000,   // 10 minutes
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  // Combine all fetched duties + current in-memory duties (deduped)
  const allDuties = useMemo(() => {
    const currentAnalysisId = state.analysisResults?.analysisId;
    const combined: DutyAnalysis[] = [];
    const seenIds = new Set<string>();

    // Add duties from persisted rosters
    for (const q of queries) {
      if (q.data) {
        for (const duty of q.data) {
          const key = duty.dutyId ?? `${duty.dateString}-${duty.reportTimeUtc}`;
          if (!seenIds.has(key)) {
            seenIds.add(key);
            combined.push(duty);
          }
        }
      }
    }

    // Add current in-memory duties if not already included via a persisted roster
    if (state.analysisResults?.duties) {
      for (const duty of state.analysisResults.duties) {
        const key = duty.dutyId ?? `${duty.dateString}-${duty.reportTimeUtc}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          combined.push(duty);
        }
      }
    }

    return combined;
  }, [queries, state.analysisResults]);

  return {
    allDuties,
    isLoading,
    totalRosters: analyzedRosters.length,
  };
}
