import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getEnrolment, listDebriefs } from '@/lib/debrief-api';

/** Keys include the user id; AuthContext clears the query cache on every sign-in/out. */
export const studyKeys = {
  enrolment: (userId?: string) => ['study-enrolment', userId] as const,
  debriefs: (userId?: string) => ['debriefs', userId] as const,
};

export function useEnrolment() {
  const { user } = useAuth();
  return useQuery({ queryKey: studyKeys.enrolment(user?.id), queryFn: getEnrolment, enabled: !!user, staleTime: 60_000, retry: false });
}

export function useDebriefs() {
  const { user } = useAuth();
  return useQuery({ queryKey: studyKeys.debriefs(user?.id), queryFn: listDebriefs, enabled: !!user, staleTime: 30_000, retry: false });
}

export function useRefreshStudy() {
  const client = useQueryClient();
  const { user } = useAuth();
  return useCallback(() => Promise.all([
    client.invalidateQueries({ queryKey: studyKeys.enrolment(user?.id) }),
    client.invalidateQueries({ queryKey: studyKeys.debriefs(user?.id) }),
  ]), [client, user?.id]);
}
