/**
 * Transform raw API response (snake_case) into frontend AnalysisResults (camelCase).
 *
 * Extracted from Index.tsx to keep the component thin and enable reuse
 * from the TanStack Query mutation hook.
 */

import { AnalysisResults, DutyAnalysis, NapHabit, PilotSettings, CompanyDetection, TimelinePoint, EasaFinding, EasaSummary, StandbyPeriod } from '@/types/fatigue';
import { AnalysisResult, Duty, SleepEstimate, DutySegment } from '@/lib/api-client';
import { format, parseISO } from 'date-fns';
import { classifyKss, isKssEngine, kssToIndex, normalizeRiskLevel, roundKss, toUpperRisk, type RiskLevel } from '@/lib/risk-scale';

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

/** A KSS value from the API, or null when absent or out of range. */
function kssOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 9 ? v : null;
}

/**
 * Per-sector sleepiness exactly as the model reports it (segments[].kss_peak,
 * kss_at_arrival, risk_level). Older analyses have none: the sector then
 * carries no value of its own and views fall back to the duty peak. Nothing is
 * interpolated here.
 */
export function sectorKss(seg: Pick<DutySegment, 'kss_peak' | 'kss_at_arrival' | 'risk_level'>): {
  kssPeak: number | null;
  kssAtArrival: number | null;
  riskLevel: RiskLevel | null;
} {
  const kssPeak = kssOrNull(seg.kss_peak);
  const kssAtArrival = kssOrNull(seg.kss_at_arrival);
  const backendLevel = normalizeRiskLevel(seg.risk_level);
  const riskLevel = kssPeak != null ? classifyKss(kssPeak) : backendLevel !== 'unknown' ? backendLevel : null;
  return { kssPeak, kssAtArrival, riskLevel };
}

/**
 * When the duty peak occurs: the backend's peak_time_utc, else the worst point's
 * timestamp when that point is the peak (same KSS to one decimal).
 */
export function dutyPeakTime(duty: Pick<Duty, 'peak_time_utc' | 'max_kss' | 'worst_point'>): string | undefined {
  if (typeof duty.peak_time_utc === 'string' && Number.isFinite(Date.parse(duty.peak_time_utc))) return duty.peak_time_utc;
  const wp = duty.worst_point;
  const max = kssOrNull(duty.max_kss);
  const wpKss = kssOrNull(wp?.kss);
  if (wp?.timestamp && max != null && wpKss != null && roundKss(max) === roundKss(wpKss) && Number.isFinite(Date.parse(wp.timestamp))) {
    return wp.timestamp;
  }
  return undefined;
}

function isNapHabit(v: unknown): v is NapHabit {
  return v === 'usually' || v === 'sometimes' || v === 'rarely';
}

/** The backend's analysis assumptions, when present. */
export function mapAssumptions(raw: AnalysisResult['assumptions']): AnalysisResults['assumptions'] {
  if (!raw) return undefined;
  const napHabit = typeof raw.nap_habit === 'string' ? raw.nap_habit.toLowerCase() : undefined;
  const out: NonNullable<AnalysisResults['assumptions']> = {};
  if (isNapHabit(napHabit)) out.napHabit = napHabit;
  if (typeof raw.headline_risk_window === 'string' && raw.headline_risk_window) out.headlineRiskWindow = raw.headline_risk_window;
  return Object.keys(out).length ? out : undefined;
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

// ── Timeline points (GET /api/duty/{analysis_id}/{duty_id}) ──

const optNum = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Map one raw backend timeline point to the frontend TimelinePoint.
 * Shared by every component that fetches the duty detail endpoint so that
 * new fields (kss, kss_90, p_severe_sleepiness, hours_awake) reach all views.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTimelinePoint(pt: any): TimelinePoint {
  return {
    hours_on_duty: pt?.hours_on_duty ?? 0,
    // Factor form: 1.0 = no effect (constant since aerowake-4.0-kss)
    time_on_task_penalty: pt?.time_on_task_penalty ?? 1,
    sleep_inertia: pt?.sleep_inertia ?? 1,
    sleep_pressure: pt?.sleep_pressure ?? 0,
    circadian: pt?.circadian ?? 0,
    performance: pt?.performance,
    kss: optNum(pt?.kss),
    kss_90: optNum(pt?.kss_90),
    p_severe_sleepiness: optNum(pt?.p_severe_sleepiness),
    hours_awake: optNum(pt?.hours_awake),
    is_in_rest: pt?.is_in_rest ?? false,
    flight_phase: pt?.flight_phase ?? null,
    is_critical: pt?.is_critical ?? false,
    timestamp: pt?.timestamp,
    timestamp_local: pt?.timestamp_local,
    debt_penalty: pt?.debt_penalty,
    hypoxia_factor: pt?.hypoxia_factor,
    pvt_lapses: pt?.pvt_lapses,
    microsleep_probability: pt?.microsleep_probability,
  };
}

/** Map a raw duty-detail timeline array (or undefined). */
export function mapTimelinePoints(raw: unknown): TimelinePoint[] | undefined {
  return Array.isArray(raw) ? raw.map(mapTimelinePoint) : undefined;
}

// ── Main transformer ─────────────────────────────────────────

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

export function transformEasaFindings(raw: AnalysisResult['easa_findings']): EasaFinding[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({
      rule: String(f.rule ?? ''),
      reference: String(f.reference ?? ''),
      severity: f.severity === 'warning' ? 'warning' : 'info',
      title: String(f.title ?? ''),
      detail: String(f.detail ?? ''),
      windowStartUtc: f.window_start_utc ?? undefined,
      windowEndUtc: f.window_end_utc ?? undefined,
      value: num(f.value),
      limit: num(f.limit),
    }));
}

export function transformEasaSummary(raw: AnalysisResult['easa_summary']): EasaSummary | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const l = raw.limits ?? ({} as NonNullable<AnalysisResult['easa_summary']>['limits']);
  return {
    status: raw.status,
    coverage: raw.coverage,
    duty7dMax: num(raw.duty_7d_max) ?? 0,
    duty14dMax: num(raw.duty_14d_max) ?? 0,
    duty28dMax: num(raw.duty_28d_max) ?? 0,
    block28dMax: num(raw.block_28d_max) ?? 0,
    limits: {
      duty7d: num(l?.duty_7d) ?? 60,
      duty14d: num(l?.duty_14d) ?? 110,
      duty28d: num(l?.duty_28d) ?? 190,
      block28d: num(l?.block_28d) ?? 100,
    },
  };
}

export function transformStandbyPeriods(raw: AnalysisResult['standby_periods']): StandbyPeriod[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((p) => p && typeof p === 'object' && p.start_utc && p.end_utc)
    .map((p) => ({
      id: String(p.id ?? `${p.type}-${p.start_utc}`),
      type: p.type === 'airport_standby' ? 'airport_standby' : 'home_standby',
      code: String(p.code ?? ''),
      startUtc: p.start_utc,
      endUtc: p.end_utc,
      startHome: p.start_home ?? '',
      endHome: p.end_home ?? '',
      date: p.date ?? p.start_utc.slice(0, 10),
      countedDutyHours: num(p.counted_duty_hours) ?? 0,
    }));
}

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
    rosterId: result.roster_id || undefined,
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
      const sleep = duty.sleep_quality ?? duty.sleep_estimate;
      // Derive sleep environment from the first sleep block (backend sets 'home' or 'hotel')
      const blockEnv = sleep?.sleep_blocks?.[0]?.environment;
      const sleepEnvironment = duty.sleep_environment ?? blockEnv ?? undefined;
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
        riskThresholds: duty.risk_thresholds,
        modelVersion: duty.model_version,
        modelParameters: duty.model_parameters,
        priorSleep: duty.prior_sleep ?? 0,
        overallRisk: toUpperRisk(duty.risk_level),
        minPerformanceRisk: toUpperRisk(duty.risk_level),
        landingRisk: toUpperRisk(duty.risk_level),
        maxKss: duty.max_kss ?? undefined,
        peakTimeUtc: dutyPeakTime(duty),
        kssPeakFdp: kssOrNull(duty.kss_peak_fdp) ?? undefined,
        landingKss: duty.landing_kss ?? undefined,
        maxKss90: duty.max_kss_90 ?? undefined,
        maxPSevere: duty.max_p_severe_sleepiness ?? undefined,
        maxHoursAwake: duty.max_hours_awake ?? undefined,
        sleepDeficit7d: duty.sleep_deficit_7d
          ? {
              days: duty.sleep_deficit_7d.days,
              sleepHours: duty.sleep_deficit_7d.sleep_hours,
              needHours: duty.sleep_deficit_7d.need_hours,
              deficitHours: duty.sleep_deficit_7d.deficit_hours,
              band: duty.sleep_deficit_7d.band,
            }
          : undefined,
        smsReportable: duty.is_reportable,
        riskAdvisory: (duty.risk_advisory as 'routine' | 'monitor' | 'consider_reporting' | 'report_recommended') ?? (duty.is_reportable ? 'report_recommended' : 'routine'),
        maxFdpHours: duty.max_fdp_hours,
        extendedFdpHours: duty.extended_fdp_hours,
        actualFdpHours: duty.actual_fdp_hours ?? undefined,
        usedDiscretion: duty.used_discretion,
        circadianPhaseShiftValue: duty.circadian_phase_shift ?? undefined,
        sleepEnvironment,
        sleepQuality,
        sleepEstimate: sleep ? transformSleepEstimate(sleep) : undefined,
        crewComposition: duty.crew_composition || 'standard',
        ulrCrewSet: duty.ulr_crew_set || null,
        augmentationSuggested: duty.augmentation_suggested ?? false,
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
          source: block.source === 'planned' ? 'planned' : 'roster_ir',
          approvedPlan: block.approved_plan ?? null,
        })),
        returnToDeckPerformance: duty.return_to_deck_performance ?? null,
        preDutyAwakeHours: duty.pre_duty_awake_hours ?? 0,
        dutyType: duty.duty_type || 'flight',
        riskReasons: Array.isArray(duty.risk_reasons)
          ? duty.risk_reasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 3)
          : undefined,
        trainingCode: duty.training_code || undefined,
        trainingAnnotations: duty.training_annotations || undefined,
        // Cabin environment
        cabinAltitudeFt: duty.cabin_altitude_ft ?? null,
        aircraftType: duty.aircraft_type ?? null,
        // Seed timelinePoints from worst_point so PerformanceSummaryCard renders immediately
        timelinePoints: duty.worst_point ? [{
          hours_on_duty: duty.worst_point.hours_on_duty ?? 0,
          time_on_task_penalty: duty.worst_point.time_on_task_penalty ?? 1,
          sleep_inertia: duty.worst_point.sleep_inertia ?? 1,
          sleep_pressure: duty.worst_point.sleep_pressure ?? 0,
          circadian: duty.worst_point.circadian ?? 0,
          performance: duty.worst_point.performance,
          timestamp: duty.worst_point.timestamp,
          timestamp_local: duty.worst_point.timestamp_local,
          debt_penalty: duty.worst_point.debt_penalty,
          hypoxia_factor: duty.worst_point.hypoxia_factor,
          pvt_lapses: duty.worst_point.pvt_lapses,
          microsleep_probability: duty.worst_point.microsleep_probability,
          kss: duty.worst_point.kss,
          kss_90: duty.worst_point.kss_90,
          p_severe_sleepiness: duty.worst_point.p_severe_sleepiness,
          hours_awake: duty.worst_point.hours_awake,
        }] : undefined,
        flightSegments: (duty.segments ?? []).map((seg) => {
          const sector = sectorKss(seg);
          return {
          flightNumber: seg.flight_number,
          departure: seg.departure,
          arrival: seg.arrival,
          departureTime: seg.departure_time_local,
          arrivalTime: seg.arrival_time_local,
          departureTimeUtc: isoToZulu(seg.departure_time),
          arrivalTimeUtc: isoToZulu(seg.arrival_time),
          departureIso: seg.departure_time || undefined,
          arrivalIso: seg.arrival_time || undefined,
          blockHours: seg.block_hours,
          ...sector,
          performance: sector.kssAtArrival != null ? kssToIndex(sector.kssAtArrival) : undefined,
          departureTimeAirportLocal: seg.departure_time_airport_local,
          arrivalTimeAirportLocal: seg.arrival_time_airport_local,
          departureTimezone: seg.departure_timezone,
          arrivalTimezone: seg.arrival_timezone,
          departureUtcOffset: seg.departure_utc_offset,
          arrivalUtcOffset: seg.arrival_utc_offset,
          lineTrainingCodes: seg.line_training_codes || undefined,
          aircraftType: seg.aircraft_type ?? null,
          };
        }),
      } as DutyAnalysis;
    }),
    homeBaseTimezone: result.home_base_timezone ?? undefined,
    assumptions: mapAssumptions(result.assumptions),
    companyDetection: result.company_detection
      ? {
          suggestedName: result.company_detection.suggested_name,
          suggestedIcao: result.company_detection.suggested_icao,
          confidence: result.company_detection.confidence,
          needsConfirmation: result.company_detection.needs_confirmation,
        }
      : undefined,
    dutiesToWatch: Array.isArray(result.duties_to_watch)
      ? result.duties_to_watch.filter((id): id is string => typeof id === 'string')
      : undefined,
    easaFindings: transformEasaFindings(result.easa_findings),
    easaSummary: transformEasaSummary(result.easa_summary),
    legacyModel: result.duties.some(d => !isKssEngine(d.model_version)),
    persistenceStatus: result.persistence_status,
    standbyPeriods: transformStandbyPeriods(result.standby_periods),
    alertnessTimeline: (result.alertness_timeline ?? [])
      .map((p) => ({ t: Date.parse(p.t), kss: p.kss, asleep: !!p.asleep, onDuty: !!p.on_duty }))
      .filter((p) => Number.isFinite(p.t)),
    continuityFromMonth: result.continuity_from_month ?? undefined,
    initialConditions: result.initial_conditions
      ? {
          processS: result.initial_conditions.process_s,
          sleepDebt: result.initial_conditions.sleep_debt,
          circadianPhaseShift: result.initial_conditions.circadian_phase_shift,
          fromMonth: result.initial_conditions.from_month,
          gapDays: result.initial_conditions.gap_days,
        }
      : undefined,
  };
}
