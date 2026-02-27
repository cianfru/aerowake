import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRosters, deleteRoster, reanalyzeRoster, type RosterSummary } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export function useRosterHistory() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const rostersQuery = useQuery<RosterSummary[]>({
    queryKey: ['rosters'],
    queryFn: getRosters,
    enabled: isAuthenticated,
    staleTime: 30_000, // 30 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rosters'] });
    },
  });

  const reanalyzeMutation = useMutation({
    mutationFn: ({ rosterId, configPreset, crewSet }: {
      rosterId: string;
      configPreset?: string;
      crewSet?: string;
    }) => reanalyzeRoster(rosterId, configPreset, crewSet),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rosters'] });
    },
  });

  return {
    rosters: [...(rostersQuery.data ?? [])].sort((a, b) => b.month.localeCompare(a.month)),
    isLoading: rostersQuery.isLoading,
    isError: rostersQuery.isError,
    error: rostersQuery.error,
    refetch: rostersQuery.refetch,
    deleteRoster: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    reanalyze: reanalyzeMutation.mutate,
    isReanalyzing: reanalyzeMutation.isPending,
    reanalyzeData: reanalyzeMutation.data,
  };
}
