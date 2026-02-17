import { useState, useMemo } from 'react';
import { Info, AlertTriangle, ZoomIn, RotateCcw, Brain, Battery } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DutyAnalysis, DutyStatistics, RestDaySleep, FlightPhase, SleepQualityFactors, SleepReference } from '@/types/fatigue';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { HumanPerformanceTimeline } from './HumanPerformanceTimeline';
import { TimelineLegend } from './TimelineLegend';
import { getRecoveryScore, getRecoveryClasses, getStrategyIcon, parseTimeToHours, decimalToHHmm, isoToZulu, getPerformanceColor } from '@/lib/fatigue-utils';
import { splitByUtcDay, utcOffsetForTimezone } from '@/lib/chronogram-utils';

interface ChronogramProps {
  duties: DutyAnalysis[];
  statistics: DutyStatistics;
  month: Date;
  pilotId: string;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  homeBaseTimezone?: string;   // IANA timezone e.g. "Asia/Qatar"
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  restDaysSleep?: RestDaySleep[];
}

// Display mode removed - chronogram is always a heatmap now

// Default check-in time before first sector (EASA typically 60 min)
// Used as fallback when report_time_local is not available from the parser
const DEFAULT_CHECK_IN_MINUTES = 60;

// parseTimeToHours, decimalToHHmm, isoToZulu imported from @/lib/fatigue-utils

interface FlightSegmentBar {
  type: 'checkin' | 'flight' | 'ground';
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  startHour: number;
  endHour: number;
  performance: number;
  // DH (deadhead/positioning) indicator
  isDeadhead?: boolean;
  activityCode?: string | null;
  // Flight phase breakdown (when zoomed in)
  phases?: {
    phase: FlightPhase;
    performance: number;
    widthPercent: number; // Percentage of the segment
  }[];
}

interface DutyBar {
  dayIndex: number;
  startHour: number; // FDP start (check-in time)
  endHour: number;
  duty: DutyAnalysis;
  isOvernightStart?: boolean; // First part of overnight bar (ends at 24:00)
  isOvernightContinuation?: boolean; // Second part of overnight bar (starts at 00:00)
  segments: FlightSegmentBar[]; // Individual flight segments
}

interface SleepBar {
  dayIndex: number;
  startHour: number;
  endHour: number;
  recoveryScore: number;
  effectiveSleep: number;
  sleepEfficiency: number;
  sleepStrategy: string;
  sleepType?: 'main' | 'nap' | 'inflight'; // Distinguishes nap from main sleep
  isPreDuty: boolean; // Sleep before the duty on this day
  relatedDuty: DutyAnalysis;
  isOvernightStart?: boolean; // First part of overnight bar (ends at 24:00)
  isOvernightContinuation?: boolean; // Second part of overnight bar (starts at 00:00)
  // Original full sleep window times (for display in tooltip)
  originalStartHour?: number;
  originalEndHour?: number;
  // Zulu (UTC) times for display in tooltip
  sleepStartZulu?: string;
  sleepEndZulu?: string;
  // Quality factor data (from backend for all sleep types)
  qualityFactors?: SleepQualityFactors;
  explanation?: string;
  confidenceBasis?: string;
  confidence?: number;
  references?: SleepReference[];
  woclOverlapHours?: number;
}

interface InFlightRestBar {
  dayIndex: number;
  startHour: number;
  endHour: number;
  durationHours: number;
  effectiveSleepHours: number;
  isDuringWocl: boolean;
  crewSet: string | null;
  relatedDuty: DutyAnalysis;
}

// WOCL and HB Night are positioned dynamically based on homeBaseTimezone offset.
// In home-base local time: WOCL = 02:00–06:00, Night = 23:00–07:00
// On the UTC grid these shift by the timezone offset (e.g. DOH UTC+3: WOCL → 23Z–03Z).

// getPerformanceColor imported from @/lib/fatigue-utils

export function Chronogram({ duties, statistics, month, pilotId, pilotName, pilotBase, pilotAircraft, homeBaseTimezone, onDutySelect, selectedDuty, restDaysSleep }: ChronogramProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  
  // Zoom functionality
  const { zoom, containerRef, resetZoom, isZoomed } = useChronogramZoom({
    minScaleX: 1,
    maxScaleX: 4,
    minScaleY: 1,
    maxScaleY: 3,
  });
  
  // Show flight phases when zoomed in enough
  const showFlightPhases = zoom.scaleX >= 2;

  // Count duties with commander discretion
  const discretionCount = useMemo(() => 
    duties.filter(d => d.usedDiscretion).length
  , [duties]);

  const daysInMonth = getDaysInMonth(month);
  const monthStart = startOfMonth(month);

  // Get only days that have duties (will be populated after dutyBars are computed)
  const allDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));
  }, [daysInMonth, monthStart]);

  // Days that have actual duties
  const dutyDays = useMemo(() => {
    const dutyDayIndices = new Set<number>();
    duties.forEach((duty) => {
      dutyDayIndices.add(duty.date.getDate());
      // Also include next day for overnight duties
      if (duty.flightSegments.length > 0) {
        const lastSegment = duty.flightSegments[duty.flightSegments.length - 1];
        const firstSegment = duty.flightSegments[0];
        const [startH] = firstSegment.departureTime.split(':').map(Number);
        const [endH] = lastSegment.arrivalTime.split(':').map(Number);
        if (endH < startH && duty.date.getDate() < daysInMonth) {
          dutyDayIndices.add(duty.date.getDate() + 1);
        }
      }
    });
    return Array.from(dutyDayIndices).sort((a, b) => a - b).map(dayNum => addDays(monthStart, dayNum - 1));
  }, [duties, daysInMonth, monthStart]);

  // ── Helpers: extract decimal UTC hour from ISO strings ──────
  /** Decimal UTC hour (0–23.9̅) from an ISO-8601 string. Returns null on failure. */
  const isoToUtcHour = (iso: string | undefined | null): number | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  };

  // Calculate flight segment bars for a duty.
  // Now uses UTC ISO timestamps (departureTimeUtcIso / arrivalTimeUtcIso)
  // so that segments align with the UTC grid. The parent DutyBar already
  // carries utcStartHour/utcEndHour from splitByUtcDay — we pass those
  // bounds so segments are clipped to the current day-row.
  const calculateSegments = (
    duty: DutyAnalysis,
    isOvernightContinuation: boolean,
    /** UTC hour where this DutyBar fragment starts (from splitByUtcDay). */
    barStartHour?: number,
    /** UTC hour where this DutyBar fragment ends (from splitByUtcDay). */
    barEndHour?: number,
  ): FlightSegmentBar[] => {
    const segments: FlightSegmentBar[] = [];
    const flightSegs = duty.flightSegments;
    if (flightSegs.length === 0) return [];

    const fragStart = barStartHour ?? 0;
    const fragEnd = barEndHour ?? 24;

    // Build per-segment UTC hours
    interface SegTiming {
      depUtcHour: number;
      arrUtcHour: number;
      seg: typeof flightSegs[number];
    }
    const timings: SegTiming[] = [];
    flightSegs.forEach((seg) => {
      const dep = isoToUtcHour(seg.departureTimeUtcIso);
      const arr = isoToUtcHour(seg.arrivalTimeUtcIso);
      if (dep == null || arr == null) return;
      // For flights crossing UTC midnight, the arrival UTC hour will be
      // less than the departure UTC hour. We handle this via the parent
      // DutyBar's splitByUtcDay fragmentation: each row only sees the
      // portion that falls within [fragStart, fragEnd].
      //
      // To correctly compute which segments fall within this fragment,
      // we need the absolute UTC timestamp, not just hour-within-day.
      // So we store raw hours and use the ISO dates for ordering.
      timings.push({
        depUtcHour: dep,
        arrUtcHour: arr,
        seg,
      });
    });

    if (timings.length === 0) return [];

    // Determine the UTC day for this fragment by looking at barStartHour.
    // For continuation rows (start=0), we want segments whose arrival
    // falls in the [0, fragEnd] window. For start rows, segments whose
    // departure falls in [fragStart, 24] window.

    // Use ISO timestamps to determine which segments overlap this fragment.
    // We do this by comparing actual Date objects (not just hour-of-day).
    const reportDate = duty.reportTimeUtc
      ? new Date(duty.reportTimeUtc)
      : (timings[0].seg.departureTimeUtcIso ? new Date(timings[0].seg.departureTimeUtcIso) : null);

    // Check-in segment: only on the first fragment (not overnight continuation)
    if (!isOvernightContinuation && reportDate) {
      const reportHour = reportDate.getUTCHours() + reportDate.getUTCMinutes() / 60;
      const firstDepHour = timings[0].depUtcHour;

      // Only add check-in if it falls within this fragment and there's a visible gap
      if (reportHour >= fragStart && reportHour < fragEnd && firstDepHour > reportHour) {
        const checkInEnd = Math.min(firstDepHour, fragEnd);
        segments.push({
          type: 'checkin',
          startHour: reportHour,
          endHour: checkInEnd,
          performance: Math.min(100, duty.avgPerformance + 10),
        });
      }
    }

    // Add each flight segment, clipping to [fragStart, fragEnd]
    let prevEndHour: number | null = null;

    timings.forEach((t) => {
      let depH = t.depUtcHour;
      let arrH = t.arrUtcHour;

      // Handle midnight-crossing flights:
      // If arrival < departure, the flight crosses UTC midnight.
      // For the pre-midnight fragment (fragEnd=24), cap arrival at 24.
      // For the post-midnight fragment (fragStart=0), set departure to 0.
      if (arrH < depH) {
        if (fragEnd === 24 && fragStart > 0) {
          // Pre-midnight fragment: show departure → 24
          arrH = 24;
        } else if (fragStart === 0 && fragEnd < 24) {
          // Post-midnight fragment: show 0 → arrival
          depH = 0;
        } else {
          return; // Doesn't fit this fragment
        }
      }

      // Skip segments entirely outside this fragment
      if (arrH <= fragStart || depH >= fragEnd) return;

      // Clip to fragment bounds
      const clippedDep = Math.max(depH, fragStart);
      const clippedArr = Math.min(arrH, fragEnd);
      if (clippedArr - clippedDep < 0.01) return; // Negligibly small

      // Add ground time between flights if there's a gap > 15 min
      if (prevEndHour != null && clippedDep > prevEndHour + 0.25) {
        segments.push({
          type: 'ground',
          startHour: prevEndHour,
          endHour: clippedDep,
          performance: duty.avgPerformance,
        });
      }

      // Generate flight phase breakdown
      const phases: FlightSegmentBar['phases'] = [
        { phase: 'takeoff' as FlightPhase, performance: t.seg.performance + 5, widthPercent: 15 },
        { phase: 'climb' as FlightPhase, performance: t.seg.performance + 3, widthPercent: 10 },
        { phase: 'cruise' as FlightPhase, performance: t.seg.performance, widthPercent: 50 },
        { phase: 'descent' as FlightPhase, performance: t.seg.performance - 2, widthPercent: 10 },
        { phase: 'approach' as FlightPhase, performance: t.seg.performance - 4, widthPercent: 10 },
        { phase: 'landing' as FlightPhase, performance: duty.landingPerformance || t.seg.performance - 5, widthPercent: 5 },
      ];

      segments.push({
        type: 'flight',
        flightNumber: t.seg.flightNumber,
        departure: t.seg.departure,
        arrival: t.seg.arrival,
        startHour: clippedDep,
        endHour: clippedArr,
        performance: t.seg.performance,
        isDeadhead: t.seg.isDeadhead,
        activityCode: t.seg.activityCode,
        phases: t.seg.isDeadhead ? undefined : phases,
      });
      prevEndHour = clippedArr;
    });

    return segments;
  };

  // ── UTC-normalised duty bars ───────────────────────────────────
  // Build an interval per duty using true UTC timestamps, then
  // fragment at UTC midnight boundaries via splitByUtcDay.
  // No manual overnight-detection heuristic needed.
  const dutyBars = useMemo(() => {
    // Build UTC intervals from duties
    const intervals = duties
      .filter(d => d.flightSegments.length > 0)
      .map(duty => {
        // Start: report_time_utc (preferred) or first segment departure UTC
        const startIso = duty.reportTimeUtc
          ?? duty.flightSegments[0]?.departureTimeUtcIso;
        // End: last segment arrival UTC
        const lastSeg = duty.flightSegments[duty.flightSegments.length - 1];
        const endIso = lastSeg?.arrivalTimeUtcIso;

        if (!startIso || !endIso) return null;
        return { startUtc: startIso, endUtc: endIso, duty };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Fragment at UTC midnight boundaries
    const fragments = splitByUtcDay(intervals);

    // Convert fragments to DutyBars
    return fragments
      .filter(f => f.utcDay >= 1 && f.utcDay <= daysInMonth)
      .map(f => {
        const isStart = f.utcStartHour > 0;
        const isContinuation = f.utcStartHour === 0 && f.utcEndHour < 24;
        return {
          dayIndex: f.utcDay,
          startHour: f.utcStartHour,
          endHour: f.utcEndHour,
          duty: f.duty,
          isOvernightStart: isStart && f.utcEndHour === 24,
          isOvernightContinuation: isContinuation,
          segments: calculateSegments(f.duty, isContinuation, f.utcStartHour, f.utcEndHour),
        } as DutyBar;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duties, daysInMonth]);

  // Compute FDP limit markers - these need to be rendered separately from duty bars
  // to handle overnight cases where the FDP limit extends past midnight
  interface FdpLimitMarker {
    dayIndex: number;
    hour: number; // Position in that day (0-24)
    maxFdp: number;
    duty: DutyAnalysis;
  }

  const fdpLimitMarkers = useMemo(() => {
    const markers: FdpLimitMarker[] = [];
    
    dutyBars.forEach((bar) => {
      // Only compute from the start of the duty (not continuations)
      if (bar.isOvernightContinuation) return;
      
      const maxFdp = bar.duty.maxFdpHours;
      if (!maxFdp) return;
      
      const fdpEndHour = bar.startHour + maxFdp;
      
      if (fdpEndHour <= 24) {
        // FDP limit is on the same day
        markers.push({
          dayIndex: bar.dayIndex,
          hour: fdpEndHour,
          maxFdp,
          duty: bar.duty,
        });
      } else {
        // FDP limit extends past midnight - render on next day
        const nextDayHour = fdpEndHour - 24;
        if (bar.dayIndex < daysInMonth) {
          markers.push({
            dayIndex: bar.dayIndex + 1,
            hour: nextDayHour,
            maxFdp,
            duty: bar.duty,
          });
        }
      }
    });
    
    return markers;
  }, [dutyBars, daysInMonth]);

  // ── UTC-normalised sleep bars ──────────────────────────────────
  // Collect all sleep blocks (from duties + rest days), convert to
  // UTC intervals, fragment at midnight boundaries, then build bars.
  const sleepBars = useMemo(() => {
    const bars: SleepBar[] = [];

    // Compute the home-base UTC offset for fallback conversion
    const hbOffset = homeBaseTimezone
      ? utcOffsetForTimezone(homeBaseTimezone, month)
      : 0;

    /** Convert a home-base-TZ ISO string to a UTC ISO string by subtracting the offset. */
    const homeTzIsoToUtc = (iso: string): string | null => {
      if (!iso) return null;
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (!m) return null;
      const localDate = new Date(
        Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                 Number(m[4]), Number(m[5]))
      );
      // Subtract offset: local = UTC + offset → UTC = local − offset
      localDate.setTime(localDate.getTime() - hbOffset * 3600_000);
      return localDate.toISOString();
    };
    
    // ── Collect all sleep intervals ──────────────────────────────
    interface SleepInterval {
      startUtc: string;
      endUtc: string;
      recoveryScore: number;
      effectiveSleep: number;
      sleepEfficiency: number;
      sleepStrategy: string;
      sleepType: 'main' | 'nap' | 'inflight';
      isPreDuty: boolean;
      relatedDuty: DutyAnalysis;
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

    const allIntervals: SleepInterval[] = [];

    // ── Duty sleep blocks → UTC intervals ──────────────────────
    duties.forEach((duty) => {
      const sleepEstimate = duty.sleepEstimate;
      if (!sleepEstimate) return;

      const recoveryScore = getRecoveryScore(sleepEstimate);
      const extras = {
        qualityFactors: sleepEstimate.qualityFactors,
        explanation: sleepEstimate.explanation,
        confidenceBasis: sleepEstimate.confidenceBasis,
        confidence: sleepEstimate.confidence,
        references: sleepEstimate.references,
        woclOverlapHours: sleepEstimate.woclOverlapHours,
        sleepStartZulu: isoToZulu(sleepEstimate.sleepStartIso) ?? undefined,
        sleepEndZulu: isoToZulu(sleepEstimate.sleepEndIso) ?? undefined,
      };

      // Normalised block shape for the union of sleepBlocks[] and the
      // top-level sleepEstimate (which is used as a single-block fallback).
      interface NormBlock {
        startUtc?: string;
        endUtc?: string;
        sleepStartIso?: string;
        sleepEndIso?: string;
        effectiveHours?: number;
        qualityFactor?: number;
        sleepType?: string;
      }

      const blocks = sleepEstimate.sleepBlocks;
      const blocksToProcess: NormBlock[] = blocks && blocks.length > 0
        ? blocks.map(b => ({
            startUtc: b.startUtc,
            endUtc: b.endUtc,
            sleepStartIso: b.sleepStartIso,
            sleepEndIso: b.sleepEndIso,
            effectiveHours: b.effectiveHours,
            qualityFactor: b.qualityFactor,
            sleepType: b.sleepType,
          }))
        : [{
            startUtc: sleepEstimate.startUtc,
            endUtc: sleepEstimate.endUtc,
            sleepStartIso: sleepEstimate.sleepStartIso,
            sleepEndIso: sleepEstimate.sleepEndIso,
            effectiveHours: sleepEstimate.effectiveSleepHours,
            qualityFactor: sleepEstimate.sleepEfficiency,
            sleepType: 'main',
          }];

      blocksToProcess.forEach((blk) => {
        // Prefer explicit UTC; fall back by converting home-TZ ISO
        let sUtc = blk.startUtc ?? sleepEstimate.startUtc;
        let eUtc = blk.endUtc ?? sleepEstimate.endUtc;
        if (!sUtc || !eUtc) {
          const iso = blk.sleepStartIso ?? sleepEstimate.sleepStartIso;
          const eIso = blk.sleepEndIso ?? sleepEstimate.sleepEndIso;
          if (iso && eIso) {
            sUtc = homeTzIsoToUtc(iso) ?? undefined;
            eUtc = homeTzIsoToUtc(eIso) ?? undefined;
          }
        }
        if (!sUtc || !eUtc) return;

        const blockRecovery = blk.effectiveHours != null
          ? Math.min(100, Math.max(0, (blk.effectiveHours / 8) * 100))
          : recoveryScore;

        allIntervals.push({
          startUtc: sUtc,
          endUtc: eUtc,
          recoveryScore: blockRecovery,
          effectiveSleep: blk.effectiveHours ?? sleepEstimate.effectiveSleepHours,
          sleepEfficiency: blk.qualityFactor ?? sleepEstimate.sleepEfficiency,
          sleepStrategy: sleepEstimate.sleepStrategy,
          sleepType: (blk.sleepType as 'main' | 'nap' | 'inflight') ?? 'main',
          isPreDuty: true,
          relatedDuty: duty,
          ...extras,
        });
      });
    });

    // ── Rest-day sleep blocks → UTC intervals ──────────────────
    // The backend generates 23-07 rest-day sleep for EVERY night
    // (inter-duty gaps + trailing OFF days).  Many of these overlap
    // with duty-level pre-duty sleep already collected above, or
    // with the duty flight windows themselves.  Build a combined
    // exclusion set from both sources and skip any rest-day block
    // that overlaps with either.
    const coveredRanges: { start: number; end: number }[] = [];

    // 1. Duty flight windows
    duties
      .filter(d => d.flightSegments.length > 0)
      .forEach(d => {
        const sIso = d.reportTimeUtc ?? d.flightSegments[0]?.departureTimeUtcIso;
        const lastSeg = d.flightSegments[d.flightSegments.length - 1];
        const eIso = lastSeg?.arrivalTimeUtcIso;
        if (sIso && eIso) {
          coveredRanges.push({ start: new Date(sIso).getTime(), end: new Date(eIso).getTime() });
        }
      });

    // 2. Duty-level sleep intervals already collected above
    allIntervals.forEach(iv => {
      const s = new Date(iv.startUtc).getTime();
      const e = new Date(iv.endUtc).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e)) {
        coveredRanges.push({ start: s, end: e });
      }
    });

    const overlapsCovered = (sMs: number, eMs: number) =>
      coveredRanges.some(r => sMs < r.end && eMs > r.start);

    if (restDaysSleep) {
      restDaysSleep.forEach((restDay) => {
        const dummyDuty = duties[0]; // link to first duty for context
        if (!dummyDuty) return;
        restDay.sleepBlocks.forEach((blk) => {
          let sUtc = blk.startUtc;
          let eUtc = blk.endUtc;
          if (!sUtc || !eUtc) {
            if (blk.sleepStartIso && blk.sleepEndIso) {
              sUtc = homeTzIsoToUtc(blk.sleepStartIso) ?? undefined;
              eUtc = homeTzIsoToUtc(blk.sleepEndIso) ?? undefined;
            }
          }
          if (!sUtc || !eUtc) return;

          // Skip rest-day sleep that overlaps with any duty or duty-level sleep
          const sMs = new Date(sUtc).getTime();
          const eMs = new Date(eUtc).getTime();
          if (overlapsCovered(sMs, eMs)) return;

          const blockRecovery = Math.min(100, Math.max(0, (blk.effectiveHours / 8) * 100));
          allIntervals.push({
            startUtc: sUtc,
            endUtc: eUtc,
            recoveryScore: blockRecovery,
            effectiveSleep: blk.effectiveHours,
            sleepEfficiency: blk.qualityFactor,
            sleepStrategy: restDay.strategyType ?? 'recovery',
            sleepType: blk.sleepType ?? 'main',
            isPreDuty: false,
            relatedDuty: dummyDuty,
          });
        });
      });
    }

    // ── Fragment at UTC midnight boundaries ─────────────────────
    const fragments = splitByUtcDay(allIntervals);

    // ── Convert fragments to SleepBars ─────────────────────────
    fragments
      .filter(f => f.utcDay >= 1 && f.utcDay <= daysInMonth)
      .forEach(f => {
        const isStart = f.utcStartHour > 0 && f.utcEndHour === 24;
        const isCont = f.utcStartHour === 0 && f.utcEndHour < 24;
        bars.push({
          dayIndex: f.utcDay,
          startHour: f.utcStartHour,
          endHour: f.utcEndHour,
          recoveryScore: f.recoveryScore,
          effectiveSleep: f.effectiveSleep,
          sleepEfficiency: f.sleepEfficiency,
          sleepStrategy: f.sleepStrategy,
          sleepType: f.sleepType,
          isPreDuty: f.isPreDuty,
          relatedDuty: f.relatedDuty,
          isOvernightStart: isStart,
          isOvernightContinuation: isCont,
          originalStartHour: f.originalStartHour,
          originalEndHour: f.originalEndHour,
          sleepStartZulu: f.sleepStartZulu,
          sleepEndZulu: f.sleepEndZulu,
          qualityFactors: f.qualityFactors,
          explanation: f.explanation,
          confidenceBasis: f.confidenceBasis,
          confidence: f.confidence,
          references: f.references,
          woclOverlapHours: f.woclOverlapHours,
        });
      });
    // ── Dedup ──────────────────────────────────────────────────
    const seen = new Set<string>();
    const deduped = bars.filter(bar => {
      const key = `${bar.dayIndex}|${bar.startHour.toFixed(1)}|${bar.endHour.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // NOTE: we intentionally do NOT remove near-overlapping bars.
    // On a UTC-normalised grid, overlaps surface fatigue-model errors.
    return deduped;
  }, [duties, restDaysSleep, daysInMonth, homeBaseTimezone, month]);


  // ── UTC in-flight rest bars ────────────────────────────────────
  // Already stored as UTC timestamps — use directly via splitByUtcDay.
  const inflightRestBars = useMemo(() => {
    const intervals = duties.flatMap(duty =>
      (duty.inflightRestBlocks ?? []).map(block => ({
        startUtc: block.startUtc,
        endUtc: block.endUtc,
        durationHours: block.durationHours,
        effectiveSleepHours: block.effectiveSleepHours,
        isDuringWocl: block.isDuringWocl,
        crewSet: block.crewSet,
        relatedDuty: duty,
      }))
    );

    return splitByUtcDay(intervals)
      .filter(f => f.utcDay >= 1 && f.utcDay <= daysInMonth)
      .map(f => ({
        dayIndex: f.utcDay,
        startHour: f.utcStartHour,
        endHour: f.utcEndHour,
        durationHours: f.durationHours,
        effectiveSleepHours: f.effectiveSleepHours,
        isDuringWocl: f.isDuringWocl,
        crewSet: f.crewSet,
        relatedDuty: f.relatedDuty,
      } as InFlightRestBar));
  }, [duties, daysInMonth]);

  // ── Dynamic circadian overlays (UTC positions) ─────────────
  // Compute where the home-base night (23–07 local) and WOCL (02–06 local)
  // fall on the 0–24 UTC grid, shifting by the timezone offset.
  const overlays = useMemo(() => {
    const offset = homeBaseTimezone
      ? utcOffsetForTimezone(homeBaseTimezone, month)
      : 0;

    // Convert local hour to UTC hour, wrapping around 0–24
    const toUtc = (localHour: number) => ((localHour - offset) % 24 + 24) % 24;

    const nightStartUtc = toUtc(23); // e.g. DOH UTC+3 → 20Z
    const nightEndUtc = toUtc(7);    // e.g. DOH UTC+3 → 4Z
    const woclStartUtc = toUtc(2);   // e.g. DOH UTC+3 → 23Z
    const woclEndUtc = toUtc(6);     // e.g. DOH UTC+3 → 3Z

    // Each overlay may wrap around midnight (e.g. 20Z–04Z spans two bands).
    // Return band(s) as [{start, end}] arrays.
    const makeBands = (start: number, end: number) => {
      if (start < end) {
        // Single contiguous band
        return [{ start, end }];
      } else {
        // Wraps around midnight: two bands
        return [
          { start: 0, end },        // left band (00:00 → end)
          { start, end: 24 },       // right band (start → 24:00)
        ];
      }
    };

    return {
      nightBands: makeBands(nightStartUtc, nightEndUtc),
      woclBands: makeBands(woclStartUtc, woclEndUtc),
      offset,
    };
  }, [homeBaseTimezone, month]);

  // Get duty warnings based on actual duty data
  const getDayWarnings = (dayOfMonth: number) => {
    const duty = duties.find(d => d.date.getDate() === dayOfMonth);
    if (!duty) return null;
    
    const warnings: string[] = [];
    
    // WOCL exposure warning (hours in Window of Circadian Low)
    if (duty.woclExposure > 0) {
      warnings.push(`WOCL ${duty.woclExposure.toFixed(1)}h`);
    }
    
    // Prior sleep / FLIP warning (Flight time Limitation Period)
    if (duty.priorSleep < 8) {
      warnings.push(`Sleep ${duty.priorSleep.toFixed(1)}h`);
    }
    
    // Low performance warning
    if (duty.minPerformance < 60) {
      warnings.push(`Perf ${Math.round(duty.minPerformance)}%`);
    }
    
    // Sleep debt warning
    if (duty.sleepDebt > 4) {
      warnings.push(`Debt ${duty.sleepDebt.toFixed(1)}h`);
    }
    
    return {
      warnings,
      risk: duty.overallRisk,
    };
  };

  // Row height constant for consistency
  const ROW_HEIGHT = 40; // Increased from 28px for breathing room
  const hours = Array.from({ length: 8 }, (_, i) => i * 3); // 00, 03, 06, 09, 12, 15, 18, 21

  const [activeTab, setActiveTab] = useState<'homebase' | 'elapsed'>('homebase');

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary">📊</span>
          Monthly Chronogram
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          High-resolution timeline showing duty timing, WOCL exposure, and fatigue patterns
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab selector for timeline type */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'homebase' | 'elapsed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="homebase" className="text-xs">
              🏠 Home-Base Timeline
            </TabsTrigger>
            <TabsTrigger value="elapsed" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              Human Performance (Elapsed)
            </TabsTrigger>
          </TabsList>

          {/* Home-Base Timeline Tab */}
          <TabsContent value="homebase" className="mt-4 space-y-4">
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
              <Button
                variant="outline"
                size="sm"
                onClick={resetZoom}
                className="text-xs h-7 px-2"
              >
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
              <p className="mb-2">The chart shows duty periods across the month. Colors indicate fatigue level (performance score):</p>
              <div className="flex flex-wrap gap-4">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(120, 70%, 45%)' }} /> 80-100% (Good)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(55, 90%, 55%)' }} /> 60-80% (Moderate)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(25, 95%, 50%)' }} /> 40-60% (High Risk)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(0, 80%, 50%)' }} /> &lt;40% (Critical)</span>
              </div>
              <p className="mt-2">Purple hatched area = WOCL (Window of Circadian Low, 02–06 home base), blue shading = Home Base Night</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* High-Resolution Timeline with zoom support */}
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
            {/* Header with pilot info */}
            <div className="mb-4 text-center">
              {pilotName && (
                <h2 className="text-lg font-semibold text-foreground">{pilotName}</h2>
              )}
              {(pilotBase || pilotAircraft) && (
                <div className="text-sm text-muted-foreground">
                  <span>{[pilotBase, pilotAircraft].filter(Boolean).join(' | ')}</span>
                </div>
              )}
              <div className="mt-1 text-sm font-medium">
                {format(month, 'MMMM yyyy')} - High-Resolution Duty Timeline
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
            
            {/* Collapsible Legend */}
            <div className="mb-3">
              <TimelineLegend showDiscretion={discretionCount > 0} variant="homebase" />
            </div>

            {/* Timeline Grid */}
            <div className="flex">
              {/* Y-axis labels (all days of month) */}
              <div className="w-28 flex-shrink-0">
                <div style={{ height: `${ROW_HEIGHT}px` }} /> {/* Header spacer */}
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

              {/* Main chart area */}
              <div className="relative flex-1">
                {/* X-axis header */}
                <div className="flex border-b border-border" style={{ height: `${ROW_HEIGHT}px` }}>
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 text-center text-[11px] text-muted-foreground flex items-center justify-center"
                      style={{ width: `${(3/24) * 100}%` }}
                    >
                      {hour.toString().padStart(2, '0')}Z
                    </div>
                  ))}
                </div>

                {/* Grid with WOCL shading and duty bars */}
                <div className="relative">
                  {/* Home Base Night overlay — dynamic position on UTC grid */}
                  {overlays.nightBands.map((band, i) => (
                    <div
                      key={`night-${i}`}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: `${(band.start / 24) * 100}%`,
                        width: `${((band.end - band.start) / 24) * 100}%`,
                        background: 'rgba(30, 58, 138, 0.07)',
                      }}
                    />
                  ))}

                  {/* WOCL hatched pattern — dynamic position on UTC grid */}
                  {overlays.woclBands.map((band, i) => (
                    <div
                      key={`wocl-${i}`}
                      className="absolute top-0 bottom-0 wocl-hatch"
                      style={{
                        left: `${(band.start / 24) * 100}%`,
                        width: `${((band.end - band.start) / 24) * 100}%`,
                      }}
                    />
                  ))}

                  {/* Grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={hour}
                        className={cn(
                          "flex-1 border-r",
                          hour % 3 === 0 ? "border-border/50" : "border-border/20"
                        )}
                      />
                    ))}
                  </div>

                  {/* Day rows (all days of month) */}
                  {allDays.map((day) => {
                    const dayNum = day.getDate();
                    return (
                      <div
                        key={dayNum}
                        className="relative border-b border-border/20"
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {/* Sleep/Rest bars for this day showing recovery */}
                        {sleepBars
                          .filter((bar) => bar.dayIndex === dayNum)
                          .map((bar, barIndex) => {
                            const barWidth = ((bar.endHour - bar.startHour) / 24) * 100;
                            const classes = getRecoveryClasses(bar.recoveryScore);
                            // Determine border radius based on overnight status
                            // Start bars: rounded left, flat right; Continuation bars: flat left, rounded right
                            const borderRadius = bar.isOvernightStart 
                              ? '2px 0 0 2px' 
                              : bar.isOvernightContinuation 
                                ? '0 2px 2px 0' 
                                : '2px';
                            return (
                              <Popover key={`sleep-${barIndex}`}>
                                <PopoverTrigger asChild>
                              <button
                                    type="button"
                                    className={cn(
                                      "absolute z-[5] flex items-center justify-end px-1 border cursor-pointer hover:brightness-110 transition-all",
                                      bar.sleepType === 'nap'
                                        ? "border-dotted border-amber-400/40 bg-amber-500/10"
                                        : "border-dashed border-primary/20 bg-primary/5"
                                    )}
                                    style={{
                                      // Single-lane: sleep bars span full row height.
                                      // Nap bars are slightly shorter for visual distinction.
                                      top: bar.sleepType === 'nap' ? '15%' : 0,
                                      height: bar.sleepType === 'nap' ? '70%' : '100%',
                                      left: `${(bar.startHour / 24) * 100}%`,
                                      width: `${Math.max(barWidth, 1)}%`,
                                      borderRadius,
                                      // Remove border on connected edges for visual continuity
                                      borderRight: bar.isOvernightStart ? 'none' : undefined,
                                      borderLeft: bar.isOvernightContinuation ? 'none' : undefined,
                                    }}
                                  >
                                    {/* Show recovery info if bar is wide enough */}
                                    {barWidth > 6 && (
                                      <div className={cn("flex items-center gap-0.5 text-[8px] font-medium", classes.text)}>
                                        <span>{bar.sleepType === 'nap' ? '💤' : getStrategyIcon(bar.sleepStrategy)}</span>
                                        <span>{bar.sleepType === 'nap' ? 'nap' : `${Math.round(bar.recoveryScore)}%`}</span>
                                      </div>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" side="top" className="max-w-sm p-3">
                                  <div className="space-y-2 text-xs">
                                      {/* Header */}
                                      <div className="flex items-center justify-between border-b border-border pb-2">
                                        <div className="font-semibold flex items-center gap-1.5">
                                          <span className="text-base">{bar.sleepType === 'nap' ? '💤' : bar.isPreDuty ? '🛏️' : '🔋'}</span>
                                          <span>{bar.sleepType === 'nap' ? 'Nap' : bar.isPreDuty ? 'Pre-Duty Sleep' : 'Recovery Sleep'}</span>
                                        </div>
                                        <div className={cn("text-lg font-bold", classes.text)}>
                                          {Math.round(bar.recoveryScore)}%
                                        </div>
                                      </div>
                                      
                                      {/* Explanation from backend (if available) */}
                                      {bar.explanation && (
                                        <div className="bg-primary/5 border border-primary/20 rounded-md p-2 text-[11px] text-muted-foreground leading-relaxed">
                                          <span className="text-primary font-medium">💡 </span>
                                          {bar.explanation}
                                        </div>
                                      )}
                                      
                                      {/* Sleep Timing - show full window for overnight sleep */}
                                      <div className="flex items-center justify-between text-muted-foreground">
                                        <span>Sleep Window</span>
                                        <span className="font-mono font-medium text-foreground">
                                          {decimalToHHmm(bar.originalStartHour ?? bar.startHour)} → {decimalToHHmm(bar.originalEndHour ?? bar.endHour)}
                                          {/* Show +1d only when sleep truly crosses midnight */}
                                          {(bar.isOvernightStart || bar.isOvernightContinuation) &&
                                           (bar.originalStartHour ?? bar.startHour) > (bar.originalEndHour ?? bar.endHour) && ' (+1d)'}
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

                                      {/* Recovery Score Breakdown */}
                                      <div className="bg-secondary/30 rounded-lg p-2 space-y-1.5">
                                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                          Recovery Score Breakdown
                                        </div>
                                        
                                        {/* Base Score from Sleep */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground">⏱️</span>
                                            <span>Effective Sleep</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">{bar.effectiveSleep.toFixed(1)}h / 8h</span>
                                            <span className={cn(
                                              "font-mono font-medium min-w-[40px] text-right",
                                              bar.effectiveSleep >= 7 ? "text-success" : 
                                              bar.effectiveSleep >= 5 ? "text-warning" : "text-critical"
                                            )}>
                                              +{Math.round((bar.effectiveSleep / 8) * 100)}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* Efficiency Bonus */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground">✨</span>
                                            <span>Sleep Quality</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">{Math.round(bar.sleepEfficiency * 100)}% efficiency</span>
                                            <span className={cn(
                                              "font-mono font-medium min-w-[40px] text-right",
                                              bar.sleepEfficiency >= 0.9 ? "text-success" : 
                                              bar.sleepEfficiency >= 0.7 ? "text-warning" : "text-high"
                                            )}>
                                              +{Math.round(bar.sleepEfficiency * 20)}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* WOCL Penalty */}
                                        {(bar.woclOverlapHours ?? 0) > 0 && (
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-muted-foreground">🌙</span>
                                              <span>WOCL Overlap</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-muted-foreground">{bar.woclOverlapHours!.toFixed(1)}h</span>
                                              <span className="font-mono font-medium text-critical min-w-[40px] text-right">
                                                -{Math.round(bar.woclOverlapHours! * 5)}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Divider & Total */}
                                        <div className="border-t border-border/50 pt-1.5 flex items-center justify-between font-medium">
                                          <span>Total Score</span>
                                          <span className={cn("font-mono", classes.text)}>
                                            = {Math.round(bar.recoveryScore)}%
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {/* Quality Factors from backend (if available) */}
                                      {bar.qualityFactors && (
                                        <div className="bg-secondary/20 rounded-lg p-2 space-y-1.5">
                                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                            🔬 Model Calculation Factors
                                          </div>
                                          {Object.entries(bar.qualityFactors).map(([key, value]) => {
                                            const labels: Record<string, string> = {
                                              base_efficiency: 'Base Efficiency',
                                              wocl_boost: 'WOCL Boost',
                                              late_onset_penalty: 'Late Onset',
                                              recovery_boost: 'Recovery Boost',
                                              time_pressure_factor: 'Time Pressure',
                                              insufficient_penalty: 'Duration Penalty',
                                              pre_duty_awake_hours: 'Pre-Duty Awake',
                                            };
                                            const label = labels[key] || key;
                                            const numValue = value as number;
                                            const isHours = key === 'pre_duty_awake_hours';
                                            const isBoost = numValue >= 1;
                                            return (
                                              <div key={key} className="flex items-center justify-between text-[11px]">
                                                <span className="text-muted-foreground">{label}</span>
                                                <span className={cn(
                                                  "font-mono font-medium",
                                                  isHours
                                                    ? (numValue <= 2 ? "text-success" : numValue <= 4 ? "text-muted-foreground" : numValue <= 8 ? "text-warning" : "text-critical")
                                                    : (numValue >= 1.05 ? "text-success" : numValue >= 0.98 ? "text-muted-foreground" : numValue >= 0.90 ? "text-warning" : "text-critical")
                                                )}>
                                                  {isHours ? `${numValue.toFixed(1)}h` : `${isBoost ? '+' : ''}${((numValue - 1) * 100).toFixed(0)}%`}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      
                                      {/* Confidence & Basis (if available) */}
                                      {bar.confidence != null && (
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="text-muted-foreground">Model Confidence</span>
                                          <span className={cn(
                                            "font-mono font-medium px-1.5 py-0.5 rounded",
                                            bar.confidence >= 0.7 ? "bg-success/10 text-success" :
                                            bar.confidence >= 0.5 ? "bg-warning/10 text-warning" : "bg-high/10 text-high"
                                          )}>
                                            {Math.round(bar.confidence * 100)}%
                                          </span>
                                        </div>
                                      )}
                                      {bar.confidenceBasis && (
                                        <div className="text-[10px] text-muted-foreground/70 italic leading-relaxed">
                                          {bar.confidenceBasis}
                                        </div>
                                      )}
                                      
                                      {/* References (if available) */}
                                      {bar.references && bar.references.length > 0 && (
                                        <div className="border-t border-border/30 pt-2 space-y-1">
                                          <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                            📚 Sources
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {bar.references.map((ref, i) => (
                                              <span key={ref.key || i} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground" title={ref.full}>
                                                {ref.short}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Strategy Badge */}
                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-muted-foreground">Strategy</span>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50">
                                          <span>{getStrategyIcon(bar.sleepStrategy)}</span>
                                          <span className="capitalize font-medium">{bar.sleepStrategy.split('_').join(' ')}</span>
                                        </div>
                                      </div>
                                      
                                      {/* Footer Context */}
                                      <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                                        {bar.isPreDuty 
                                          ? `Rest before ${format(bar.relatedDuty.date, 'EEEE, MMM d')} duty`
                                          : `Rest day recovery • ${format(bar.relatedDuty.date, 'EEEE, MMM d')}`
                                        }
                                      </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })}

                        {/* Duty bars for this day with flight phase segments */}
                        {dutyBars
                          .filter((bar) => bar.dayIndex === dayNum)
                          .map((bar, barIndex) => {
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
                                        // Single-lane: duty bars span full row height
                                        top: 0,
                                        height: '100%',
                                        left: `${(bar.startHour / 24) * 100}%`,
                                        width: `${Math.max(((bar.endHour - bar.startHour) / 24) * 100, 2)}%`,
                                        borderRadius,
                                      }}
                                      >
                                        {/* Render individual flight segments */}
                                        {bar.segments.map((segment, segIndex) => {
                                          const segmentWidth = ((segment.endHour - segment.startHour) / (bar.endHour - bar.startHour)) * 100;
                                          
                                          // When zoomed, show flight phases within each flight segment
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
                                                    {/* Phase label - only show for cruise when wide enough */}
                                                    {phase.phase === 'cruise' && zoom.scaleX >= 2.5 && segmentWidth > 15 && (
                                                      <span className="text-[6px] font-medium text-background/90 truncate">
                                                        {Math.round(phase.performance)}%
                                                      </span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          }
                                          
                                          // Standard rendering (not zoomed or non-flight segments)
                                          const isDH = segment.isDeadhead;
                                          return (
                                            <div
                                              key={segIndex}
                                              className={cn(
                                                "h-full relative flex items-center justify-center",
                                                segment.type === 'checkin' && "opacity-70",
                                                segment.type === 'ground' && "opacity-50"
                                              )}
                                              style={{
                                                width: `${segmentWidth}%`,
                                                backgroundColor: segment.type === 'ground'
                                                  ? 'hsl(var(--muted))'
                                                  : isDH
                                                    ? 'hsl(var(--muted))'
                                                    : getPerformanceColor(segment.performance),
                                                // DH diagonal stripes pattern
                                                ...(isDH ? {
                                                  backgroundImage: `repeating-linear-gradient(
                                                    45deg,
                                                    transparent,
                                                    transparent 3px,
                                                    hsla(var(--foreground) / 0.15) 3px,
                                                    hsla(var(--foreground) / 0.15) 5px
                                                  )`,
                                                } : {}),
                                              }}
                                            >
                                              {/* Segment separator line */}
                                              {segIndex > 0 && (
                                                <div className="absolute left-0 top-0 bottom-0 w-px bg-background/70" />
                                              )}
                                              {/* DH label for deadhead flights */}
                                              {isDH && segment.type === 'flight' && segmentWidth > 6 && (
                                                <span className="text-[7px] font-bold text-muted-foreground truncate px-0.5 tracking-wider">
                                                  DH
                                                </span>
                                              )}
                                              {/* Flight number label for operating flights */}
                                              {!isDH && segment.type === 'flight' && segment.flightNumber && segmentWidth > 8 && (
                                                <span className="text-[8px] font-medium text-background truncate px-0.5">
                                                  {segment.flightNumber}
                                                </span>
                                              )}
                                              {/* Check-in indicator */}
                                              {segment.type === 'checkin' && segmentWidth > 5 && (
                                                <span className="text-[8px] text-background/80">✓</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      {/* Crew composition badge for augmented (LR/ULR) duties */}
                                      {bar.duty.crewComposition !== 'standard' && (
                                        <div className={cn(
                                          "absolute -top-2 left-1 text-[7px] font-bold px-1 py-0 rounded leading-tight z-20 border",
                                          bar.duty.crewComposition === 'augmented_4'
                                            ? "bg-purple-500/90 text-white border-purple-400/60"
                                            : "bg-blue-500/90 text-white border-blue-400/60"
                                        )}>
                                          {bar.duty.crewComposition === 'augmented_4' ? '4P' : '3P'}
                                        </div>
                                      )}
                                      {/* Discretion warning indicator */}
                                      {usedDiscretion && (
                                        <div className={cn(
                                          "absolute -top-1 h-3 w-3 rounded-full bg-critical flex items-center justify-center",
                                          bar.duty.crewComposition !== 'standard' ? "-right-1" : "-right-1"
                                        )}>
                                          <AlertTriangle className="h-2 w-2 text-critical-foreground" />
                                        </div>
                                      )}
                                    </button>
                                  </TooltipTrigger>

                                  <TooltipContent side="top" align="start" className="max-w-xs p-3 z-[100]">
                                    <div className="space-y-2 text-xs">
                                      <div className={cn(
                                        "font-semibold text-sm border-b pb-1 flex items-center justify-between",
                                        usedDiscretion ? "border-critical" : "border-border"
                                      )}>
                                        <span>
                                          {format(bar.duty.date, 'EEEE, MMM d')} {bar.isOvernightContinuation && '(continued)'}
                                        </span>
                                        {usedDiscretion && (
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                            DISCRETION
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <span className="text-muted-foreground">Flights:</span>
                                        <span>{bar.duty.flightSegments.map(s => s.flightNumber).join(', ')}</span>
                                      </div>

                                      {/* Crew Composition Section (for augmented duties) */}
                                      {bar.duty.crewComposition !== 'standard' && (
                                        <div className="border-t border-border pt-2 mt-2">
                                          <span className="text-muted-foreground font-medium flex items-center gap-1">
                                            <Brain className="h-3 w-3" />
                                            Crew & Rest
                                          </span>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                                            <span className="text-muted-foreground">Crew:</span>
                                            <span className={cn(
                                              "font-medium",
                                              bar.duty.crewComposition === 'augmented_4' ? "text-purple-400" : "text-blue-400"
                                            )}>
                                              {bar.duty.crewComposition === 'augmented_4' ? '4-Pilot ULR' : '3-Pilot LR'}
                                            </span>
                                            {bar.duty.restFacilityClass && (
                                              <>
                                                <span className="text-muted-foreground">Rest Facility:</span>
                                                <span className="capitalize">{bar.duty.restFacilityClass.replace('_', ' ')}</span>
                                              </>
                                            )}
                                            {bar.duty.inflightRestBlocks.length > 0 && (
                                              <>
                                                <span className="text-muted-foreground">In-Flight Rest:</span>
                                                <span>
                                                  {bar.duty.inflightRestBlocks.length} block{bar.duty.inflightRestBlocks.length > 1 ? 's' : ''} · {bar.duty.inflightRestBlocks.reduce((sum, b) => sum + b.effectiveSleepHours, 0).toFixed(1)}h eff
                                                </span>
                                              </>
                                            )}
                                            {bar.duty.returnToDeckPerformance != null && (
                                              <>
                                                <span className="text-muted-foreground">Return to Deck:</span>
                                                <span className={cn(
                                                  "font-medium",
                                                  bar.duty.returnToDeckPerformance < 60 ? "text-critical" :
                                                  bar.duty.returnToDeckPerformance < 70 ? "text-warning" : "text-success"
                                                )}>
                                                  {Math.round(bar.duty.returnToDeckPerformance)}%
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}

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
                                                <span className="text-warning">{bar.duty.extendedFdpHours.toFixed(1)}h</span>
                                              </>
                                            )}
                                            <span className="text-muted-foreground">Actual FDP:</span>
                                            <span className={cn(
                                              maxFdp && actualFdp > maxFdp && "text-critical font-medium",
                                              maxFdp && actualFdp <= maxFdp && "text-success"
                                            )}>
                                              {actualFdp.toFixed(1)}h
                                            </span>
                                            {bar.duty.fdpExceedance && bar.duty.fdpExceedance > 0 && (
                                              <>
                                                <span className="text-muted-foreground">Exceedance:</span>
                                                <span className="text-critical font-medium">+{bar.duty.fdpExceedance.toFixed(1)}h</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Flight Segments */}
                                      <div className="border-t border-border pt-2 mt-2">
                                        <span className="text-muted-foreground font-medium">Flight Segments:</span>
                                        <div className="flex flex-col gap-1 mt-1">
                                          {bar.segments.filter(s => s.type === 'flight').map((segment, i) => (
                                            <div key={i} className={cn(
                                              "flex items-center justify-between text-[10px] p-1 rounded",
                                              segment.isDeadhead && "border border-dashed border-muted-foreground/40"
                                            )} style={{ backgroundColor: segment.isDeadhead ? 'hsl(var(--muted))' : `${getPerformanceColor(segment.performance)}20` }}>
                                              <span className="font-medium">
                                                {segment.isDeadhead && <span className="text-muted-foreground mr-1">DH</span>}
                                                {segment.flightNumber}
                                              </span>
                                              <span className="text-muted-foreground">{segment.departure} → {segment.arrival}</span>
                                              {segment.isDeadhead
                                                ? <span className="text-muted-foreground italic text-[9px]">PAX</span>
                                                : <span style={{ color: getPerformanceColor(segment.performance) }} className="font-medium">{Math.round(segment.performance)}%</span>
                                              }
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2">
                                        <span className="text-muted-foreground">Min Perf:</span>
                                        <span style={{ color: getPerformanceColor(bar.duty.minPerformance) }}>{Math.round(bar.duty.minPerformance)}%</span>
                                        <span className="text-muted-foreground">WOCL Exposure:</span>
                                        <span className={bar.duty.woclExposure > 0 ? "text-warning" : ""}>{bar.duty.woclExposure.toFixed(1)}h</span>
                                        <span className="text-muted-foreground">Prior Sleep:</span>
                                        <span className={bar.duty.priorSleep < 8 ? "text-warning" : ""}>{bar.duty.priorSleep.toFixed(1)}h</span>
                                        <span className="text-muted-foreground">Sleep Debt:</span>
                                        <span className={bar.duty.sleepDebt > 4 ? "text-high" : ""}>{bar.duty.sleepDebt.toFixed(1)}h</span>
                                        <span className="text-muted-foreground">Risk Level:</span>
                                        <span className={cn(
                                          bar.duty.overallRisk === 'LOW' && "text-success",
                                          bar.duty.overallRisk === 'MODERATE' && "text-warning",
                                          bar.duty.overallRisk === 'HIGH' && "text-high",
                                          bar.duty.overallRisk === 'CRITICAL' && "text-critical"
                                        )}>{bar.duty.overallRisk}</span>
                                      </div>
                                      
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
                                              const score = getRecoveryScore(bar.duty.sleepEstimate);
                                              const classes = getRecoveryClasses(score);
                                              return (
                                                <span className={cn("font-medium", classes.text)}>
                                                  {Math.round(score)}%
                                                </span>
                                              );
                                            })()}
                                            <span className="text-muted-foreground">Effective Sleep:</span>
                                            <span>{bar.duty.sleepEstimate.effectiveSleepHours.toFixed(1)}h</span>
                                            <span className="text-muted-foreground">Efficiency:</span>
                                            <span>{Math.round(bar.duty.sleepEstimate.sleepEfficiency * 100)}%</span>
                                            <span className="text-muted-foreground">Strategy:</span>
                                            <span className="capitalize">{bar.duty.sleepEstimate.sleepStrategy}</span>
                                            {bar.duty.sleepEstimate.warnings.length > 0 && (
                                              <>
                                                <span className="text-muted-foreground col-span-2 text-warning text-[10px] mt-1">
                                                  ⚠️ {bar.duty.sleepEstimate.warnings[0]}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}

                        {/* In-flight rest period bars - hatched overlay on duty bars */}
                        {inflightRestBars
                          .filter((bar) => bar.dayIndex === dayNum)
                          .map((bar, barIndex) => {
                            const barWidth = ((bar.endHour - bar.startHour) / 24) * 100;
                            return (
                              <TooltipProvider key={`ifr-${barIndex}`} delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="absolute pointer-events-auto cursor-help"
                                      style={{
                                        // Single-lane: in-flight rest spans full row height
                                        top: '10%',
                                        height: '80%',
                                        left: `${(bar.startHour / 24) * 100}%`,
                                        width: `${Math.max(barWidth, 0.5)}%`,
                                        background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(147, 130, 220, 0.5) 2px, rgba(147, 130, 220, 0.5) 4px)',
                                        borderRadius: '2px',
                                        border: '1px solid rgba(147, 130, 220, 0.6)',
                                        zIndex: 25,
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs p-3">
                                    <div className="space-y-1 text-xs">
                                      <div className="font-semibold border-b pb-1 flex items-center gap-2">
                                        <span>In-Flight Rest</span>
                                        {bar.crewSet && (
                                          <Badge variant="outline" className="text-[10px] capitalize">
                                            {bar.crewSet.replace('_', ' ')}
                                          </Badge>
                                        )}
                                        {bar.relatedDuty.crewComposition !== 'standard' && (
                                          <Badge variant="outline" className={cn(
                                            "text-[10px]",
                                            bar.relatedDuty.crewComposition === 'augmented_4'
                                              ? "border-purple-400/60 text-purple-400"
                                              : "border-blue-400/60 text-blue-400"
                                          )}>
                                            {bar.relatedDuty.crewComposition === 'augmented_4' ? '4-Pilot' : '3-Pilot'}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                         <span className="text-muted-foreground">Duration:</span>
                                         <span>{bar.durationHours?.toFixed(1) ?? 'N/A'}h</span>
                                         <span className="text-muted-foreground">Effective Sleep:</span>
                                         <span>{bar.effectiveSleepHours?.toFixed(1) ?? 'N/A'}h</span>
                                         {bar.isDuringWocl && (
                                           <>
                                             <span className="text-muted-foreground">WOCL:</span>
                                             <span className="text-warning">Yes</span>
                                           </>
                                         )}
                                         {bar.relatedDuty.restFacilityClass && (
                                           <>
                                             <span className="text-muted-foreground">Facility:</span>
                                             <span className="capitalize">{bar.relatedDuty.restFacilityClass.replace('_', ' ')}</span>
                                           </>
                                         )}
                                       </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}

                        {/* FDP Limit markers for this day - rendered separately to handle overnight cases */}
                        {fdpLimitMarkers
                          .filter((marker) => marker.dayIndex === dayNum)
                          .map((marker, markerIndex) => (
                            <div
                              key={`fdp-${markerIndex}`}
                              className="absolute top-0 bottom-0 border-r-2 border-dashed border-muted-foreground/50 pointer-events-none z-30"
                              style={{
                                left: `${(marker.hour / 24) * 100}%`,
                              }}
                              title={`Max FDP: ${marker.maxFdp}h`}
                            />
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Color legend - compact, aligned with chart height */}
              <div className="ml-3 flex w-10 flex-shrink-0 flex-col">
                  <div style={{ height: `${ROW_HEIGHT}px` }} />
                  <div className="flex gap-1" style={{ height: `${allDays.length * ROW_HEIGHT}px` }}>
                    <div className="w-2.5 rounded-sm overflow-hidden">
                      <div
                        className="h-full w-full"
                        style={{
                          background: 'linear-gradient(to bottom, hsl(120, 70%, 45%), hsl(90, 70%, 50%), hsl(55, 90%, 55%), hsl(40, 95%, 50%), hsl(25, 95%, 50%), hsl(0, 80%, 50%))',
                        }}
                      />
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
              UTC
            </div>
          </div>
        </div>

        {/* Quick duty selection grid */}
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
                {duty.crewComposition === 'augmented_4' && (
                  <span className="absolute -top-1.5 -right-1.5 text-[7px] font-bold bg-purple-500 text-white rounded-full px-1 py-px leading-tight">4P ULR</span>
                )}
                {duty.crewComposition === 'augmented_3' && (
                  <span className="absolute -top-1.5 -right-1.5 text-[7px] font-bold bg-blue-500 text-white rounded-full px-1 py-px leading-tight">3P LR</span>
                )}
                {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
              </button>
            ))}
          </div>
        </div>
          </TabsContent>

          {/* Human Performance (Elapsed Time) Tab */}
          <TabsContent value="elapsed" className="mt-4">
            <HumanPerformanceTimeline
              duties={duties}
              month={month}
              pilotName={pilotName}
              pilotBase={pilotBase}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              restDaysSleep={restDaysSleep}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
