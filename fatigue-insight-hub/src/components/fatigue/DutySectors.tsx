import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import type { DutyAnalysis } from '@/types/fatigue';
import { formatAircraftType, getTrainingDutyLabel, isTrainingDuty } from '@/lib/fatigue-utils';
import { RISK_LEVEL_LABELS, classifyKss, riskClasses } from '@/lib/risk-scale';
import { cn } from '@/lib/utils';

/** CrewLink legend for training annotations; unknown codes are shown as printed. */
const TRAINING_NOTES: Record<string, string> = {
  EQ: 'TRT instructor required', LQ: 'TRE/SFE tutor required', aw: 'AWOPS', lpc: 'sim check',
  op: 'EBT recurrent day 2', rc: 'recency sim', rh: 'right-hand seat sim',
};
const trainingNoteLabel = (code: string) => TRAINING_NOTES[code] ?? code;

/**
 * The duty's sectors in home-base time. A sector shows its own predicted KSS
 * only when the model reports it (segments[].kss_peak / kss_at_arrival);
 * otherwise the duty peak above speaks for the whole duty.
 */
export function DutySectors({ duty, homeLabel }: { duty: DutyAnalysis; homeLabel?: string }) {
  if (isTrainingDuty(duty)) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="sectors-heading">
        <h3 id="sectors-heading" className="text-[15px] font-semibold">{getTrainingDutyLabel(duty.dutyType || '')}</h3>
        <p className="mt-2 font-mono text-sm tabular">{duty.trainingCode ? `${duty.trainingCode} · ` : ''}{duty.reportTimeLocal}–{duty.releaseTimeLocal}</p>
        {duty.trainingAnnotations?.length ? <p className="mt-1 text-xs text-muted-foreground">Notes: {duty.trainingAnnotations.map(trainingNoteLabel).join(', ')}</p> : null}
      </section>
    );
  }

  const sectors = duty.flightSegments ?? [];
  const hasValues = sectors.some((s) => s.kssPeak != null);

  return (
    <section className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="sectors-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="sectors-heading" className="text-[15px] font-semibold">Sectors</h3>
        <p className="text-xs text-muted-foreground">Times {homeLabel ? `${homeLabel} ` : ''}home base</p>
      </div>
      <ol className="mt-3 divide-y divide-border">
        {sectors.map((seg, i) => {
          const special = seg.activityCode === 'DH' ? 'Positioning' : seg.activityCode === 'IR' ? 'In-flight rest' : null;
          const level = seg.kssPeak != null ? classifyKss(seg.kssPeak) : null;
          return (
            <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-mono font-semibold">{seg.flightNumber}</span>
                  <span className="font-medium">{seg.departure} → {seg.arrival}</span>
                  {special && <span className="text-xs text-muted-foreground">{special}</span>}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted-foreground tabular">
                  <span className="inline-flex items-center gap-1"><PlaneTakeoff className="h-3 w-3" aria-hidden="true" />{seg.departureTime}</span>
                  <span className="inline-flex items-center gap-1"><PlaneLanding className="h-3 w-3" aria-hidden="true" />{seg.arrivalTime}</span>
                  {seg.blockHours > 0 && <span>{seg.blockHours.toFixed(1)}h block</span>}
                  {seg.aircraftType && <span className="font-sans">{formatAircraftType(seg.aircraftType)}</span>}
                </p>
              </div>
              {level && seg.kssPeak != null && (
                <div className="shrink-0 text-right">
                  <p className={cn('inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular', riskClasses(level).text)}>
                    <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-[1px]', riskClasses(level).fill)} />
                    {seg.kssPeak.toFixed(1)}
                    <span className="sr-only"> peak KSS, {RISK_LEVEL_LABELS[level]}</span>
                  </p>
                  {seg.kssAtArrival != null && <p className="font-mono text-xs text-muted-foreground tabular">at arrival {seg.kssAtArrival.toFixed(1)}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!hasValues && sectors.length > 1 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">This analysis has no per-sector values, so the duty peak applies to every sector.</p>
      )}
    </section>
  );
}
