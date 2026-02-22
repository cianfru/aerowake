import { useState, useMemo } from 'react';
import { Info, AlertTriangle, ZoomIn, RotateCcw, Battery } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DutyAnalysis, DutyStatistics, RestDaySleep, FlightPhase, SleepQualityFactors, SleepReference } from '@/types/fatigue';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { TimelineLegend } from '../TimelineLegend';
import { getRecoveryScore, getRecoveryClasses, getStrategyIcon, parseTimeToHours, decimalToHHmm, isoToZulu, getPerformanceColor, isTrainingDuty, getTrainingDutyColor, getTrainingDutyLabel } from '@/lib/fatigue-utils';

// Default check-in time before first sector (EASA typically 60 min)
// Used as fallback when report_time_local is not available from the parser
const DEFAULT_CHECK_IN_MINUTES = 60;

// WOCL (Window of Circadian Low) is typically 02:00 - 06:00
const WOCL_START = 2;
const WOCL_END = 6;

// Row height constant for consistency
const ROW_HEIGHT = 40; // Increased from 28px for breathing room

interface FlightSegmentBar {
  type: 'checkin' | 'flight' | 'ground' | 'training';
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  startHour: number;
  endHour: number;
  performance: number;
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

interface FdpLimitMarker {
  dayIndex: number;
  hour: number; // Position in that day (0-24)
  maxFdp: number;
  duty: DutyAnalysis;
}

export interface HomeBaseTimelineProps {
  duties: DutyAnalysis[];
  statistics: DutyStatistics;
  month: Date;
  pilotId: string;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  restDaysSleep?: RestDaySleep[];
}

export function HomeBaseTimeline({ duties, statistics, month, pilotId, pilotName, pilotBase, pilotAircraft, onDutySelect, selectedDuty, restDaysSleep }: HomeBaseTimelineProps) {
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

  // Calculate flight segment bars for a duty
  const calculateSegments = (duty: DutyAnalysis, isOvernightContinuation: boolean): FlightSegmentBar[] => {
    const segments: FlightSegmentBar[] = [];
    const flightSegs = duty.flightSegments;
    if (flightSegs.length === 0) return [];

    // For overnight continuation, we show the portion of the duty after midnight
    if (isOvernightContinuation) {
      // Collect only after-midnight segments and add ground time between them
      let lastEndHour = 0; // Track where the previous segment ended (starts at 00:00)

      flightSegs.forEach((seg) => {
        const [depH, depM] = seg.departureTime.split(':').map(Number);
        const [arrH, arrM] = seg.arrivalTime.split(':').map(Number);
        const depHour = depH + depM / 60;
        const arrHour = arrH + arrM / 60;

        if (arrHour < depHour) {
          // This flight crosses midnight -- show the portion from 00:00 to arrival
          // Add ground time gap if the continuation doesn't start right at 00:00
          if (lastEndHour < arrHour && lastEndHour > 0.25) {
            // There was a previous after-midnight segment; fill ground between them
          }
          segments.push({
            type: 'flight',
            flightNumber: seg.flightNumber,
            departure: seg.departure,
            arrival: seg.arrival,
            startHour: 0,
            endHour: arrHour,
            performance: seg.performance,
          });
          lastEndHour = arrHour;
        } else if (depHour < 12 && arrHour < 12) {
          // Both times are in early morning (after midnight) -- show full segment
          // Add ground time from the previous after-midnight endpoint
          if (depHour > lastEndHour + 0.25) {
            segments.push({
              type: 'ground',
              startHour: lastEndHour,
              endHour: depHour,
              performance: duty.avgPerformance,
            });
          }
          segments.push({
            type: 'flight',
            flightNumber: seg.flightNumber,
            departure: seg.departure,
            arrival: seg.arrival,
            startHour: depHour,
            endHour: arrHour,
            performance: seg.performance,
          });
          lastEndHour = arrHour;
        }
      });
      return segments;
    }

    // Use actual report time from parser if available, otherwise fall back to estimated check-in
    const [firstDepH, firstDepM] = flightSegs[0].departureTime.split(':').map(Number);
    const firstDepHour = firstDepH + firstDepM / 60;
    // Use reportTimeLocal directly when available, fall back to default offset from first departure
    const reportHour = parseTimeToHours(duty.reportTimeLocal);
    const checkInHour = Math.max(0, reportHour ?? (firstDepHour - DEFAULT_CHECK_IN_MINUTES / 60));

    // Add check-in segment
    segments.push({
      type: 'checkin',
      startHour: checkInHour,
      endHour: firstDepHour,
      performance: Math.min(100, duty.avgPerformance + 10), // Higher at start
    });

    // Add each flight segment
    // Track midnight crossing so we stop adding segments for the departure-day bar
    let passedMidnight = false;

    flightSegs.forEach((seg, index) => {
      if (passedMidnight) return;

      const [depH, depM] = seg.departureTime.split(':').map(Number);
      const [arrH, arrM] = seg.arrivalTime.split(':').map(Number);
      const depHour = depH + depM / 60;
      let arrHour = arrH + arrM / 60;

      // Add ground time between flights if there's a gap
      if (index > 0) {
        const prevSeg = flightSegs[index - 1];
        const [prevArrH, prevArrM] = prevSeg.arrivalTime.split(':').map(Number);
        const prevArrHour = prevArrH + prevArrM / 60;

        // Midnight crossed between consecutive segments
        // (previous arrived in PM, this departs in AM next day)
        if (prevArrHour > depHour) {
          // Fill remaining ground time up to midnight and stop
          if (prevArrHour < 23.75) {
            segments.push({
              type: 'ground',
              startHour: prevArrHour,
              endHour: 24,
              performance: duty.avgPerformance,
            });
          }
          passedMidnight = true;
          return;
        }

        if (depHour > prevArrHour + 0.25) { // More than 15 min gap
          segments.push({
            type: 'ground',
            startHour: prevArrHour,
            endHour: depHour,
            performance: duty.avgPerformance,
          });
        }
      }

      // Handle overnight: if arrival is before departure, cap at midnight
      if (arrHour < depHour) {
        arrHour = 24; // Cap at midnight for this day's bar
        passedMidnight = true;
      }

      // Generate flight phase breakdown for this segment
      // Phases: Takeoff (15%), Climb (10%), Cruise (50%), Descent (10%), Approach (10%), Landing (5%)
      const phases: FlightSegmentBar['phases'] = [
        { phase: 'takeoff' as FlightPhase, performance: seg.performance + 5, widthPercent: 15 },
        { phase: 'climb' as FlightPhase, performance: seg.performance + 3, widthPercent: 10 },
        { phase: 'cruise' as FlightPhase, performance: seg.performance, widthPercent: 50 },
        { phase: 'descent' as FlightPhase, performance: seg.performance - 2, widthPercent: 10 },
        { phase: 'approach' as FlightPhase, performance: seg.performance - 4, widthPercent: 10 },
        { phase: 'landing' as FlightPhase, performance: duty.landingPerformance || seg.performance - 5, widthPercent: 5 },
      ];

      segments.push({
        type: 'flight',
        flightNumber: seg.flightNumber,
        departure: seg.departure,
        arrival: seg.arrival,
        startHour: depHour,
        endHour: arrHour,
        performance: seg.performance,
        phases,
      });
    });

    return segments;
  };

  // Convert duties to bar positions with individual flight segments
  const dutyBars = useMemo(() => {
    const bars: DutyBar[] = [];

    duties.forEach((duty) => {
      // Extract day-of-month from dateString (YYYY-MM-DD) to avoid timezone issues
      // Fallback to Date.getDate() if dateString not available
      const dayOfMonth = duty.dateString
        ? Number(duty.dateString.split('-')[2])
        : duty.date.getDate();

      // Calculate start and end times from flight segments
      if (duty.flightSegments.length > 0) {
        const firstSegment = duty.flightSegments[0];
        const lastSegment = duty.flightSegments[duty.flightSegments.length - 1];

        const [startH, startM] = firstSegment.departureTime.split(':').map(Number);
        const [endH, endM] = lastSegment.arrivalTime.split(':').map(Number);

        // FDP starts at report time (actual RPT from parser) or estimated check-in
        const startHour = startH + startM / 60;
        // Use reportTimeLocal directly when available, fall back to default offset from first departure
        const reportHour = parseTimeToHours(duty.reportTimeLocal);
        const checkInHour = Math.max(0, reportHour ?? (startHour - DEFAULT_CHECK_IN_MINUTES / 60));
        const endHour = endH + endM / 60;

        // Detect overnight duty - FDP crosses midnight in home-base time.
        // Three cases:
        // 1. Last arrival < first departure (e.g. depart 22:00, arrive 04:00)
        // 2. Departure after 16:00 AND arrival before 10:00 (covers night ops)
        // 3. Report time (checkInHour) > arrival (endHour) -- late-night check-in
        //    whose flights finish the next morning (e.g. RPT 23:30, arrive 07:45)
        const isOvernight = endHour < startHour
          || (startHour >= 16 && endHour < 10)
          || (checkInHour > endHour && checkInHour >= 16);

        if (isOvernight) {
          // Determine which calendar day the check-in falls on.
          // If checkInHour >= 20 and flights land before noon -> check-in is the
          // *previous* calendar day relative to dateString (e.g. duty dated Mar 8
          // but check-in 23:30 on Mar 7).
          const checkInOnPrevDay = checkInHour > endHour && checkInHour >= 16;
          const startDayIndex = checkInOnPrevDay ? dayOfMonth - 1 : dayOfMonth;
          const endDayIndex   = checkInOnPrevDay ? dayOfMonth     : dayOfMonth + 1;

          // First bar: from check-in to midnight on the check-in day
          if (startDayIndex >= 1) {
            bars.push({
              dayIndex: startDayIndex,
              startHour: checkInHour,
              endHour: 24,
              duty,
              isOvernightStart: true,
              segments: calculateSegments(duty, false),
            });
          }

          // Second bar: from midnight to arrival on the following day
          if (endDayIndex <= daysInMonth && endHour > 0) {
            bars.push({
              dayIndex: endDayIndex,
              startHour: 0,
              endHour: endHour,
              duty,
              isOvernightContinuation: true,
              segments: calculateSegments(duty, true),
            });
          }
        } else {
          // Same-day duty - no overnight crossing
          bars.push({
            dayIndex: dayOfMonth,
            startHour: checkInHour,
            endHour: endHour,
            duty,
            segments: calculateSegments(duty, false),
          });
        }
      } else if (isTrainingDuty(duty)) {
        // Training duty -- no flight segments, use report/release local times
        const reportHour = parseTimeToHours(duty.reportTimeLocal);
        const releaseHour = parseTimeToHours(duty.releaseTimeLocal);
        if (reportHour === null || releaseHour === null) return;

        const isOvernight = releaseHour < reportHour;

        if (isOvernight) {
          // Overnight training (e.g. night SIM) -- split like flight overnights
          if (dayOfMonth >= 1) {
            bars.push({
              dayIndex: dayOfMonth,
              startHour: reportHour,
              endHour: 24,
              duty,
              isOvernightStart: true,
              segments: [{ type: 'training', startHour: reportHour, endHour: 24, performance: duty.minPerformance }],
            });
          }
          const nextDay = dayOfMonth + 1;
          if (nextDay <= daysInMonth && releaseHour > 0) {
            bars.push({
              dayIndex: nextDay,
              startHour: 0,
              endHour: releaseHour,
              duty,
              isOvernightContinuation: true,
              segments: [{ type: 'training', startHour: 0, endHour: releaseHour, performance: duty.minPerformance }],
            });
          }
        } else {
          bars.push({
            dayIndex: dayOfMonth,
            startHour: reportHour,
            endHour: releaseHour,
            duty,
            segments: [{ type: 'training', startHour: reportHour, endHour: releaseHour, performance: duty.minPerformance }],
          });
        }
      }
    });

    return bars;
  }, [duties, daysInMonth]);

  // Compute FDP limit markers - these need to be rendered separately from duty bars
  // to handle overnight cases where the FDP limit extends past midnight
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

  // Calculate sleep/rest period bars showing recovery using backend timing
  // Uses ISO timestamps for accurate date/day positioning when available
  const sleepBars = useMemo(() => {
    const bars: SleepBar[] = [];

    // Helper to parse HH:mm to decimal hours
    const parseTime = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return h + (m || 0) / 60;
    };

    // Helper to extract day-of-month and hour from ISO timestamp.
    // IMPORTANT: Do NOT use `new Date(iso)` here because it converts to the browser's local timezone,
    // which can shift sleep blocks onto the wrong day/hour and create visual overlap.
    // We intentionally parse the date/time *as written in the ISO string*.
    const parseIsoTimestamp = (isoStr: string): { dayOfMonth: number; hour: number } | null => {
      if (!isoStr) return null;

      // Fast-path for standard ISO strings: YYYY-MM-DDTHH:mm...
      const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (m) {
        const dayOfMonth = Number(m[3]);
        const hour = Number(m[4]) + Number(m[5]) / 60;
        if (!Number.isFinite(dayOfMonth) || !Number.isFinite(hour)) return null;
        return { dayOfMonth, hour };
      }

      // Fallback for unexpected formats
      try {
        const date = new Date(isoStr);
        if (Number.isNaN(date.getTime())) return null;
        return {
          dayOfMonth: date.getDate(),
          hour: date.getHours() + date.getMinutes() / 60,
        };
      } catch {
        return null;
      }
    };

    duties.forEach((duty) => {
      // Extract day-of-month from dateString to avoid timezone issues
      const dutyDayOfMonth = duty.dateString
        ? Number(duty.dateString.split('-')[2])
        : duty.date.getDate();
      const sleepEstimate = duty.sleepEstimate;

      if (!sleepEstimate) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Duty ${duty.dutyId} missing sleepEstimate - skipping sleep bar`);
        }
        return;
      }

      // ULR pre-duty sleep spans multiple nights (Night 1 + Night 2) and is
      // rendered individually -- one bar per night -- via the restDaysSleep path
      // (strategy key = duty ID in sleep_strategies).  Rendering it here from
      // the aggregate sleepStartDay->sleepEndDay span produces a single
      // mis-positioned bar that overwrites the correctly-split recovery bars.
      // Skip the duties-loop path for ULR duties; restDaysSleep handles them.
      if (sleepEstimate.sleepStrategy === 'ulr_pre_duty') {
        return;
      }

      const recoveryScore = getRecoveryScore(sleepEstimate);

      // Common quality factor fields for all sleep bars from this duty
      const sleepBarExtras = {
        qualityFactors: sleepEstimate.qualityFactors,
        explanation: sleepEstimate.explanation,
        confidenceBasis: sleepEstimate.confidenceBasis,
        confidence: sleepEstimate.confidence,
        references: sleepEstimate.references,
        woclOverlapHours: sleepEstimate.woclOverlapHours,
        sleepStartZulu: isoToZulu(sleepEstimate.sleepStartIso) ?? undefined,
        sleepEndZulu: isoToZulu(sleepEstimate.sleepEndIso) ?? undefined,
      };

      // PREFER home-base timezone day/hour values for chronogram positioning
      // This ensures sleep bars align with duty bars (which are already in home TZ)
      const hasHomeTz =
        sleepEstimate.sleepStartDayHomeTz != null &&
        sleepEstimate.sleepStartHourHomeTz != null &&
        sleepEstimate.sleepEndDayHomeTz != null &&
        sleepEstimate.sleepEndHourHomeTz != null;

      // Fallback to location-timezone precomputed values if home_tz not available
      const hasPrecomputed = hasHomeTz || (
        sleepEstimate.sleepStartDay != null &&
        sleepEstimate.sleepStartHour != null &&
        sleepEstimate.sleepEndDay != null &&
        sleepEstimate.sleepEndHour != null);

      if (hasPrecomputed) {
        // Use home-base timezone values when available, fall back to location values
        const startDay = sleepEstimate.sleepStartDayHomeTz ?? sleepEstimate.sleepStartDay!;
        const endDay = sleepEstimate.sleepEndDayHomeTz ?? sleepEstimate.sleepEndDay!;
        const startHour = sleepEstimate.sleepStartHourHomeTz ?? sleepEstimate.sleepStartHour!;
        const endHour = sleepEstimate.sleepEndHourHomeTz ?? sleepEstimate.sleepEndHour!;

        // Clamp to visible month range instead of dropping blocks that
        // cross month boundaries.  A sleep block from Jan 31 -> Feb 1 should
        // still render its visible portion rather than being silently dropped.
        const validHours = startHour >= 0 && startHour <= 24 && endHour >= 0 && endHour <= 24;
        const anyPartVisible = startDay <= daysInMonth && endDay >= 1 && validHours;

        if (anyPartVisible) {
          // Clamp days to visible range
          const clampedStartDay = Math.max(1, Math.min(startDay, daysInMonth));
          const clampedEndDay = Math.max(1, Math.min(endDay, daysInMonth));
          const clampedStartHour = startDay < 1 ? 0 : startHour;
          const clampedEndHour = endDay > daysInMonth ? 24 : endHour;
          if (clampedStartDay === clampedEndDay && clampedEndHour > clampedStartHour) {
            // Same-day sleep (e.g., afternoon nap)
            bars.push({
              dayIndex: clampedStartDay,
              startHour: clampedStartHour,
              endHour: clampedEndHour,
              recoveryScore,
              effectiveSleep: sleepEstimate.effectiveSleepHours,
              sleepEfficiency: sleepEstimate.sleepEfficiency,
              sleepStrategy: sleepEstimate.sleepStrategy,
              isPreDuty: true,
              relatedDuty: duty,
              originalStartHour: startHour,
              originalEndHour: endHour,
            });
          } else if (clampedStartDay !== clampedEndDay) {
            // Overnight sleep: crosses midnight into different day
            // Part 1: startHour to 24:00 on start day
            if (clampedStartDay >= 1 && clampedStartDay <= daysInMonth) {
              bars.push({
                dayIndex: clampedStartDay,
                startHour: clampedStartHour,
                endHour: 24,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
                isOvernightStart: true,
                originalStartHour: startHour,
                originalEndHour: endHour,
              });
            }
            // Part 2: 00:00 to endHour on end day
            if (clampedEndDay >= 1 && clampedEndDay <= daysInMonth && clampedEndHour > 0) {
              bars.push({
                dayIndex: clampedEndDay,
                startHour: 0,
                endHour: clampedEndHour,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
                isOvernightContinuation: true,
                originalStartHour: startHour,
                originalEndHour: endHour,
              });
            }
          }
          // If same day but endHour <= startHour, treat as overnight (endDay = startDay + 1)
          else if (clampedStartDay === clampedEndDay && clampedEndHour <= clampedStartHour) {
            if (clampedStartDay >= 1 && clampedStartDay <= daysInMonth) {
              bars.push({
                dayIndex: clampedStartDay,
                startHour: clampedStartHour,
                endHour: 24,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
                isOvernightStart: true,
                originalStartHour: startHour,
                originalEndHour: endHour,
              });
            }
            if (clampedStartDay + 1 <= daysInMonth && clampedEndHour > 0) {
              bars.push({
                dayIndex: clampedStartDay + 1,
                startHour: 0,
                endHour: clampedEndHour,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
                isOvernightContinuation: true,
                originalStartHour: startHour,
                originalEndHour: endHour,
              });
            }
          }

          // Enrich bars from this duty now (before moving to next duty)
          const barsFromThisDuty = bars.filter(b => b.relatedDuty === duty && !b.qualityFactors);
          barsFromThisDuty.forEach(b => Object.assign(b, sleepBarExtras));
          return; // forEach continue - skip fallback
        }
      }
      // FALLBACK when precomputed data is missing or invalid
      {
        // FALLBACK: Parse ISO timestamps (legacy behavior)
        const sleepStartIso = sleepEstimate.sleepStartIso ? parseIsoTimestamp(sleepEstimate.sleepStartIso) : null;
        const sleepEndIso = sleepEstimate.sleepEndIso ? parseIsoTimestamp(sleepEstimate.sleepEndIso) : null;

        if (sleepStartIso && sleepEndIso) {
          // Use ISO timestamps for precise day placement
          const startDay = sleepStartIso.dayOfMonth;
          const endDay = sleepEndIso.dayOfMonth;
          const startHour = sleepStartIso.hour;
          const endHour = sleepEndIso.hour;

          if (startDay === endDay) {
            // Same-day sleep (e.g., afternoon nap)
            bars.push({
              dayIndex: startDay,
              startHour,
              endHour,
              recoveryScore,
              effectiveSleep: sleepEstimate.effectiveSleepHours,
              sleepEfficiency: sleepEstimate.sleepEfficiency,
              sleepStrategy: sleepEstimate.sleepStrategy,
              isPreDuty: true,
              relatedDuty: duty,
              originalStartHour: startHour,
              originalEndHour: endHour,
            });
          } else {
            // Multi-day span: the backend may send the entire rest period as one block.
            // Only render the last night of sleep (the night before the duty).
            const daySpan = endDay - startDay;

            if (daySpan <= 1) {
              // Normal overnight sleep (1 day crossing)
              if (startDay >= 1 && startDay <= daysInMonth) {
                bars.push({
                  dayIndex: startDay,
                  startHour,
                  endHour: 24,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                  isOvernightStart: true,
                  originalStartHour: startHour,
                  originalEndHour: endHour,
                });
              }
              if (endDay >= 1 && endDay <= daysInMonth && endHour > 0) {
                bars.push({
                  dayIndex: endDay,
                  startHour: 0,
                  endHour,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                  isOvernightContinuation: true,
                  originalStartHour: startHour,
                  originalEndHour: endHour,
                });
              }
            } else {
              // Multi-day rest period (>1 day span): only render the last night before the duty.
              // Estimate sleep start as ~22:00 on the night before endDay, ending at endHour on endDay.
              const lastNightDay = endDay - 1;
              const estimatedSleepStart = 22; // Reasonable default for pre-duty sleep

              if (lastNightDay >= 1 && lastNightDay <= daysInMonth) {
                bars.push({
                  dayIndex: lastNightDay,
                  startHour: estimatedSleepStart,
                  endHour: 24,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                  isOvernightStart: true,
                  originalStartHour: estimatedSleepStart,
                  originalEndHour: endHour,
                });
              }
              if (endDay >= 1 && endDay <= daysInMonth && endHour > 0) {
                bars.push({
                  dayIndex: endDay,
                  startHour: 0,
                  endHour,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                  isOvernightContinuation: true,
                  originalStartHour: estimatedSleepStart,
                  originalEndHour: endHour,
                });
              }
            }
          }
        } else {
          // FALLBACK: Use HH:mm times (legacy behavior - may be inaccurate for overnight)
          const sleepStart = sleepEstimate.sleepStartTime ? parseTime(sleepEstimate.sleepStartTime) : null;
          const sleepEnd = sleepEstimate.sleepEndTime ? parseTime(sleepEstimate.sleepEndTime) : null;

          if (sleepStart !== null && sleepEnd !== null) {
            if (sleepStart > sleepEnd) {
              // Assume overnight sleep: spans midnight
              if (dutyDayOfMonth > 1) {
                bars.push({
                  dayIndex: dutyDayOfMonth - 1,
                  startHour: sleepStart,
                  endHour: 24,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                });
              }
              bars.push({
                dayIndex: dutyDayOfMonth,
                startHour: 0,
                endHour: sleepEnd,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
              });
            } else {
              // Same-day sleep
              bars.push({
                dayIndex: dutyDayOfMonth,
                startHour: sleepStart,
                endHour: sleepEnd,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
              });
            }
          } else if (duty.flightSegments.length > 0) {
            // Fallback: estimate sleep window from total hours
            const firstSeg = duty.flightSegments[0];
            const [depH, depM] = firstSeg.departureTime.split(':').map(Number);
            const dutyStart = depH + depM / 60;
            const sleepDuration = sleepEstimate.totalSleepHours;

            // Estimate wake time as 1.5h before duty
            const wakeTime = Math.max(0, dutyStart - 1.5);
            let estimatedSleepStart = wakeTime - sleepDuration;

            if (estimatedSleepStart < 0) {
              estimatedSleepStart += 24;
              if (dutyDayOfMonth > 1) {
                bars.push({
                  dayIndex: dutyDayOfMonth - 1,
                  startHour: estimatedSleepStart,
                  endHour: 24,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                });
              }
              if (wakeTime > 0) {
                bars.push({
                  dayIndex: dutyDayOfMonth,
                  startHour: 0,
                  endHour: wakeTime,
                  recoveryScore,
                  effectiveSleep: sleepEstimate.effectiveSleepHours,
                  sleepEfficiency: sleepEstimate.sleepEfficiency,
                  sleepStrategy: sleepEstimate.sleepStrategy,
                  isPreDuty: true,
                  relatedDuty: duty,
                });
              }
            } else {
              bars.push({
                dayIndex: dutyDayOfMonth,
                startHour: estimatedSleepStart,
                endHour: wakeTime,
                recoveryScore,
                effectiveSleep: sleepEstimate.effectiveSleepHours,
                sleepEfficiency: sleepEstimate.sleepEfficiency,
                sleepStrategy: sleepEstimate.sleepStrategy,
                isPreDuty: true,
                relatedDuty: duty,
              });
            }
          }
        }
      }

      // Enrich all bars from this duty with quality factor data
      const barsFromThisDuty = bars.filter(b => b.relatedDuty === duty && !b.qualityFactors);
      barsFromThisDuty.forEach(b => Object.assign(b, sleepBarExtras));
    });

    // Add rest day sleep bars (from separate rest_days_sleep array)
    if (restDaysSleep) {
      restDaysSleep.forEach((restDay) => {
        // Rest-day level quality factor extras
        const restDayExtras = {
          qualityFactors: restDay.qualityFactors,
          explanation: restDay.explanation,
          confidenceBasis: restDay.confidenceBasis,
          confidence: restDay.confidence,
          references: restDay.references,
        };

        restDay.sleepBlocks.forEach((block) => {
          // Calculate recovery score for rest day sleep
          const baseScore = (block.effectiveHours / 8) * 100;
          const efficiencyBonus = block.qualityFactor * 20;
          const recoveryScore = Math.min(100, Math.max(0, baseScore + efficiencyBonus));

          // Compute Zulu times from ISO timestamps
          const blockZuluTimes = {
            sleepStartZulu: isoToZulu(block.sleepStartIso) ?? undefined,
            sleepEndZulu: isoToZulu(block.sleepEndIso) ?? undefined,
          };

          // PREFER home-base timezone positioning for rest day blocks too
          const hasHomeTzBlock =
            block.sleepStartDayHomeTz != null &&
            block.sleepStartHourHomeTz != null &&
            block.sleepEndDayHomeTz != null &&
            block.sleepEndHourHomeTz != null;

          let startDay: number;
          let endDay: number;
          let startHour: number;
          let endHour: number;

          if (hasHomeTzBlock) {
            startDay = block.sleepStartDayHomeTz!;
            endDay = block.sleepEndDayHomeTz!;
            startHour = block.sleepStartHourHomeTz!;
            endHour = block.sleepEndHourHomeTz!;
          } else {
            // Fallback: parse ISO timestamps (location timezone)
            const parseIso = (isoStr: string): { dayOfMonth: number; hour: number } | null => {
              if (!isoStr) return null;
              const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
              if (m) {
                const dayOfMonth = Number(m[3]);
                const hour = Number(m[4]) + Number(m[5]) / 60;
                if (!Number.isFinite(dayOfMonth) || !Number.isFinite(hour)) return null;
                return { dayOfMonth, hour };
              }
              try {
                const date = new Date(isoStr);
                if (Number.isNaN(date.getTime())) return null;
                return { dayOfMonth: date.getDate(), hour: date.getHours() + date.getMinutes() / 60 };
              } catch { return null; }
            };

            const sleepStartIso = parseIso(block.sleepStartIso);
            const sleepEndIso = parseIso(block.sleepEndIso);

            if (!sleepStartIso || !sleepEndIso) return;
            startDay = sleepStartIso.dayOfMonth;
            endDay = sleepEndIso.dayOfMonth;
            startHour = sleepStartIso.hour;
            endHour = sleepEndIso.hour;
          }

            // Create a pseudo-duty for tooltip display purposes
            const pseudoDuty: DutyAnalysis = {
              date: restDay.date,
              dayOfWeek: format(restDay.date, 'EEE'),
              dutyHours: 0,
              blockHours: 0,
              sectors: 0,
              minPerformance: 100,
              avgPerformance: 100,
              landingPerformance: 100,
              sleepDebt: 0,
              woclExposure: 0,
              priorSleep: restDay.totalSleepHours,
              overallRisk: 'LOW',
              minPerformanceRisk: 'LOW',
              landingRisk: 'LOW',
              smsReportable: false,
              flightSegments: [],
              crewComposition: 'standard',
              restFacilityClass: null,
              isUlr: false,
              acclimatizationState: 'acclimatized',
              ulrCompliance: null,
              inflightRestBlocks: [],
              returnToDeckPerformance: null,
              preDutyAwakeHours: 0,
            };

            if (startDay === endDay) {
              // Same-day sleep
              bars.push({
                dayIndex: startDay,
                startHour,
                endHour,
                recoveryScore,
                effectiveSleep: block.effectiveHours,
                sleepEfficiency: block.qualityFactor,
                sleepStrategy: restDay.strategyType,
                isPreDuty: false,
                relatedDuty: pseudoDuty,
                ...restDayExtras,
                ...blockZuluTimes,
              });
            } else {
              // Overnight sleep: crosses midnight
              // Part 1: startHour to 24:00 on start day
              if (startDay >= 1 && startDay <= daysInMonth) {
                bars.push({
                  dayIndex: startDay,
                  startHour,
                  endHour: 24,
                  recoveryScore,
                  effectiveSleep: block.effectiveHours,
                  sleepEfficiency: block.qualityFactor,
                  sleepStrategy: restDay.strategyType,
                  isPreDuty: false,
                  relatedDuty: pseudoDuty,
                  isOvernightStart: true,
                  originalStartHour: startHour,
                  originalEndHour: endHour,
                  ...restDayExtras,
                  ...blockZuluTimes,
                });
              }
              // Part 2: 00:00 to endHour on end day
              if (endDay >= 1 && endDay <= daysInMonth && endHour > 0) {
                bars.push({
                  dayIndex: endDay,
                  startHour: 0,
                  endHour,
                  recoveryScore,
                  effectiveSleep: block.effectiveHours,
                  sleepEfficiency: block.qualityFactor,
                  sleepStrategy: restDay.strategyType,
                  isPreDuty: false,
                  relatedDuty: pseudoDuty,
                  isOvernightContinuation: true,
                  originalStartHour: startHour,
                  originalEndHour: endHour,
                  ...restDayExtras,
                  ...blockZuluTimes,
                });
              }
            }
        });
      });
    }

    // Deduplicate EXACT duplicates only (same day, same hour range, same duty).
    // Previously this dropped ALL overlapping bars on the same day -- which
    // incorrectly removed valid sleep bars (e.g., a rest-day bar + a pre-duty
    // nap on the same day, or overnight continuation + daytime nap).
    // Now we only remove bars that are truly redundant (identical positioning
    // from the same related duty).
    const seen = new Set<string>();
    const deduped = bars.filter(bar => {
      // Round to 2 decimal places to avoid floating-point near-duplicates.
      // Key on position only (dayIndex + time slot) -- two bars occupying the
      // same slot on the same day are visual duplicates regardless of which
      // path generated them (duty path vs restDaysSleep path). The duty path
      // runs first in the useMemo loop, so its bar (correct strategy label,
      // isPreDuty=true) always wins the slot.
      const key = `${bar.dayIndex}|${bar.startHour.toFixed(2)}|${bar.endHour.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped;
  }, [duties, restDaysSleep, daysInMonth]);

  // Calculate in-flight rest bars for augmented/ULR duties
  // IMPORTANT: Duty bars are positioned in HOME BASE LOCAL time, so inflight rest
  // bars must also be converted from UTC to local time for proper alignment.
  const inflightRestBars = useMemo(() => {
    const bars: InFlightRestBar[] = [];

    // Helper: derive UTC->local offset from duty's first segment
    const getLocalOffsetHours = (duty: DutyAnalysis): number => {
      if (!duty.flightSegments || duty.flightSegments.length === 0) return 0;
      const seg = duty.flightSegments[0];
      // Use explicit UTC offset if available
      if (seg.departureUtcOffset != null && typeof seg.departureUtcOffset === 'number') {
        return seg.departureUtcOffset;
      }
      // Derive from comparing local vs UTC departure times
      if (seg.departureTime && seg.departureTimeUtc) {
        const [lH, lM] = seg.departureTime.split(':').map(Number);
        const utcStr = seg.departureTimeUtc.replace('Z', '');
        const [uH, uM] = utcStr.split(':').map(Number);
        if (Number.isFinite(lH) && Number.isFinite(uH)) {
          let diff = (lH + lM / 60) - (uH + uM / 60);
          if (diff > 12) diff -= 24;
          if (diff < -12) diff += 24;
          return diff;
        }
      }
      return 0;
    };

    duties.forEach((duty) => {
      if (!duty.inflightRestBlocks || duty.inflightRestBlocks.length === 0) return;

      const dutyDayOfMonth = duty.dateString
        ? Number(duty.dateString.split('-')[2])
        : duty.date.getDate();

      const utcOffset = getLocalOffsetHours(duty);

      duty.inflightRestBlocks.forEach((block) => {
        const pushBar = (dayIdx: number, sH: number, eH: number) => {
          if (dayIdx < 1 || dayIdx > daysInMonth) return;
          bars.push({
            dayIndex: dayIdx,
            startHour: sH,
            endHour: eH,
            durationHours: block.durationHours,
            effectiveSleepHours: block.effectiveSleepHours,
            isDuringWocl: block.isDuringWocl,
            crewSet: block.crewSet,
            relatedDuty: duty,
          });
        };

        // Prefer pre-computed home-TZ fields (most reliable, no offset arithmetic)
        const hasHomeTz = block.startDayHomeTz != null && block.startHourHomeTz != null;

        if (hasHomeTz) {
          const startDay = block.startDayHomeTz!;
          const endDay = block.endDayHomeTz!;
          const startHour = block.startHourHomeTz!;
          const endHour = block.endHourHomeTz!;

          if (startDay === endDay) {
            pushBar(startDay, startHour, endHour);
          } else {
            // Crosses midnight in home TZ
            pushBar(startDay, startHour, 24);
            pushBar(endDay, 0, endHour);
          }
        } else {
          // Fallback: legacy UTC offset arithmetic (old behaviour, kept for safety)
          const startMatch = block.startUtc?.match(/T(\d{2}):(\d{2})/);
          const endMatch = block.endUtc?.match(/T(\d{2}):(\d{2})/);
          if (!startMatch || !endMatch) return;

          // Convert UTC hours to local time for alignment with duty bars
          let startHour = Number(startMatch[1]) + Number(startMatch[2]) / 60 + utcOffset;
          let endHour = Number(endMatch[1]) + Number(endMatch[2]) / 60 + utcOffset;

          // Also check if the UTC date differs from the duty date (rest block may span days in UTC)
          const startDateMatch = block.startUtc.match(/(\d{4})-(\d{2})-(\d{2})/);
          const endDateMatch = block.endUtc.match(/(\d{4})-(\d{2})-(\d{2})/);
          const startDayUtc = startDateMatch ? Number(startDateMatch[3]) : dutyDayOfMonth;
          const endDayUtc = endDateMatch ? Number(endDateMatch[3]) : dutyDayOfMonth;

          // Adjust day index based on UTC->local conversion crossing midnight
          let startDayLocal = startDayUtc;
          if (startHour >= 24) { startHour -= 24; startDayLocal += 1; }
          if (startHour < 0) { startHour += 24; startDayLocal -= 1; }

          let endDayLocal = endDayUtc;
          if (endHour >= 24) { endHour -= 24; endDayLocal += 1; }
          if (endHour < 0) { endHour += 24; endDayLocal -= 1; }

          if (startDayLocal === endDayLocal) {
            if (endHour > startHour) {
              pushBar(startDayLocal, startHour, endHour);
            } else {
              // Crosses midnight in local time
              pushBar(startDayLocal, startHour, 24);
              pushBar(startDayLocal + 1, 0, endHour);
            }
          } else {
            // Multi-day: first day until midnight, last day from midnight
            pushBar(startDayLocal, startHour, 24);
            pushBar(endDayLocal, 0, endHour);
          }
        }
      });
    });

    return bars;
  }, [duties, daysInMonth]);

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

  const hours = Array.from({ length: 8 }, (_, i) => i * 3); // 00, 03, 06, 09, 12, 15, 18, 21

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
            <p className="mt-2">Purple shaded area = WOCL (Window of Circadian Low: 02:00-06:00)</p>
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
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Grid with WOCL shading and duty bars */}
              <div className="relative">
                {/* WOCL hatched pattern */}
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
                      {/* Sleep/Rest bars for this day showing recovery - SEPARATE LANE at top */}
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
                                  className="absolute z-[5] flex items-center justify-end px-1 border border-dashed cursor-pointer hover:brightness-110 transition-all border-primary/20 bg-primary/5"
                                  style={{
                                    top: 0,
                                    height: '100%',
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
                                      <span>{getStrategyIcon(bar.sleepStrategy)}</span>
                                      <span>{Math.round(bar.recoveryScore)}%</span>
                                    </div>
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" side="top" className="max-w-sm p-3">
                                <div className="space-y-2 text-xs">
                                    {/* Header */}
                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                      <div className="font-semibold flex items-center gap-1.5">
                                        <span className="text-base">{bar.isPreDuty ? '🛏️' : '🔋'}</span>
                                        <span>{bar.isPreDuty ? 'Pre-Duty Sleep' : 'Recovery Sleep'}</span>
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
                                        : `Rest day recovery \u2022 ${format(bar.relatedDuty.date, 'EEEE, MMM d')}`
                                      }
                                    </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })}

                      {/* Duty bars for this day with flight phase segments - SEPARATE LANE at bottom */}
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

                                        // Training segment -- distinct solid color with performance accent
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
                                                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.08) 3px, rgba(255,255,255,0.08) 6px)',
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

                                        // Standard rendering (not zoomed or non-flight segments)
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
                                                : getPerformanceColor(segment.performance),
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
                                              <span className="text-[8px] text-background/80">✓</span>
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
                                    {isTrainingDuty(bar.duty) ? (
                                      <>
                                        {/* Training duty type + code */}
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: getTrainingDutyColor(bar.duty.dutyType!) }}>
                                            {getTrainingDutyLabel(bar.duty.dutyType!)}
                                          </Badge>
                                          <span className="font-mono text-xs font-semibold">{bar.duty.trainingCode}</span>
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
                                        {/* Flight duty: flights list, EASA FDP, segments */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                          <span className="text-muted-foreground">Flights:</span>
                                          <span>{bar.duty.flightSegments.map(s => s.flightNumber).join(', ')}</span>
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
                                              <div key={i} className="flex items-center justify-between text-[10px] p-1 rounded" style={{ backgroundColor: `${getPerformanceColor(segment.performance)}20` }}>
                                                <span className="font-medium">{segment.flightNumber}</span>
                                                <span className="text-muted-foreground">{segment.departure} → {segment.arrival}</span>
                                                <span style={{ color: getPerformanceColor(segment.performance) }} className="font-medium">{Math.round(segment.performance)}%</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </>
                                    )}
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
                                      top: 13,
                                      height: 13,
                                      left: `${(bar.startHour / 24) * 100}%`,
                                      width: `${Math.max(barWidth, 0.5)}%`,
                                      background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(147, 130, 220, 0.5) 2px, rgba(147, 130, 220, 0.5) 4px)',
                                      borderRadius: '2px',
                                      zIndex: 25,
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs p-3">
                                  <div className="space-y-1 text-xs">
                                    <div className="font-semibold border-b pb-1">
                                      In-Flight Rest
                                      {bar.crewSet && (
                                        <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                                          {bar.crewSet.replace('_', ' ')}
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
            Time of Day (Home Base)
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
              {duty.isUlr && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded-full px-1 leading-tight">ULR</span>
              )}
              {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
