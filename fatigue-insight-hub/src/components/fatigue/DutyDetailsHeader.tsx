import { crewLabel } from '@/lib/crew';
import type { ReactNode } from 'react';
import { Plane, Monitor, BookOpen, FileText, FileWarning, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';
import { isTrainingDuty, getTrainingDutyLabel } from '@/lib/fatigue-utils';
import { classifyKss, resolveKss } from '@/lib/risk-scale';
import { RiskLabel } from './roster/primitives';

interface DutyDetailsHeaderProps {
  duty: DutyAnalysis;
  /** e.g. "DOH · UTC+3" — the zone every time in the dialog uses. */
  zoneLabel?: string;
  onGenerateReport?: () => void;
  onReportFatigue?: () => void;
  /** Debrief control for a flown duty (renders nothing for future duties). */
  debrief?: ReactNode;
}

/** "DOH → NJF → DOH" (in-flight rest rows excluded). */
export function dutyRoute(duty: DutyAnalysis): string {
  const segs = duty.flightSegments.filter((s) => s.activityCode !== 'IR');
  if (!segs.length) return duty.trainingCode || getTrainingDutyLabel(duty.dutyType || '');
  const stops = [segs[0].departure];
  for (const s of segs) {
    if (stops[stops.length - 1] !== s.departure) stops.push(s.departure);
    stops.push(s.arrival);
  }
  return stops.join(' → ');
}

/**
 * Details header: date, route, times and the band. The right edge leaves
 * room for the dialog's close button; on phones the actions sit on their own
 * row with visible labels.
 */
export function DutyDetailsHeader({ duty, zoneLabel, onGenerateReport, onReportFatigue, debrief }: DutyDetailsHeaderProps) {
  const isTraining = isTrainingDuty(duty);
  const peak = resolveKss(duty.maxKss, duty.minPerformance, duty.modelVersion);
  const Icon = isTraining ? (duty.dutyType === 'simulator' ? Monitor : BookOpen) : Plane;
  const crew = crewLabel(duty);
  const times = duty.reportTimeLocal && duty.releaseTimeLocal ? `${duty.reportTimeLocal}–${duty.releaseTimeLocal}` : '';

  return (
    <div className="flex flex-col gap-3 pr-10 md:flex-row md:items-center md:justify-between md:gap-6 md:pr-12">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{format(duty.date, 'EEE d MMM')}</h2>
            {peak != null && <RiskLabel level={classifyKss(peak)} />}
            {crew && <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground/80"><Users className="h-3 w-3" aria-hidden="true" />{crew}</span>}
          </div>
          <p className="text-sm text-muted-foreground md:truncate">
            <span className="text-foreground">{dutyRoute(duty)}</span>
            {times && <span className="font-mono tabular"> · {times}</span>}
            {zoneLabel && <span> {zoneLabel}</span>}
          </p>
          <p className="font-mono text-xs text-muted-foreground tabular">
            Duty {(duty.dutyHours ?? 0).toFixed(1)}h
            {!isTraining && <> · Block {Math.max(0, duty.blockHours ?? 0).toFixed(1)}h · {duty.sectors} {duty.sectors === 1 ? 'sector' : 'sectors'}</>}
          </p>
        </div>
      </div>

      {(onReportFatigue || onGenerateReport || debrief) && (
        <div className="flex shrink-0 items-center gap-2">
          {debrief}
          {onReportFatigue && (
            <Button variant="outline" size="sm" onClick={onReportFatigue} className="h-9 gap-1.5 rounded-lg text-[13px]">
              <FileWarning className="h-4 w-4" aria-hidden="true" />
              Report fatigue
            </Button>
          )}
          {onGenerateReport && (
            <Button variant="ghost" size="sm" onClick={onGenerateReport} className="h-9 gap-1.5 rounded-lg text-[13px]" title="Full duty report (PDF)">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Full report
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
