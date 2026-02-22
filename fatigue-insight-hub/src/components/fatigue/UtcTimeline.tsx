import { useState, useMemo } from 'react';
import { Info, AlertTriangle, ZoomIn, RotateCcw, Brain, Battery } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DutyAnalysis, RestDaySleep, FlightPhase, SleepQualityFactors, SleepReference } from '@/types/fatigue';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { TimelineLegend } from './TimelineLegend';
import { getRecoveryScore, getRecoveryClasses, getStrategyIcon, getPerformanceColor } from '@/lib/fatigue-utils';
import { utcDayHour, utcToZulu } from '@/lib/timezone-utils';

interface UtcTimelineProps {
  duties: DutyAnalysis[];
  statistics: {
    totalDuties: number;
    highRiskDuties: number;
    criticalRiskDuties: number;
  };
  month: Date;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  restDaysSleep?: RestDaySleep[];
}

// ── Bar types (same structure as Home Base) ──

interface FlightSegmentBar {
  type: 'checkin' | 'flight' | 'ground';
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  startHour: number;
  endHour: number;
  performance: number;
  activityCode?: string | null;
  isDeadhead?: boolean;
  phases?: { phase: FlightPhase; performance: number; widthPercent: number }[];
}

interface DutyBar {
  dayIndex: number;
  startHour: number;
  endHour: number;
  duty: DutyAnalysis;
  isOvernightStart?: boolean;
  isOvernightContinuation?: boolean;
  segments: FlightSegmentBar[];
}

interface SleepBar {
  dayIndex: number;
  startHour: number;
  endHour: number;
  recoveryScore: number;
  effectiveSleep: number;
  sleepEfficiency: number;
  sleepStrategy: string;
  isPreDuty: boolean;
  relatedDuty: DutyAnalysis;
  isOvernightStart?: boolean;
  isOvernightContinuation?: boolean;
  originalStartHour?: number;
  originalEndHour?: number;
  sleepStartZulu?: string;
  sleepEndZulu?: string;
  qualityFactors?: SleepQualityFactors;
  explanation?: string;
  confidenceBasis?: string;
  confidence?: number;
  references?: SleepReference[];
  woclOverlapHours?: number;
}

// WOCL 02:00-06:00 UTC
const WOCL_START = 2;
const WOCL_END = 6;
const ROW_HEIGHT = 40;

/**
 * Parse "HH:mmZ" or "HH:mm" to decimal hours.
 */
const parseUtcTime = (timeStr: string | undefined): number | null => {
  if (!timeStr) return null;
  const cleaned = timeStr.replace('Z', '');
  const [h, m] = cleaned.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
};

/**
 * Extract UTC day and hour from an ISO timestamp string.
 */
const isoToUtcDayHour = (iso: string | undefined): { day: number; hour: number } | null => {
  if (!iso) return null;
  try {
    const { day, hour } = utcDayHour(iso);
    return { day, hour };
  } catch {
    return null;
  }
};

const decimalToHHmm = (h: number): string => {
  const hrs = Math.floor(((h % 24) + 24) % 24);
  const mins = Math.round((h - Math.floor(h)) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(Math.abs(mins)).padStart(2, '0')}`;
};

export function UtcTimeline({
  duties,
  statistics,
  month,
  pilotName,
  pilotBase,
  pilotAircraft,
  onDutySelect,
  selectedDuty,
  restDaysSleep,
}: UtcTimelineProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const { zoom, containerRef, resetZoom, isZoomed } = useChronogramZoom({
    minScaleX: 1, maxScaleX: 4, minScaleY: 1, maxScaleY: 3,
  });

  const showFlightPhases = zoom.scaleX >= 2;

  const discretionCount = useMemo(() =>
    duties.filter(d => d.usedDiscretion).length
  , [duties]);

  const daysInMonth = getDaysInMonth(month);
  const monthStart = startOfMonth(month);

  const allDays = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i))
  , [daysInMonth, monthStart]);

  const hours = Array.from({ length: 8 }, (_, i) => i * 3);

  // ── Compute duty bars using UTC coordinates ──
  const dutyBars = useMemo(() => {
    const bars: DutyBar[] = [];

    duties.forEach((duty) => {
      if (duty.flightSegments.length === 0) return;

      const firstSeg = duty.flightSegments[0];
      const lastSeg = duty.flightSegments[duty.flightSegments.length - 1];

      // Get UTC departure/arrival hours
      // Priority: parse from departureTimeUtc ("HH:mmZ"), then fall back to ISO via departure_time
      let depHourUtc = parseUtcTime(firstSeg.departureTimeUtc);
      let arrHourUtc = parseUtcTime(lastSeg.arrivalTimeUtc);

      // Determine which UTC day the duty starts on
      let utcDay: number | null = null;

      // Try to get UTC day from reportTimeUtc ISO
      if (duty.reportTimeUtc) {
        const parsed = isoToUtcDayHour(duty.reportTimeUtc);
        if (parsed) utcDay = parsed.day;
      }

      // Fall back to dateString
      if (utcDay == null && duty.dateString) {
        utcDay = Number(duty.dateString.split('-')[2]);
      }
      if (utcDay == null) {
        utcDay = duty.date.getUTCDate();
      }

      if (depHourUtc == null || arrHourUtc == null) return;

      // Estimate check-in: 60 min before departure in UTC
      const reportParsed = duty.reportTimeUtc ? isoToUtcDayHour(duty.reportTimeUtc) : null;
      const checkInHour = reportParsed ? reportParsed.hour : Math.max(0, depHourUtc - 1);

      // Build flight segments in UTC
      const buildSegments = (isOvernightCont: boolean): FlightSegmentBar[] => {
        const segs: FlightSegmentBar[] = [];
        if (isOvernightCont) {
          // After midnight portion
          let lastEnd = 0;
          duty.flightSegments.forEach((seg) => {
            const depH = parseUtcTime(seg.departureTimeUtc);
            const arrH = parseUtcTime(seg.arrivalTimeUtc);
            if (depH == null || arrH == null) return;

            if (arrH < depH) {
              // This segment crosses midnight - show 00:00 to arrival
              segs.push({ type: 'flight', flightNumber: seg.flightNumber, departure: seg.departure, arrival: seg.arrival, startHour: 0, endHour: arrH, performance: seg.performance, activityCode: seg.activityCode, isDeadhead: seg.isDeadhead });
              lastEnd = arrH;
            } else if (depH < 12 && arrH < 12) {
              // After-midnight segment
              if (depH > lastEnd + 0.25) {
                segs.push({ type: 'ground', startHour: lastEnd, endHour: depH, performance: duty.avgPerformance });
              }
              segs.push({ type: 'flight', flightNumber: seg.flightNumber, departure: seg.departure, arrival: seg.arrival, startHour: depH, endHour: arrH, performance: seg.performance, activityCode: seg.activityCode, isDeadhead: seg.isDeadhead });
              lastEnd = arrH;
            }
          });
          return segs;
        }

        // Normal: before midnight
        segs.push({ type: 'checkin', startHour: checkInHour, endHour: depHourUtc!, performance: Math.min(100, duty.avgPerformance + 10) });

        let passedMidnight = false;
        duty.flightSegments.forEach((seg, idx) => {
          if (passedMidnight) return;
          const depH = parseUtcTime(seg.departureTimeUtc);
          const arrH = parseUtcTime(seg.arrivalTimeUtc);
          if (depH == null || arrH == null) return;

          // Ground time
          if (idx > 0) {
            const prevSeg = duty.flightSegments[idx - 1];
            const prevArr = parseUtcTime(prevSeg.arrivalTimeUtc);
            if (prevArr != null) {
              if (prevArr > depH) {
                // Midnight crossed
                if (prevArr < 23.75) {
                  segs.push({ type: 'ground', startHour: prevArr, endHour: 24, performance: duty.avgPerformance });
                }
                passedMidnight = true;
                return;
              }
              if (depH > prevArr + 0.25) {
                segs.push({ type: 'ground', startHour: prevArr, endHour: depH, performance: duty.avgPerformance });
              }
            }
          }

          let effectiveArr = arrH;
          if (arrH < depH) {
            effectiveArr = 24;
            passedMidnight = true;
          }

          const phases: FlightSegmentBar['phases'] = [
            { phase: 'takeoff', performance: seg.performance + 5, widthPercent: 15 },
            { phase: 'climb', performance: seg.performance + 3, widthPercent: 10 },
            { phase: 'cruise', performance: seg.performance, widthPercent: 50 },
            { phase: 'descent', performance: seg.performance - 2, widthPercent: 10 },
            { phase: 'approach', performance: seg.performance - 4, widthPercent: 10 },
            { phase: 'landing', performance: duty.landingPerformance || seg.performance - 5, widthPercent: 5 },
          ];

          segs.push({
            type: 'flight', flightNumber: seg.flightNumber, departure: seg.departure, arrival: seg.arrival,
            startHour: depH, endHour: effectiveArr, performance: seg.performance,
            activityCode: seg.activityCode, isDeadhead: seg.isDeadhead, phases,
          });
        });
        return segs;
      };

      // Detect overnight in UTC: arrival hour < departure hour
      const isOvernight = arrHourUtc < depHourUtc;

      if (isOvernight) {
        bars.push({
          dayIndex: utcDay, startHour: checkInHour, endHour: 24,
          duty, isOvernightStart: true, segments: buildSegments(false),
        });
        if (utcDay < daysInMonth && arrHourUtc > 0) {
          bars.push({
            dayIndex: utcDay + 1, startHour: 0, endHour: arrHourUtc,
            duty, isOvernightContinuation: true, segments: buildSegments(true),
          });
        }
      } else {
        bars.push({
          dayIndex: utcDay, startHour: checkInHour, endHour: arrHourUtc,
          duty, segments: buildSegments(false),
        });
      }
    });

    return bars;
  }, [duties, daysInMonth]);

  // ── Compute sleep bars using UTC coordinates ──
  const sleepBars = useMemo(() => {
    const bars: SleepBar[] = [];

    const addSleepBar = (
      startDay: number, startHour: number, endDay: number, endHour: number,
      extras: Omit<SleepBar, 'dayIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'>
    ) => {
      if (startDay === endDay && endHour > startHour) {
        bars.push({ ...extras, dayIndex: startDay, startHour, endHour });
      } else if (startDay !== endDay || endHour <= startHour) {
        const actualEndDay = endDay !== startDay ? endDay : startDay + 1;
        if (startDay >= 1 && startDay <= daysInMonth) {
          bars.push({ ...extras, dayIndex: startDay, startHour, endHour: 24, isOvernightStart: true, originalStartHour: startHour, originalEndHour: endHour });
        }
        if (actualEndDay >= 1 && actualEndDay <= daysInMonth && endHour > 0) {
          bars.push({ ...extras, dayIndex: actualEndDay, startHour: 0, endHour, isOvernightContinuation: true, originalStartHour: startHour, originalEndHour: endHour });
        }
      }
    };

    duties.forEach((duty) => {
      const est = duty.sleepEstimate;
      if (!est) return;

      const recoveryScore = getRecoveryScore(est);
      const baseExtras = {
        recoveryScore,
        effectiveSleep: est.effectiveSleepHours,
        sleepEfficiency: est.sleepEfficiency,
        sleepStrategy: est.sleepStrategy,
        isPreDuty: true,
        relatedDuty: duty,
        qualityFactors: est.qualityFactors,
        explanation: est.explanation,
        confidenceBasis: est.confidenceBasis,
        confidence: est.confidence,
        references: est.references,
        woclOverlapHours: est.woclOverlapHours,
        sleepStartZulu: est.sleepStartIso ? utcToZulu(est.sleepStartIso) : undefined,
        sleepEndZulu: est.sleepEndIso ? utcToZulu(est.sleepEndIso) : undefined,
      };

      // Use ISO timestamps → UTC day/hour (deterministic)
      if (est.sleepStartIso && est.sleepEndIso) {
        const s = isoToUtcDayHour(est.sleepStartIso);
        const e = isoToUtcDayHour(est.sleepEndIso);
        if (s && e) {
          addSleepBar(s.day, s.hour, e.day, e.hour, baseExtras);
          return;
        }
      }

      // Fallback: use location-tz precomputed values (less accurate for UTC)
      if (est.sleepStartDay != null && est.sleepStartHour != null && est.sleepEndDay != null && est.sleepEndHour != null) {
        addSleepBar(est.sleepStartDay, est.sleepStartHour, est.sleepEndDay, est.sleepEndHour, baseExtras);
      }
    });

    // Rest day sleep bars
    if (restDaysSleep) {
      restDaysSleep.forEach((restDay) => {
        const restDayExtras = {
          qualityFactors: restDay.qualityFactors,
          explanation: restDay.explanation,
          confidenceBasis: restDay.confidenceBasis,
          confidence: restDay.confidence,
          references: restDay.references,
        };

        restDay.sleepBlocks.forEach((block) => {
          const baseScore = (block.effectiveHours / 8) * 100;
          const recoveryScore = Math.min(100, Math.max(0, baseScore + block.qualityFactor * 20));

          const pseudoDuty: DutyAnalysis = {
            date: restDay.date, dayOfWeek: format(restDay.date, 'EEE'),
            dutyHours: 0, blockHours: 0, sectors: 0,
            minPerformance: 100, avgPerformance: 100, landingPerformance: 100,
            sleepDebt: 0, woclExposure: 0, priorSleep: restDay.totalSleepHours,
            overallRisk: 'LOW', minPerformanceRisk: 'LOW', landingRisk: 'LOW',
            smsReportable: false, flightSegments: [],
            crewComposition: 'standard', restFacilityClass: null, isUlr: false,
            acclimatizationState: 'acclimatized', ulrCompliance: null,
            inflightRestBlocks: [], returnToDeckPerformance: null, preDutyAwakeHours: 0,
          };

          const extras = {
            recoveryScore, effectiveSleep: block.effectiveHours,
            sleepEfficiency: block.qualityFactor, sleepStrategy: restDay.strategyType,
            isPreDuty: false, relatedDuty: pseudoDuty,
            sleepStartZulu: block.sleepStartIso ? utcToZulu(block.sleepStartIso) : undefined,
            sleepEndZulu: block.sleepEndIso ? utcToZulu(block.sleepEndIso) : undefined,
            ...restDayExtras,
          };

          // Use ISO → UTC
          const s = isoToUtcDayHour(block.sleepStartIso);
          const e = isoToUtcDayHour(block.sleepEndIso);
          if (s && e) {
            addSleepBar(s.day, s.hour, e.day, e.hour, extras);
          }
        });
      });
    }

    // Deduplicate exact duplicates
    const seen = new Set<string>();
    return bars.filter(bar => {
      const key = `${bar.dayIndex}|${bar.startHour.toFixed(2)}|${bar.endHour.toFixed(2)}|${bar.sleepStrategy ?? ''}|${bar.isPreDuty}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [duties, restDaysSleep, daysInMonth]);

  // Day warnings
  const getDayWarnings = (dayOfMonth: number) => {
    const duty = duties.find(d => d.date.getDate() === dayOfMonth);
    if (!duty) return null;
    const warnings: string[] = [];
    if (duty.woclExposure > 0) warnings.push(`WOCL ${duty.woclExposure.toFixed(1)}h`);
    if (duty.priorSleep < 8) warnings.push(`Sleep ${duty.priorSleep.toFixed(1)}h`);
    if (duty.minPerformance < 60) warnings.push(`Perf ${Math.round(duty.minPerformance)}%`);
    if (duty.sleepDebt > 4) warnings.push(`Debt ${duty.sleepDebt.toFixed(1)}h`);
    return { warnings, risk: duty.overallRisk };
  };

  return (
    <div className="space-y-4">
      {/* Zoom Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showFlightPhases && (
            <p className="text-xs text-primary flex items-center gap-1">
              <ZoomIn className="h-3 w-3" />
              Flight phases visible
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isZoomed ? `Zoom: ${zoom.scaleX.toFixed(1)}x` : 'Pinch/Ctrl+Scroll to zoom'}
          </span>
          {isZoomed && (
            <Button variant="outline" size="sm" onClick={resetZoom} className="text-xs h-7 px-2">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Info Collapsible */}
      <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            <Info className="mr-1 h-3 w-3" />
            How to Read This Chart
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p className="mb-2">This chart shows duties positioned in <strong>UTC (Zulu) time</strong>. All bars use deterministic UTC coordinates from ISO timestamps — no timezone conversion applied.</p>
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(120, 70%, 45%)' }} /> 80-100% (Good)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(55, 90%, 55%)' }} /> 60-80% (Moderate)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(25, 95%, 50%)' }} /> 40-60% (High Risk)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(0, 80%, 50%)' }} /> &lt;40% (Critical)</span>
            </div>
            <p className="mt-2">Purple shaded area = WOCL (Window of Circadian Low: 02:00-06:00 UTC)</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Legend */}
      <TimelineLegend showDiscretion={discretionCount > 0} variant="homebase" />

      {/* Timeline Grid */}
      <div
        ref={containerRef}
        className="overflow-auto pb-4 touch-pan-x touch-pan-y"
        style={{ maxHeight: isZoomed ? '80vh' : undefined }}
      >
        <div
          className="min-w-[800px] transition-transform duration-100"
          style={{
            transform: `translate(${zoom.panX}px, ${zoom.panY}px) scale(${zoom.scaleX}, ${zoom.scaleY})`,
            transformOrigin: 'top left',
            width: `${100 / zoom.scaleX}%`,
          }}
        >
          {/* Header */}
          <div className="mb-4 text-center">
            {pilotName && <h2 className="text-lg font-semibold text-foreground">{pilotName}</h2>}
            {(pilotBase || pilotAircraft) && (
              <div className="text-sm text-muted-foreground">
                {[pilotBase, pilotAircraft].filter(Boolean).join(' | ')}
              </div>
            )}
            <div className="mt-1 text-sm font-medium">
              {format(month, 'MMMM yyyy')} — UTC (Zulu) Timeline
            </div>
          </div>

          {/* Stats ribbon */}
          <div className="mb-3 flex items-center justify-center gap-4 text-[11px] flex-wrap">
            <span>Duties: <strong>{statistics.totalDuties}</strong></span>
            <span>High Risk: <strong className="text-high">{statistics.highRiskDuties}</strong></span>
            <span>Critical: <strong className="text-critical">{statistics.criticalRiskDuties}</strong></span>
            {discretionCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" />
                {discretionCount} Discretion
              </Badge>
            )}
          </div>

          <div className="flex">
            {/* Y-axis */}
            <div className="w-28 flex-shrink-0">
              <div style={{ height: `${ROW_HEIGHT}px` }} />
              {allDays.map((day) => {
                const dayNum = day.getDate();
                const dayWarnings = getDayWarnings(dayNum);
                const hasDuty = dutyBars.some(bar => bar.dayIndex === dayNum);
                const riskClass = dayWarnings?.risk === 'CRITICAL' ? 'risk-border-critical'
                  : dayWarnings?.risk === 'HIGH' ? 'risk-border-high'
                  : dayWarnings?.risk === 'MODERATE' ? 'risk-border-moderate'
                  : hasDuty ? 'risk-border-low' : '';
                return (
                  <div
                    key={dayNum}
                    className={cn(
                      "relative flex items-center gap-1 pr-2 text-[11px]",
                      !hasDuty && "opacity-40",
                      riskClass
                    )}
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    <div className="flex flex-col items-start min-w-[50px] pl-1">
                      {dayWarnings && dayWarnings.warnings.length > 0 && (
                        <span className={cn(
                          "text-[9px] leading-tight truncate max-w-[50px]",
                          dayWarnings.risk === 'CRITICAL' && "text-critical",
                          dayWarnings.risk === 'HIGH' && "text-high",
                          dayWarnings.risk === 'MODERATE' && "text-warning",
                          dayWarnings.risk === 'LOW' && "text-muted-foreground"
                        )}>
                          {dayWarnings.warnings[0]}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "ml-auto font-medium text-[11px]",
                      hasDuty ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {format(day, 'EEE d')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Main chart */}
            <div className="relative flex-1">
              {/* X-axis header */}
              <div className="flex border-b border-border" style={{ height: `${ROW_HEIGHT}px` }}>
                {hours.map((hour) => (
                  <div key={hour} className="flex-1 text-center text-[11px] text-muted-foreground flex items-center justify-center" style={{ width: `${(3/24) * 100}%` }}>
                    {hour.toString().padStart(2, '0')}:00Z
                  </div>
                ))}
              </div>

              <div className="relative">
                {/* WOCL band */}
                <div
                  className="absolute top-0 bottom-0 wocl-hatch"
                  style={{
                    left: `${(WOCL_START / 24) * 100}%`,
                    width: `${((WOCL_END - WOCL_START) / 24) * 100}%`,
                  }}
                />

                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className={cn("flex-1 border-r", hour % 3 === 0 ? "border-border/50" : "border-border/20")} />
                  ))}
                </div>

                {/* Day rows */}
                {allDays.map((day) => {
                  const dayNum = day.getDate();
                  return (
                    <div key={dayNum} className="relative border-b border-border/20" style={{ height: `${ROW_HEIGHT}px` }}>
                      {/* Sleep bars */}
                      {sleepBars
                        .filter(bar => bar.dayIndex === dayNum)
                        .map((bar, barIndex) => {
                          const barWidth = ((bar.endHour - bar.startHour) / 24) * 100;
                          const classes = getRecoveryClasses(bar.recoveryScore);
                          const borderRadius = bar.isOvernightStart ? '2px 0 0 2px' : bar.isOvernightContinuation ? '0 2px 2px 0' : '2px';
                          return (
                            <Popover key={`sleep-${barIndex}`}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="absolute z-[5] flex items-center justify-end px-1 border border-dashed cursor-pointer hover:brightness-110 transition-all border-primary/20 bg-primary/5"
                                  style={{
                                    top: 0, height: '100%',
                                    left: `${(bar.startHour / 24) * 100}%`,
                                    width: `${Math.max(barWidth, 1)}%`,
                                    borderRadius,
                                    borderRight: bar.isOvernightStart ? 'none' : undefined,
                                    borderLeft: bar.isOvernightContinuation ? 'none' : undefined,
                                  }}
                                >
                                  {barWidth > 6 && (
                                    <div className={cn("flex items-center gap-0.5 text-[8px] font-medium", classes.text)}>
                                      <span>{getStrategyIcon(bar.sleepStrategy)}</span>
                                      <span>{Math.round(bar.recoveryScore)}%</span>
                                    </div>
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" side="top" className="max-w-sm p-3">
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center justify-between border-b border-border pb-2">
                                    <div className="font-semibold flex items-center gap-1.5">
                                      <span className="text-base">{bar.isPreDuty ? '🛏️' : '🔋'}</span>
                                      <span>{bar.isPreDuty ? 'Pre-Duty Sleep' : 'Recovery Sleep'}</span>
                                    </div>
                                    <div className={cn("text-lg font-bold", classes.text)}>
                                      {Math.round(bar.recoveryScore)}%
                                    </div>
                                  </div>
                                  {bar.explanation && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-md p-2 text-[11px] text-muted-foreground leading-relaxed">
                                      <span className="text-primary font-medium">💡 </span>{bar.explanation}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span>Sleep Window (UTC)</span>
                                    <span className="font-mono font-medium text-foreground">
                                      {bar.sleepStartZulu ?? decimalToHHmm(bar.originalStartHour ?? bar.startHour) + 'Z'} → {bar.sleepEndZulu ?? decimalToHHmm(bar.originalEndHour ?? bar.endHour) + 'Z'}
                                    </span>
                                  </div>
                                  <div className="bg-secondary/30 rounded-lg p-2 space-y-1.5">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Recovery Score Breakdown</div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5"><span className="text-muted-foreground">⏱️</span><span>Effective Sleep</span></div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{bar.effectiveSleep.toFixed(1)}h / 8h</span>
                                        <span className={cn("font-mono font-medium min-w-[40px] text-right", bar.effectiveSleep >= 7 ? "text-success" : bar.effectiveSleep >= 5 ? "text-warning" : "text-critical")}>+{Math.round((bar.effectiveSleep / 8) * 100)}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5"><span className="text-muted-foreground">✨</span><span>Sleep Quality</span></div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{Math.round(bar.sleepEfficiency * 100)}%</span>
                                        <span className={cn("font-mono font-medium min-w-[40px] text-right", bar.sleepEfficiency >= 0.9 ? "text-success" : bar.sleepEfficiency >= 0.7 ? "text-warning" : "text-high")}>+{Math.round(bar.sleepEfficiency * 20)}</span>
                                      </div>
                                    </div>
                                    {(bar.woclOverlapHours ?? 0) > 0 && (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5"><span className="text-muted-foreground">🌙</span><span>WOCL Overlap</span></div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">{bar.woclOverlapHours!.toFixed(1)}h</span>
                                          <span className="font-mono font-medium text-critical min-w-[40px] text-right">-{Math.round(bar.woclOverlapHours! * 5)}</span>
                                        </div>
                                      </div>
                                    )}
                                    <div className="border-t border-border/50 pt-1.5 flex items-center justify-between font-medium">
                                      <span>Total Score</span>
                                      <span className={cn("font-mono", classes.text)}>= {Math.round(bar.recoveryScore)}%</span>
                                    </div>
                                  </div>
                                  {bar.qualityFactors && (
                                    <div className="bg-secondary/20 rounded-lg p-2 space-y-1.5">
                                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">🔬 Model Calculation Factors</div>
                                      {Object.entries(bar.qualityFactors).map(([key, value]) => {
                                        const labels: Record<string, string> = { base_efficiency: 'Base Efficiency', wocl_boost: 'WOCL Boost', late_onset_penalty: 'Late Onset', recovery_boost: 'Recovery Boost', time_pressure_factor: 'Time Pressure', insufficient_penalty: 'Duration Penalty', pre_duty_awake_hours: 'Pre-Duty Awake' };
                                        const numValue = value as number;
                                        const isHours = key === 'pre_duty_awake_hours';
                                        return (
                                          <div key={key} className="flex items-center justify-between text-[11px]">
                                            <span className="text-muted-foreground">{labels[key] || key}</span>
                                            <span className={cn("font-mono font-medium", isHours ? (numValue <= 2 ? "text-success" : numValue <= 4 ? "text-muted-foreground" : numValue <= 8 ? "text-warning" : "text-critical") : (numValue >= 1.05 ? "text-success" : numValue >= 0.98 ? "text-muted-foreground" : numValue >= 0.90 ? "text-warning" : "text-critical"))}>
                                              {isHours ? `${numValue.toFixed(1)}h` : `${numValue >= 1 ? '+' : ''}${((numValue - 1) * 100).toFixed(0)}%`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {bar.confidence != null && (
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-muted-foreground">Model Confidence</span>
                                      <span className={cn("font-mono font-medium px-1.5 py-0.5 rounded", bar.confidence >= 0.7 ? "bg-success/10 text-success" : bar.confidence >= 0.5 ? "bg-warning/10 text-warning" : "bg-high/10 text-high")}>{Math.round(bar.confidence * 100)}%</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-muted-foreground">Strategy</span>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50">
                                      <span>{getStrategyIcon(bar.sleepStrategy)}</span>
                                      <span className="capitalize font-medium">{bar.sleepStrategy.split('_').join(' ')}</span>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                                    {bar.isPreDuty
                                      ? `Rest before ${format(bar.relatedDuty.date, 'EEEE, MMM d')} duty`
                                      : `Rest day recovery • ${format(bar.relatedDuty.date, 'EEEE, MMM d')}`}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })}

                      {/* Duty bars */}
                      {dutyBars
                        .filter(bar => bar.dayIndex === dayNum)
                        .map((bar, barIndex) => {
                          const usedDiscretion = bar.duty.usedDiscretion;
                          const borderRadius = bar.isOvernightStart ? '2px 0 0 2px' : bar.isOvernightContinuation ? '0 2px 2px 0' : '2px';
                          return (
                            <TooltipProvider key={barIndex} delayDuration={100}>
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
                                      top: 0, height: '100%',
                                      left: `${(bar.startHour / 24) * 100}%`,
                                      width: `${Math.max(((bar.endHour - bar.startHour) / 24) * 100, 2)}%`,
                                      borderRadius,
                                    }}
                                  >
                                    {bar.segments.map((segment, segIndex) => {
                                      const segmentWidth = ((segment.endHour - segment.startHour) / (bar.endHour - bar.startHour)) * 100;

                                      if (showFlightPhases && segment.type === 'flight' && segment.phases) {
                                        return (
                                          <div key={segIndex} className="h-full relative flex" style={{ width: `${segmentWidth}%` }}>
                                            {segIndex > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70 z-10" />}
                                            {segment.phases.map((phase, pi) => (
                                              <div key={pi} className="h-full flex items-center justify-center relative" style={{ width: `${phase.widthPercent}%`, backgroundColor: getPerformanceColor(phase.performance) }}>
                                                {pi > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-background/40" />}
                                                {phase.phase === 'cruise' && zoom.scaleX >= 2.5 && segmentWidth > 15 && (
                                                  <span className="text-[6px] font-medium text-background/90">{Math.round(phase.performance)}%</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }

                                      const isDH = segment.isDeadhead || segment.activityCode === 'DH';
                                      const isIR = segment.activityCode === 'IR';
                                      return (
                                        <div
                                          key={segIndex}
                                          className={cn("h-full relative flex items-center justify-center", segment.type === 'checkin' && "opacity-70", segment.type === 'ground' && "opacity-50")}
                                          style={{
                                            width: `${segmentWidth}%`,
                                            backgroundColor: segment.type === 'ground' ? 'hsl(var(--muted))' : isDH ? 'transparent' : getPerformanceColor(segment.performance),
                                            ...(isDH ? { background: `repeating-linear-gradient(135deg, ${getPerformanceColor(segment.performance)}40, ${getPerformanceColor(segment.performance)}40 3px, ${getPerformanceColor(segment.performance)}20 3px, ${getPerformanceColor(segment.performance)}20 6px)`, border: `1px dashed ${getPerformanceColor(segment.performance)}80` } : {}),
                                          }}
                                        >
                                          {segIndex > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70" />}
                                          {segment.type === 'flight' && segment.flightNumber && segmentWidth > 8 && (
                                            <span className={cn("text-[8px] font-medium truncate px-0.5 flex items-center gap-0.5", isDH ? "text-foreground/70" : "text-background")}>
                                              {segment.activityCode && (
                                                <span className={cn("text-[7px] px-0.5 rounded font-bold", isDH ? "bg-muted-foreground/30 text-foreground" : isIR ? "bg-primary/60 text-primary-foreground" : "bg-background/30")}>{segment.activityCode}</span>
                                              )}
                                              {segment.flightNumber}
                                            </span>
                                          )}
                                          {segment.type === 'flight' && segment.activityCode && segmentWidth <= 8 && segmentWidth > 3 && (
                                            <span className={cn("text-[6px] font-bold px-0.5", isDH ? "text-foreground/70" : "text-background/90")}>{segment.activityCode}</span>
                                          )}
                                          {segment.type === 'checkin' && segmentWidth > 5 && (
                                            <span className="text-[8px] text-background/80">✓</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {usedDiscretion && (
                                      <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-critical flex items-center justify-center">
                                        <AlertTriangle className="h-2 w-2 text-critical-foreground" />
                                      </div>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="start" className="max-w-xs p-3 z-[100]">
                                  <div className="space-y-2 text-xs">
                                    <div className={cn("font-semibold text-sm border-b pb-1 flex items-center justify-between", usedDiscretion ? "border-critical" : "border-border")}>
                                      <span>{format(bar.duty.date, 'EEEE, MMM d')} {bar.isOvernightContinuation && '(continued)'}</span>
                                      {usedDiscretion && <Badge variant="destructive" className="text-[10px] px-1 py-0">DISCRETION</Badge>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      <span className="text-muted-foreground">Flights:</span>
                                      <span>{bar.duty.flightSegments.map(s => s.flightNumber).join(', ')}</span>
                                    </div>
                                    {/* Flight Segments with UTC times */}
                                    <div className="border-t border-border pt-2 mt-2">
                                      <span className="text-muted-foreground font-medium">Flight Segments (UTC):</span>
                                      <div className="flex flex-col gap-1 mt-1">
                                        {bar.segments.filter(s => s.type === 'flight').map((segment, i) => {
                                          const isDH = segment.isDeadhead || segment.activityCode === 'DH';
                                          return (
                                            <div key={i} className={cn("flex items-center justify-between text-[10px] p-1 rounded gap-1", isDH && "border border-dashed border-muted-foreground/40")} style={{ backgroundColor: isDH ? 'transparent' : `${getPerformanceColor(segment.performance)}20` }}>
                                              <span className="font-medium flex items-center gap-1">
                                                {segment.activityCode && <span className={cn("text-[9px] px-1 rounded font-bold", isDH ? "bg-muted text-muted-foreground" : segment.activityCode === 'IR' ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground")}>{segment.activityCode}</span>}
                                                {segment.flightNumber}
                                              </span>
                                              <span className="text-muted-foreground">{segment.departure} → {segment.arrival}</span>
                                              <span className="font-mono text-muted-foreground">{decimalToHHmm(segment.startHour)}Z–{decimalToHHmm(segment.endHour)}Z</span>
                                              <span style={{ color: getPerformanceColor(segment.performance) }} className="font-medium">{isDH ? 'PAX' : `${Math.round(segment.performance)}%`}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2">
                                      <span className="text-muted-foreground">Min Perf:</span>
                                      <span style={{ color: getPerformanceColor(bar.duty.minPerformance) }}>{Math.round(bar.duty.minPerformance)}%</span>
                                      <span className="text-muted-foreground">WOCL Exposure:</span>
                                      <span className={bar.duty.woclExposure > 0 ? "text-warning" : ""}>{bar.duty.woclExposure.toFixed(1)}h</span>
                                      <span className="text-muted-foreground">Prior Sleep:</span>
                                      <span className={bar.duty.priorSleep < 8 ? "text-warning" : ""}>{bar.duty.priorSleep.toFixed(1)}h</span>
                                      <span className="text-muted-foreground">Risk Level:</span>
                                      <span className={cn(
                                        bar.duty.overallRisk === 'LOW' && "text-success",
                                        bar.duty.overallRisk === 'MODERATE' && "text-warning",
                                        bar.duty.overallRisk === 'HIGH' && "text-high",
                                        bar.duty.overallRisk === 'CRITICAL' && "text-critical"
                                      )}>{bar.duty.overallRisk}</span>
                                    </div>
                                    {bar.duty.sleepEstimate && (
                                      <div className="border-t border-border pt-2 mt-2">
                                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                                          <Battery className="h-3 w-3" />
                                          Sleep Recovery
                                        </span>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                                          <span className="text-muted-foreground">Recovery Score:</span>
                                          {(() => {
                                            const score = getRecoveryScore(bar.duty.sleepEstimate);
                                            const cls = getRecoveryClasses(score);
                                            return <span className={cn("font-medium", cls.text)}>{Math.round(score)}%</span>;
                                          })()}
                                          <span className="text-muted-foreground">Effective Sleep:</span>
                                          <span>{bar.duty.sleepEstimate.effectiveSleepHours.toFixed(1)}h</span>
                                          <span className="text-muted-foreground">Strategy:</span>
                                          <span className="capitalize">{bar.duty.sleepEstimate.sleepStrategy}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Color legend */}
            <div className="ml-3 flex w-10 flex-shrink-0 flex-col">
              <div style={{ height: `${ROW_HEIGHT}px` }} />
              <div className="flex gap-1" style={{ height: `${allDays.length * ROW_HEIGHT}px` }}>
                <div className="w-2.5 rounded-sm overflow-hidden">
                  <div className="h-full w-full" style={{ background: 'linear-gradient(to bottom, hsl(120, 70%, 45%), hsl(90, 70%, 50%), hsl(55, 90%, 55%), hsl(40, 95%, 50%), hsl(25, 95%, 50%), hsl(0, 80%, 50%))' }} />
                </div>
                <div className="flex flex-col justify-between text-[9px] text-muted-foreground">
                  <span>100</span>
                  <span>60</span>
                  <span>0</span>
                </div>
              </div>
            </div>
          </div>

          {/* X-axis label */}
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Time of Day (UTC / Zulu)
          </div>
        </div>
      </div>

      {/* Quick duty selection */}
      <div className="space-y-2 pt-4 border-t border-border">
        <h4 className="text-sm font-medium">Quick Duty Selection</h4>
        <div className="flex flex-wrap gap-2">
          {duties.map((duty, index) => (
            <button
              key={index}
              onClick={() => onDutySelect(duty)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 text-foreground relative",
                duty.overallRisk === 'LOW' && "bg-success hover:bg-success/80",
                duty.overallRisk === 'MODERATE' && "bg-warning hover:bg-warning/80",
                duty.overallRisk === 'HIGH' && "bg-high hover:bg-high/80",
                duty.overallRisk === 'CRITICAL' && "bg-critical hover:bg-critical/80",
                selectedDuty?.date.getTime() === duty.date.getTime()
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                  : 'hover:scale-105'
              )}
            >
              {duty.isUlr && <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded-full px-1 leading-tight">ULR</span>}
              {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
