import { ChevronRight, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { isoToZulu } from '@/lib/fatigue-utils';
import { classifyKss, resolveKss, riskClasses, RISK_LEVEL_LABELS } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import type { TimelineVariant } from '@/lib/timeline-types';

/** Readable, touch-accessible counterparts to narrow calendar bars. */
export function DutyFocusList({ duties, selectedDuty, onDutySelect, variant }: {
  duties: DutyAnalysis[];
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  variant: TimelineVariant;
}) {
  return <div className="space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">Duties in view</h3>
    {duties.length === 0 ? <p className="text-sm text-muted-foreground">No duties recorded in this window. Sleep bars are estimates; an empty day does not confirm time off.</p>
      : <ul className="divide-y divide-border/70">
        {duties.map((duty) => {
          const kss = resolveKss(duty.maxKss, duty.minPerformance, duty.modelVersion);
          const level = classifyKss(kss);
          const flights = duty.flightSegments.filter((segment) => segment.activityCode !== 'IR');
          const route = flights.length ? [flights[0].departure, ...flights.map((segment) => segment.arrival)].join(' → ') : duty.trainingCode || 'Ground duty';
          const times = variant === 'utc' ? [isoToZulu(duty.reportTimeUtc), isoToZulu(duty.releaseTimeUtc)] : [duty.reportTimeLocal, duty.releaseTimeLocal];
          const utcDate = variant === 'utc' && duty.reportTimeUtc ? duty.reportTimeUtc.slice(0, 10) : null;
          const dateLabel = utcDate && /^\d{4}-\d{2}-\d{2}$/.test(utcDate) ? format(new Date(`${utcDate}T12:00:00`), 'EEE d MMM') : format(duty.date, 'EEE d MMM');
          const selected = selectedDuty === duty || (duty.dutyId != null && selectedDuty?.dutyId === duty.dutyId);
          return <li key={duty.dutyId ?? `${duty.dateString}-${duty.reportTimeUtc}`}>
            <button type="button" aria-label={`Inspect ${dateLabel}: ${route}`} aria-pressed={selected}
              onClick={() => onDutySelect(duty)} className={cn('flex min-h-20 w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'bg-muted/50')}>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">{dateLabel} <span className="ml-1 font-mono tabular">{times.filter(Boolean).join('–')}</span></p>
                <p className="break-words text-sm font-medium">{route}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Moon className="h-3 w-3" aria-hidden="true" />{duty.priorSleep.toFixed(1)}h sleep before (est.)</span>
                  {duty.woclExposure > 0 && <span>{duty.woclExposure.toFixed(1)}h body-clock low</span>}
                </p>
              </div>
              <div className={cn('shrink-0 text-right', riskClasses(level).text)}>
                <p className="font-mono text-lg font-semibold tabular">{kss?.toFixed(1) ?? '—'}</p>
                <p className="text-[11px]">{RISK_LEVEL_LABELS[level]} · peak KSS</p>
              </div>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
            </button>
          </li>;
        })}
      </ul>}
  </div>;
}
