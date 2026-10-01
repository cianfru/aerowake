import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { debriefQueue, dutyRoute } from '@/lib/debrief-api';
import { cn } from '@/lib/utils';
import type { DutyAnalysis } from '@/types/fatigue';
import { DebriefFlow } from './DebriefFlow';
import { dutyDateLabel } from './time';
import { useDebriefs, useEnrolment } from './useStudy';

const HIDE_KEY = 'aerowake-debrief-queue-hidden';
const SHOWN = 3;

function readHidden(): boolean {
  try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
}

/**
 * Flown duties from the current analysis that have no debrief yet, most
 * recent first. Neither the order nor the card reveals the forecast, so
 * ratings stay blind and unflagged duties (false alarms) are sampled fairly.
 */
export function DebriefQueue({ now, className }: { now?: number; className?: string }) {
  const { state } = useAnalysis();
  const { isAuthenticated } = useAuth();
  const enrolment = useEnrolment();
  const debriefs = useDebriefs();
  const [hidden, setHidden] = useState(readHidden);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<DutyAnalysis | null>(null);
  const results = state.analysisResults;
  const queue = useMemo(
    () => (results ? debriefQueue(results.duties, debriefs.data ?? [], now) : []),
    [results, debriefs.data, now],
  );

  const withdrawn = !!enrolment.data?.withdrawn_at && !enrolment.data.enrolled;
  if (!results || hidden || withdrawn || queue.length === 0 || (isAuthenticated && debriefs.isLoading)) return null;
  const tz = results.homeBaseTimezone || 'UTC';
  const visible = expanded ? queue : queue.slice(0, SHOWN);

  function hide() {
    setHidden(true);
    try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* storage unavailable: hide for this view only */ }
  }

  return (
    <section aria-labelledby="debrief-queue-title" className={cn('rounded-xl border border-border bg-card p-4 md:p-5', className)}>
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="debrief-queue-title" className="text-base font-semibold">
            {queue.length === 1 ? '1 flown duty to debrief' : `${queue.length} flown duties to debrief`}
          </h2>
          <p className="text-sm text-muted-foreground">
            About 20 seconds each: rate how sleepy you were, then see the forecast. Optional and private; never sent to your operator.
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {visible.map((duty) => (
          <li key={duty.dutyId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{dutyDateLabel(duty.reportTimeUtc, tz)}</span>
              {dutyRoute(duty) && <span className="ml-2 truncate font-mono text-xs text-muted-foreground">{dutyRoute(duty)}</span>}
            </span>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setActive(duty)}>Debrief</Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        {queue.length > SHOWN && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Show fewer' : `Show all ${queue.length}`}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={hide}>Hide for now</Button>
      </div>
      {active && <DebriefFlow duty={active} analysisId={results.analysisId} onClose={() => setActive(null)} />}
    </section>
  );
}
