import { useState } from 'react';
import { Check, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { debriefsFor, isFlown } from '@/lib/debrief-api';
import { cn } from '@/lib/utils';
import type { DutyAnalysis } from '@/types/fatigue';
import { DebriefFlow } from './DebriefFlow';
import { useDebriefs } from './useStudy';

/**
 * One-tap debrief for a duty whose planned release time has passed.
 * Renders nothing for future duties. Self-contained: mount it in any duty card.
 */
export function DutyDebriefAction({ duty, analysisId, now, className }: {
  duty: DutyAnalysis; analysisId?: string | null; now?: number; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const debriefs = useDebriefs();
  if (!duty.dutyId || !isFlown(duty, now)) return null;
  const mine = isAuthenticated ? debriefsFor(duty, debriefs.data ?? []) : [];
  const worst = mine.find((d) => d.moment === 'worst_moment' && d.kss !== null) ?? mine.find((d) => d.kss !== null);
  const done = mine.length > 0;
  const label = done ? (worst ? `Debriefed · KSS ${worst.kss}` : 'Debriefed') : 'Debrief';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={done ? `${label}. Add another rating for this duty` : 'Debrief this flown duty'}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-2 py-1 text-[13px] font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          done ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20',
          className,
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </button>
      {open && <DebriefFlow duty={duty} analysisId={analysisId} onClose={() => setOpen(false)} />}
    </>
  );
}
