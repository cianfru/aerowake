/**
 * DutyBarTooltip — Renders a duty bar button with performance-colored flight
 * segments and a rich tooltip showing duty details, EASA FDP metrics,
 * performance decomposition, KSS/FHA badges, and sleep recovery info.
 *
 * Extracted from HomeBaseTimeline.tsx (lines 1639-1991).
 * Used by TimelineRenderer across all 3 grid-based chronogram views
 * (homebase, utc, elapsed).
 */

import { AlertTriangle, Battery, Mountain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  getPerformanceColor,
  getRecoveryScore,
  getRecoveryClasses,
  isTrainingDuty,
  getTrainingDutyColor,
  getTrainingDutyLabel,
} from '@/lib/fatigue-utils';
import {
  decomposePerformance,
  calculateFHA,
  getFHASeverity,
  performanceToKSS,
  getKSSLabel,
} from '@/lib/fatigue-calculations';
import type { TimelineDutyBar } from '@/lib/timeline-types';
import type { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DutyBarTooltipProps {
  bar: TimelineDutyBar;
  widthPercent: number;
  leftPercent: number;
  showFlightPhases: boolean;
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  variant: 'homebase' | 'utc' | 'elapsed';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DutyBarTooltip({
  bar,
  widthPercent,
  leftPercent,
  showFlightPhases,
  selectedDuty,
  onDutySelect,
  variant,
}: DutyBarTooltipProps) {
  const usedDiscretion = bar.duty.usedDiscretion;
  const maxFdp = bar.duty.maxFdpHours;
  const actualFdp = bar.duty.actualFdpHours || bar.duty.dutyHours;

  // Determine border radius based on overnight status for visual continuity
  const borderRadius = bar.isOvernightStart
    ? '2px 0 0 2px'
    : bar.isOvernightContinuation
      ? '0 2px 2px 0'
      : '2px';

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onDutySelect(bar.duty)}
            className={cn(
              "absolute z-10 transition-all hover:ring-2 cursor-pointer overflow-hidden flex",
              selectedDuty?.date.getTime() === bar.duty.date.getTime() && "ring-2 ring-foreground",
              usedDiscretion ? "ring-2 ring-critical hover:ring-critical/80" : "hover:ring-foreground"
            )}
            style={{
              top: 0,
              height: '100%',
              left: `${leftPercent}%`,
              width: `${Math.max(widthPercent, 2)}%`,
              borderRadius,
            }}
          >
            {/* Render individual flight segments */}
            {bar.segments.map((segment, segIndex) => {
              // For the elapsed variant, prefer the pre-calculated widthPercent
              // on each segment. Fall back to hour-based calculation.
              const segmentWidth =
                variant === 'elapsed' && segment.widthPercent != null
                  ? segment.widthPercent
                  : ((segment.endHour - segment.startHour) / (bar.endHour - bar.startHour)) * 100;

              // ----- Flight phases (zoomed view) -----
              if (showFlightPhases && segment.type === 'flight' && segment.phases) {
                return (
                  <div
                    key={segIndex}
                    className="h-full relative flex"
                    style={{ width: `${segmentWidth}%` }}
                  >
                    {/* Segment separator line */}
                    {segIndex > 0 && (
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70 z-10" />
                    )}
                    {/* Render each flight phase */}
                    {segment.phases.map((phase, phaseIndex) => (
                      <div
                        key={phaseIndex}
                        className="h-full flex items-center justify-center relative"
                        style={{
                          width: `${phase.widthPercent}%`,
                          backgroundColor: getPerformanceColor(phase.performance),
                        }}
                        title={`${phase.phase}: ${Math.round(phase.performance)}%`}
                      >
                        {/* Phase separator */}
                        {phaseIndex > 0 && (
                          <div className="absolute left-0 top-0 bottom-0 w-px bg-background/40" />
                        )}
                        {/* Phase label — only show for cruise when wide enough */}
                        {phase.phase === 'cruise' && segmentWidth > 15 && (
                          <span className="text-[6px] font-medium text-background/90 truncate">
                            {Math.round(phase.performance)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              // ----- Training segment -----
              if (segment.type === 'training') {
                const bgColor = getTrainingDutyColor(bar.duty.dutyType || 'simulator');
                const perfColor = getPerformanceColor(segment.performance);
                const isSim = bar.duty.dutyType === 'simulator';
                return (
                  <div
                    key={segIndex}
                    className="h-full relative flex items-center justify-center"
                    style={{
                      width: `${segmentWidth}%`,
                      backgroundColor: bgColor,
                      borderLeft: `3px solid ${perfColor}`,
                      ...(isSim && {
                        backgroundImage:
                          'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.08) 3px, rgba(255,255,255,0.08) 6px)',
                      }),
                    }}
                  >
                    {segmentWidth > 6 && (
                      <span className="text-[8px] font-semibold text-white/90 truncate px-0.5">
                        {bar.duty.trainingCode || getTrainingDutyLabel(bar.duty.dutyType || '')}
                      </span>
                    )}
                  </div>
                );
              }

              // ----- Standard rendering (non-zoomed or non-flight segments) -----
              return (
                <div
                  key={segIndex}
                  className={cn(
                    "h-full relative flex items-center justify-center",
                    segment.type === 'checkin' && "opacity-70",
                    segment.type === 'ground' && "opacity-50",
                    segment.type === 'postflight' && "opacity-30"
                  )}
                  style={{
                    width: `${segmentWidth}%`,
                    backgroundColor:
                      segment.type === 'ground' || segment.type === 'postflight'
                        ? 'hsl(var(--muted))'
                        : getPerformanceColor(segment.performance),
                    ...(segment.type === 'postflight' && {
                      backgroundImage:
                        'repeating-linear-gradient(90deg, transparent, transparent 2px, hsl(var(--muted-foreground) / 0.15) 2px, hsl(var(--muted-foreground) / 0.15) 4px)',
                    }),
                  }}
                >
                  {/* Segment separator line */}
                  {segIndex > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70" />
                  )}
                  {/* Flight number label for flights */}
                  {segment.type === 'flight' && segment.flightNumber && segmentWidth > 8 && (
                    <span className="text-[8px] font-medium text-background truncate px-0.5">
                      {segment.flightNumber}
                    </span>
                  )}
                  {/* Check-in indicator */}
                  {segment.type === 'checkin' && segmentWidth > 5 && (
                    <span className="text-[8px] text-background/80">{'\u2713'}</span>
                  )}
                </div>
              );
            })}

            {/* Discretion warning indicator */}
            {usedDiscretion && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-critical flex items-center justify-center">
                <AlertTriangle className="h-2 w-2 text-critical-foreground" />
              </div>
            )}
          </button>
        </TooltipTrigger>

        {/* ----------------------------------------------------------------- */}
        {/* Tooltip content                                                    */}
        {/* ----------------------------------------------------------------- */}
        <TooltipContent side="top" align="start" className="max-w-xs p-3 z-[100]">
          <div className="space-y-2 text-xs">
            {/* Header: date + discretion badge */}
            <div
              className={cn(
                "font-semibold text-sm border-b pb-1 flex items-center justify-between",
                usedDiscretion ? "border-critical" : "border-border"
              )}
            >
              <span>
                {format(bar.duty.date, 'EEEE, MMM d')}{' '}
                {bar.isOvernightContinuation && '(continued)'}
              </span>
              {usedDiscretion && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  DISCRETION
                </Badge>
              )}
            </div>

            {isTrainingDuty(bar.duty) ? (
              <>
                {/* Training duty type + code */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{ borderColor: getTrainingDutyColor(bar.duty.dutyType!) }}
                  >
                    {getTrainingDutyLabel(bar.duty.dutyType!)}
                  </Badge>
                  <span className="font-mono text-xs font-semibold">
                    {bar.duty.trainingCode}
                  </span>
                </div>
                {/* Time window */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Report:</span>
                  <span>{bar.duty.reportTimeLocal}</span>
                  <span className="text-muted-foreground">Release:</span>
                  <span>{bar.duty.releaseTimeLocal}</span>
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{bar.duty.dutyHours.toFixed(1)}h</span>
                </div>
                {bar.duty.trainingAnnotations && bar.duty.trainingAnnotations.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Annotations: {bar.duty.trainingAnnotations.join(', ')}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Flight duty: flights list */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Flights:</span>
                  <span>
                    {bar.duty.flightSegments.map((s) => s.flightNumber).join(', ')}
                  </span>
                </div>

                {/* EASA ORO.FTL Section */}
                {(maxFdp || bar.duty.extendedFdpHours) && (
                  <div className="border-t border-border pt-2 mt-2">
                    <span className="text-muted-foreground font-medium">EASA ORO.FTL:</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                      {maxFdp && (
                        <>
                          <span className="text-muted-foreground">Max FDP:</span>
                          <span>{maxFdp.toFixed(1)}h</span>
                        </>
                      )}
                      {bar.duty.extendedFdpHours && (
                        <>
                          <span className="text-muted-foreground">Extended FDP:</span>
                          <span className="text-warning">
                            {bar.duty.extendedFdpHours.toFixed(1)}h
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground">Actual FDP:</span>
                      <span
                        className={cn(
                          maxFdp && actualFdp > maxFdp && "text-critical font-medium",
                          maxFdp && actualFdp <= maxFdp && "text-success"
                        )}
                      >
                        {actualFdp.toFixed(1)}h
                      </span>
                      {bar.duty.fdpExceedance && bar.duty.fdpExceedance > 0 && (
                        <>
                          <span className="text-muted-foreground">Exceedance:</span>
                          <span className="text-critical font-medium">
                            +{bar.duty.fdpExceedance.toFixed(1)}h
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Flight Segments */}
                <div className="border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground font-medium">Flight Segments:</span>
                  <div className="flex flex-col gap-1 mt-1">
                    {bar.segments
                      .filter((s) => s.type === 'flight')
                      .map((segment, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[10px] p-1 rounded"
                          style={{
                            backgroundColor: `${getPerformanceColor(segment.performance)}20`,
                          }}
                        >
                          <span className="font-medium">{segment.flightNumber}</span>
                          <span className="text-muted-foreground">
                            {segment.departure} {'\u2192'} {segment.arrival}
                          </span>
                          <span
                            style={{ color: getPerformanceColor(segment.performance) }}
                            className="font-medium"
                          >
                            {Math.round(segment.performance)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Common metrics */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2">
              <span className="text-muted-foreground">Min Perf:</span>
              <span style={{ color: getPerformanceColor(bar.duty.minPerformance) }}>
                {Math.round(bar.duty.minPerformance)}%
              </span>
              <span className="text-muted-foreground">WOCL Exposure:</span>
              <span className={bar.duty.woclExposure > 0 ? 'text-warning' : ''}>
                {bar.duty.woclExposure.toFixed(1)}h
              </span>
              <span className="text-muted-foreground">Prior Sleep:</span>
              <span className={bar.duty.priorSleep < 8 ? 'text-warning' : ''}>
                {bar.duty.priorSleep.toFixed(1)}h
              </span>
              <span className="text-muted-foreground">Sleep Debt:</span>
              <span className={bar.duty.sleepDebt > 4 ? 'text-high' : ''}>
                {bar.duty.sleepDebt.toFixed(1)}h
                {(() => {
                  const wp = bar.duty.timelinePoints?.[0];
                  if (wp?.debt_penalty != null && wp.debt_penalty < 0.99) {
                    return <span className="text-warning ml-1">({((1 - wp.debt_penalty) * 100).toFixed(0)}%)</span>;
                  }
                  return null;
                })()}
              </span>
              <span className="text-muted-foreground">Risk Level:</span>
              <span
                className={cn(
                  bar.duty.overallRisk === 'LOW' && 'text-success',
                  bar.duty.overallRisk === 'MODERATE' && 'text-warning',
                  bar.duty.overallRisk === 'HIGH' && 'text-high',
                  bar.duty.overallRisk === 'CRITICAL' && 'text-critical'
                )}
              >
                {bar.duty.overallRisk}
              </span>
            </div>

            {/* Performance "Why?" breakdown + KSS/FHA badges */}
            {(() => {
              const tp = bar.duty.timelinePoints;
              if (!tp || tp.length === 0) return null;
              const worst = tp.reduce(
                (min, pt) =>
                  (pt.performance ?? 100) < (min.performance ?? 100) ? pt : min,
                tp[0]
              );
              if (worst.performance == null) return null;
              const decomp = decomposePerformance({
                performance: worst.performance,
                sleep_pressure: worst.sleep_pressure,
                circadian: worst.circadian,
                sleep_inertia: worst.sleep_inertia,
                time_on_task_penalty: worst.time_on_task_penalty,
                hours_on_duty: worst.hours_on_duty,
              });
              const kss = performanceToKSS(worst.performance);
              const kssLabel = getKSSLabel(kss);
              const validPts = tp.filter((pt) => pt.performance != null);
              const fha = calculateFHA(
                validPts.map((pt) => ({ performance: pt.performance ?? 0 }))
              );
              const fhaSev = getFHASeverity(fha);
              return (
                <div className="border-t border-border pt-2 mt-1 space-y-1.5">
                  <span className="text-muted-foreground font-medium">
                    Why {Math.round(worst.performance)}%?
                  </span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-muted-foreground">Sleep Pressure (S):</span>
                    <span
                      className={
                        decomp.sContribution > 10
                          ? 'text-critical'
                          : decomp.sContribution > 5
                            ? 'text-warning'
                            : ''
                      }
                    >
                      -{decomp.sContribution.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">Circadian (C):</span>
                    <span
                      className={
                        decomp.cContribution > 10
                          ? 'text-critical'
                          : decomp.cContribution > 5
                            ? 'text-warning'
                            : ''
                      }
                    >
                      -{decomp.cContribution.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">Time on Duty (ToT):</span>
                    <span>-{decomp.totContribution.toFixed(1)}%</span>
                    {decomp.wContribution > 0.1 && (
                      <>
                        <span className="text-muted-foreground">Sleep Inertia (W):</span>
                        <span className="text-warning">
                          -{decomp.wContribution.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <Badge variant={kssLabel.variant} className="text-[10px]">
                      KSS {kss.toFixed(1)}
                    </Badge>
                    {fha > 0 && (
                      <Badge variant={fhaSev.variant} className="text-[10px]">
                        FHA {fha}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Cabin Environment — only for flight duties with known cabin alt */}
            {bar.duty.cabinAltitudeFt && bar.duty.cabinAltitudeFt > 5000 && !isTrainingDuty(bar.duty) && (
              <div className="border-t border-border pt-2 mt-2 space-y-1">
                <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Mountain className="h-3 w-3" /> Cabin Environment
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                  {bar.duty.aircraftType && (
                    <>
                      <span className="text-muted-foreground">Aircraft</span>
                      <span className="text-foreground font-medium">{bar.duty.aircraftType}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Cabin Alt.</span>
                  <span className="text-foreground font-medium">{bar.duty.cabinAltitudeFt.toLocaleString()} ft</span>
                  {(() => {
                    const wp = bar.duty.timelinePoints?.[0];
                    if (wp?.hypoxia_factor != null && wp.hypoxia_factor < 0.99) {
                      return (
                        <>
                          <span className="text-muted-foreground">Hypoxia</span>
                          <span className="text-warning font-medium">
                            {((1 - wp.hypoxia_factor) * 100).toFixed(1)}%
                          </span>
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* PVT Lapses + Microsleep probability */}
            {(() => {
              const wp = bar.duty.timelinePoints?.[0];
              if (!wp) return null;
              const pvt = wp.pvt_lapses;
              const micro = wp.microsleep_probability;
              if (pvt == null && micro == null) return null;
              return (
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Alertness Indicators
                  </span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                    {pvt != null && (
                      <>
                        <span className="text-muted-foreground">PVT Lapses</span>
                        <span className={cn(
                          'font-medium',
                          pvt <= 2 ? 'text-success' : pvt <= 5 ? 'text-warning' : 'text-critical',
                        )}>
                          ~{pvt.toFixed(1)}/10min
                        </span>
                      </>
                    )}
                    {micro != null && micro > 0.01 && (
                      <>
                        <span className="text-muted-foreground">Microsleep</span>
                        <span className={cn(
                          'font-medium',
                          micro < 0.02 ? 'text-success' : micro < 0.05 ? 'text-warning' : 'text-critical',
                        )}>
                          {(micro * 100).toFixed(1)}%/hr
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Sleep Recovery Section */}
            {bar.duty.sleepEstimate && (
              <div className="border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Battery className="h-3 w-3" />
                  Sleep Recovery
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                  <span className="text-muted-foreground">Recovery Score:</span>
                  {(() => {
                    const score = getRecoveryScore(bar.duty.sleepEstimate!);
                    const classes = getRecoveryClasses(score);
                    return (
                      <span className={cn('font-medium', classes.text)}>
                        {Math.round(score)}%
                      </span>
                    );
                  })()}
                  <span className="text-muted-foreground">Effective Sleep:</span>
                  <span>{bar.duty.sleepEstimate.effectiveSleepHours.toFixed(1)}h</span>
                  <span className="text-muted-foreground">Efficiency:</span>
                  <span>
                    {Math.round(bar.duty.sleepEstimate.sleepEfficiency * 100)}%
                  </span>
                  <span className="text-muted-foreground">Strategy:</span>
                  <span className="capitalize">{bar.duty.sleepEstimate.sleepStrategy}</span>
                  {bar.duty.sleepEstimate.warnings.length > 0 && (
                    <span className="text-muted-foreground col-span-2 text-warning text-[10px] mt-1">
                      <AlertTriangle className="h-3 w-3 inline-block mr-0.5" /> {bar.duty.sleepEstimate.warnings[0]}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
