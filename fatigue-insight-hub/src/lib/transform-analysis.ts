/**
 * Transform raw API response (snake_case) into frontend AnalysisResults (camelCase).
 *
 * Extracted from Index.tsx to keep the component thin and enable reuse
 * from the TanStack Query mutation hook.
 */

import { AnalysisResults, DutyAnalysis, PilotSettings } from '@/types/fatigue';
import { AnalysisResult, Duty, SleepEstimate, DutySegment } from '@/lib/api-client';
import { format, parseISO } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────

function isoToHHmm(iso: string): string {
  if (!iso) return '';
  if (iso.length >= 16 && iso.includes('T')) return iso.slice(11, 16);
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
}

function isoToZulu(iso: string): string {
  const hhmm = isoToHHmm(iso);
  return hhmm ? `${hhmm}Z` : '';
}

function parseTimeToMinutes(t: string | undefined): number | null {
  if (!t) return null;
  const isoMatch = t.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const h = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
  }
  const parts = t.split(':').map(Number);
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

function computeSegmentBlockHours(seg: {
  block_hours?: number;
  departure_time_local?: string;
  arrival_time_local?: string;
  departure_time?: string;
  arrival_time?: string;
}): number {
  if (typeof seg.block_hours === 'number' && Number.isFinite(seg.block_hours) && seg.block_hours > 0)
    return seg.block_hours;
  const dep = parseTimeToMinutes(seg.departure_time_local) ?? parseTimeToMinutes(seg.departure_time);
  const arr = parseTimeToMinutes(seg.arrival_time_local) ?? parseTimeToMinutes(seg.arrival_time);
  if (dep == null || arr == null) return 0;
  let diff = arr - dep;
  if (diff < 0) diff += 24 * 60;
  return Math.max(0, diff / 60);
}

/**
 * Per-segment performance interpolation based on temporal position within duty.
 * Accounts for cumulative fatigue and time-on-task degradation.
 */
function calculateSegmentPerformances(duty: {
  segments: Array<{ departure_time: string; arrival_time: string; block_hours?: number }>;
  report_time_utc: string;
  min_performance: number;
  avg_performance: number;
  landing_performance: number | null;
  duty_hours: number;
}): number[] {
  if (duty.segments.length === 0) return [];
  if (duty.segments.length === 1) return [duty.avg_performance];

  const parseIsoToDate = (iso: string): Date | null => {
    try { return parseISO(iso); } catch { return null; }
  };

  const reportTime = parseIsoToDate(duty.report_time_utc);
  if (!reportTime) return duty.segments.map(() => duty.avg_performance);

  const segmentEndHours: number[] = [];
  let cumulativeHours = 0;

  duty.segments.forEach((seg) => {
    const arrivalTime = parseIsoToDate(seg.arrival_time);
    if (arrivalTime) {
      segmentEndHours.push((arrivalTime.getTime() - reportTime.getTime()) / (1000 * 60 * 60));
    } else {
      cumulativeHours += (seg.block_hours || 1) + 0.5;
      segmentEndHours.push(cumulativeHours);
    }
  });

  const finalLanding = duty.landing_performance ?? duty.min_performance;
  const totalDutyHours = duty.duty_hours;
  const performanceDrop = duty.avg_performance - finalLanding;
  const estimatedStartPerf = Math.min(100, duty.avg_performance + performanceDrop * 0.5);

  return segmentEndHours.map((hoursElapsed) => {
    const fraction = totalDutyHours > 0 ? hoursElapsed / totalDutyHours : 0;
    const performance = estimatedStartPerf - (estimatedStartPerf - finalLanding) * fraction;
    return Math.max(0, Math.min(100, performance));
  });
}

function parseIsoToDayHour(iso: string | undefined | null): { day: number; hour: number } | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return { day: Number(m[3]), hour: Number(m[4]) + Number(m[5]) / 60 };
  return null;
}

function transformSleepEstimate(sleep: SleepEstimate) {
  const firstBlock = sleep.sleep_blocks?.[0];
  const sleepStartIso = sleep.sleep_start_iso ?? firstBlock?.sleep_start_iso;
  const sleepEndIso = sleep.sleep_end_iso ?? firstBlock?.sleep_end_iso;

  let sleepStartDay = sleep.sleep_start_day ?? undefined;
  let sleepStartHour = sleep.sleep_start_hour ?? undefined;
  let sleepEndDay = sleep.sleep_end_day ?? undefined;
  let sleepEndHour = sleep.sleep_end_hour ?? undefined;

  const sleepStartDayHomeTz = sleep.sleep_start_day_home_tz ?? undefined;
  const sleepStartHourHomeTz = sleep.sleep_start_hour_home_tz ?? undefined;
  const sleepEndDayHomeTz = sleep.sleep_end_day_home_tz ?? undefined;
  const sleepEndHourHomeTz = sleep.sleep_end_hour_home_tz ?? undefined;
  const sleepStartTimeHomeTz = sleep.sleep_start_time_home_tz ?? undefined;
  const sleepEndTimeHomeTz = sleep.sleep_end_time_home_tz ?? undefined;
  const locationTimezone = sleep.location_timezone ?? undefined;
  const sleepEnvironment2 = sleep.environment ?? undefined;

  if (sleepStartDay == null && sleepStartIso) {
    const parsed = parseIsoToDayHour(sleepStartIso);
    if (parsed) { sleepStartDay = parsed.day; sleepStartHour = parsed.hour; }
  }
  if (sleepEndDay == null && sleepEndIso) {
    const parsed = parseIsoToDayHour(sleepEndIso);
    if (parsed) { sleepEndDay = parsed.day; sleepEndHour = parsed.hour; }
  }

  // Surface sleep blocks with UTC timestamps for what-if editing
  // and per-block home-TZ positioning for multi-block rendering
  const sleepBlocks = sleep.sleep_blocks?.map((b) => ({
    sleepStartUtc: b.sleep_start_utc ?? undefined,
    sleepEndUtc: b.sleep_end_utc ?? undefined,
    sleepType: b.sleep_type,
    durationHours: b.duration_hours,
    effectiveHours: b.effective_hours,
    sleepStartDayHomeTz: b.sleep_start_day_home_tz ?? undefined,
    sleepStartHourHomeTz: b.sleep_start_hour_home_tz ?? undefined,
    sleepEndDayHomeTz: b.sleep_end_day_home_tz ?? undefined,
    sleepEndHourHomeTz: b.sleep_end_hour_home_tz ?? undefined,
  }));

  return {
    totalSleepHours: sleep.total_sleep_hours,
    effectiveSleepHours: sleep.effective_sleep_hours,
    sleepEfficiency: sleep.sleep_efficiency,
    woclOverlapHours: sleep.wocl_overlap_hours,
    sleepStrategy: sleep.sleep_strategy,
    confidence: sleep.confidence,
    warnings: sleep.warnings,
    sleepStartTime: sleep.sleep_start_time,
    sleepEndTime: sleep.sleep_end_time,
    sleepStartIso,
    sleepEndIso,
    sleepStartDay,
    sleepStartHour,
    sleepEndDay,
    sleepEndHour,
    sleepStartDayHomeTz,
    sleepStartHourHomeTz,
    sleepEndDayHomeTz,
    sleepEndHourHomeTz,
    sleepStartTimeHomeTz,
    sleepEndTimeHomeTz,
    locationTimezone,
    environment: sleepEnvironment2,
    explanation: sleep.explanation,
    confidenceBasis: sleep.confidence_basis,
    qualityFactors: sleep.quality_factors,
    references: sleep.references,
    sleepBlocks,
  };
}

// ── Main transformer ─────────────────────────────────────────

export function transformAnalysisResult(
  result: AnalysisResult,
  fallbackMonth: Date,
): AnalysisResults {
  const analysisMonth =
    result.duties.length > 0 ? parseISO(result.duties[0].date) : fallbackMonth;

  const computedBlockHoursFromSegments = result.duties.reduce(
    (sum, d) => sum + d.segments.reduce((s, seg) => s + computeSegmentBlockHours(seg), 0),
    0,
  );

  return {
    generatedAt: new Date(),
    month: analysisMonth,
    analysisId: result.analysis_id || undefined,
    pilotId: result.pilot_id || undefined,
    pilotName: result.pilot_name || undefined,
    pilotBase: result.pilot_base || undefined,
    pilotAircraft: result.pilot_aircraft || undefined,
    statistics: {
      totalDuties: result.total_duties,
      totalSectors: result.total_sectors,
      totalDutyHours: result.total_duty_hours,
      totalBlockHours:
        Number.isFinite(result.total_block_hours) && result.total_block_hours > 0
          ? result.total_block_hours
          : computedBlockHoursFromSegments,
      highRiskDuties: result.high_risk_duties,
      criticalRiskDuties: result.critical_risk_duties,
      maxSleepDebt: result.max_sleep_debt,
      totalPinchEvents: result.total_pinch_events || 0,
      avgSleepPerNight: result.avg_sleep_per_night || 0,
      worstPerformance: result.worst_performance || 0,
      worstDutyId: result.worst_duty_id || undefined,
      totalUlrDuties: result.total_ulr_duties || 0,
      totalAugmentedDuties: result.total_augmented_duties || 0,
      ulrViolations: result.ulr_violations || [],
    },
    restDaysSleep: result.rest_days_sleep?.map((restDay) => ({
      date: parseISO(restDay.date),
      sleepBlocks: restDay.sleep_blocks.map((block) => ({
        sleepStartTime: block.sleep_start_time,
        sleepEndTime: block.sleep_end_time,
        sleepStartIso: block.sleep_start_iso,
        sleepEndIso: block.sleep_end_iso,
        sleepType: block.sleep_type,
        durationHours: block.duration_hours,
        effectiveHours: block.effective_hours,
        qualityFactor: block.quality_factor,
        sleepStartDayHomeTz: block.sleep_start_day_home_tz ?? undefined,
        sleepStartHourHomeTz: block.sleep_start_hour_home_tz ?? undefined,
        sleepEndDayHomeTz: block.sleep_end_day_home_tz ?? undefined,
        sleepEndHourHomeTz: block.sleep_end_hour_home_tz ?? undefined,
        sleepStartTimeHomeTz: block.sleep_start_time_home_tz ?? undefined,
        sleepEndTimeHomeTz: block.sleep_end_time_home_tz ?? undefined,
        locationTimezone: block.location_timezone ?? undefined,
        environment: block.environment ?? undefined,
        sleepStartTimeLocationTz: block.sleep_start_time_location_tz ?? undefined,
        sleepEndTimeLocationTz: block.sleep_end_time_location_tz ?? undefined,
        sleepStartDay: block.sleep_start_day ?? undefined,
        sleepStartHour: block.sleep_start_hour ?? undefined,
        sleepEndDay: block.sleep_end_day ?? undefined,
        sleepEndHour: block.sleep_end_hour ?? undefined,
      })),
      totalSleepHours: restDay.total_sleep_hours,
      effectiveSleepHours: restDay.effective_sleep_hours,
      sleepEfficiency: restDay.sleep_efficiency,
      strategyType: restDay.strategy_type,
      confidence: restDay.confidence,
      explanation: restDay.explanation,
      confidenceBasis: restDay.confidence_basis,
      qualityFactors: restDay.quality_factors,
      references: restDay.references,
    })),
    bodyClockTimeline: result.body_clock_timeline?.map((entry) => ({
      timestampUtc: entry.timestamp_utc,
      phaseShiftHours: entry.phase_shift_hours,
      referenceTimezone: entry.reference_timezone,
    })),
    duties: result.duties.map((duty) => {
      const segmentPerformances = calculateSegmentPerformances(duty);
      const sleep = duty.sleep_quality ?? duty.sleep_estimate;
      const sleepEnvironment = duty.sleep_environment ?? sleep?.sleep_environment;
      const sleepQuality = duty.sleep_quality_label ?? sleep?.sleep_quality_label;

      return {
        dutyId: duty.duty_id,
        date: parseISO(duty.date),
        dateString: duty.date,
        dayOfWeek: format(parseISO(duty.date), 'EEE'),
        reportTimeUtc: duty.report_time_utc,
        releaseTimeUtc: duty.release_time_utc,
        reportTimeLocal: duty.report_time_local,
        releaseTimeLocal: duty.release_time_local,
        dutyHours: duty.duty_hours ?? 0,
        blockHours: (duty.segments ?? []).reduce(
          (sum, seg) => sum + computeSegmentBlockHours(seg),
          0,
        ),
        sectors: duty.sectors ?? 0,
        minPerformance: duty.min_performance ?? 0,
        avgPerformance: duty.avg_performance ?? 0,
        landingPerformance: duty.landing_performance ?? duty.min_performance ?? 0,
        sleepDebt: duty.sleep_debt ?? 0,
        woclExposure: duty.wocl_hours ?? 0,
        priorSleep: duty.prior_sleep ?? 0,
        overallRisk: (duty.risk_level ?? 'unknown').toUpperCase() as
          | 'LOW'
          | 'MODERATE'
          | 'HIGH'
          | 'CRITICAL',
        minPerformanceRisk: (duty.risk_level ?? 'unknown').toUpperCase() as
          | 'LOW'
          | 'MODERATE'
          | 'HIGH'
          | 'CRITICAL',
        landingRisk: (duty.risk_level ?? 'unknown').toUpperCase() as
          | 'LOW'
          | 'MODERATE'
          | 'HIGH'
          | 'CRITICAL',
        smsReportable: duty.is_reportable,
        maxFdpHours: duty.max_fdp_hours,
        extendedFdpHours: duty.extended_fdp_hours,
        actualFdpHours: duty.actual_fdp_hours ?? undefined,
        usedDiscretion: duty.used_discretion,
        circadianPhaseShiftValue: duty.circadian_phase_shift ?? undefined,
        sleepEnvironment,
        sleepQuality,
        sleepEstimate: sleep ? transformSleepEstimate(sleep) : undefined,
        crewComposition: duty.crew_composition || 'standard',
        restFacilityClass: duty.rest_facility_class || null,
        isUlr: duty.is_ulr || false,
        acclimatizationState: duty.acclimatization_state || 'acclimatized',
        ulrCompliance: duty.ulr_compliance
          ? {
              isUlr: duty.ulr_compliance.is_ulr,
              fdpWithinLimit: duty.ulr_compliance.fdp_within_limit,
              maxPlannedFdp: duty.ulr_compliance.max_planned_fdp,
              restPeriodsValid: duty.ulr_compliance.rest_periods_valid,
              preUlrRestCompliant: duty.ulr_compliance.pre_ulr_rest_compliant,
              postUlrRestCompliant: duty.ulr_compliance.post_ulr_rest_compliant,
              monthlyUlrCount: duty.ulr_compliance.monthly_ulr_count,
              monthlyLimit: duty.ulr_compliance.monthly_limit,
              violations: duty.ulr_compliance.violations,
              warnings: duty.ulr_compliance.warnings,
            }
          : null,
        inflightRestBlocks: (duty.inflight_rest_blocks || []).map((block) => ({
          startUtc: block.start_utc,
          endUtc: block.end_utc,
          startHomeTz: block.start_home_tz ?? null,
          endHomeTz: block.end_home_tz ?? null,
          startDayHomeTz: block.start_day_home_tz ?? null,
          startHourHomeTz: block.start_hour_home_tz ?? null,
          endDayHomeTz: block.end_day_home_tz ?? null,
          endHourHomeTz: block.end_hour_home_tz ?? null,
          startIsoHomeTz: block.start_iso_home_tz ?? null,
          endIsoHomeTz: block.end_iso_home_tz ?? null,
          durationHours: block.duration_hours,
          effectiveSleepHours: block.effective_sleep_hours,
          qualityFactor: block.quality_factor ?? 1,
          environment: block.environment ?? '',
          crewMemberId: block.crew_member_id,
          crewSet: block.crew_set,
          isDuringWocl: block.is_during_wocl,
        })),
        returnToDeckPerformance: duty.return_to_deck_performance ?? null,
        preDutyAwakeHours: duty.pre_duty_awake_hours ?? 0,
        dutyType: duty.duty_type || 'flight',
        trainingCode: duty.training_code || undefined,
        trainingAnnotations: duty.training_annotations || undefined,
        // Cabin environment
        cabinAltitudeFt: duty.cabin_altitude_ft ?? null,
        aircraftType: duty.aircraft_type ?? null,
        // Seed timelinePoints from worst_point so PerformanceSummaryCard renders immediately
        timelinePoints: duty.worst_point ? [{
          hours_on_duty: duty.worst_point.hours_on_duty ?? 0,
          time_on_task_penalty: duty.worst_point.time_on_task_penalty ?? 0,
          sleep_inertia: duty.worst_point.sleep_inertia ?? 0,
          sleep_pressure: duty.worst_point.sleep_pressure ?? 0,
          circadian: duty.worst_point.circadian ?? 0,
          performance: duty.worst_point.performance,
          timestamp: duty.worst_point.timestamp,
          timestamp_local: duty.worst_point.timestamp_local,
          debt_penalty: duty.worst_point.debt_penalty,
          hypoxia_factor: duty.worst_point.hypoxia_factor,
          pvt_lapses: duty.worst_point.pvt_lapses,
          microsleep_probability: duty.worst_point.microsleep_probability,
        }] : undefined,
        flightSegments: (duty.segments ?? []).map((seg, idx) => ({
          flightNumber: seg.flight_number,
          departure: seg.departure,
          arrival: seg.arrival,
          departureTime: seg.departure_time_local,
          arrivalTime: seg.arrival_time_local,
          departureTimeUtc: isoToZulu(seg.departure_time),
          arrivalTimeUtc: isoToZulu(seg.arrival_time),
          blockHours: seg.block_hours,
          performance: segmentPerformances[idx] || duty.avg_performance,
          departureTimeAirportLocal: seg.departure_time_airport_local,
          arrivalTimeAirportLocal: seg.arrival_time_airport_local,
          departureTimezone: seg.departure_timezone,
          arrivalTimezone: seg.arrival_timezone,
          departureUtcOffset: seg.departure_utc_offset,
          arrivalUtcOffset: seg.arrival_utc_offset,
          lineTrainingCodes: seg.line_training_codes || undefined,
          aircraftType: seg.aircraft_type ?? null,
        })),
      } as DutyAnalysis;
    }),
    homeBaseTimezone: result.home_base_timezone ?? undefined,
  };
}
