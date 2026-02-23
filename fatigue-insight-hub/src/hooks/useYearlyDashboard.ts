import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getYearlyDashboard, type YearlyDashboardData } from '@/lib/api-client';

export function useYearlyDashboard() {
  const { isAuthenticated } = useAuth();

  const query = useQuery<YearlyDashboardData>({
    queryKey: ['dashboard', 'yearly'],
    queryFn: getYearlyDashboard,
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    months: query.data?.months ?? [],
    summary: query.data?.summary ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
