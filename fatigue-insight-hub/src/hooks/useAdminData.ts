// src/hooks/useAdminData.ts
// TanStack Query hook for admin dashboard data.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAdminStats,
  getAdminUsers,
  getAdminRosters,
  getAdminActivity,
  type PlatformStats,
  type AdminUser,
  type AdminRoster,
  type ActivityEvent,
} from '@/lib/admin-api';

export function useAdminData() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  const statsQuery = useQuery<PlatformStats>({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: getAdminUsers,
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rostersQuery = useQuery<AdminRoster[]>({
    queryKey: ['admin', 'rosters'],
    queryFn: () => getAdminRosters(200, 0),
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const activityQuery = useQuery<ActivityEvent[]>({
    queryKey: ['admin', 'activity'],
    queryFn: () => getAdminActivity(50),
    enabled: isAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    stats: statsQuery.data,
    users: usersQuery.data ?? [],
    rosters: rostersQuery.data ?? [],
    activity: activityQuery.data ?? [],
    isLoading: statsQuery.isLoading || usersQuery.isLoading,
    isError: statsQuery.isError || usersQuery.isError,
    refetchAll: () => {
      statsQuery.refetch();
      usersQuery.refetch();
      rostersQuery.refetch();
      activityQuery.refetch();
    },
  };
}
