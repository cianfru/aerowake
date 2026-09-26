import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, riskClasses } from '@/lib/risk-scale';
import type { DutyAnalysis, StandbyPeriod } from '@/types/fatigue';
import {
  buildRosterRows, dutyDateLabel, dutyPeakKss, dutyRiskLevel, dutyRoute, dutyTimes, standbyLabel,
} from './roster-utils';
import { format, parseISO } from 'date-fns';

interface AllDutiesListProps {
  duties: DutyAnalysis[];
  standbyPeriods?: StandbyPeriod[];
  onSelect: (duty: DutyAnalysis) => void;
}

function standbyDate(s: StandbyPeriod): string {
  try {
    return format(parseISO(s.date), 'EEE d MMM');
  } catch {
    return s.date;
  }
}

const ROW = 'grid grid-cols-[5.75rem_minmax(0,1fr)_auto] items-center gap-x-4 px-1 py-2.5';

/** Every duty as one row (no per-sector rows); standby muted. Collapsed by default. */
export function AllDutiesList({ duties, standbyPeriods, onSelect }: AllDutiesListProps) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => buildRosterRows(duties, standbyPeriods), [duties, standbyPeriods]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-label="All duties">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-2 border-b border-border pb-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="text-[13px] font-semibold">All duties ({duties.length})</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {open ? 'Hide' : 'Show'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y divide-border/70">
            {rows.map((row) => {
              if (row.kind === 'standby') {
                return (
                  <li key={row.key} className={cn(ROW, 'text-xs text-muted-foreground')} data-testid="standby-row">
                    <span>{standbyDate(row.standby)}</span>
                    <span>{standbyLabel(row.standby)}</span>
                    <span />
                  </li>
                );
              }
              const d = row.duty;
              const level = dutyRiskLevel(d);
              const rc = riskClasses(level);
              const kss = dutyPeakKss(d);
              const times = dutyTimes(d);
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(d)}
                    className={cn(ROW, 'w-full text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none')}
                    aria-label={`${dutyDateLabel(d)}, ${dutyRoute(d)}, ${RISK_LEVEL_LABELS[level]} — open details`}
                  >
                    <span className="text-[13px] font-medium">{dutyDateLabel(d)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{dutyRoute(d)}</span>
                      {times && <span className="block font-mono text-[11px] text-muted-foreground tabular">{times}</span>}
                    </span>
                    <span className="flex items-center gap-2.5">
                      {kss != null && (
                        <span className={cn('font-mono text-sm tabular', rc.text)}>{kss.toFixed(1)}</span>
                      )}
                      <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-[1px]', rc.fill)} />
                      <span className="sr-only">{RISK_LEVEL_LABELS[level]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
