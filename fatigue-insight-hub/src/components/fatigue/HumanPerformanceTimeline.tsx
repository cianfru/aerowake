import { useState, useMemo } from 'react';
import { Info, AlertTriangle, RotateCcw, Brain, Battery, ZoomIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DutyAnalysis, RestDaySleep, FlightPhase, SleepQualityFactors, SleepReference } from '@/types/fatigue';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseTimeToHours, decimalToHHmm, isoToZulu, getPerformanceColor, getRecoveryScore, getRecoveryClasses, getStrategyIcon } from '@/lib/fatigue-utils';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { TimelineLegend } from './TimelineLegend';

interface HumanPerformanceTimelineProps {
  duties: DutyAnalysis[];
  month: Date;
  pilotName?: string;
  pilotBase?: string;
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  restDaysSleep?: RestDaySleep[];
}

// Circadian adaptation rates (hours/day)
const ADAPTATION_RATE_EAST = 1.0;
const ADAPTATION_RATE_WEST = 1.5;

// Default WOCL window (02:00-06:00 body clock time)
const WOCL_START = 2;
const WOCL_END = 6;
const NADIR_HOUR = 4.5;

const DEFAULT_CHECK_IN_MINUTES = 60;

// ── Elapsed-time bar types ──

interface ElapsedDutyBar {
  rowIndex: number;       // Which 24h row (0-based)
  startHourInRow: number; // 0-24 within the row
  endHourInRow: number;   // 0-24 within the row
  duty: DutyAnalysis;
  isOverflowStart?: boolean;     // Bar continues to next row
  isOverflowContinuation?: boolean; // Bar started on previous row
  segments: ElapsedSegment[];
}

interface ElapsedSegment {
  type: 'checkin' | 'flight' | 'ground';
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  widthPercent: number;
  performance: number;
  phases?: { phase: FlightPhase; performance: number; widthPercent: number }[];
}

interface ElapsedSleepBar {
  rowIndex: number;
  startHourInRow: number;
  endHourInRow: number;
  recoveryScore: number;
  effectiveSleep: number;
  sleepEfficiency: number;
  sleepStrategy: string;
  isPreDuty: boolean;
  relatedDuty: DutyAnalysis;
  isOverflowStart?: boolean;
  isOverflowContinuation?: boolean;
  originalStartHour?: number;
  originalEndHour?: number;
  // Zulu (UTC) times for display in tooltip
  sleepStartZulu?: string;
  sleepEndZulu?: string;
  qualityFactors?: SleepQualityFactors;
  explanation?: string;
  confidenceBasis?: string;
  confidence?: number;
  references?: SleepReference[];
  woclOverlapHours?: number;
}

interface WoclBand {
  rowIndex: number;
  startHourInRow: number;
  endHourInRow: number;
}

export function HumanPerformanceTimeline({
  duties,
  month,
  pilotName,
  pilotBase,
  onDutySelect,
  selectedDuty,
  restDaysSleep,
}: HumanPerformanceTimelineProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const { zoom, containerRef, resetZoom, isZoomed } = useChronogramZoom({
    minScaleX: 1, maxScaleX: 4, minScaleY: 1, maxScaleY: 3,
  });

  const showFlightPhases = zoom.scaleX >= 2;

  const discretionCount = useMemo(() =>
    duties.filter(d => d.usedDiscretion).length
  , [duties]);

  // ── T=0 reference: first hour of the roster month ──
  const t0 = useMemo(() => {
    // T=0 = midnight on the 1st of the roster month
    const d = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
    return d;
  }, [month]);

  // Convert a Date + HH:mm time to elapsed hours from T=0
  const toElapsed = (date: Date, hourOfDay: number): number => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayOffsetMs = dayStart.getTime() - t0.getTime();
    const dayOffsetHours = dayOffsetMs / (1000 * 60 * 60);
    return dayOffsetHours + hourOfDay;
  };

  // Convert dayOfMonth + hourOfDay to elapsed hours from T=0
  const dayHourToElapsed = (dayOfMonth: number, hourOfDay: number): number => {
    const d = new Date(month.getFullYear(), month.getMonth(), dayOfMonth);
    d.setHours(0, 0, 0, 0);
    const offsetMs = d.getTime() - t0.getTime();
    return offsetMs / (1000 * 60 * 60) + hourOfDay;
  };

  // ── Circadian phase shifts (accumulated timezone crossings) ──
  const circadianShifts = useMemo(() => {
    // Track accumulated phase shift per elapsed-24h-row
    const sorted = [...duties].sort((a, b) => a.date.getTime() - b.date.getTime());
    const shifts: Map<number, number> = new Map(); // rowIndex -> phaseShift
    let currentShift = 0;
    let lastDutyElapsed = 0;

    sorted.forEach((duty) => {
      const dayOfMonth = duty.dateString ? Number(duty.dateString.split('-')[2]) : duty.date.getDate();
      const reportHour = parseTimeToHours(duty.reportTimeLocal) ?? 0;
      const elapsed = dayHourToElapsed(dayOfMonth, reportHour);
      
      // Rest days between duties: body clock adapts
      if (lastDutyElapsed > 0) {
        const restHours = elapsed - lastDutyElapsed;
        const restDays = restHours / 24;
        if (restDays > 0.5) {
          const rate = currentShift > 0 ? ADAPTATION_RATE_EAST : ADAPTATION_RATE_WEST;
          const adaptation = Math.min(Math.abs(currentShift), restDays * rate);
          currentShift += currentShift > 0 ? -adaptation : adaptation;
        }
      }

      // Prefer backend-provided circadian_phase_shift (absolute value at this duty)
      if (duty.circadianPhaseShiftValue != null) {
        currentShift = duty.circadianPhaseShiftValue;
      } else {
        currentShift += duty.circadianPhaseShift || 0;
      }
      currentShift = Math.max(-12, Math.min(12, currentShift));

      const row = Math.floor(elapsed / 24);
      shifts.set(row, currentShift);
      lastDutyElapsed = elapsed + duty.dutyHours;
    });

    return shifts;
  }, [duties, month, t0]);

  const getPhaseShiftForRow = (row: number): number => {
    // Find the most recent shift at or before this row
    let shift = 0;
    for (const [r, s] of circadianShifts) {
      if (r <= row) shift = s;
    }
    return shift;
  };

  // ── Compute elapsed duty bars ──
  const { dutyBars, totalRows } = useMemo(() => {
    const bars: ElapsedDutyBar[] = [];
    let maxElapsed = 0;

    duties.forEach((duty) => {
      const dayOfMonth = duty.dateString ? Number(duty.dateString.split('-')[2]) : duty.date.getDate();
      if (duty.flightSegments.length === 0) return;

      const firstSeg = duty.flightSegments[0];
      const lastSeg = duty.flightSegments[duty.flightSegments.length - 1];
      const [startH, startM] = firstSeg.departureTime.split(':').map(Number);
      const [endH, endM] = lastSeg.arrivalTime.split(':').map(Number);

      const depHour = startH + startM / 60;
      const reportHour = parseTimeToHours(duty.reportTimeLocal);
      const checkInHour = Math.max(0, reportHour ?? (depHour - DEFAULT_CHECK_IN_MINUTES / 60));
      let arrHour = endH + endM / 60;
      
      // Handle overnight: arrival next day
      if (arrHour < depHour) arrHour += 24;

      const elapsedStart = dayHourToElapsed(dayOfMonth, checkInHour);
      const elapsedEnd = dayHourToElapsed(dayOfMonth, arrHour);
      maxElapsed = Math.max(maxElapsed, elapsedEnd);

      const startRow = Math.floor(elapsedStart / 24);
      const startInRow = elapsedStart % 24;
      const endRow = Math.floor(elapsedEnd / 24);
      const endInRow = elapsedEnd % 24;

      // Build segments for display
      const buildSegments = (barStartElapsed: number, barEndElapsed: number): ElapsedSegment[] => {
        const segs: ElapsedSegment[] = [];
        const barDuration = barEndElapsed - barStartElapsed;
        if (barDuration <= 0) return segs;

        // Check-in
        const checkInEnd = dayHourToElapsed(dayOfMonth, depHour);
        const checkInStartClamped = Math.max(elapsedStart, barStartElapsed);
        const checkInEndClamped = Math.min(checkInEnd, barEndElapsed);
        if (checkInEndClamped > checkInStartClamped) {
          segs.push({
            type: 'checkin',
            widthPercent: ((checkInEndClamped - checkInStartClamped) / barDuration) * 100,
            performance: Math.min(100, duty.avgPerformance + 10),
          });
        }

        // Flights
        let prevArrElapsed = checkInEnd;
        duty.flightSegments.forEach((seg) => {
          const [dH, dM] = seg.departureTime.split(':').map(Number);
          const [aH, aM] = seg.arrivalTime.split(':').map(Number);
          let segDepElapsed = dayHourToElapsed(dayOfMonth, dH + dM / 60);
          let segArrElapsed = dayHourToElapsed(dayOfMonth, aH + aM / 60);
          if (segArrElapsed < segDepElapsed) segArrElapsed += 24;

          // Ground time
          const groundStart = Math.max(prevArrElapsed, barStartElapsed);
          const groundEnd = Math.min(segDepElapsed, barEndElapsed);
          if (groundEnd > groundStart + 0.1) {
            segs.push({
              type: 'ground',
              widthPercent: ((groundEnd - groundStart) / barDuration) * 100,
              performance: duty.avgPerformance,
            });
          }

          // Flight
          const flightStart = Math.max(segDepElapsed, barStartElapsed);
          const flightEnd = Math.min(segArrElapsed, barEndElapsed);
          if (flightEnd > flightStart) {
            const phases = [
              { phase: 'takeoff' as FlightPhase, performance: seg.performance + 5, widthPercent: 15 },
              { phase: 'climb' as FlightPhase, performance: seg.performance + 3, widthPercent: 10 },
              { phase: 'cruise' as FlightPhase, performance: seg.performance, widthPercent: 50 },
              { phase: 'descent' as FlightPhase, performance: seg.performance - 2, widthPercent: 10 },
              { phase: 'approach' as FlightPhase, performance: seg.performance - 4, widthPercent: 10 },
              { phase: 'landing' as FlightPhase, performance: duty.landingPerformance || seg.performance - 5, widthPercent: 5 },
            ];
            segs.push({
              type: 'flight',
              flightNumber: seg.flightNumber,
              departure: seg.departure,
              arrival: seg.arrival,
              widthPercent: ((flightEnd - flightStart) / barDuration) * 100,
              performance: seg.performance,
              phases,
            });
          }

          prevArrElapsed = segArrElapsed;
        });

        return segs;
      };

      if (startRow === endRow) {
        bars.push({
          rowIndex: startRow,
          startHourInRow: startInRow,
          endHourInRow: endInRow,
          duty,
          segments: buildSegments(elapsedStart, elapsedEnd),
        });
      } else {
        // Split across 24h boundary
        const splitPoint = (startRow + 1) * 24;
        bars.push({
          rowIndex: startRow,
          startHourInRow: startInRow,
          endHourInRow: 24,
          duty,
          isOverflowStart: true,
          segments: buildSegments(elapsedStart, splitPoint),
        });
        bars.push({
          rowIndex: endRow,
          startHourInRow: 0,
          endHourInRow: endInRow,
          duty,
          isOverflowContinuation: true,
          segments: buildSegments(splitPoint, elapsedEnd),
        });
      }
    });

    // Also account for rest days and sleep extending the timeline
    let lastDay = 0;
    duties.forEach(d => {
      const dom = d.dateString ? Number(d.dateString.split('-')[2]) : d.date.getDate();
      lastDay = Math.max(lastDay, dom);
    });
    if (restDaysSleep) {
      restDaysSleep.forEach(r => {
        const dom = r.date.getDate();
        lastDay = Math.max(lastDay, dom);
      });
    }
    const lastElapsed = dayHourToElapsed(lastDay, 24);
    maxElapsed = Math.max(maxElapsed, lastElapsed);

    const totalRows = Math.max(1, Math.ceil(maxElapsed / 24));
    return { dutyBars: bars, totalRows };
  }, [duties, restDaysSleep, month, t0]);

  // ── Compute elapsed sleep bars ──
  const sleepBars = useMemo(() => {
    const bars: ElapsedSleepBar[] = [];

    const addSleep = (
      elapsedStart: number, elapsedEnd: number,
      props: Omit<ElapsedSleepBar, 'rowIndex' | 'startHourInRow' | 'endHourInRow' | 'isOverflowStart' | 'isOverflowContinuation'>
    ) => {
      if (elapsedEnd <= elapsedStart || elapsedStart < 0) return;
      const startRow = Math.floor(elapsedStart / 24);
      const endRow = Math.floor(elapsedEnd / 24);
      const startInRow = elapsedStart % 24;
      const endInRow = elapsedEnd % 24 || 24;

      if (startRow === endRow) {
        bars.push({ ...props, rowIndex: startRow, startHourInRow: startInRow, endHourInRow: endInRow });
      } else {
        bars.push({ ...props, rowIndex: startRow, startHourInRow: startInRow, endHourInRow: 24, isOverflowStart: true });
        bars.push({ ...props, rowIndex: endRow, startHourInRow: 0, endHourInRow: endInRow, isOverflowContinuation: true });
      }
    };

    duties.forEach((duty) => {
      const dayOfMonth = duty.dateString ? Number(duty.dateString.split('-')[2]) : duty.date.getDate();
      const est = duty.sleepEstimate;
      if (!est) return;

      const recoveryScore = getRecoveryScore(est);
      const extras = {
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
        sleepStartZulu: isoToZulu(est.sleepStartIso) ?? undefined,
        sleepEndZulu: isoToZulu(est.sleepEndIso) ?? undefined,
      };

      // Use home-tz precomputed values
      const hasHomeTz = est.sleepStartDayHomeTz != null && est.sleepStartHourHomeTz != null &&
        est.sleepEndDayHomeTz != null && est.sleepEndHourHomeTz != null;

      if (hasHomeTz) {
        const elStart = dayHourToElapsed(est.sleepStartDayHomeTz!, est.sleepStartHourHomeTz!);
        const elEnd = dayHourToElapsed(est.sleepEndDayHomeTz!, est.sleepEndHourHomeTz!);
        addSleep(elStart, elEnd, {
          ...extras,
          originalStartHour: est.sleepStartHourHomeTz!,
          originalEndHour: est.sleepEndHourHomeTz!,
        });
        return;
      }

      // Fallback: ISO or HH:mm
      if (est.sleepStartIso && est.sleepEndIso) {
        const parseIso = (iso: string) => {
          const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
          if (m) return { day: Number(m[3]), hour: Number(m[4]) + Number(m[5]) / 60 };
          return null;
        };
        const s = parseIso(est.sleepStartIso);
        const e = parseIso(est.sleepEndIso);
        if (s && e) {
          let elStart = dayHourToElapsed(s.day, s.hour);
          let elEnd = dayHourToElapsed(e.day, e.hour);
          if (elEnd <= elStart) elEnd += 24;
          addSleep(elStart, elEnd, { ...extras, originalStartHour: s.hour, originalEndHour: e.hour });
          return;
        }
      }

      // HH:mm fallback
      if (est.sleepStartTime && est.sleepEndTime) {
        const sH = parseTimeToHours(est.sleepStartTime)!;
        const eH = parseTimeToHours(est.sleepEndTime)!;
        let elStart = dayHourToElapsed(dayOfMonth, sH);
        let elEnd = dayHourToElapsed(dayOfMonth, eH);
        if (sH > eH) {
          elStart = dayHourToElapsed(dayOfMonth - 1, sH);
        }
        addSleep(elStart, elEnd, { ...extras, originalStartHour: sH, originalEndHour: eH });
      }
    });

    // Rest day sleep
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

          // Compute Zulu times from ISO timestamps
          const blockZuluTimes = {
            sleepStartZulu: isoToZulu(block.sleepStartIso) ?? undefined,
            sleepEndZulu: isoToZulu(block.sleepEndIso) ?? undefined,
          };

          // Use home-tz values if available
          if (block.sleepStartDayHomeTz != null && block.sleepStartHourHomeTz != null &&
              block.sleepEndDayHomeTz != null && block.sleepEndHourHomeTz != null) {
            const elStart = dayHourToElapsed(block.sleepStartDayHomeTz, block.sleepStartHourHomeTz);
            const elEnd = dayHourToElapsed(block.sleepEndDayHomeTz, block.sleepEndHourHomeTz);
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
            addSleep(elStart, elEnd, {
              recoveryScore,
              effectiveSleep: block.effectiveHours,
              sleepEfficiency: block.qualityFactor,
              sleepStrategy: restDay.strategyType,
              isPreDuty: false,
              relatedDuty: pseudoDuty,
              originalStartHour: block.sleepStartHourHomeTz,
              originalEndHour: block.sleepEndHourHomeTz,
              ...restDayExtras,
              ...blockZuluTimes,
            });
          } else {
            // ISO fallback
            const parseIso = (iso: string) => {
              const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
              if (m) return { day: Number(m[3]), hour: Number(m[4]) + Number(m[5]) / 60 };
              return null;
            };
            const s = parseIso(block.sleepStartIso);
            const e = parseIso(block.sleepEndIso);
            if (s && e) {
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
              let elStart = dayHourToElapsed(s.day, s.hour);
              let elEnd = dayHourToElapsed(e.day, e.hour);
              if (elEnd <= elStart) elEnd += 24;
              addSleep(elStart, elEnd, {
                recoveryScore,
                effectiveSleep: block.effectiveHours,
                sleepEfficiency: block.qualityFactor,
                sleepStrategy: restDay.strategyType,
                isPreDuty: false,
                relatedDuty: pseudoDuty,
                originalStartHour: s.hour,
                originalEndHour: e.hour,
                ...restDayExtras,
                ...blockZuluTimes,
              });
            }
          }
        });
      });
    }

    // Deduplicate
    const deduped: ElapsedSleepBar[] = [];
    const byRow = new Map<number, ElapsedSleepBar[]>();
    bars.forEach(b => {
      const arr = byRow.get(b.rowIndex) || [];
      arr.push(b);
      byRow.set(b.rowIndex, arr);
    });
    byRow.forEach(rowBars => {
      rowBars.sort((a, b) => a.startHourInRow - b.startHourInRow);
      const kept: ElapsedSleepBar[] = [];
      for (const bar of rowBars) {
        const overlap = kept.find(k => bar.startHourInRow < k.endHourInRow && bar.endHourInRow > k.startHourInRow);
        if (overlap) {
          if (!!bar.qualityFactors && !overlap.qualityFactors) {
            kept[kept.indexOf(overlap)] = bar;
          }
        } else {
          kept.push(bar);
        }
      }
      deduped.push(...kept);
    });

    return deduped;
  }, [duties, restDaysSleep, month, t0]);

  // ── WOCL bands per row (shifted by circadian adaptation) ──
  const woclBands = useMemo(() => {
    const bands: WoclBand[] = [];
    for (let row = 0; row < totalRows; row++) {
      const shift = getPhaseShiftForRow(row);
      const ws = ((WOCL_START + shift) % 24 + 24) % 24;
      const we = ((WOCL_END + shift) % 24 + 24) % 24;

      if (ws < we) {
        bands.push({ rowIndex: row, startHourInRow: ws, endHourInRow: we });
      } else {
        // Wraps around midnight
        bands.push({ rowIndex: row, startHourInRow: ws, endHourInRow: 24 });
        bands.push({ rowIndex: row, startHourInRow: 0, endHourInRow: we });
      }
    }
    return bands;
  }, [totalRows, circadianShifts]);

  const ROW_HEIGHT = 40;
  const hours = Array.from({ length: 8 }, (_, i) => i * 3);
  const rows = Array.from({ length: totalRows }, (_, i) => i);

  if (dutyBars.length === 0) {
    return (
      <Card variant="glass">
        <CardContent className="py-8 text-center text-muted-foreground">
          No duty data available for human performance visualization
        </CardContent>
      </Card>
    );
  }

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
            Understanding This Chart
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Elapsed-Time Performance View</p>
            <p>
              This chart shows your roster on a continuous timeline starting from T=0 (first duty day).
              Each row represents 24 elapsed hours. The WOCL zone shifts as your body clock adapts
              to timezone crossings (~1h/day east, ~1.5h/day west).
            </p>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Y-Axis:</p>
                <p>Elapsed 24h periods from T=0</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">X-Axis:</p>
                <p>Hours 0–24 within each period</p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Legend */}
      <TimelineLegend showDiscretion={discretionCount > 0} variant="elapsed" />

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
            {pilotBase && <div className="text-sm text-muted-foreground">Base: {pilotBase}</div>}
            <div className="mt-1 text-sm font-medium">
              {format(month, 'MMMM yyyy')} — Human Performance · Elapsed Time from t=0
            </div>
            <div className="text-[11px] text-muted-foreground">
              Body clock adapts ~1.0h/day east, ~1.5h/day west · WOCL markers shift with accumulated timezone crossings
            </div>
          </div>

          {/* Stats */}
          <div className="mb-4 flex items-center justify-center gap-4 text-xs flex-wrap">
            <span>Duties: <strong>{duties.length}</strong></span>
            <span>High Risk: <strong className="text-high">{duties.filter(d => d.overallRisk === 'HIGH').length}</strong></span>
            <span>Critical: <strong className="text-critical">{duties.filter(d => d.overallRisk === 'CRITICAL').length}</strong></span>
            {discretionCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {discretionCount} Discretion Used
              </Badge>
            )}
          </div>

          <div className="flex">
            {/* Y-axis: elapsed hours labels */}
            <div className="w-20 flex-shrink-0">
              <div className="h-8" />
              {rows.map((row) => {
                const shift = getPhaseShiftForRow(row);
                // Find the calendar date for this row's midpoint
                const midElapsed = row * 24 + 12;
                const calDate = new Date(t0.getTime() + midElapsed * 3600000);

                return (
                  <div
                    key={row}
                    className="flex items-center justify-end pr-2 text-[11px]"
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    <div className="text-right">
                      <div className="text-foreground font-medium text-[11px]">
                        +{row * 24}h
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {format(calDate, 'EEE d')}
                      </div>
                      {shift !== 0 && (
                        <div className={cn(
                          "text-[9px] font-semibold",
                          shift > 0 ? "text-warning" : "text-primary"
                        )}>
                          {shift > 0 ? '→E ' : '→W '}{shift > 0 ? '+' : ''}{shift.toFixed(1)}h
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main chart area */}
            <div className="relative flex-1">
              {/* X-axis header */}
              <div className="flex h-8 border-b border-border">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-[10px] text-muted-foreground"
                    style={{ width: `${(3 / 24) * 100}%` }}
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              <div className="relative">
                {rows.map((row) => {
                  const rowWocl = woclBands.filter(w => w.rowIndex === row);
                  const nadirShift = getPhaseShiftForRow(row);
                  const nadirHour = ((NADIR_HOUR + nadirShift) % 24 + 24) % 24;

                  return (
                    <div key={row} className="relative border-b border-border/20" style={{ height: `${ROW_HEIGHT}px` }}>
                      {/* WOCL solid bands */}
                      {rowWocl.map((w, i) => (
                        <div
                          key={`wocl-${i}`}
                          className="absolute top-0 bottom-0 wocl-hatch"
                          style={{
                            left: `${(w.startHourInRow / 24) * 100}%`,
                            width: `${((w.endHourInRow - w.startHourInRow) / 24) * 100}%`,
                          }}
                        />
                      ))}

                      {/* Nadir marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-critical/40"
                        style={{ left: `${(nadirHour / 24) * 100}%` }}
                      >
                        <div className="absolute -top-0.5 -left-1.5 text-[8px] text-critical">▼</div>
                      </div>

                      {/* Grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {Array.from({ length: 24 }, (_, h) => (
                          <div
                            key={h}
                            className={cn("flex-1 border-r", h % 3 === 0 ? "border-border/40" : "border-border/15")}
                          />
                        ))}
                      </div>

                      {/* Sleep bars */}
                      {sleepBars
                        .filter(b => b.rowIndex === row)
                        .map((bar, idx) => {
                          const barWidth = ((bar.endHourInRow - bar.startHourInRow) / 24) * 100;
                          const classes = getRecoveryClasses(bar.recoveryScore);
                          const borderRadius = bar.isOverflowStart
                            ? '2px 0 0 2px'
                            : bar.isOverflowContinuation
                              ? '0 2px 2px 0'
                              : '2px';
                          return (
                            <Popover key={`sleep-${idx}`}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="absolute z-[5] flex items-center justify-end px-1 border border-dashed cursor-pointer hover:brightness-110 transition-all border-primary/20 bg-primary/5"
                                  style={{
                                    top: 0, height: '100%',
                                    left: `${(bar.startHourInRow / 24) * 100}%`,
                                    width: `${Math.max(barWidth, 1)}%`,
                                    borderRadius,
                                    borderRight: bar.isOverflowStart ? 'none' : undefined,
                                    borderLeft: bar.isOverflowContinuation ? 'none' : undefined,
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
                                    <span>Sleep Window</span>
                                    <span className="font-mono font-medium text-foreground">
                                      {decimalToHHmm(bar.originalStartHour ?? bar.startHourInRow)} → {decimalToHHmm(bar.originalEndHour ?? bar.endHourInRow)}
                                      {(bar.isOverflowStart || bar.isOverflowContinuation) &&
                                        (bar.originalStartHour ?? bar.startHourInRow) > (bar.originalEndHour ?? bar.endHourInRow) && ' (+1d)'}
                                    </span>
                                  </div>
                                  {bar.sleepStartZulu && bar.sleepEndZulu && (
                                    <div className="flex items-center justify-between text-muted-foreground">
                                      <span>Zulu</span>
                                      <span className="font-mono font-medium text-foreground">
                                        {bar.sleepStartZulu} → {bar.sleepEndZulu}
                                      </span>
                                    </div>
                                  )}
                                  <div className="bg-secondary/30 rounded-lg p-2 space-y-1.5">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Recovery Score</div>
                                    <div className="flex items-center justify-between">
                                      <span>Effective Sleep</span>
                                      <span className="font-mono">{bar.effectiveSleep.toFixed(1)}h</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Efficiency</span>
                                      <span className="font-mono">{Math.round(bar.sleepEfficiency * 100)}%</span>
                                    </div>
                                  </div>
                                  {bar.qualityFactors && (
                                    <div className="bg-secondary/20 rounded-lg p-2 space-y-1.5">
                                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">🔬 Model Factors</div>
                                      {Object.entries(bar.qualityFactors).map(([key, value]) => {
                                        const labels: Record<string, string> = {
                                          base_efficiency: 'Base Efficiency', wocl_boost: 'WOCL Boost',
                                          late_onset_penalty: 'Late Onset', recovery_boost: 'Recovery Boost',
                                          time_pressure_factor: 'Time Pressure', insufficient_penalty: 'Duration Penalty',
                                          pre_duty_awake_hours: 'Pre-Duty Awake',
                                        };
                                        const numValue = value as number;
                                        const isHours = key === 'pre_duty_awake_hours';
                                        return (
                                          <div key={key} className="flex items-center justify-between text-[11px]">
                                            <span className="text-muted-foreground">{labels[key] || key}</span>
                                            <span className="font-mono font-medium">
                                              {isHours ? `${numValue.toFixed(1)}h` : `${numValue >= 1 ? '+' : ''}${((numValue - 1) * 100).toFixed(0)}%`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-muted-foreground">Strategy</span>
                                    <span className="capitalize">{getStrategyIcon(bar.sleepStrategy)} {bar.sleepStrategy.split('_').join(' ')}</span>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })}

                      {/* Duty bars */}
                      {dutyBars
                        .filter(b => b.rowIndex === row)
                        .map((bar, idx) => {
                          const barWidth = ((bar.endHourInRow - bar.startHourInRow) / 24) * 100;
                          const usedDiscretion = bar.duty.usedDiscretion;
                          const borderRadius = bar.isOverflowStart
                            ? '2px 0 0 2px'
                            : bar.isOverflowContinuation
                              ? '0 2px 2px 0'
                              : '2px';

                          return (
                            <TooltipProvider key={`duty-${idx}`} delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => onDutySelect(bar.duty)}
                                    className={cn(
                                      "absolute z-10 transition-all hover:ring-2 cursor-pointer overflow-hidden flex",
                                      selectedDuty?.date.getTime() === bar.duty.date.getTime() && "ring-2 ring-foreground",
                                      usedDiscretion ? "ring-2 ring-critical" : "hover:ring-foreground"
                                    )}
                                    style={{
                                      top: 0, height: '100%',
                                      left: `${(bar.startHourInRow / 24) * 100}%`,
                                      width: `${Math.max(barWidth, 2)}%`,
                                      borderRadius,
                                    }}
                                  >
                                    {bar.segments.map((seg, segIdx) => {
                                      if (showFlightPhases && seg.type === 'flight' && seg.phases) {
                                        return (
                                          <div key={segIdx} className="h-full relative flex" style={{ width: `${seg.widthPercent}%` }}>
                                            {segIdx > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70 z-10" />}
                                            {seg.phases.map((phase, pi) => (
                                              <div
                                                key={pi}
                                                className="h-full flex items-center justify-center relative"
                                                style={{ width: `${phase.widthPercent}%`, backgroundColor: getPerformanceColor(phase.performance) }}
                                              >
                                                {pi > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-background/40" />}
                                                {phase.phase === 'cruise' && zoom.scaleX >= 2.5 && seg.widthPercent > 15 && (
                                                  <span className="text-[6px] font-medium text-background/90">{Math.round(phase.performance)}%</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={segIdx}
                                          className={cn(
                                            "h-full relative flex items-center justify-center",
                                            seg.type === 'checkin' && "opacity-70",
                                            seg.type === 'ground' && "opacity-50"
                                          )}
                                          style={{
                                            width: `${seg.widthPercent}%`,
                                            backgroundColor: seg.type === 'ground'
                                              ? 'hsl(var(--muted))'
                                              : getPerformanceColor(seg.performance),
                                          }}
                                        >
                                          {segIdx > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70" />}
                                          {seg.type === 'flight' && seg.flightNumber && seg.widthPercent > 8 && (
                                            <span className="text-[8px] font-medium text-background truncate px-0.5">{seg.flightNumber}</span>
                                          )}
                                          {seg.type === 'checkin' && seg.widthPercent > 5 && (
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
                                    <div className="font-semibold text-sm border-b pb-1 border-border">
                                      {format(bar.duty.date, 'EEEE, MMM d')} {bar.isOverflowContinuation && '(continued)'}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      <span className="text-muted-foreground">Flights:</span>
                                      <span>{bar.duty.flightSegments.map(s => s.flightNumber).join(', ')}</span>
                                      <span className="text-muted-foreground">Min Perf:</span>
                                      <span style={{ color: getPerformanceColor(bar.duty.minPerformance) }}>{Math.round(bar.duty.minPerformance)}%</span>
                                      <span className="text-muted-foreground">WOCL:</span>
                                      <span>{bar.duty.woclExposure.toFixed(1)}h</span>
                                      <span className="text-muted-foreground">Risk:</span>
                                      <span className={cn(
                                        bar.duty.overallRisk === 'LOW' && "text-success",
                                        bar.duty.overallRisk === 'MODERATE' && "text-warning",
                                        bar.duty.overallRisk === 'HIGH' && "text-high",
                                        bar.duty.overallRisk === 'CRITICAL' && "text-critical"
                                      )}>{bar.duty.overallRisk}</span>
                                    </div>
                                    {bar.duty.sleepEstimate && (
                                      <div className="border-t border-border pt-1">
                                        <span className="text-muted-foreground">Sleep:</span>{' '}
                                        <span>{bar.duty.sleepEstimate.effectiveSleepHours.toFixed(1)}h</span>
                                        <span className="text-muted-foreground ml-2">Recovery:</span>{' '}
                                        <span>{Math.round(getRecoveryScore(bar.duty.sleepEstimate!))}%</span>
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

            {/* Performance color legend */}
            <div className="ml-3 flex w-10 flex-shrink-0 flex-col">
              <div className="h-8" />
              <div className="flex gap-1" style={{ height: `${totalRows * ROW_HEIGHT}px` }}>
                <div className="w-2.5 rounded-sm overflow-hidden">
                  <div className="h-full w-full" style={{
                    background: 'linear-gradient(to bottom, hsl(120, 70%, 45%), hsl(90, 70%, 50%), hsl(55, 90%, 55%), hsl(40, 95%, 50%), hsl(25, 95%, 50%), hsl(0, 80%, 50%))',
                  }} />
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
            Elapsed Hours (0–24 per row) · WOCL markers shift with circadian adaptation
          </div>
        </div>
      </div>

      {/* Quick duty selection */}
      <div className="space-y-2 pt-4 border-t border-border">
        <h4 className="text-sm font-medium">Quick Duty Selection</h4>
        <div className="flex flex-wrap gap-2">
          {duties.map((duty, i) => (
            <button
              key={i}
              onClick={() => onDutySelect(duty)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 text-foreground",
                duty.overallRisk === 'LOW' && "bg-success hover:bg-success/80",
                duty.overallRisk === 'MODERATE' && "bg-warning hover:bg-warning/80",
                duty.overallRisk === 'HIGH' && "bg-high hover:bg-high/80",
                duty.overallRisk === 'CRITICAL' && "bg-critical hover:bg-critical/80",
                selectedDuty?.date.getTime() === duty.date.getTime()
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                  : 'hover:scale-105'
              )}
            >
              {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
