import type { RiskLevel, RiskLevelUpper, SleepDeficitBand } from '@/lib/risk-scale';

export type { RiskLevelUpper } from '@/lib/risk-scale';

/** Rolling 7-day cumulative sleep restriction ledger (backend `sleep_deficit_7d`). */
export interface SleepDeficit7d {
  days: number;
  sleepHours: number;
  needHours: number;
  deficitHours: number;
  band: SleepDeficitBand;
}

/** How often the pilot naps before late duties (an analysis assumption). */
export type NapHabit = 'usually' | 'sometimes' | 'rarely';
export const DEFAULT_NAP_HABIT: NapHabit = 'sometimes';

export interface PilotSettings {
  pilotId: string;
  homeBase: string;
  /** Pre-duty nap assumption sent with the next analysis. */
  napHabit: NapHabit;
  /** Usual bedtime at home, 'HH:MM' (default 23:00). */
  usualBedtime?: string;
  /** Usual wake-up at home, 'HH:MM' (default 07:00). */
  usualWakeTime?: string;
  analysisType: 'single' | 'range';
  selectedMonth: Date;
  startDate?: Date;
  endDate?: Date;
  theme: 'dark' | 'light';
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

export interface DutyStatistics {
  totalDuties: number;
  totalSectors: number;
  totalDutyHours: number;
  totalBlockHours: number;
  highRiskDuties: number;
  criticalRiskDuties: number;
  maxSleepDebt: number;
  // Additional statistics from backend
  totalPinchEvents: number;
  avgSleepPerNight: number;
  worstPerformance: number;
  worstDutyId?: string;
  // ULR / Augmented crew summary
  totalUlrDuties: number;
  totalAugmentedDuties: number;
  ulrViolations: string[];
}

export interface FlightSegment {
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;      // HH:mm in home base local time
  arrivalTime: string;        // HH:mm in home base local time
  departureTimeUtc?: string;  // HH:mmZ (Zulu time, formatted)
  arrivalTimeUtc?: string;    // HH:mmZ (Zulu time, formatted)
  /** Aware ISO instants of departure / arrival (backend departure_time / arrival_time). */
  departureIso?: string;
  arrivalIso?: string;
  blockHours: number;
  /**
   * Index (110 − 10·KSS) at arrival, only when the backend supplies the sector's
   * KSS at arrival. Never interpolated in the frontend.
   */
  performance?: number;
  /** Highest model KSS between departure and arrival (backend `kss_peak`); null when not supplied. */
  kssPeak?: number | null;
  /** Model KSS at arrival (backend `kss_at_arrival`); null when not supplied. */
  kssAtArrival?: number | null;
  /** Band of kssPeak (backend `risk_level`, else classified from kssPeak); null when not supplied. */
  riskLevel?: RiskLevel | null;
  // New airport-local time fields
  departureTimeAirportLocal?: string;  // HH:mm in actual airport timezone
  arrivalTimeAirportLocal?: string;    // HH:mm in actual airport timezone
  departureTimezone?: string;          // IANA timezone e.g. "Asia/Kolkata"
  arrivalTimezone?: string;            // IANA timezone e.g. "Asia/Qatar"
  departureUtcOffset?: number | null;  // UTC offset hours e.g. 5.5
  arrivalUtcOffset?: number | null;    // UTC offset hours e.g. 3.0
  // Activity code from roster PDF
  activityCode?: string | null;  // "IR" = inflight rest, "DH" = deadhead
  isDeadhead?: boolean;          // true when activity_code == "DH"
  // Line training annotations (X, U, UL, L, E, ZFT)
  lineTrainingCodes?: string[];
  // Aircraft type from PDF trailing tokens (e.g. "351", "359", "320", "77W")
  aircraftType?: string | null;
}

export type FlightPhase = 'preflight' | 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'approach' | 'landing';

export interface PinchEvent {
  time: string;
  phase: FlightPhase;
  performance: number;
  circadian: number;
  sleepPressure: number;
  severity: 'high' | 'critical';
}

export interface FlightPhasePerformance {
  phase: FlightPhase;
  performance: number;
  isCritical: boolean;
}

export interface DutyAnalysis {
  riskThresholds?: Record<string, [number, number]>;
  modelVersion?: string;
  reportScenario?: { analysisId?: string; changes: unknown };
  modelParameters?: Record<string, unknown>;

  dutyId?: string; // Backend duty_id (used for fetching detailed duty breakdown)
  date: Date;
  dateString?: string; // Raw YYYY-MM-DD from backend for timezone-safe day extraction
  dayOfWeek: string;
  reportTimeUtc?: string; // Raw report_time_utc from backend (ISO or HH:mm)
  releaseTimeUtc?: string; // Raw release_time_utc from backend (ISO or HH:mm)
  reportTimeLocal?: string; // Report time in home base timezone (HH:mm)
  releaseTimeLocal?: string; // Release time in home base timezone (HH:mm)
  dutyHours: number;
  blockHours: number;
  sectors: number;
  minPerformance: number;
  avgPerformance: number;
  landingPerformance: number;
  sleepDebt: number;
  woclExposure: number;
  priorSleep: number;
  overallRisk: RiskLevelUpper;
  minPerformanceRisk: RiskLevelUpper;
  landingRisk: RiskLevelUpper;
  // KSS-anchored alertness (backend engine aerowake-4.0-kss). Optional —
  // older analyses omit them; derive via indexToKss() from risk-scale.ts.
  maxKss?: number;           // worst predicted KSS on deck (group-average pilot)
  /** When the duty peak occurs (ISO UTC): backend peak_time_utc, else the matching worst point. */
  peakTimeUtc?: string;
  /** Peak KSS from report to the last on-blocks (backend kss_peak_fdp). */
  kssPeakFdp?: number;
  landingKss?: number;       // predicted KSS at final landing
  maxKss90?: number;         // worst predicted KSS for the 90th-percentile pilot
  maxPSevere?: number;       // max P(KSS ≥ 7), 0–1
  maxHoursAwake?: number;    // max continuous hours awake during the duty
  sleepDeficit7d?: SleepDeficit7d;
  smsReportable: boolean; // Deprecated — use riskAdvisory
  riskAdvisory: 'routine' | 'monitor' | 'consider_reporting' | 'report_recommended';
  flightSegments: FlightSegment[];
  // EASA ORO.FTL fields
  maxFdpHours?: number; // Maximum FDP (Qatar OM-A 7.6.3 / 7.6.6 / 7.18)
  extendedFdpHours?: number; // Extended limit with discretion
  plannedExtensionFdpHours?: number | null; // OM-A 7.6.5 Table 7-8 (null = not allowed)
  fdpLimitReference?: string | null; // OM-A table the maximum comes from
  actualFdpHours?: number; // Actual FDP worked
  usedDiscretion?: boolean; // Commander discretion used
  fdpExceedance?: number; // Hours over limit (if any)
  // Per-timeline performance degradation points (from GET /api/duty/{id}/{duty_id})
  timelinePoints?: TimelinePoint[];
  // Existing optional fields
  pinchEvents?: PinchEvent[];
  circadianPhaseShift?: number;
  circadianPhaseShiftValue?: number; // Backend circadian_phase_shift: hours offset from home-base body clock
  phasePerformance?: FlightPhasePerformance[];
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  sleepEnvironment?: 'home' | 'hotel' | 'layover';
  
  // Strategic sleep estimator fields
  sleepEstimate?: {
    totalSleepHours: number;
    effectiveSleepHours: number;
    sleepEfficiency: number;
    woclOverlapHours: number;
    sleepStrategy:
      | 'anchor'
      | 'split'
      | 'nap'
      | 'extended'
      | 'restricted'
      | 'recovery'
      | 'normal'
      // Additional backend strategies
      | 'early_bedtime'
      | 'afternoon_nap'
      | 'ulr_pre_duty' | 'post_duty_recovery';
    confidence: number;
    warnings: string[];
    // Sleep timing (HH:mm in home base timezone)
    sleepStartTime?: string;
    sleepEndTime?: string;
    // ISO timestamps for precise date/time positioning
    sleepStartIso?: string;
    sleepEndIso?: string;
    // Pre-computed day/hour values in LOCATION timezone (legacy)
    sleepStartDay?: number;   // Day of month (1-31)
    sleepStartHour?: number;  // Hour (0-24, decimal)
    sleepEndDay?: number;     // Day of month (1-31)
    sleepEndHour?: number;    // Hour (0-24, decimal)
    // Pre-computed day/hour values in HOME BASE timezone (use for chronogram positioning)
    sleepStartDayHomeTz?: number;
    sleepStartHourHomeTz?: number;
    sleepEndDayHomeTz?: number;
    sleepEndHourHomeTz?: number;
    sleepStartTimeHomeTz?: string;  // HH:mm in home base timezone
    sleepEndTimeHomeTz?: string;    // HH:mm in home base timezone
    // Location context for display
    locationTimezone?: string;      // IANA timezone e.g. "Europe/London"
    environment?: 'home' | 'hotel' | 'layover';
    // Detailed sleep quality data from backend
    explanation?: string;
    confidenceBasis?: string;
    qualityFactors?: SleepQualityFactors;
    references?: SleepReference[];
    // Sleep blocks with UTC timestamps (for what-if sleep editing)
    sleepBlocks?: Array<{
      sleepStartUtc?: string;
      sleepEndUtc?: string;
      /** 'main' or 'nap' (pre-duty naps are modelled blocks too). */
      sleepType?: string;
      durationHours?: number;
      effectiveHours?: number;
      // Per-block home-TZ positioning (for multi-block rendering)
      sleepStartDayHomeTz?: number;
      sleepStartHourHomeTz?: number;
      sleepEndDayHomeTz?: number;
      sleepEndHourHomeTz?: number;
      /** Why this block is there, with its published basis; undefined = the strategy explains it. */
      basis?: string;
      /** 'pilot' = set or added by the pilot (planned sleep, not reported). */
      source?: 'estimated' | 'pilot';
      qualityFactors?: SleepQualityFactors;
      environment?: string;
      locationTimezone?: string;
    }>;
    /** Includes sleep the pilot set or removed. */
    isUserOverride?: boolean;
  };

  // ULR / Augmented crew fields
  crewComposition: 'standard' | 'augmented_3' | 'augmented_4';
  ulrCrewSet: 'crew_a' | 'crew_b' | null;
  /** 2-pilot duty above the basic FDP maximum with a long sector: probably augmented, crew not on the roster. */
  augmentationSuggested?: boolean;
  /** Where the crew size comes from: IR sector, inferred from the planned FDP, or the pilot. */
  crewSource?: 'roster_ir' | 'fdp' | 'pilot' | null;
  restFacilityClass: 'class_1' | 'class_2' | 'class_3' | null;
  isUlr: boolean;
  acclimatizationState: 'acclimatized' | 'unknown' | 'departed';
  ulrCompliance: {
    isUlr: boolean;
    fdpWithinLimit: boolean;
    maxPlannedFdp: number;
    restPeriodsValid: boolean;
    preUlrRestCompliant: boolean;
    postUlrRestCompliant: boolean;
    monthlyUlrCount: number;
    monthlyLimit: number;
    violations: string[];
    warnings: string[];
  } | null;
  inflightRestBlocks: {
    startUtc: string;
    endUtc: string;
    // Home-base TZ positioning — use these for chronogram bar placement
    startHomeTz: string | null;          // HH:MM
    endHomeTz: string | null;            // HH:MM
    startDayHomeTz: number | null;       // 1-31
    startHourHomeTz: number | null;      // 0-24 decimal
    endDayHomeTz: number | null;
    endHourHomeTz: number | null;
    startIsoHomeTz: string | null;
    endIsoHomeTz: string | null;
    durationHours: number;
    effectiveSleepHours: number;
    qualityFactor: number;
    environment: string;
    crewMemberId: string | null;
    crewSet: 'crew_a' | 'crew_b' | null;
    isDuringWocl: boolean;
    /** 'roster_ir' = an IR sector on the roster; 'planned' = the standard rest rotation, to confirm. */
    source: 'roster_ir' | 'planned';
    /** Qatar FTL 7.18.11 figure (e.g. '7-3') when the times follow an approved ULR rest plan. */
    approvedPlan: string | null;
  }[];
  returnToDeckPerformance: number | null;
  preDutyAwakeHours: number;

  // Cabin environment (Phase 2 model deepening)
  cabinAltitudeFt?: number | null;   // Inferred cabin altitude from aircraft type (ft)
  aircraftType?: string | null;      // Aircraft type string (e.g., "A320")

  /** Up to 3 plain-language reasons behind the risk level. */
  riskReasons?: string[];

  // Training duty classification
  dutyType?: 'flight' | 'simulator' | 'ground_training' | 'airport_standby';
  trainingCode?: string;           // Raw activity code: "OPTR", "FFS", "EBTGR", etc.
  trainingAnnotations?: string[];  // Trailing codes: ["ea"], ["aw","lpc","rh"]
  /** Meanings from the roster's own activity-code legend (code -> description). */
  trainingLegend?: Record<string, string>;
}

// Sleep quality calculation factors
export interface SleepQualityFactors {
  base_efficiency: number;
  wocl_boost: number;
  late_onset_penalty: number;
  recovery_boost: number;
  time_pressure_factor: number;
  insufficient_penalty: number;
  pre_duty_awake_hours?: number; // Hours awake before report (Dawson & Reid, 1997)
}

// Per-timeline point model outputs (GET /api/duty/{id}/{duty_id})
export interface TimelinePoint {
  hours_on_duty: number;           // Hours since report
  /** @deprecated Constant 1.0 (factor form) since aerowake-4.0-kss — not in the score. */
  time_on_task_penalty: number;
  /** @deprecated Constant 1.0 (factor form) since aerowake-4.0-kss — not in the score. */
  sleep_inertia: number;
  sleep_pressure: number;          // Homeostatic pressure, normalised 0–1 (1 = depleted)
  circadian: number;               // Circadian phase, normalised 0–1 (1 = circadian peak)
  performance?: number;            // 20–100 index = 110 − 10·KSS
  kss?: number;                    // Predicted KSS (group-average pilot)
  kss_90?: number;                 // Predicted KSS, 90th-percentile pilot
  p_severe_sleepiness?: number;    // P(KSS ≥ 7), 0–1
  hours_awake?: number;            // Continuous hours awake
  is_in_rest?: boolean;            // True when crew member is in bunk rest
  // Extended fields (Phase 2 — populated from GET /api/duty detail)
  flight_phase?: string | null;    // Current flight phase: "takeoff", "cruise", "landing", etc.
  is_critical?: boolean;           // True during takeoff/landing phases
  timestamp?: string;              // ISO 8601 UTC timestamp
  timestamp_local?: string;        // ISO 8601 home-base timezone timestamp
  // Phase 2 — Model deepening additions
  /** @deprecated Constant 1.0 since aerowake-4.0-kss — not in the score. */
  debt_penalty?: number;
  /** @deprecated Constant 1.0 since aerowake-4.0-kss — not in the score. */
  hypoxia_factor?: number;
  pvt_lapses?: number;             // Legacy heuristic (not part of the KSS model)
  microsleep_probability?: number; // P(KSS = 9, "fighting sleep") from the ordinal model
}

// Academic reference for sleep calculations
export interface SleepReference {
  key: string;
  short: string;
  full: string;
}

// Rest day sleep block (transformed from backend)
export interface RestDaySleepBlock {
  sleepStartTime: string;
  sleepEndTime: string;
  sleepStartIso: string;
  sleepEndIso: string;
  sleepType: 'main' | 'nap';
  durationHours: number;
  effectiveHours: number;
  qualityFactor: number;
  // Home base timezone positioning
  sleepStartDayHomeTz?: number;
  sleepStartHourHomeTz?: number;
  sleepEndDayHomeTz?: number;
  sleepEndHourHomeTz?: number;
  sleepStartTimeHomeTz?: string;
  sleepEndTimeHomeTz?: string;
  locationTimezone?: string;
  environment?: 'home' | 'hotel' | 'layover' | 'crew_rest' | 'airport_hotel';
  // Location-local display times
  sleepStartTimeLocationTz?: string;
  sleepEndTimeLocationTz?: string;
  // Numeric grid positioning (home-base TZ)
  sleepStartDay?: number;
  sleepStartHour?: number;
  sleepEndDay?: number;
  sleepEndHour?: number;
  sleepStartUtc?: string;
  sleepEndUtc?: string;
  basis?: string;
  source?: 'estimated' | 'pilot';
  qualityFactors?: SleepQualityFactors;
}

// Rest day sleep (transformed from backend)
export interface RestDaySleep {
  date: Date;
  sleepBlocks: RestDaySleepBlock[];
  totalSleepHours: number;
  effectiveSleepHours: number;
  sleepEfficiency: number;
  strategyType: 'recovery' | 'normal' | 'ulr_pre_duty' | 'post_duty_recovery';
  confidence: number;
  // Quality factor breakdown from backend
  explanation?: string;
  confidenceBasis?: string;
  qualityFactors?: SleepQualityFactors;
  references?: SleepReference[];
  isUserOverride?: boolean;
}

/** A pilot change to the estimated sleep, as stored with the analysis. */
export interface SleepEditItem {
  id: string;
  action: 'remove' | 'replace' | 'add';
  kind?: 'main' | 'nap' | null;
  environment?: 'home' | 'hotel' | null;
  targetStartUtc?: string | null;
  targetEndUtc?: string | null;
  startUtc?: string | null;
  endUtc?: string | null;
  /** False when the change no longer matches an estimated sleep. */
  applied: boolean;
}

// ── EASA ORO.FTL roster-level checks ─────────────────────────

export interface EasaFinding {
  rule: string;
  reference: string;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  windowStartUtc?: string;
  windowEndUtc?: string;
  value?: number;
  limit?: number;
}

export interface EasaSummary {
  status?: string;
  coverage?: Record<string, { status: string; reason: string }>;

  duty7dMax: number;
  duty14dMax: number;
  duty28dMax: number;
  block28dMax: number;
  limits: {
    duty7d: number;
    duty14d: number;
    duty28d: number;
    block28d: number;
  };
}

/** Standby period — not a scored duty (home standby counts 25% toward cumulative duty). */
export interface StandbyPeriod {
  id: string;
  type: 'home_standby' | 'airport_standby';
  code: string;
  startUtc: string;
  endUtc: string;
  startHome: string; // HH:MM home base
  endHome: string;   // HH:MM home base
  date: string;      // YYYY-MM-DD home base
  countedDutyHours: number;
}

export interface CompanyDetection {
  suggestedName: string;
  suggestedIcao: string;
  confidence: number;
  needsConfirmation: boolean;
}

export interface AnalysisResults {
  legacyModel?: boolean;
  persistenceStatus?: string;
  statistics: DutyStatistics;
  duties: DutyAnalysis[];
  generatedAt: Date;
  month: Date; // Actual month from the roster data
  analysisId?: string; // Backend analysis_id
  rosterId?: string;   // Backend roster_id (for reanalyze with new params)
  // Pilot info from backend
  pilotId?: string;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  homeBaseTimezone?: string; // IANA timezone e.g. "Asia/Qatar"
  /** Assumptions the backend ran with (absent on older analyses). */
  assumptions?: {
    napHabit?: NapHabit;
    /** Window of the headline risk, e.g. 'duty' or 'fdp'. */
    headlineRiskWindow?: string;
    /** The usual night the analysis assumed, 'HH:MM'. */
    usualBedtime?: string;
    usualWakeTime?: string;
  };
  // Rest day sleep data
  restDaysSleep?: RestDaySleep[];
  /** The pilot's sleep changes stored with this analysis. */
  sleepEdits?: SleepEditItem[];
  // Circadian adaptation curve across the roster
  bodyClockTimeline?: BodyClockTimelineEntry[];
  // Company detection (first upload only)
  companyDetection?: CompanyDetection;
  // Roster verdict: duty ids with high/critical/extreme risk, worst first.
  // Undefined when the backend predates the field.
  dutiesToWatch?: string[];
  easaFindings?: EasaFinding[];
  easaSummary?: EasaSummary;
  standbyPeriods?: StandbyPeriod[];
  /** Predicted KSS through the month from the backend model (no interpolation). */
  alertnessTimeline?: AlertnessSample[];
  // Fatigue continuity (multi-roster chaining)
  continuityFromMonth?: string;    // "2026-01" if prior state was injected
  initialConditions?: {
    processS: number;
    sleepDebt: number;
    circadianPhaseShift: number;
    fromMonth: string;
    gapDays: number;
  };
}

// Body clock adaptation curve entry
export interface BodyClockTimelineEntry {
  timestampUtc: string;       // ISO 8601 UTC timestamp
  phaseShiftHours: number;    // hours offset from home base (-12 to +12)
  referenceTimezone: string;  // IANA tz the pilot is physically in
}


/** One sample of the monthly alertness curve (backend, 30-min steps). */
export interface AlertnessSample {
  t: number;            // epoch ms
  kss: number | null;   // null while asleep
  asleep: boolean;
  onDuty: boolean;
}
