/**
 * DutyBarTooltip — one duty bar in the roster calendar plus a short tooltip.
 *
 * Bar colour is model output only: each sector in its own band when the
 * backend reports segments[].kss_peak, otherwise the whole duty in its peak
 * band. Check-in, turnaround and post-flight time are neutral duty time.
 */

import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  decimalToHHmm,
  getTrainingDutyColor,
  getTrainingDutyLabel,
  isTrainingDuty,
  isoToZulu,
} from '@/lib/fatigue-utils';
import {
  RISK_LEVEL_LABELS,
  classifyKss,
  kssLabel,
  resolveKss,
  riskClasses,
  riskCssColor,
  riskOnColor,
} from '@/lib/risk-scale';
import type { TimelineDutyBar, TimelinePeakMarker, TimelineSegment } from '@/lib/timeline-types';
import type { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';

interface DutyBarTooltipProps {
  bar: TimelineDutyBar;
  widthPercent: number;
  leftPercent: number;
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  variant: 'homebase' | 'utc' | 'elapsed';
  /** The duty's peak marker (any row), for the tooltip's "at hh:mm". */
  peak?: TimelinePeakMarker;
}

/** "DOH → NJF → DOH" from the bar's full duty. */
function route(duty: DutyAnalysis): string {
  const segs = duty.flightSegments.filter((s) => s.activityCode !== 'IR');
  if (!segs.length) return duty.trainingCode || getTrainingDutyLabel(duty.dutyType || '');
  const stops = [segs[0].departure];
  for (const s of segs) {
    if (stops[stops.length - 1] !== s.departure) stops.push(s.departure);
    stops.push(s.arrival);
  }
  return stops.join(' → ');
}

function segmentStyle(segment: TimelineSegment, duty: DutyAnalysis): React.CSSProperties {
  switch (segment.type) {
    case 'flight':
      return { backgroundColor: riskCssColor(segment.level) };
    case 'training':
      return {
        backgroundColor: getTrainingDutyColor(duty.dutyType || 'simulator'),
        borderLeft: `3px solid ${riskCssColor(segment.level)}`,
      };
    case 'ground':
      // Turnarounds and positioning: duty time, not a sector with its own value.
      return segment.isDeadhead
        ? { backgroundColor: 'hsl(var(--muted-foreground) / 0.3)' }
        : { backgroundColor: 'hsl(var(--muted-foreground) / 0.18)' };
    default:
      return { backgroundColor: 'hsl(var(--muted-foreground) / 0.3)' };
  }
}

export function DutyBarTooltip({ bar, widthPercent, leftPercent, selectedDuty, onDutySelect, variant, peak }: DutyBarTooltipProps) {
  const { duty } = bar;
  const usedDiscretion = duty.usedDiscretion;
  const peakKss = resolveKss(duty.maxKss, duty.minPerformance, duty.modelVersion);
  const level = classifyKss(peakKss);
  const training = isTrainingDuty(duty);
  const sectors = duty.flightSegments.filter((s) => s.activityCode !== 'IR' && !s.isDeadhead);
  const hasSectorValues = sectors.some((s) => s.kssPeak != null);
  const times = variant === 'utc'
    ? [isoToZulu(duty.reportTimeUtc), isoToZulu(duty.releaseTimeUtc)].filter(Boolean).join('–')
    : duty.reportTimeLocal && duty.releaseTimeLocal ? `${duty.reportTimeLocal}–${duty.releaseTimeLocal}` : '';
  const fdp = duty.actualFdpHours ?? duty.dutyHours;
  const isSelected = selectedDuty?.date.getTime() === duty.date.getTime();

  const borderRadius = bar.isOvernightStart ? '3px 0 0 3px' : bar.isOvernightContinuation ? '0 3px 3px 0' : '3px';
  const label = `Open duty on ${format(duty.date, 'EEE d MMM')}: ${duty.flightSegments.map((s) => s.flightNumber).join(', ') || duty.trainingCode || 'Duty'}${bar.isOvernightContinuation ? ' (continued)' : ''}`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => onDutySelect(duty)}
            className={cn(
              'calendar-duty absolute z-10 flex cursor-pointer overflow-hidden transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'ring-2 ring-foreground',
              usedDiscretion ? 'ring-2 ring-risk-critical' : 'hover:ring-2 hover:ring-foreground/70',
            )}
            style={{ top: 5, bottom: 5, left: `${leftPercent}%`, width: `${Math.max(widthPercent, 1.5)}%`, borderRadius }}
          >
            {bar.segments.map((segment, i) => {
              const width = variant === 'elapsed' && segment.widthPercent != null
                ? segment.widthPercent
                : ((segment.endHour - segment.startHour) / (bar.endHour - bar.startHour)) * 100;
              const isFlight = segment.type === 'flight';
              return (
                <div
                  key={i}
                  className={cn(
                    'calendar-seg relative flex h-full items-center justify-center',
                    isFlight && segment.level === 'extreme' && 'risk-extreme-hatch',
                  )}
                  style={{ width: `${width}%`, ...segmentStyle(segment, duty) }}
                >
                  {i > 0 && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-card/80" />}
                  {isFlight && segment.flightNumber && (
                    <span className="calendar-seg-label truncate px-1 font-mono text-[11px] font-semibold leading-none" style={{ color: riskOnColor(segment.level) }}>
                      {segment.flightNumber}
                    </span>
                  )}
                  {segment.type === 'training' && (
                    <span className="calendar-seg-label truncate px-1 text-[11px] font-semibold leading-none"
                      style={{ color: duty.dutyType === 'ground_training' ? 'hsl(var(--ground-training-foreground))' : 'hsl(var(--simulator-foreground))' }}>
                      {duty.trainingCode || getTrainingDutyLabel(duty.dutyType || '')}
                    </span>
                  )}
                </div>
              );
            })}
            {usedDiscretion && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-risk-critical">
                <AlertTriangle className="h-2 w-2 text-risk-critical-on" aria-hidden="true" />
              </span>
            )}
          </button>
        </TooltipTrigger>

        <TooltipContent side="top" align="start" className="z-[100] w-72 max-w-[calc(100vw-2rem)] p-3">
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{format(duty.date, 'EEE d MMM')}{bar.isOvernightContinuation ? ' (continued)' : ''}</p>
                <p className="text-muted-foreground">{route(duty)}</p>
              </div>
              {peakKss != null && (
                <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em]', riskClasses(level).text)}>
                  <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-[1px]', riskClasses(level).fill)} />
                  {RISK_LEVEL_LABELS[level]}
                </span>
              )}
            </div>

            {peakKss != null && (
              <p>
                <span className={cn('font-mono text-base font-semibold tabular', riskClasses(level).text)}>{peakKss.toFixed(1)}</span>
                <span className="ml-1.5 text-muted-foreground">peak KSS{peak ? ` at ${decimalToHHmm(peak.hour)}` : ''} · {kssLabel(peakKss)}</span>
              </p>
            )}

            {!training && sectors.length > 0 && (
              <ul className="space-y-1 border-t border-border pt-2" aria-label="Sectors">
                {sectors.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span><span className="font-mono font-medium">{s.flightNumber}</span> <span className="text-muted-foreground">{s.departure} → {s.arrival}</span></span>
                    {s.kssPeak != null && (
                      <span className={cn('font-mono tabular', riskClasses(classifyKss(s.kssPeak)).text)}>KSS {s.kssPeak.toFixed(1)}</span>
                    )}
                  </li>
                ))}
                {!hasSectorValues && sectors.length > 1 && (
                  <li className="text-muted-foreground">Sectors share the duty peak colour.</li>
                )}
              </ul>
            )}
            {training && (
              <p className="border-t border-border pt-2"><span className="font-medium">{getTrainingDutyLabel(duty.dutyType || '')}</span>{duty.trainingCode ? ` · ${duty.trainingCode}` : ''}</p>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-2">
              {times && <><dt className="text-muted-foreground">{variant === 'utc' ? 'Duty (UTC)' : 'Duty (home base)'}</dt><dd className="font-mono tabular">{times}</dd></>}
              {!training && duty.maxFdpHours ? <><dt className="text-muted-foreground">FDP</dt><dd className="font-mono tabular">{fdp.toFixed(1)}h of {duty.maxFdpHours.toFixed(1)}h max</dd></> : null}
              <dt className="text-muted-foreground">Sleep before (est.)</dt><dd className="font-mono tabular">{duty.priorSleep.toFixed(1)}h</dd>
              {duty.sleepDeficit7d && <><dt className="text-muted-foreground">7-day sleep shortfall</dt><dd className="font-mono tabular">{duty.sleepDeficit7d.deficitHours.toFixed(1)}h</dd></>}
              {duty.woclExposure > 0 && <><dt className="text-muted-foreground">Body-clock low (WOCL)</dt><dd className="font-mono tabular">{duty.woclExposure.toFixed(1)}h</dd></>}
            </dl>
            {usedDiscretion && <p className="font-medium text-risk-critical-ink">Commander&apos;s discretion used</p>}
            <p className="text-muted-foreground">Select for the full duty details.</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
