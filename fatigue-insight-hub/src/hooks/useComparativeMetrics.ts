import { useQuery } from '@tanstack/react-query';
import {
  getComparativeMetrics,
  getComparativeTrend,
  type ComparativeMetrics,
  type TrendData,
} from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export function useComparativeMetrics(month?: string) {
  const { isAuthenticated, user } = useAuth();
  const hasCompany = !!user?.company_id;

  const metricsQuery = useQuery<ComparativeMetrics>({
    queryKey: ['comparative-metrics', month],
    queryFn: () => getComparativeMetrics(month),
    enabled: isAuthenticated && hasCompany,
    staleTime: 60_000, // 1 minute
    retry: 1,
  });

  const trendQuery = useQuery<TrendData>({
    queryKey: ['comparative-trend'],
    queryFn: getComparativeTrend,
    enabled: isAuthenticated && hasCompany,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    metrics: metricsQuery.data ?? null,
    trend: trendQuery.data ?? null,
    isLoading: metricsQuery.isLoading || trendQuery.isLoading,
    isError: metricsQuery.isError || trendQuery.isError,
    error: metricsQuery.error || trendQuery.error,
    hasCompany,
  };
}
