/**
 * Pure transform functions for the grid-based roster calendar.
 *
 * Each function converts DutyAnalysis[] into a TimelineData object
 * consumed by the unified TimelineGrid renderer. No React, no hooks, no JSX.
 *
 * - homeBaseTransform()  -- positions bars using home-base local times
 * - utcTransform()       -- positions bars using UTC/Zulu times
 *
 * Colour comes only from model output: a sector's own band when the backend
 * reports it (segments[].kss_peak / risk_level), otherwise the duty peak band.
 * Nothing here interpolates or invents a sector or phase KSS.
 */

import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';

import type {
  TimelineData,
  TimelineDutyBar,
  TimelineSleepBar,
  TimelineIRBar,
  TimelineFdpMarker,
  TimelinePeakMarker,
  TimelineSegment,
  WoclBand,
  WmzBand,
  RowLabel,
} from '@/lib/timeline-types';

import {
  parseTimeToHours,
  isoToZulu,
  getRecoveryScore,
  isTrainingDuty,
  createRestDayPseudoDuty,
  deduplicateTimelineBars,
  splitOvernightBar,
  parseUtcTimeStr,
  DEFAULT_CHECK_IN_MINUTES,
  WOCL_START,
  WOCL_END,
  WMZ_START,
  WMZ_END,
} from '@/lib/fatigue-utils';

import { classifyKss, resolveKss, toUpperRisk, type RiskLevel } from '@/lib/risk-scale';
import { utcDayHour } from '@/lib/timezone-utils';

import type { DutyAnalysis, FlightSegment, RestDaySleep } from '@/types/fatigue';

type SleepFields = Omit<TimelineSleepBar, 'rowIndex' | 'startHour' | 'endHour' | 'isOvernightStart' | 'isOvernightContinuation'>;

// ---------------------------------------------------------------------------
// Shared helpers (internal)
// ---------------------------------------------------------------------------

/** Extract day-of-month from a DutyAnalysis (timezone-safe). */
function dutyDayOfMonth(duty: DutyAnalysis): number {
  if (duty.dateString) return Number(duty.dateString.split('-')[2]);
  return duty.date.getDate();
}

/** Duty peak KSS (backend max_kss, else the current model's index). */
function dutyPeak(duty: DutyAnalysis): number | null {
  return resolveKss(duty.maxKss, duty.minPerformance, duty.modelVersion);
}

/** Band of the duty peak: the fallback colour for every part of the duty. */
export function dutyBand(duty: DutyAnalysis): RiskLevel {
  return classifyKss(dutyPeak(duty));
}

/** A sector's own model band when supplied, else the duty peak band. */
export function sectorBand(seg: Pick<FlightSegment, 'riskLevel' | 'kssPeak'>, duty: DutyAnalysis): RiskLevel {
  if (seg.kssPeak != null) return classifyKss(seg.kssPeak);
  return seg.riskLevel ?? dutyBand(duty);
}

/**
 * Build TimelineSegments for a flight duty: check-in, sectors, ground
 * turnarounds and post-flight time, in continuous hours (> 24 after midnight)
 * so overnight duties can later be clipped per row slice.
 */
function buildSegments(
  duty: DutyAnalysis,
  checkInHour: number,
  dutyEndHour: number,
  times: (seg: FlightSegment) => [number | undefined, number | undefined],
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  const level = dutyBand(duty);
  let lastEndHour = checkInHour;

  if (duty.flightSegments.length > 0) {
    const [firstDepRaw] = times(duty.flightSegments[0]);
    if (firstDepRaw !== undefined) {
      const firstDep = firstDepRaw < checkInHour ? firstDepRaw + 24 : firstDepRaw;
      if (firstDep > checkInHour + 0.01) {
        segments.push({ type: 'checkin', startHour: checkInHour, endHour: firstDep, level, kss: null });
        lastEndHour = firstDep;
      }
    }
  }

  for (const seg of duty.flightSegments) {
    const [depH, arrH] = times(seg);
    if (depH === undefined || arrH === undefined) continue;

    const adjustedDep = depH < lastEndHour ? depH + 24 : depH;
    let adjustedArr = arrH < depH ? arrH + 24 : arrH;
    if (adjustedArr < adjustedDep) adjustedArr += 24;

    if (adjustedDep > lastEndHour + 0.01) {
      segments.push({ type: 'ground', startHour: lastEndHour, endHour: adjustedDep, level, kss: null });
    }

    segments.push({
      type: seg.isDeadhead ? 'ground' : 'flight',
      flightNumber: seg.flightNumber,
      departure: seg.departure,
      arrival: seg.arrival,
      startHour: adjustedDep,
      endHour: adjustedArr,
      level: seg.isDeadhead ? level : sectorBand(seg, duty),
      kss: seg.isDeadhead ? null : seg.kssPeak ?? null,
      activityCode: seg.activityCode,
      isDeadhead: seg.isDeadhead,
    });

    lastEndHour = adjustedArr;
  }

  const adjustedEnd = dutyEndHour < lastEndHour ? dutyEndHour + 24 : dutyEndHour;
  if (segments.length > 0 && adjustedEnd > lastEndHour + 0.01) {
    segments.push({ type: 'postflight', startHour: lastEndHour, endHour: adjustedEnd, level, kss: null });
  }

  return segments;
}

const localTimes = (seg: FlightSegment): [number | undefined, number | undefined] =>
  [parseTimeToHours(seg.departureTime), parseTimeToHours(seg.arrivalTime)];

const utcTimes = (seg: FlightSegment): [number | undefined, number | undefined] =>
  [parseUtcTimeStr(seg.departureTimeUtc) ?? undefined, parseUtcTimeStr(seg.arrivalTimeUtc) ?? undefined];

/**
 * Clip a full-duty segment array to a single overnight bar slice.
 *
 * Segments use continuous hours (e.g. 24.75 = 00:45 next day). The start
 * slice keeps [sliceStart, 24]; the continuation slice maps hours > 24 back
 * into 0..sliceEnd.
 */
function clipSegmentsToSlice(
  segments: TimelineSegment[],
  sliceStart: number,
  sliceEnd: number,
  isContinuation: boolean,
): TimelineSegment[] {
  const clipped: TimelineSegment[] = [];
  for (const seg of segments) {
    if (!isContinuation) {
      if (seg.endHour <= sliceStart || seg.startHour >= 24) continue;
      const s = Math.max(seg.startHour, sliceStart);
      const e = Math.min(seg.endHour, 24);
      if (e - s >= 0.01) clipped.push({ ...seg, startHour: s, endHour: e });
    } else {
      if (seg.endHour <= 24) continue;
      const s = Math.max(seg.startHour >= 24 ? seg.startHour - 24 : 0, 0);
      const e = Math.min(seg.endHour - 24, sliceEnd);
      if (e - s >= 0.01) clipped.push({ ...seg, startHour: s, endHour: e });
    }
  }
  return clipped;
}

/** A single training segment spanning the duty window, in the duty peak band. */
function buildTrainingSegment(duty: DutyAnalysis, startHour: number, endHour: number): TimelineSegment {
  return { type: 'training', startHour, endHour, level: dutyBand(duty), kss: null, activityCode: duty.trainingCode ?? null };
}

/**
 * Where the duty peak sits in the grid: `checkInHour` on `startRow` plus the
 * time from report to the model's peak (peak_time_utc). No marker without one.
 */
function peakMarker(duty: DutyAnalysis, startRow: number, checkInHour: number, maxRow: number): TimelinePeakMarker[] {
  const kss = dutyPeak(duty);
  const peak = Date.parse(duty.peakTimeUtc ?? '');
  const report = Date.parse(duty.reportTimeUtc ?? '');
  const release = Date.parse(duty.releaseTimeUtc ?? '');
  if (kss == null || !Number.isFinite(peak) || !Number.isFinite(report)) return [];
  const offset = (peak - report) / 3_600_000;
  const span = Number.isFinite(release) ? (release - report) / 3_600_000 : duty.dutyHours;
  if (offset < -0.01 || offset > span + 0.01) return [];
  const continuous = checkInHour + Math.max(0, offset);
  const rowIndex = startRow + Math.floor(continuous / 24);
  if (rowIndex < 1 || rowIndex > maxRow) return [];
  return [{ rowIndex, hour: continuous % 24, kss, level: classifyKss(kss), duty }];
}

/** Common sleep bar fields; per-block ISO timestamps and a unique blockKey when given. */
function baseSleepFields(
  est: NonNullable<DutyAnalysis['sleepEstimate']>,
  duty: DutyAnalysis,
  blockOverrides?: {
    blockIndex: number;
    block: NonNullable<NonNullable<DutyAnalysis['sleepEstimate']>['sleepBlocks']>[number];
  },
): SleepFields {
  const first = est.sleepBlocks?.[0];
  const block = blockOverrides?.block;
  const blockIdx = blockOverrides?.blockIndex ?? 0;
  return {
    recoveryScore: getRecoveryScore(est),
    // A block of a multi-block night (a nap, say) reports its own hours and window.
    effectiveSleep: block?.effectiveHours ?? est.effectiveSleepHours,
    sleepEfficiency: est.sleepEfficiency,
    sleepStrategy: est.sleepStrategy,
    sleepType: block?.sleepType ?? first?.sleepType,
    isPreDuty: false,
    relatedDuty: duty,
    originalStartHour: block?.sleepStartHourHomeTz ?? est.sleepStartHourHomeTz ?? est.sleepStartHour,
    originalEndHour: block?.sleepEndHourHomeTz ?? est.sleepEndHourHomeTz ?? est.sleepEndHour,
    sleepStartZulu: isoToZulu(block?.sleepStartUtc ?? est.sleepStartIso) ?? undefined,
    sleepEndZulu: isoToZulu(block?.sleepEndUtc ?? est.sleepEndIso) ?? undefined,
    qualityFactors: block?.qualityFactors ?? est.qualityFactors,
    explanation: est.explanation,
    confidenceBasis: est.confidenceBasis,
    confidence: est.confidence,
    references: est.references,
    woclOverlapHours: est.woclOverlapHours,
    sleepId: duty.dutyId,
    sleepStartIso: (block ?? first)?.sleepStartUtc ?? undefined,
    sleepEndIso: (block ?? first)?.sleepEndUtc ?? undefined,
    blockKey: duty.dutyId ? `${duty.dutyId}::${blockIdx}` : undefined,
    basis: (block ?? first)?.basis,
    source: (block ?? first)?.source,
  };
}

/** Sleep bar fields for a rest-day block (no duty). */
function restDaySleepFields(restDay: RestDaySleep, blockIdx: number, startHour: number, endHour: number): SleepFields {
  const block = restDay.sleepBlocks[blockIdx];
  return {
    recoveryScore: (block.effectiveHours / 8) * 100,
    effectiveSleep: block.effectiveHours,
    sleepEfficiency: restDay.sleepEfficiency,
    sleepStrategy: restDay.strategyType,
    sleepType: block.sleepType,
    isPreDuty: false,
    relatedDuty: createRestDayPseudoDuty(restDay),
    originalStartHour: startHour,
    originalEndHour: endHour,
    sleepStartZulu: isoToZulu(block.sleepStartIso) ?? undefined,
    sleepEndZulu: isoToZulu(block.sleepEndIso) ?? undefined,
    qualityFactors: block.qualityFactors ?? restDay.qualityFactors,
    explanation: restDay.explanation,
    confidenceBasis: restDay.confidenceBasis,
    confidence: restDay.confidence,
    references: restDay.references,
    blockKey: `rest::${format(restDay.date, 'yyyy-MM-dd')}::${blockIdx}`,
    sleepStartIso: block.sleepStartUtc ?? block.sleepStartIso,
    sleepEndIso: block.sleepEndUtc ?? block.sleepEndIso,
    basis: block.basis,
    source: block.source,
  };
}

/** Push a home-base sleep block, splitting at midnight when needed. */
function addDaySleepBar(
  bars: TimelineSleepBar[],
  fields: SleepFields,
  startDay: number,
  startHour: number,
  endDay: number,
  endHour: number,
  maxRow: number,
): void {
  if (startDay > maxRow || endDay < 1) return;
  if (startDay === endDay) {
    if (endHour <= startHour) {
      for (const s of splitOvernightBar(startDay, startHour, endHour, maxRow)) bars.push({ ...fields, ...s });
    } else {
      bars.push({ ...fields, rowIndex: startDay, startHour, endHour });
    }
    return;
  }
  if (startDay >= 1 && startDay <= maxRow) {
    bars.push({ ...fields, rowIndex: startDay, startHour, endHour: 24, isOvernightStart: true });
  }
  if (endDay >= 1 && endDay <= maxRow) {
    bars.push({ ...fields, rowIndex: endDay, startHour: 0, endHour, isOvernightContinuation: true });
  }
}

/**
 * Row labels for a calendar month (home base and UTC): the highest duty peak
 * starting that day, with its band. Notes such as WOCL or sleep live in the
 * duty tooltip, not the label column.
 */
function buildMonthRowLabels(duties: DutyAnalysis[], month: Date): RowLabel[] {
  const dim = getDaysInMonth(month);
  const monthStart = startOfMonth(month);
  const labels: RowLabel[] = [];

  for (let d = 1; d <= dim; d++) {
    const dateObj = addDays(monthStart, d - 1);
    const dayDuties = duties.filter((duty) => dutyDayOfMonth(duty) === d);
    const peaks = dayDuties.map(dutyPeak).filter((k): k is number => k != null);
    const peakKss = peaks.length ? Math.max(...peaks) : null;
    const level = dayDuties.length ? classifyKss(peakKss) : undefined;
    labels.push({
      rowIndex: d,
      label: format(dateObj, 'EEE d'),
      date: dateObj,
      hasDuty: dayDuties.length > 0,
      risk: level ? toUpperRisk(level) : undefined,
      peakKss,
      level,
      warnings: [],
    });
  }

  return labels;
}

/** Duty bars (one per row slice) for a duty starting at `startHour` on `startRow`. */
function dutySlices(
  duty: DutyAnalysis,
  startRow: number,
  startHour: number,
  endHour: number,
  segments: TimelineSegment[],
  maxRow: number,
  training: boolean,
): TimelineDutyBar[] {
  const overnight = endHour < startHour || (!training && startHour >= 16 && endHour < 10);
  if (!overnight) return [{ rowIndex: startRow, startHour, endHour, duty, segments }];
  return splitOvernightBar(startRow, startHour, endHour, maxRow).map((s) => ({
    ...s,
    duty,
    segments: training
      ? [buildTrainingSegment(duty, s.startHour, s.endHour)]
      : clipSegmentsToSlice(segments, s.startHour, s.endHour, !!s.isOvernightContinuation),
  }));
}

/** FDP limit marker, on the start row or the following one. */
function fdpMarker(duty: DutyAnalysis, row: number, checkInHour: number, maxRow: number): TimelineFdpMarker[] {
  if (!duty.maxFdpHours) return [];
  const end = checkInHour + duty.maxFdpHours;
  if (end <= 24) return [{ rowIndex: row, hour: end, maxFdp: duty.maxFdpHours, duty }];
  return row + 1 <= maxRow ? [{ rowIndex: row + 1, hour: end - 24, maxFdp: duty.maxFdpHours, duty }] : [];
}

const STATIC_BANDS = () => ({
  woclBands: [{ rowIndex: -1, startHour: WOCL_START, endHour: WOCL_END }] as WoclBand[],
  wmzBands: [{ rowIndex: -1, startHour: WMZ_START, endHour: WMZ_END }] as WmzBand[],
});

// ===========================================================================
// 1. HOME BASE TRANSFORM
// ===========================================================================

/**
 * Transform DutyAnalysis[] into TimelineData for the home-base local-time view.
 *
 * Duty and sleep bars use precomputed home-base fields from the backend.
 * Sleep bars without them are skipped (no guessing).
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
  const peakMarkers: TimelinePeakMarker[] = [];

  for (const duty of duties) {
    const dayOfMonth = dutyDayOfMonth(duty);

    // ---- Duty bars ----
    if (isTrainingDuty(duty)) {
      const startH = parseTimeToHours(duty.reportTimeLocal);
      const endH = parseTimeToHours(duty.releaseTimeLocal);
      if (startH !== undefined && endH !== undefined) {
        dutyBars.push(...dutySlices(duty, dayOfMonth, startH, endH, [buildTrainingSegment(duty, startH, endH)], daysInMonth, true));
        peakMarkers.push(...peakMarker(duty, dayOfMonth, startH, daysInMonth));
      }
    } else if (duty.flightSegments.length > 0) {
      const [firstDep] = localTimes(duty.flightSegments[0]);
      const [, lastArr] = localTimes(duty.flightSegments[duty.flightSegments.length - 1]);
      const reportH = parseTimeToHours(duty.reportTimeLocal);
      const releaseH = parseTimeToHours(duty.releaseTimeLocal);
      const checkInHour = reportH ?? (firstDep !== undefined ? firstDep - DEFAULT_CHECK_IN_MINUTES / 60 : undefined);
      const endHour = releaseH ?? lastArr;

      if (checkInHour !== undefined && endHour !== undefined) {
        const segments = buildSegments(duty, checkInHour, endHour, localTimes);
        dutyBars.push(...dutySlices(duty, dayOfMonth, checkInHour, endHour, segments, daysInMonth, false));
        fdpMarkers.push(...fdpMarker(duty, dayOfMonth, checkInHour, daysInMonth));
        peakMarkers.push(...peakMarker(duty, dayOfMonth, checkInHour, daysInMonth));
      }
    }

    // ---- Sleep bars (precomputed home-base positions only) ----
    const est = duty.sleepEstimate;
    if (est && est.sleepStrategy !== 'ulr_pre_duty') {
      // Every modelled block (main sleep and pre-duty naps) is drawn on its own.
      const blocksWithPos = (est.sleepBlocks ?? []).filter(
        (b) =>
          b.sleepStartDayHomeTz != null &&
          b.sleepStartHourHomeTz != null &&
          b.sleepEndDayHomeTz != null &&
          b.sleepEndHourHomeTz != null,
      );

      if (blocksWithPos.length >= 2) {
        blocksWithPos.forEach((block, blockIdx) => {
          const fields = baseSleepFields(est, duty, { blockIndex: blockIdx, block });
          addDaySleepBar(sleepBars, fields, block.sleepStartDayHomeTz!, block.sleepStartHourHomeTz!,
            block.sleepEndDayHomeTz!, block.sleepEndHourHomeTz!, daysInMonth);
        });
      } else if (
        est.sleepStartDayHomeTz != null &&
        est.sleepStartHourHomeTz != null &&
        est.sleepEndDayHomeTz != null &&
        est.sleepEndHourHomeTz != null
      ) {
        addDaySleepBar(sleepBars, baseSleepFields(est, duty), est.sleepStartDayHomeTz, est.sleepStartHourHomeTz,
          est.sleepEndDayHomeTz, est.sleepEndHourHomeTz, daysInMonth);
      }
    }

    // ---- In-flight rest bars (home-TZ precomputed) ----
    for (const block of duty.inflightRestBlocks) {
      if (
        block.startDayHomeTz == null ||
        block.startHourHomeTz == null ||
        block.endDayHomeTz == null ||
        block.endHourHomeTz == null
      ) continue;
      for (const s of splitOvernightBar(block.startDayHomeTz, block.startHourHomeTz, block.endHourHomeTz, daysInMonth)) {
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

  // ---- Rest-day sleep ----
  for (const restDay of restDaysSleep ?? []) {
    restDay.sleepBlocks.forEach((block, blockIdx) => {
      if (
        block.sleepStartDayHomeTz == null ||
        block.sleepStartHourHomeTz == null ||
        block.sleepEndDayHomeTz == null ||
        block.sleepEndHourHomeTz == null
      ) return;
      const fields = restDaySleepFields(restDay, blockIdx, block.sleepStartHourHomeTz, block.sleepEndHourHomeTz);
      addDaySleepBar(sleepBars, fields, block.sleepStartDayHomeTz, block.sleepStartHourHomeTz,
        block.sleepEndDayHomeTz, block.sleepEndHourHomeTz, daysInMonth);
    });
  }

  return {
    variant: 'homebase',
    dutyBars,
    sleepBars: deduplicateTimelineBars(sleepBars),
    inflightRestBars: irBars,
    fdpMarkers,
    peakMarkers,
    ...STATIC_BANDS(),
    rowLabels: buildMonthRowLabels(duties, month),
    totalRows: daysInMonth,
    xAxisLabel: 'Time of day (home base)',
  };
}

// ===========================================================================
// 2. UTC TRANSFORM
// ===========================================================================

/** Add a UTC sleep bar, handling same-day, overnight and multi-day blocks. */
function addUtcSleepBar(
  bars: TimelineSleepBar[],
  startDay: number,
  startHour: number,
  endDay: number,
  endHour: number,
  fields: SleepFields,
  maxRow: number,
): void {
  if (startDay > maxRow || endDay < 1) return;

  if (startDay === endDay) {
    if (endHour <= startHour && endHour > 0) {
      for (const s of splitOvernightBar(startDay, startHour, endHour, maxRow)) bars.push({ ...fields, ...s });
    } else if (startDay >= 1 && startDay <= maxRow) {
      bars.push({ ...fields, rowIndex: startDay, startHour, endHour: endHour > startHour ? endHour : 24 });
    }
    return;
  }
  if (startDay >= 1 && startDay <= maxRow) {
    bars.push({ ...fields, rowIndex: startDay, startHour, endHour: 24, isOvernightStart: true });
  }
  for (let d = startDay + 1; d < endDay; d++) {
    if (d >= 1 && d <= maxRow) bars.push({ ...fields, rowIndex: d, startHour: 0, endHour: 24 });
  }
  if (endDay >= 1 && endDay <= maxRow && endHour > 0) {
    bars.push({ ...fields, rowIndex: endDay, startHour: 0, endHour, isOvernightContinuation: true });
  }
}

/**
 * Transform DutyAnalysis[] into TimelineData for the UTC (Zulu) view.
 *
 * Duty bars use UTC sector times. Sleep bars prefer ISO timestamps converted
 * to UTC day/hour, falling back to location-TZ precomputed fields.
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
  const peakMarkers: TimelinePeakMarker[] = [];

  for (const duty of duties) {
    const dayOfMonth = dutyDayOfMonth(duty);

    // ---- Duty bars ----
    if (isTrainingDuty(duty)) {
      if (duty.reportTimeUtc && duty.releaseTimeUtc) {
        const start = utcDayHour(duty.reportTimeUtc);
        const end = utcDayHour(duty.releaseTimeUtc);
        dutyBars.push(...dutySlices(duty, start.day, start.hour, end.hour, [buildTrainingSegment(duty, start.hour, end.hour)], daysInMonth, true));
        peakMarkers.push(...peakMarker(duty, start.day, start.hour, daysInMonth));
      }
    } else if (duty.flightSegments.length > 0) {
      const [firstDepUtc] = utcTimes(duty.flightSegments[0]);
      const [, lastArrUtc] = utcTimes(duty.flightSegments[duty.flightSegments.length - 1]);

      let checkInDay = dayOfMonth;
      let checkInHour: number | undefined;
      if (duty.reportTimeUtc && /^\d{4}-\d{2}-\d{2}T/.test(duty.reportTimeUtc)) {
        const parsed = utcDayHour(duty.reportTimeUtc);
        checkInDay = parsed.day;
        checkInHour = parsed.hour;
      }
      if (checkInHour === undefined && firstDepUtc !== undefined) {
        checkInHour = firstDepUtc - DEFAULT_CHECK_IN_MINUTES / 60;
        if (checkInHour < 0) checkInHour += 24;
      }

      if (checkInHour !== undefined && lastArrUtc !== undefined) {
        const endHour = lastArrUtc;
        const segments = buildSegments(duty, checkInHour, endHour, utcTimes);
        const overnight = endHour < checkInHour;
        if (overnight) {
          for (const s of splitOvernightBar(checkInDay, checkInHour, endHour, daysInMonth)) {
            dutyBars.push({ ...s, duty, segments: clipSegmentsToSlice(segments, s.startHour, s.endHour, !!s.isOvernightContinuation) });
          }
        } else {
          dutyBars.push({ rowIndex: checkInDay, startHour: checkInHour, endHour, duty, segments });
        }
        fdpMarkers.push(...fdpMarker(duty, checkInDay, checkInHour, daysInMonth));
        peakMarkers.push(...peakMarker(duty, checkInDay, checkInHour, daysInMonth));
      }
    }

    // ---- Sleep bars (ISO → UTC preferred, fallback to location-TZ precomputed) ----
    const est = duty.sleepEstimate;
    if (est && est.sleepStrategy !== 'ulr_pre_duty') {
      const blocksWithUtc = (est.sleepBlocks ?? []).filter((b) => b.sleepStartUtc && b.sleepEndUtc);

      if (blocksWithUtc.length >= 2) {
        blocksWithUtc.forEach((block, blockIdx) => {
          const fields = baseSleepFields(est, duty, { blockIndex: blockIdx, block });
          const s = utcDayHour(block.sleepStartUtc!);
          const e = utcDayHour(block.sleepEndUtc!);
          addUtcSleepBar(sleepBars, s.day, s.hour, e.day, e.hour, fields, daysInMonth);
        });
      } else {
        let startDay: number | undefined;
        let startHour: number | undefined;
        let endDay: number | undefined;
        let endHour: number | undefined;

        if (est.sleepStartIso && est.sleepEndIso) {
          const s = utcDayHour(est.sleepStartIso);
          const e = utcDayHour(est.sleepEndIso);
          [startDay, startHour, endDay, endHour] = [s.day, s.hour, e.day, e.hour];
        } else if (est.sleepStartDay != null && est.sleepEndDay != null) {
          [startDay, startHour, endDay, endHour] = [est.sleepStartDay, est.sleepStartHour ?? 0, est.sleepEndDay, est.sleepEndHour ?? 0];
        }

        if (startDay != null && startHour != null && endDay != null && endHour != null) {
          addUtcSleepBar(sleepBars, startDay, startHour, endDay, endHour, baseSleepFields(est, duty), daysInMonth);
        }
      }
    }

    // ---- In-flight rest bars (UTC ISO) ----
    for (const block of duty.inflightRestBlocks) {
      if (!block.startUtc || !block.endUtc) continue;
      const start = utcDayHour(block.startUtc);
      const end = utcDayHour(block.endUtc);
      for (const s of splitOvernightBar(start.day, start.hour, end.hour, daysInMonth)) {
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

  // ---- Rest-day sleep ----
  for (const restDay of restDaysSleep ?? []) {
    restDay.sleepBlocks.forEach((block, blockIdx) => {
      let startDay: number | undefined;
      let startHour: number | undefined;
      let endDay: number | undefined;
      let endHour: number | undefined;

      if (block.sleepStartIso && block.sleepEndIso) {
        const s = utcDayHour(block.sleepStartIso);
        const e = utcDayHour(block.sleepEndIso);
        [startDay, startHour, endDay, endHour] = [s.day, s.hour, e.day, e.hour];
      } else if (block.sleepStartDay != null && block.sleepEndDay != null) {
        [startDay, startHour, endDay, endHour] = [block.sleepStartDay, block.sleepStartHour ?? 0, block.sleepEndDay, block.sleepEndHour ?? 0];
      }

      if (startDay != null && startHour != null && endDay != null && endHour != null) {
        addUtcSleepBar(sleepBars, startDay, startHour, endDay, endHour, restDaySleepFields(restDay, blockIdx, startHour, endHour), daysInMonth);
      }
    });
  }

  return {
    variant: 'utc',
    dutyBars,
    sleepBars: deduplicateTimelineBars(sleepBars),
    inflightRestBars: irBars,
    fdpMarkers,
    peakMarkers,
    ...STATIC_BANDS(),
    rowLabels: buildMonthRowLabels(duties, month),
    totalRows: daysInMonth,
    xAxisLabel: 'Time of day (UTC)',
  };
}
