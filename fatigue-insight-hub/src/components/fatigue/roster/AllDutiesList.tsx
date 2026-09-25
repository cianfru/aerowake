import { useMemo, useState } from 'react';
import { ChevronDown, ListOrdered } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, formatKss, riskBadgeVariant, riskClasses } from '@/lib/risk-scale';
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

/** Every duty as one compact row (no per-sector rows); standby shown muted. Collapsed by default. */
export function AllDutiesList({ duties, standbyPeriods, onSelect }: AllDutiesListProps) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => buildRosterRows(duties, standbyPeriods), [duties, standbyPeriods]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-label="All duties">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
              All duties ({duties.length})
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card variant="glass" className="overflow-hidden">
            <ul className="divide-y divide-border/40">
              {rows.map((row) => {
                if (row.kind === 'standby') {
                  return (
                    <li key={row.key} className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground" data-testid="standby-row">
                      <span className="w-[5.5rem] flex-shrink-0">{standbyDate(row.standby)}</span>
                      <span className="italic">{standbyLabel(row.standby)}</span>
                    </li>
                  );
                }
                const d = row.duty;
                const level = dutyRiskLevel(d);
                const kss = dutyPeakKss(d);
                const times = dutyTimes(d);
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(d)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none"
                      aria-label={`${dutyDateLabel(d)}, ${dutyRoute(d)}, ${RISK_LEVEL_LABELS[level]} — open details`}
                    >
                      <span className="w-[5.5rem] flex-shrink-0 text-xs font-medium">{dutyDateLabel(d)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{dutyRoute(d)}</span>
                        {times && <span className="block font-mono text-[11px] text-muted-foreground">{times}</span>}
                      </span>
                      <span className="flex flex-shrink-0 flex-col items-end gap-1">
                        {kss != null && (
                          <span className={cn('font-mono text-[11px]', riskClasses(level).text)}>{formatKss(kss)}</span>
                        )}
                        <Badge variant={riskBadgeVariant(level)} className="px-1.5 py-0 text-[10px]">
                          {RISK_LEVEL_LABELS[level]}
                        </Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
