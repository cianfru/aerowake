/**
 * Pure transform functions for the three grid-based chronogram views.
 *
 * Each function converts DutyAnalysis[] into a TimelineData object
 * consumed by the unified TimelineGrid renderer. No React, no hooks, no JSX.
 *
 * - homeBaseTransform()  -- positions bars using home-base local times
 * - utcTransform()       -- positions bars using UTC/Zulu times
 * - elapsedTransform()   -- positions bars on a continuous elapsed-hours axis
 */

import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';

import type {
  TimelineData,
  TimelineDutyBar,
  TimelineSleepBar,
  TimelineIRBar,
  TimelineFdpMarker,
  TimelineSegment,
  WoclBand,
  RowLabel,
} from '@/lib/timeline-types';

import {
  parseTimeToHours,
  isoToZulu,
  getRecoveryScore,
  isTrainingDuty,
  buildFlightPhases,
  getDayWarnings,
  createRestDayPseudoDuty,
  deduplicateTimelineBars,
  splitOvernightBar,
  parseUtcTimeStr,
  parseIsoDirectly,
  DEFAULT_CHECK_IN_MINUTES,
  WOCL_START,
  WOCL_END,
  ADAPTATION_RATE_EAST,
  ADAPTATION_RATE_WEST,
} from '@/lib/fatigue-utils';

import { utcDayHour } from '@/lib/timezone-utils';

import type { DutyAnalysis, RestDaySleep } from '@/types/fatigue';

// ---------------------------------------------------------------------------
// Shared helpers (internal)
// ---------------------------------------------------------------------------

/** Extract day-of-month from a DutyAnalysis (timezone-safe). */
function dutyDayOfMonth(duty: DutyAnalysis): number {
  if (duty.dateString) return Number(duty.dateString.split('-')[2]);
  return duty.date.getDate();
}

/** Build TimelineSegments for flight-based duties using local HH:mm times. */
function buildLocalSegments(
  duty: DutyAnalysis,
  checkInHour: number,
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];

  // Check-in segment
  if (duty.flightSegments.length > 0) {
    const firstDep = parseTimeToHours(duty.flightSegments[0].departureTime);
    if (firstDep !== undefined) {
      segments.push({
        type: 'checkin',
        startHour: checkInHour,
        endHour: firstDep,
        performance: duty.avgPerformance,
      });
    }
  }

  // Flight segments
  for (const seg of duty.flightSegments) {
    const depH = parseTimeToHours(seg.departureTime);
    const arrH = parseTimeToHours(seg.arrivalTime);
    if (depH === undefined || arrH === undefined) continue;

    const adjustedArr = arrH < depH ? arrH + 24 : arrH;
    const perf = seg.performance ?? duty.avgPerformance;

    segments.push({
      type: seg.isDeadhead ? 'ground' : 'flight',
      flightNumber: seg.flightNumber,
      departure: seg.departure,
      arrival: seg.arrival,
      startHour: depH,
      endHour: adjustedArr,
      performance: perf,
      activityCode: seg.activityCode,
      isDeadhead: seg.isDeadhead,
      phases: seg.isDeadhead ? undefined : buildFlightPhases(perf, duty.landingPerformance),
    });
  }

  return segments;
}

/** Build a single training segment spanning the full duty window. */
function buildTrainingSegment(
  duty: DutyAnalysis,
  startHour: number,
  endHour: number,
): TimelineSegment {
  return {
    type: 'training',
    startHour,
    endHour,
    performance: duty.avgPerformance,
    activityCode: duty.trainingCode ?? null,
  };
}

/** Build common sleep bar fields shared across all three views. */
function baseSleepFields(
  est: NonNullable<DutyAnalysis['sleepEstimate']>,
  duty: DutyAnalysis,
): Omit<TimelineSleepBar, 'rowIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'> {
  return {
    recoveryScore: getRecoveryScore(est),
    effectiveSleep: est.effectiveSleepHours,
    sleepEfficiency: est.sleepEfficiency,
    sleepStrategy: est.sleepStrategy,
    isPreDuty: false,
    relatedDuty: duty,
    originalStartHour: est.sleepStartHourHomeTz ?? est.sleepStartHour,
    originalEndHour: est.sleepEndHourHomeTz ?? est.sleepEndHour,
    sleepStartZulu: isoToZulu(est.sleepStartIso) ?? undefined,
    sleepEndZulu: isoToZulu(est.sleepEndIso) ?? undefined,
    qualityFactors: est.qualityFactors,
    explanation: est.explanation,
    confidenceBasis: est.confidenceBasis,
    confidence: est.confidence,
    references: est.references,
    woclOverlapHours: est.woclOverlapHours,
  };
}

/** Build row labels for a calendar month (shared by homebase and utc). */
function buildMonthRowLabels(
  duties: DutyAnalysis[],
  month: Date,
): RowLabel[] {
  const dim = getDaysInMonth(month);
  const monthStart = startOfMonth(month);
  const labels: RowLabel[] = [];

  for (let d = 1; d <= dim; d++) {
    const dateObj = addDays(monthStart, d - 1);
    const dayResult = getDayWarnings(duties, d);
    labels.push({
      rowIndex: d,
      label: format(dateObj, 'EEE d'),
      date: dateObj,
      hasDuty: dayResult !== null,
      risk: dayResult?.risk,
      warnings: dayResult?.warnings ?? [],
    });
  }

  return labels;
}

// ===========================================================================
// 1. HOME BASE TRANSFORM
// ===========================================================================

/**
 * Transform DutyAnalysis[] into TimelineData for the Home Base local-time view.
 *
 * Duty and sleep bars are positioned using precomputed home-base timezone
 * fields from the backend. Sleep bars ONLY use Path 1 (sleepStartDayHomeTz,
 * sleepStartHourHomeTz, sleepEndDayHomeTz, sleepEndHourHomeTz). Missing
 * precomputed fields cause a console.warn and the bar is skipped -- no
 * fallback to ISO parsing or estimation.
 */
export function homeBaseTransform(
  duties: DutyAnalysis[],
  _statistics: { totalDuties: number; highRiskDuties: number; criticalRiskDuties: number },
  month: Date,
  restDaysSleep?: RestDaySleep[],
): TimelineData {
  const daysInMonth = getDaysInMonth(month);
  const dutyBars: TimelineDutyBar[] = [];
  const sleepBars: TimelineSleepBar[] = [];
  const irBars: TimelineIRBar[] = [];
  const fdpMarkers: TimelineFdpMarker[] = [];

  for (const duty of duties) {
    const dayOfMonth = dutyDayOfMonth(duty);

    // ---- Duty bars ----
    if (isTrainingDuty(duty)) {
      const startH = parseTimeToHours(duty.reportTimeLocal);
      const endH = parseTimeToHours(duty.releaseTimeLocal);
      if (startH !== undefined && endH !== undefined) {
        const isOvernight = endH < startH || (startH >= 16 && endH < 10);
        if (isOvernight) {
          const slices = splitOvernightBar(dayOfMonth, startH, endH, daysInMonth);
          for (const s of slices) {
            dutyBars.push({
              ...s,
              duty,
              segments: [buildTrainingSegment(duty, s.startHour, s.endHour)],
            });
          }
        } else {
          dutyBars.push({
            rowIndex: dayOfMonth,
            startHour: startH,
            endHour: endH,
            duty,
            segments: [buildTrainingSegment(duty, startH, endH)],
          });
        }
      }
    } else if (duty.flightSegments.length > 0) {
      // Flight duty: derive check-in / release from local times
      const firstDep = parseTimeToHours(duty.flightSegments[0].departureTime);
      const lastArr = parseTimeToHours(duty.flightSegments[duty.flightSegments.length - 1].arrivalTime);
      const reportH = parseTimeToHours(duty.reportTimeLocal);
      const releaseH = parseTimeToHours(duty.releaseTimeLocal);

      const checkInHour = reportH ?? (firstDep !== undefined ? firstDep - DEFAULT_CHECK_IN_MINUTES / 60 : undefined);
      const endHour = releaseH ?? lastArr;

      if (checkInHour !== undefined && endHour !== undefined) {
        // Detect overnight
        const isOvernight = endHour < checkInHour || (checkInHour >= 16 && endHour < 10);

        // Special case: check-in on previous day
        const checkInOnPrevDay = checkInHour > endHour && checkInHour >= 16;

        const segments = buildLocalSegments(duty, checkInHour);

        if (checkInOnPrevDay) {
          // Bar 1: previous day, check-in to 24:00
          if (dayOfMonth - 1 >= 1) {
            dutyBars.push({
              rowIndex: dayOfMonth - 1,
              startHour: checkInHour,
              endHour: 24,
              duty,
              isOvernightStart: true,
              segments,
            });
          }
          // Bar 2: current day, 00:00 to endHour
          dutyBars.push({
            rowIndex: dayOfMonth,
            startHour: 0,
            endHour,
            duty,
            isOvernightContinuation: true,
            segments,
          });
        } else if (isOvernight) {
          const slices = splitOvernightBar(dayOfMonth, checkInHour, endHour, daysInMonth);
          for (const s of slices) {
            dutyBars.push({ ...s, duty, segments });
          }
        } else {
          dutyBars.push({
            rowIndex: dayOfMonth,
            startHour: checkInHour,
            endHour,
            duty,
            segments,
          });
        }

        // FDP marker (only on start bar, not continuation)
        if (duty.maxFdpHours && checkInHour !== undefined) {
          const fdpEndHour = checkInHour + duty.maxFdpHours;
          if (fdpEndHour <= 24) {
            fdpMarkers.push({ rowIndex: dayOfMonth, hour: fdpEndHour, maxFdp: duty.maxFdpHours, duty });
          } else {
            const nextRow = dayOfMonth + 1;
            if (nextRow <= daysInMonth) {
              fdpMarkers.push({ rowIndex: nextRow, hour: fdpEndHour - 24, maxFdp: duty.maxFdpHours, duty });
            }
          }
        }
      }
    }

    // ---- Sleep bars (Path 1 ONLY) ----
    const est = duty.sleepEstimate;
    if (est) {
      if (est.sleepStrategy === 'ulr_pre_duty') {
        // Skip ULR pre-duty sleep
      } else if (
        est.sleepStartDayHomeTz != null &&
        est.sleepStartHourHomeTz != null &&
        est.sleepEndDayHomeTz != null &&
        est.sleepEndHourHomeTz != null
      ) {
        const startDay = est.sleepStartDayHomeTz;
        const startHour = est.sleepStartHourHomeTz;
        const endDay = est.sleepEndDayHomeTz;
        const endHour = est.sleepEndHourHomeTz;

        // Clamp to visible month range
        if (startDay <= daysInMonth && endDay >= 1) {
          const base = baseSleepFields(est, duty);

          if (startDay === endDay) {
            // Same-day sleep
            if (endHour <= startHour) {
              // Wraps midnight on same day number -> treat as overnight
              const slices = splitOvernightBar(startDay, startHour, endHour, daysInMonth);
              for (const s of slices) {
                sleepBars.push({ ...base, ...s });
              }
            } else {
              sleepBars.push({
                ...base,
                rowIndex: startDay,
                startHour,
                endHour,
              });
            }
          } else {
            // Overnight or multi-day: split at midnight
            if (startDay >= 1 && startDay <= daysInMonth) {
              sleepBars.push({
                ...base,
                rowIndex: startDay,
                startHour,
                endHour: 24,
                isOvernightStart: true,
              });
            }
            if (endDay >= 1 && endDay <= daysInMonth) {
              sleepBars.push({
                ...base,
                rowIndex: endDay,
                startHour: 0,
                endHour,
                isOvernightContinuation: true,
              });
            }
          }
        }
      } else {
        console.warn(
          `[homeBaseTransform] Skipping sleep bar for duty ${duty.dateString ?? duty.date.toISOString()}: ` +
          'missing sleepStartDayHomeTz/sleepStartHourHomeTz/sleepEndDayHomeTz/sleepEndHourHomeTz',
        );
      }
    }

    // ---- In-flight rest bars (Path 1: home-TZ precomputed) ----
    for (const block of duty.inflightRestBlocks) {
      if (
        block.startDayHomeTz != null &&
        block.startHourHomeTz != null &&
        block.endDayHomeTz != null &&
        block.endHourHomeTz != null
      ) {
        const slices = splitOvernightBar(
          block.startDayHomeTz,
          block.startHourHomeTz,
          block.endHourHomeTz,
          daysInMonth,
        );
        for (const s of slices) {
          irBars.push({
            rowIndex: s.rowIndex,
            startHour: s.startHour,
            endHour: s.endHour,
            durationHours: block.durationHours,
            effectiveSleepHours: block.effectiveSleepHours,
            isDuringWocl: block.isDuringWocl,
            crewSet: block.crewSet,
            relatedDuty: duty,
          });
        }
      } else {
        console.warn(
          `[homeBaseTransform] Skipping IR bar for duty ${duty.dateString ?? duty.date.toISOString()}: ` +
          'missing home-TZ precomputed fields on inflightRestBlock',
        );
      }
    }
  }

  // ---- Rest day sleep ----
  if (restDaysSleep) {
    for (const restDay of restDaysSleep) {
      const pseudoDuty = createRestDayPseudoDuty(restDay);
      for (const block of restDay.sleepBlocks) {
        if (
          block.sleepStartDayHomeTz != null &&
          block.sleepStartHourHomeTz != null &&
          block.sleepEndDayHomeTz != null &&
          block.sleepEndHourHomeTz != null
        ) {
          const startDay = block.sleepStartDayHomeTz;
          const startHour = block.sleepStartHourHomeTz;
          const endDay = block.sleepEndDayHomeTz;
          const endHour = block.sleepEndHourHomeTz;

          if (startDay > daysInMonth || endDay < 1) continue;

          const baseFields: Omit<TimelineSleepBar, 'rowIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'> = {
            recoveryScore: (block.effectiveHours / 8) * 100,
            effectiveSleep: block.effectiveHours,
            sleepEfficiency: restDay.sleepEfficiency,
            sleepStrategy: restDay.strategyType,
            isPreDuty: false,
            relatedDuty: pseudoDuty,
            originalStartHour: startHour,
            originalEndHour: endHour,
            sleepStartZulu: isoToZulu(block.sleepStartIso) ?? undefined,
            sleepEndZulu: isoToZulu(block.sleepEndIso) ?? undefined,
            qualityFactors: restDay.qualityFactors,
            explanation: restDay.explanation,
            confidenceBasis: restDay.confidenceBasis,
            confidence: restDay.confidence,
            references: restDay.references,
          };

          if (startDay === endDay) {
            if (endHour <= startHour) {
              const slices = splitOvernightBar(startDay, startHour, endHour, daysInMonth);
              for (const s of slices) sleepBars.push({ ...baseFields, ...s });
            } else {
              sleepBars.push({ ...baseFields, rowIndex: startDay, startHour, endHour });
            }
          } else {
            if (startDay >= 1 && startDay <= daysInMonth) {
              sleepBars.push({ ...baseFields, rowIndex: startDay, startHour, endHour: 24, isOvernightStart: true });
            }
            if (endDay >= 1 && endDay <= daysInMonth) {
              sleepBars.push({ ...baseFields, rowIndex: endDay, startHour: 0, endHour, isOvernightContinuation: true });
            }
          }
        } else {
          console.warn(
            `[homeBaseTransform] Skipping rest-day sleep bar for ${restDay.date.toISOString()}: ` +
            'missing home-TZ precomputed fields on sleepBlock',
          );
        }
      }
    }
  }

  // ---- WOCL band (static) ----
  const woclBands: WoclBand[] = [{ rowIndex: -1, startHour: WOCL_START, endHour: WOCL_END }];

  return {
    variant: 'homebase',
    dutyBars,
    sleepBars: deduplicateTimelineBars(sleepBars),
    inflightRestBars: irBars,
    fdpMarkers,
    woclBands,
    rowLabels: buildMonthRowLabels(duties, month),
    totalRows: daysInMonth,
    xAxisLabel: 'Time of Day (Home Base)',
  };
}

// ===========================================================================
// 2. UTC TRANSFORM
// ===========================================================================

/** Build TimelineSegments using UTC times from flight segments. */
function buildUtcSegments(
  duty: DutyAnalysis,
  checkInHour: number,
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];

  if (duty.flightSegments.length > 0) {
    const firstDepUtc = parseUtcTimeStr(duty.flightSegments[0].departureTimeUtc);
    if (firstDepUtc !== null) {
      segments.push({
        type: 'checkin',
        startHour: checkInHour,
        endHour: firstDepUtc,
        performance: duty.avgPerformance,
      });
    }
  }

  for (const seg of duty.flightSegments) {
    const depH = parseUtcTimeStr(seg.departureTimeUtc);
    const arrH = parseUtcTimeStr(seg.arrivalTimeUtc);
    if (depH === null || arrH === null) continue;

    const adjustedArr = arrH < depH ? arrH + 24 : arrH;
    const perf = seg.performance ?? duty.avgPerformance;

    segments.push({
      type: seg.isDeadhead ? 'ground' : 'flight',
      flightNumber: seg.flightNumber,
      departure: seg.departure,
      arrival: seg.arrival,
      startHour: depH,
      endHour: adjustedArr,
      performance: perf,
      activityCode: seg.activityCode,
      isDeadhead: seg.isDeadhead,
      phases: seg.isDeadhead ? undefined : buildFlightPhases(perf, duty.landingPerformance),
    });
  }

  return segments;
}

/**
 * Helper to add a sleep bar in the UTC view, handling same-day, overnight,
 * and multi-day splitting.
 */
function addUtcSleepBar(
  bars: TimelineSleepBar[],
  startDay: number,
  startHour: number,
  endDay: number,
  endHour: number,
  fields: Omit<TimelineSleepBar, 'rowIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'>,
  maxRow: number,
): void {
  if (startDay > maxRow || endDay < 1) return;

  if (startDay === endDay) {
    if (endHour <= startHour && endHour > 0) {
      // Wraps midnight on same UTC day number
      const slices = splitOvernightBar(startDay, startHour, endHour, maxRow);
      for (const s of slices) bars.push({ ...fields, ...s });
    } else {
      if (startDay >= 1 && startDay <= maxRow) {
        bars.push({ ...fields, rowIndex: startDay, startHour, endHour: endHour > startHour ? endHour : 24 });
      }
    }
  } else {
    // Multi-day: first day startHour..24, intermediate full rows, last day 0..endHour
    if (startDay >= 1 && startDay <= maxRow) {
      bars.push({ ...fields, rowIndex: startDay, startHour, endHour: 24, isOvernightStart: true });
    }
    // Intermediate full days (rare for sleep, but handle it)
    for (let d = startDay + 1; d < endDay; d++) {
      if (d >= 1 && d <= maxRow) {
        bars.push({ ...fields, rowIndex: d, startHour: 0, endHour: 24 });
      }
    }
    if (endDay >= 1 && endDay <= maxRow && endHour > 0) {
      bars.push({ ...fields, rowIndex: endDay, startHour: 0, endHour, isOvernightContinuation: true });
    }
  }
}

/**
 * Transform DutyAnalysis[] into TimelineData for the UTC (Zulu) view.
 *
 * Duty bars use UTC flight segment times. Sleep bars prefer ISO timestamps
 * converted to UTC day/hour via utcDayHour(), falling back to location-TZ
 * precomputed fields.
 */
export function utcTransform(
  duties: DutyAnalysis[],
  _statistics: { totalDuties: number; highRiskDuties: number; criticalRiskDuties: number },
  month: Date,
  restDaysSleep?: RestDaySleep[],
): TimelineData {
  const daysInMonth = getDaysInMonth(month);
  const dutyBars: TimelineDutyBar[] = [];
  const sleepBars: TimelineSleepBar[] = [];
  const irBars: TimelineIRBar[] = [];
  const fdpMarkers: TimelineFdpMarker[] = [];

  for (const duty of duties) {
    const dayOfMonth = dutyDayOfMonth(duty);

    // ---- Duty bars ----
    if (isTrainingDuty(duty)) {
      // Training duties: use reportTimeUtc/releaseTimeUtc ISO timestamps
      let startDay = dayOfMonth;
      let startHour: number | undefined;
      let endHour: number | undefined;

      if (duty.reportTimeUtc) {
        const parsed = utcDayHour(duty.reportTimeUtc);
        startDay = parsed.day;
        startHour = parsed.hour;
      }
      if (duty.releaseTimeUtc) {
        const parsed = utcDayHour(duty.releaseTimeUtc);
        endHour = parsed.hour;
      }

      if (startHour !== undefined && endHour !== undefined) {
        const isOvernight = endHour < startHour;
        if (isOvernight) {
          const slices = splitOvernightBar(startDay, startHour, endHour, daysInMonth);
          for (const s of slices) {
            dutyBars.push({ ...s, duty, segments: [buildTrainingSegment(duty, s.startHour, s.endHour)] });
          }
        } else {
          dutyBars.push({
            rowIndex: startDay,
            startHour,
            endHour,
            duty,
            segments: [buildTrainingSegment(duty, startHour, endHour)],
          });
        }
      }
    } else if (duty.flightSegments.length > 0) {
      // Flight duty: UTC times from segments
      const firstDepUtc = parseUtcTimeStr(duty.flightSegments[0].departureTimeUtc);
      const lastArrUtc = parseUtcTimeStr(duty.flightSegments[duty.flightSegments.length - 1].arrivalTimeUtc);

      // Check-in: prefer reportTimeUtc ISO, else estimate -1h from departure
      let checkInDay = dayOfMonth;
      let checkInHour: number | undefined;

      if (duty.reportTimeUtc) {
        try {
          const parsed = utcDayHour(duty.reportTimeUtc);
          checkInDay = parsed.day;
          checkInHour = parsed.hour;
        } catch {
          // fallback below
        }
      }
      if (checkInHour === undefined && firstDepUtc !== null) {
        checkInHour = firstDepUtc - DEFAULT_CHECK_IN_MINUTES / 60;
        if (checkInHour < 0) checkInHour += 24;
      }

      if (checkInHour !== undefined && lastArrUtc !== null) {
        const endHour = lastArrUtc;
        const isOvernight = endHour < checkInHour;
        const segments = buildUtcSegments(duty, checkInHour);

        if (isOvernight) {
          const slices = splitOvernightBar(checkInDay, checkInHour, endHour, daysInMonth);
          for (const s of slices) {
            dutyBars.push({ ...s, duty, segments });
          }
        } else {
          dutyBars.push({
            rowIndex: checkInDay,
            startHour: checkInHour,
            endHour,
            duty,
            segments,
          });
        }

        // FDP marker
        if (duty.maxFdpHours) {
          const fdpEndHour = checkInHour + duty.maxFdpHours;
          if (fdpEndHour <= 24) {
            fdpMarkers.push({ rowIndex: checkInDay, hour: fdpEndHour, maxFdp: duty.maxFdpHours, duty });
          } else {
            const nextRow = checkInDay + 1;
            if (nextRow <= daysInMonth) {
              fdpMarkers.push({ rowIndex: nextRow, hour: fdpEndHour - 24, maxFdp: duty.maxFdpHours, duty });
            }
          }
        }
      }
    }

    // ---- Sleep bars (ISO -> UTC preferred, fallback to location-TZ precomputed) ----
    const est = duty.sleepEstimate;
    if (est && est.sleepStrategy !== 'ulr_pre_duty') {
      const base = baseSleepFields(est, duty);
      let startDay: number | undefined;
      let startHour: number | undefined;
      let endDay: number | undefined;
      let endHour: number | undefined;

      // Primary: ISO timestamps -> UTC
      if (est.sleepStartIso && est.sleepEndIso) {
        const startUtc = utcDayHour(est.sleepStartIso);
        const endUtc = utcDayHour(est.sleepEndIso);
        startDay = startUtc.day;
        startHour = startUtc.hour;
        endDay = endUtc.day;
        endHour = endUtc.hour;
      }

      // Fallback: location-TZ precomputed
      if (startDay == null && est.sleepStartDay != null && est.sleepEndDay != null) {
        startDay = est.sleepStartDay;
        startHour = est.sleepStartHour ?? 0;
        endDay = est.sleepEndDay;
        endHour = est.sleepEndHour ?? 0;
      }

      if (startDay != null && startHour != null && endDay != null && endHour != null) {
        addUtcSleepBar(sleepBars, startDay, startHour, endDay, endHour, base, daysInMonth);
      }
    }

    // ---- In-flight rest bars (UTC ISO) ----
    for (const block of duty.inflightRestBlocks) {
      if (block.startUtc && block.endUtc) {
        const start = utcDayHour(block.startUtc);
        const end = utcDayHour(block.endUtc);

        const slices = splitOvernightBar(start.day, start.hour, end.hour, daysInMonth);
        for (const s of slices) {
          irBars.push({
            rowIndex: s.rowIndex,
            startHour: s.startHour,
            endHour: s.endHour,
            durationHours: block.durationHours,
            effectiveSleepHours: block.effectiveSleepHours,
            isDuringWocl: block.isDuringWocl,
            crewSet: block.crewSet,
            relatedDuty: duty,
          });
        }
      }
    }
  }

  // ---- Rest day sleep ----
  if (restDaysSleep) {
    for (const restDay of restDaysSleep) {
      const pseudoDuty = createRestDayPseudoDuty(restDay);
      for (const block of restDay.sleepBlocks) {
        let startDay: number | undefined;
        let startHour: number | undefined;
        let endDay: number | undefined;
        let endHour: number | undefined;

        // Primary: ISO -> UTC
        if (block.sleepStartIso && block.sleepEndIso) {
          const s = utcDayHour(block.sleepStartIso);
          const e = utcDayHour(block.sleepEndIso);
          startDay = s.day;
          startHour = s.hour;
          endDay = e.day;
          endHour = e.hour;
        }

        // Fallback: location-TZ precomputed
        if (startDay == null && block.sleepStartDay != null && block.sleepEndDay != null) {
          startDay = block.sleepStartDay;
          startHour = block.sleepStartHour ?? 0;
          endDay = block.sleepEndDay;
          endHour = block.sleepEndHour ?? 0;
        }

        if (startDay != null && startHour != null && endDay != null && endHour != null) {
          const baseFields: Omit<TimelineSleepBar, 'rowIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'> = {
            recoveryScore: (block.effectiveHours / 8) * 100,
            effectiveSleep: block.effectiveHours,
            sleepEfficiency: restDay.sleepEfficiency,
            sleepStrategy: restDay.strategyType,
            isPreDuty: false,
            relatedDuty: pseudoDuty,
            originalStartHour: startHour,
            originalEndHour: endHour,
            sleepStartZulu: isoToZulu(block.sleepStartIso) ?? undefined,
            sleepEndZulu: isoToZulu(block.sleepEndIso) ?? undefined,
            qualityFactors: restDay.qualityFactors,
            explanation: restDay.explanation,
            confidenceBasis: restDay.confidenceBasis,
            confidence: restDay.confidence,
            references: restDay.references,
          };
          addUtcSleepBar(sleepBars, startDay, startHour, endDay, endHour, baseFields, daysInMonth);
        }
      }
    }
  }

  // ---- WOCL band (static) ----
  const woclBands: WoclBand[] = [{ rowIndex: -1, startHour: WOCL_START, endHour: WOCL_END }];

  return {
    variant: 'utc',
    dutyBars,
    sleepBars: deduplicateTimelineBars(sleepBars),
    inflightRestBars: irBars,
    fdpMarkers,
    woclBands,
    rowLabels: buildMonthRowLabels(duties, month),
    totalRows: daysInMonth,
    xAxisLabel: 'Time of Day (UTC / Zulu)',
  };
}

// ===========================================================================
// 3. ELAPSED TRANSFORM
// ===========================================================================

/**
 * Convert a day-of-month and hour to elapsed hours from T=0
 * (midnight on the 1st of the roster month).
 */
function dayHourToElapsed(dayOfMonth: number, hourOfDay: number): number {
  return (dayOfMonth - 1) * 24 + hourOfDay;
}

/**
 * Split an elapsed-hours range across 24h row boundaries.
 *
 * Each row spans [row*24, (row+1)*24). Returns bar slices with
 * startHour/endHour relative to the row (0-24).
 */
function splitElapsedAcrossRows(
  startElapsed: number,
  endElapsed: number,
): { rowIndex: number; startHour: number; endHour: number; isOvernightStart?: boolean; isOvernightContinuation?: boolean }[] {
  const results: { rowIndex: number; startHour: number; endHour: number; isOvernightStart?: boolean; isOvernightContinuation?: boolean }[] = [];
  if (endElapsed <= startElapsed) return results;

  const firstRow = Math.floor(startElapsed / 24);
  const lastRow = Math.floor((endElapsed - 0.001) / 24); // -epsilon so exactly on boundary stays in previous row

  for (let row = firstRow; row <= lastRow; row++) {
    const rowStart = row * 24;
    const rowEnd = rowStart + 24;
    const barStart = Math.max(startElapsed, rowStart) - rowStart;
    const barEnd = Math.min(endElapsed, rowEnd) - rowStart;

    if (barEnd > barStart) {
      results.push({
        rowIndex: row,
        startHour: barStart,
        endHour: barEnd,
        isOvernightStart: row === firstRow && lastRow > firstRow ? true : undefined,
        isOvernightContinuation: row > firstRow ? true : undefined,
      });
    }
  }

  return results;
}

/**
 * Transform DutyAnalysis[] into TimelineData for the Elapsed (HPT) view.
 *
 * The X axis represents elapsed hours from T=0 (midnight on the 1st of the
 * roster month). Each row is a 24-hour chunk. WOCL bands shift per row
 * based on accumulated circadian phase shift.
 */
export function elapsedTransform(
  duties: DutyAnalysis[],
  month: Date,
  restDaysSleep?: RestDaySleep[],
): TimelineData {
  const daysInMonth = getDaysInMonth(month);
  const monthStart = startOfMonth(month);
  const dutyBars: TimelineDutyBar[] = [];
  const sleepBars: TimelineSleepBar[] = [];
  const irBars: TimelineIRBar[] = [];
  const fdpMarkers: TimelineFdpMarker[] = [];
  let maxElapsedHour = 24; // at least one row

  // --- Circadian shift tracking ---
  // Build a map of day-of-month -> cumulative circadian shift
  const circadianShiftByDay = new Map<number, number>();
  let accumulatedShift = 0;
  let lastDutyDay = 0;

  // Sort duties by date for sequential shift tracking
  const sortedDuties = [...duties].sort((a, b) => {
    const da = dutyDayOfMonth(a);
    const db = dutyDayOfMonth(b);
    return da - db;
  });

  for (const duty of sortedDuties) {
    const dom = dutyDayOfMonth(duty);

    // Adapt shift toward 0 for rest days between duties
    if (lastDutyDay > 0 && dom > lastDutyDay + 1) {
      const restDays = dom - lastDutyDay - 1;
      if (accumulatedShift > 0) {
        accumulatedShift = Math.max(0, accumulatedShift - restDays * ADAPTATION_RATE_WEST);
      } else if (accumulatedShift < 0) {
        accumulatedShift = Math.min(0, accumulatedShift + restDays * ADAPTATION_RATE_EAST);
      }
    }

    // Apply this duty's phase shift
    const dutyShift = duty.circadianPhaseShiftValue ?? duty.circadianPhaseShift ?? 0;
    accumulatedShift += dutyShift;

    // Clamp to +/-12h
    accumulatedShift = Math.max(-12, Math.min(12, accumulatedShift));

    circadianShiftByDay.set(dom, accumulatedShift);
    lastDutyDay = dom;
  }

  // Fill in shift values for non-duty days (decay toward 0)
  let currentShift = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (circadianShiftByDay.has(d)) {
      currentShift = circadianShiftByDay.get(d)!;
    } else {
      // Adapt toward 0
      if (currentShift > 0) {
        currentShift = Math.max(0, currentShift - ADAPTATION_RATE_WEST);
      } else if (currentShift < 0) {
        currentShift = Math.min(0, currentShift + ADAPTATION_RATE_EAST);
      }
      circadianShiftByDay.set(d, currentShift);
    }
  }

  // --- Duty bars ---
  for (const duty of duties) {
    const dayOfMonth = dutyDayOfMonth(duty);

    if (isTrainingDuty(duty)) {
      const startH = parseTimeToHours(duty.reportTimeLocal);
      const endH = parseTimeToHours(duty.releaseTimeLocal);
      if (startH !== undefined && endH !== undefined) {
        const startElapsed = dayHourToElapsed(dayOfMonth, startH);
        let endElapsed = dayHourToElapsed(dayOfMonth, endH);
        if (endElapsed <= startElapsed) endElapsed += 24; // overnight
        maxElapsedHour = Math.max(maxElapsedHour, endElapsed);

        const totalDuration = endElapsed - startElapsed;
        const slices = splitElapsedAcrossRows(startElapsed, endElapsed);
        for (const s of slices) {
          dutyBars.push({
            ...s,
            duty,
            segments: [{
              type: 'training',
              startHour: s.startHour,
              endHour: s.endHour,
              widthPercent: totalDuration > 0 ? ((s.endHour - s.startHour) / totalDuration) * 100 : 100,
              performance: duty.avgPerformance,
              activityCode: duty.trainingCode ?? null,
            }],
          });
        }
      }
    } else if (duty.flightSegments.length > 0) {
      const firstDep = parseTimeToHours(duty.flightSegments[0].departureTime);
      const lastArr = parseTimeToHours(duty.flightSegments[duty.flightSegments.length - 1].arrivalTime);
      const reportH = parseTimeToHours(duty.reportTimeLocal);

      const checkInHour = reportH ?? (firstDep !== undefined ? firstDep - DEFAULT_CHECK_IN_MINUTES / 60 : undefined);

      if (checkInHour !== undefined && lastArr !== undefined) {
        const startElapsed = dayHourToElapsed(dayOfMonth, checkInHour);
        let adjustedLastArr = lastArr;
        if (adjustedLastArr < checkInHour) adjustedLastArr += 24;
        const endElapsed = dayHourToElapsed(dayOfMonth, adjustedLastArr);
        maxElapsedHour = Math.max(maxElapsedHour, endElapsed);

        const totalDuration = endElapsed - startElapsed;

        // Build segments with widthPercent
        const segments: TimelineSegment[] = [];

        // Check-in
        if (firstDep !== undefined) {
          const ciDur = firstDep - checkInHour;
          if (ciDur > 0) {
            segments.push({
              type: 'checkin',
              startHour: checkInHour,
              endHour: firstDep,
              widthPercent: totalDuration > 0 ? (ciDur / totalDuration) * 100 : 0,
              performance: duty.avgPerformance,
            });
          }
        }

        for (const seg of duty.flightSegments) {
          const depH = parseTimeToHours(seg.departureTime);
          const arrH = parseTimeToHours(seg.arrivalTime);
          if (depH === undefined || arrH === undefined) continue;

          const adjustedArr = arrH < depH ? arrH + 24 : arrH;
          const segDur = adjustedArr - depH;
          const perf = seg.performance ?? duty.avgPerformance;

          segments.push({
            type: seg.isDeadhead ? 'ground' : 'flight',
            flightNumber: seg.flightNumber,
            departure: seg.departure,
            arrival: seg.arrival,
            startHour: depH,
            endHour: adjustedArr,
            widthPercent: totalDuration > 0 ? (segDur / totalDuration) * 100 : 0,
            performance: perf,
            activityCode: seg.activityCode,
            isDeadhead: seg.isDeadhead,
            phases: seg.isDeadhead ? undefined : buildFlightPhases(perf, duty.landingPerformance),
          });
        }

        const slices = splitElapsedAcrossRows(startElapsed, endElapsed);
        for (const s of slices) {
          dutyBars.push({ ...s, duty, segments });
        }

        // FDP marker
        if (duty.maxFdpHours) {
          const fdpElapsed = startElapsed + duty.maxFdpHours;
          const fdpRow = Math.floor(fdpElapsed / 24);
          const fdpHourInRow = fdpElapsed - fdpRow * 24;
          fdpMarkers.push({ rowIndex: fdpRow, hour: fdpHourInRow, maxFdp: duty.maxFdpHours, duty });
          maxElapsedHour = Math.max(maxElapsedHour, fdpElapsed);
        }
      }
    }

    // ---- Sleep bars ----
    const est = duty.sleepEstimate;
    if (est && est.sleepStrategy !== 'ulr_pre_duty') {
      const base = baseSleepFields(est, duty);

      let startElapsed: number | undefined;
      let endElapsed: number | undefined;

      // Path 1: home-TZ precomputed
      if (
        est.sleepStartDayHomeTz != null &&
        est.sleepStartHourHomeTz != null &&
        est.sleepEndDayHomeTz != null &&
        est.sleepEndHourHomeTz != null
      ) {
        startElapsed = dayHourToElapsed(est.sleepStartDayHomeTz, est.sleepStartHourHomeTz);
        endElapsed = dayHourToElapsed(est.sleepEndDayHomeTz, est.sleepEndHourHomeTz);
      }

      // Fallback: ISO direct parse
      if (startElapsed == null && est.sleepStartIso && est.sleepEndIso) {
        const sp = parseIsoDirectly(est.sleepStartIso);
        const ep = parseIsoDirectly(est.sleepEndIso);
        if (sp && ep) {
          startElapsed = dayHourToElapsed(sp.dayOfMonth, sp.hour);
          endElapsed = dayHourToElapsed(ep.dayOfMonth, ep.hour);
        }
      }

      // Fallback: HH:mm
      if (startElapsed == null && est.sleepStartTime && est.sleepEndTime) {
        const sH = parseTimeToHours(est.sleepStartTime);
        const eH = parseTimeToHours(est.sleepEndTime);
        const dom = dutyDayOfMonth(duty);
        if (sH !== undefined && eH !== undefined) {
          startElapsed = dayHourToElapsed(dom, sH);
          endElapsed = dayHourToElapsed(dom, eH);
        }
      }

      if (startElapsed != null && endElapsed != null) {
        if (endElapsed <= startElapsed) endElapsed += 24; // overnight
        maxElapsedHour = Math.max(maxElapsedHour, endElapsed);

        const slices = splitElapsedAcrossRows(startElapsed, endElapsed);
        for (const s of slices) {
          sleepBars.push({ ...base, ...s });
        }
      }
    }

    // ---- In-flight rest bars ----
    for (const block of duty.inflightRestBlocks) {
      let startElapsed: number | undefined;
      let endElapsed: number | undefined;

      // Prefer home-TZ precomputed
      if (
        block.startDayHomeTz != null &&
        block.startHourHomeTz != null &&
        block.endDayHomeTz != null &&
        block.endHourHomeTz != null
      ) {
        startElapsed = dayHourToElapsed(block.startDayHomeTz, block.startHourHomeTz);
        endElapsed = dayHourToElapsed(block.endDayHomeTz, block.endHourHomeTz);
      }

      // Fallback: UTC ISO
      if (startElapsed == null && block.startUtc && block.endUtc) {
        const s = utcDayHour(block.startUtc);
        const e = utcDayHour(block.endUtc);
        startElapsed = dayHourToElapsed(s.day, s.hour);
        endElapsed = dayHourToElapsed(e.day, e.hour);
      }

      if (startElapsed != null && endElapsed != null) {
        if (endElapsed <= startElapsed) endElapsed += 24;
        maxElapsedHour = Math.max(maxElapsedHour, endElapsed);

        const slices = splitElapsedAcrossRows(startElapsed, endElapsed);
        for (const s of slices) {
          irBars.push({
            rowIndex: s.rowIndex,
            startHour: s.startHour,
            endHour: s.endHour,
            durationHours: block.durationHours,
            effectiveSleepHours: block.effectiveSleepHours,
            isDuringWocl: block.isDuringWocl,
            crewSet: block.crewSet,
            relatedDuty: duty,
          });
        }
      }
    }
  }

  // ---- Rest day sleep ----
  if (restDaysSleep) {
    for (const restDay of restDaysSleep) {
      const pseudoDuty = createRestDayPseudoDuty(restDay);
      for (const block of restDay.sleepBlocks) {
        let startElapsed: number | undefined;
        let endElapsed: number | undefined;

        // Path 1: home-TZ precomputed
        if (
          block.sleepStartDayHomeTz != null &&
          block.sleepStartHourHomeTz != null &&
          block.sleepEndDayHomeTz != null &&
          block.sleepEndHourHomeTz != null
        ) {
          startElapsed = dayHourToElapsed(block.sleepStartDayHomeTz, block.sleepStartHourHomeTz);
          endElapsed = dayHourToElapsed(block.sleepEndDayHomeTz, block.sleepEndHourHomeTz);
        }

        // Fallback: ISO direct parse
        if (startElapsed == null && block.sleepStartIso && block.sleepEndIso) {
          const sp = parseIsoDirectly(block.sleepStartIso);
          const ep = parseIsoDirectly(block.sleepEndIso);
          if (sp && ep) {
            startElapsed = dayHourToElapsed(sp.dayOfMonth, sp.hour);
            endElapsed = dayHourToElapsed(ep.dayOfMonth, ep.hour);
          }
        }

        if (startElapsed != null && endElapsed != null) {
          if (endElapsed <= startElapsed) endElapsed += 24;
          maxElapsedHour = Math.max(maxElapsedHour, endElapsed);

          const baseFields: Omit<TimelineSleepBar, 'rowIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'> = {
            recoveryScore: (block.effectiveHours / 8) * 100,
            effectiveSleep: block.effectiveHours,
            sleepEfficiency: restDay.sleepEfficiency,
            sleepStrategy: restDay.strategyType,
            isPreDuty: false,
            relatedDuty: pseudoDuty,
            originalStartHour: block.sleepStartHourHomeTz ?? block.sleepStartHour,
            originalEndHour: block.sleepEndHourHomeTz ?? block.sleepEndHour,
            sleepStartZulu: isoToZulu(block.sleepStartIso) ?? undefined,
            sleepEndZulu: isoToZulu(block.sleepEndIso) ?? undefined,
            qualityFactors: restDay.qualityFactors,
            explanation: restDay.explanation,
            confidenceBasis: restDay.confidenceBasis,
            confidence: restDay.confidence,
            references: restDay.references,
          };

          const slices = splitElapsedAcrossRows(startElapsed, endElapsed);
          for (const s of slices) {
            sleepBars.push({ ...baseFields, ...s });
          }
        }
      }
    }
  }

  // ---- WOCL bands (DYNAMIC per row, shifted by circadian phase) ----
  const totalRows = Math.max(1, Math.ceil(maxElapsedHour / 24));
  const woclBands: WoclBand[] = [];

  for (let row = 0; row < totalRows; row++) {
    // Map row back to approximate day-of-month for shift lookup
    const approxDay = row + 1; // row 0 = day 1
    const shift = circadianShiftByDay.get(Math.min(approxDay, daysInMonth)) ?? 0;

    let shiftedStart = WOCL_START + shift;
    let shiftedEnd = WOCL_END + shift;

    // Wrap around [0, 24)
    shiftedStart = ((shiftedStart % 24) + 24) % 24;
    shiftedEnd = ((shiftedEnd % 24) + 24) % 24;

    if (shiftedStart < shiftedEnd) {
      woclBands.push({ rowIndex: row, startHour: shiftedStart, endHour: shiftedEnd });
    } else {
      // Wraps midnight: two bands
      woclBands.push({ rowIndex: row, startHour: shiftedStart, endHour: 24 });
      woclBands.push({ rowIndex: row, startHour: 0, endHour: shiftedEnd });
    }
  }

  // ---- Row labels ----
  const rowLabels: RowLabel[] = [];
  const dutyBarRowSet = new Set(dutyBars.map(b => b.rowIndex));

  for (let row = 0; row < totalRows; row++) {
    const approxDay = row + 1;
    const dayResult = approxDay <= daysInMonth ? getDayWarnings(duties, approxDay) : null;

    // Date range for this row
    const rowStartDate = addDays(monthStart, row);

    // Circadian annotation
    const shift = circadianShiftByDay.get(Math.min(approxDay, daysInMonth)) ?? 0;
    let circadianAnnotation: string | undefined;
    if (Math.abs(shift) > 0.5) {
      const direction = shift > 0 ? 'E' : 'W';
      const sign = shift > 0 ? '+' : '';
      circadianAnnotation = `\u2192${direction} ${sign}${shift.toFixed(1)}h`;
    }

    rowLabels.push({
      rowIndex: row,
      label: `Day ${row + 1} (${format(rowStartDate, 'MMM d')})`,
      date: rowStartDate,
      hasDuty: dutyBarRowSet.has(row),
      risk: dayResult?.risk,
      warnings: dayResult?.warnings ?? [],
      circadianAnnotation,
    });
  }

  return {
    variant: 'elapsed',
    dutyBars,
    sleepBars: deduplicateTimelineBars(sleepBars),
    inflightRestBars: irBars,
    fdpMarkers,
    woclBands,
    rowLabels,
    totalRows,
    xAxisLabel: 'Hours (Elapsed)',
  };
}
