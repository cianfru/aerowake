import { useState, useEffect, useRef } from 'react';
import { DutyAnalysis } from '@/types/fatigue';
import { getDutyDetail } from '@/lib/api-client';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';

interface UseFetchAllDutyTimelinesProps {
  analysisId?: string;
  duties: DutyAnalysis[];
}

interface UseFetchAllDutyTimelinesResult {
  timelines: Map<string, DutyDetailTimeline>;
  loading: boolean;
  progress: number; // 0-100
  error: string | null;
}

export function useFetchAllDutyTimelines({
  analysisId,
  duties,
}: UseFetchAllDutyTimelinesProps): UseFetchAllDutyTimelinesResult {
  const [timelines, setTimelines] = useState<Map<string, DutyDetailTimeline>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!analysisId || duties.length === 0) return;

    // Skip if we already fetched for this analysis
    if (fetchedRef.current === analysisId) return;
    fetchedRef.current = analysisId;

    const dutyIds = duties.map(d => d.dutyId).filter(Boolean) as string[];
    if (dutyIds.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setProgress(0);
    setError(null);

    async function fetchAll() {
      const results = new Map<string, DutyDetailTimeline>();
      let completed = 0;

      // Fetch in batches of 5 to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < dutyIds.length; i += batchSize) {
        if (cancelled) return;

        const batch = dutyIds.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(dutyId => getDutyDetail(analysisId!, dutyId))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          if (result.status === 'fulfilled' && result.value) {
            results.set(batch[j], result.value as DutyDetailTimeline);
          }
        }

        completed += batch.length;
        if (!cancelled) {
          setProgress(Math.round((completed / dutyIds.length) * 100));
          // Update timelines progressively
          setTimelines(new Map(results));
        }
      }

      if (!cancelled) {
        setTimelines(new Map(results));
        setLoading(false);
      }
    }

    fetchAll().catch(err => {
      if (!cancelled) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [analysisId, duties]);

  return { timelines, loading, progress, error };
}
