// src/lib/api-client.ts

import { getAuthHeaders } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

// ============================================================================
// TYPES (matching your existing types in src/types/fatigue.ts)
// ============================================================================

// Crew augmentation & ULR enums
export type CrewComposition = 'standard' | 'augmented_3' | 'augmented_4';
export type RestFacilityClass = 'class_1' | 'class_2' | 'class_3';
export type ULRCrewSet = 'crew_a' | 'crew_b';
export type AcclimatizationState = 'acclimatized' | 'unknown' | 'departed';

export interface InFlightRestBlock {
  start_utc: string;
  end_utc: string;
  // Home-base TZ positioning
  start_home_tz?: string | null;
  end_home_tz?: string | null;
  start_day_home_tz?: number | null;
  start_hour_home_tz?: number | null;
  end_day_home_tz?: number | null;
  end_hour_home_tz?: number | null;
  start_iso_home_tz?: string | null;
  end_iso_home_tz?: string | null;
  duration_hours: number;
  effective_sleep_hours: number;
  quality_factor?: number;
  environment?: string;
  crew_member_id: string | null;
  crew_set: ULRCrewSet | null;
  is_during_wocl: boolean;
}

export interface ULRCompliance {
  is_ulr: boolean;
  fdp_within_limit: boolean;
  max_planned_fdp: number;
  rest_periods_valid: boolean;
  pre_ulr_rest_compliant: boolean;
  post_ulr_rest_compliant: boolean;
  monthly_ulr_count: number;
  monthly_limit: number;
  violations: string[];
  warnings: string[];
}

export interface DutySegment {
  flight_number: string;
  departure: string;
  arrival: string;
  departure_time: string;
  arrival_time: string;
  departure_time_local: string;  // Pre-converted to HH:mm in home base timezone
  arrival_time_local: string;    // Pre-converted to HH:mm in home base timezone
  block_hours: number;
  // New unambiguous time fields
  departure_time_home_tz: string;       // HH:mm in home base timezone
  arrival_time_home_tz: string;         // HH:mm in home base timezone
  departure_time_airport_local: string; // HH:mm in actual airport timezone
  arrival_time_airport_local: string;   // HH:mm in actual airport timezone
  departure_timezone: string;           // IANA timezone e.g. "Asia/Kolkata"
  arrival_timezone: string;             // IANA timezone e.g. "Asia/Qatar"
  departure_utc_offset: number | null;  // UTC offset hours e.g. 5.5
  arrival_utc_offset: number | null;    // UTC offset hours e.g. 3.0
  // Line training annotations (X, U, UL, L, E, ZFT)
  line_training_codes?: string[];
}

// Sleep block from strategic sleep estimator
export interface SleepBlockResponse {
  sleep_start_time: string;
  sleep_end_time: string;
  sleep_start_iso: string;
  sleep_end_iso: string;
  sleep_type: 'main' | 'nap';
  duration_hours: number;
  effective_hours: number;
  quality_factor: number;
  // Location context
  location_timezone?: string | null;
  environment?: 'home' | 'hotel' | 'crew_rest' | 'airport_hotel' | null;
  sleep_start_time_location_tz?: string | null;
  sleep_end_time_location_tz?: string | null;
  // Numeric grid positioning (home-base TZ)
  sleep_start_day?: number | null;
  sleep_start_hour?: number | null;
  sleep_end_day?: number | null;
  sleep_end_hour?: number | null;
  // UTC ISO timestamps (canonical, unambiguous — used for what-if sleep editing)
  sleep_start_utc?: string | null;
  sleep_end_utc?: string | null;
}

// Strategic sleep estimator output (SleepQualityResponse from backend)
export interface SleepEstimate {
  total_sleep_hours: number;
  effective_sleep_hours: number;
  sleep_efficiency: number;
  wocl_overlap_hours: number;
  sleep_strategy:
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
    | 'post_duty_recovery';
  confidence: number;
  warnings: string[];
  // Sleep blocks array (detailed sleep periods)
  sleep_blocks?: SleepBlockResponse[];
  // Sleep timing (HH:mm in home base timezone) - optional top-level convenience fields
  sleep_start_time?: string | null;
  sleep_end_time?: string | null;
  // ISO timestamps for precise date/time positioning - optional top-level convenience fields
  sleep_start_iso?: string | null;
  sleep_end_iso?: string | null;
  // Pre-computed day/hour values in LOCATION timezone
  sleep_start_day?: number | null;
  sleep_start_hour?: number | null;
  sleep_end_day?: number | null;
  sleep_end_hour?: number | null;
  // Pre-computed day/hour values in HOME BASE timezone (for chronogram positioning)
  sleep_start_day_home_tz?: number | null;
  sleep_start_hour_home_tz?: number | null;
  sleep_end_day_home_tz?: number | null;
  sleep_end_hour_home_tz?: number | null;
  sleep_start_time_home_tz?: string | null;
  sleep_end_time_home_tz?: string | null;
  // Location context
  location_timezone?: string | null;
  environment?: 'home' | 'hotel' | 'layover' | null;

  // Detailed sleep quality explanation (new backend fields)
  explanation?: string;
  confidence_basis?: string;
  quality_factors?: {
    base_efficiency: number;
    wocl_boost: number;
    late_onset_penalty: number;
    recovery_boost: number;
    time_pressure_factor: number;
    insufficient_penalty: number;
    pre_duty_awake_hours?: number; // Hours awake before report
  };
  references?: Array<{
    key: string;
    short: string;
    full: string;
  }>;
  // Sleep environment and quality indicators
  sleep_environment?: 'home' | 'layover';
  sleep_quality_label?: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface Duty {
  duty_id: string;
  date: string;
  report_time_utc: string;
  release_time_utc: string;
  report_time_local?: string;   // Pre-converted to HH:mm in home base timezone
  release_time_local?: string;  // Pre-converted to HH:mm in home base timezone
  report_time_home_tz?: string;   // HH:MM in home base timezone (unambiguous naming)
  release_time_home_tz?: string;  // HH:MM in home base timezone (unambiguous naming)
  duty_hours: number;
  sectors: number;
  segments: DutySegment[];
  
  min_performance: number;
  avg_performance: number;
  landing_performance: number | null;
  
  sleep_debt: number;
  wocl_hours: number;
  prior_sleep: number;
  
  // Strategic sleep estimator fields
  sleep_estimate?: SleepEstimate;
  // Backend currently returns this key
  sleep_quality?: SleepEstimate;
  // Sleep environment and quality (can be at duty level or within sleep_estimate/sleep_quality)
  sleep_environment?: 'home' | 'layover';
  sleep_quality_label?: 'poor' | 'fair' | 'good' | 'excellent';
  
  risk_level: 'low' | 'moderate' | 'high' | 'critical' | 'extreme' | 'unknown';
  is_reportable: boolean;
  pinch_events: number;
  max_fdp_hours?: number;
  extended_fdp_hours?: number;
  used_discretion?: boolean;
  // Circadian adaptation state at duty report time
  circadian_phase_shift?: number | null;

  // ULR / Augmented crew fields
  crew_composition?: CrewComposition;
  rest_facility_class?: RestFacilityClass | null;
  is_ulr?: boolean;
  acclimatization_state?: AcclimatizationState;
  ulr_compliance?: ULRCompliance | null;
  inflight_rest_blocks?: InFlightRestBlock[];
  return_to_deck_performance?: number | null;
  pre_duty_awake_hours?: number;

  // Training duty classification
  duty_type?: 'flight' | 'simulator' | 'ground_training';
  training_code?: string;
  training_annotations?: string[];
}

// Rest day sleep block from backend
export interface RestDaySleepBlock {
  sleep_start_time: string;
  sleep_end_time: string;
  sleep_start_iso: string;
  sleep_end_iso: string;
  sleep_type: 'main' | 'nap';
  duration_hours: number;
  effective_hours: number;
  quality_factor: number;
  // Home base timezone positioning
  sleep_start_day_home_tz?: number | null;
  sleep_start_hour_home_tz?: number | null;
  sleep_end_day_home_tz?: number | null;
  sleep_end_hour_home_tz?: number | null;
  sleep_start_time_home_tz?: string | null;
  sleep_end_time_home_tz?: string | null;
  location_timezone?: string | null;
  environment?: 'home' | 'hotel' | 'layover' | 'crew_rest' | 'airport_hotel' | null;
  // Location-local display times
  sleep_start_time_location_tz?: string | null;
  sleep_end_time_location_tz?: string | null;
  // Numeric grid positioning (home-base TZ)
  sleep_start_day?: number | null;
  sleep_start_hour?: number | null;
  sleep_end_day?: number | null;
  sleep_end_hour?: number | null;
}

// Rest day sleep entry from backend
export interface RestDaySleep {
  date: string;
  sleep_blocks: RestDaySleepBlock[];
  total_sleep_hours: number;
  effective_sleep_hours: number;
  sleep_efficiency: number;
  strategy_type: 'recovery' | 'normal' | 'post_duty_recovery';
  confidence: number;
  // Quality factor breakdown (new backend fields)
  explanation?: string;
  confidence_basis?: string;
  quality_factors?: {
    base_efficiency: number;
    wocl_boost: number;
    late_onset_penalty: number;
    recovery_boost: number;
    time_pressure_factor: number;
    insufficient_penalty: number;
    pre_duty_awake_hours?: number;
  };
  references?: Array<{
    key: string;
    short: string;
    full: string;
  }>;
}

export interface AnalysisResult {
  analysis_id: string;
  roster_id: string;
  pilot_id: string;
  pilot_name: string | null;
  pilot_base: string | null;
  pilot_aircraft: string | null;
  home_base_timezone: string | null;  // IANA timezone e.g. "Asia/Qatar"
  month: string;
  
  total_duties: number;
  total_sectors: number;
  total_duty_hours: number;
  total_block_hours: number;
  
  high_risk_duties: number;
  critical_risk_duties: number;
  total_pinch_events: number;
  
  avg_sleep_per_night: number;
  max_sleep_debt: number;
  average_sleep_debt?: number;

  worst_duty_id: string;
  worst_performance: number;
  
  duties: Duty[];
  rest_days_sleep?: RestDaySleep[];
  // Full circadian adaptation curve across the roster
  body_clock_timeline?: Array<{
    timestamp_utc: string;
    phase_shift_hours: number;
    reference_timezone: string;
  }>;

  // ULR / Augmented crew summary
  total_ulr_duties?: number;
  total_augmented_duties?: number;
  ulr_violations?: string[];

  // Company detection (first upload only, when user has no company)
  company_detection?: {
    suggested_name: string;
    suggested_icao: string;
    confidence: number;
    needs_confirmation: boolean;
  } | null;

  // Fatigue continuity (multi-roster chaining)
  continuity_from_month?: string | null;
  initial_conditions?: {
    process_s: number;
    sleep_debt: number;
    circadian_phase_shift: number;
    from_month: string;
    gap_days: number;
  } | null;
}

export interface Statistics {
  totalDuties: number;
  totalSectors: number;
  highRiskDuties: number;
  criticalRiskDuties: number;
  totalPinchEvents: number;
  avgSleepPerNight: number;
  maxSleepDebt: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function analyzeRoster(
  file: File,
  pilotId: string,
  homeBase: string,
  configPreset: string = 'operational',
  crewSet: ULRCrewSet = 'crew_b',
  dutyCrewOverrides?: Map<string, ULRCrewSet>
): Promise<AnalysisResult> {

  const formData = new FormData();
  formData.append('file', file);
  formData.append('pilot_id', pilotId);
  formData.append('home_base', homeBase);
  formData.append('config_preset', configPreset);
  formData.append('crew_set', crewSet);

  // Serialize per-duty overrides to JSON
  if (dutyCrewOverrides && dutyCrewOverrides.size > 0) {
    const overridesObj = Object.fromEntries(dutyCrewOverrides);
    formData.append('duty_crew_overrides', JSON.stringify(overridesObj));
  }

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Analysis failed');
  }
  
  return response.json();
}

export async function getDutyDetail(
  analysisId: string,
  dutyId: string
) {
  
  const response = await fetch(
    `${API_BASE_URL}/api/duty/${analysisId}/${dutyId}`,
    { headers: { ...getAuthHeaders() } },
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch duty detail');
  }
  
  return response.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getAirportsBatch(codes: string[]): Promise<Array<{
  code: string;
  timezone: string;
  utc_offset_hours: number | null;
  latitude: number;
  longitude: number;
}>> {
  const response = await fetch(`${API_BASE_URL}/api/airports/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes }),
  });

  if (!response.ok) throw new Error('Failed to fetch airport data');
  return response.json();
}


// ============================================================================
// ROSTER MANAGEMENT (authenticated)
// ============================================================================

export interface RosterSummary {
  id: string;
  filename: string;
  month: string;
  pilot_id: string | null;
  home_base: string | null;
  config_preset: string | null;
  total_duties: number | null;
  total_sectors: number | null;
  total_duty_hours: number | null;
  total_block_hours: number | null;
  analysis_id: string | null;
  created_at: string;
}

export interface RosterDetail extends RosterSummary {
  analysis: AnalysisResult | null;
}

export async function getRosters(): Promise<RosterSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/rosters`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Not authenticated');
    throw new Error('Failed to fetch rosters');
  }

  return response.json();
}

export async function getRoster(rosterId: string): Promise<RosterDetail> {
  const response = await fetch(`${API_BASE_URL}/api/rosters/${rosterId}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error('Failed to fetch roster');
  return response.json();
}

export async function deleteRoster(rosterId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/rosters/${rosterId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error('Failed to delete roster');
}

export async function reanalyzeRoster(
  rosterId: string,
  configPreset: string = 'operational',
  crewSet: string = 'crew_b',
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('config_preset', configPreset);
  formData.append('crew_set', crewSet);

  const response = await fetch(`${API_BASE_URL}/api/rosters/${rosterId}/reanalyze`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Re-analysis failed' }));
    throw new Error(error.detail || 'Re-analysis failed');
  }

  return response.json();
}


// ============================================================================
// YEARLY DASHBOARD
// ============================================================================

export interface MonthlyMetrics {
  month: string;
  roster_id: string;
  filename: string;
  created_at: string;
  total_duties: number;
  total_sectors: number;
  total_duty_hours: number;
  total_block_hours: number;
  avg_performance: number;
  worst_performance: number;
  low_risk_count: number;
  moderate_risk_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  avg_sleep_per_night: number;
  max_sleep_debt: number;
  total_wocl_hours: number;
  total_pinch_events: number;
  high_risk_duties: number;
  critical_risk_duties: number;
  flight_duties: number;
  simulator_duties: number;
  ground_training_duties: number;
}

export interface YearlySummary {
  total_months: number;
  total_duties: number;
  total_sectors: number;
  total_duty_hours: number;
  total_block_hours: number;
  avg_performance: number;
  worst_performance: number;
  avg_sleep_per_night: number;
  max_sleep_debt: number;
  total_wocl_hours: number;
  total_pinch_events: number;
  total_high_risk_duties: number;
  total_critical_risk_duties: number;
}

export interface YearlyDashboardData {
  months: MonthlyMetrics[];
  summary: YearlySummary;
}

export async function getYearlyDashboard(): Promise<YearlyDashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/yearly`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Not authenticated');
    throw new Error('Failed to fetch yearly dashboard');
  }

  return response.json();
}


// ============================================================================
// WHAT-IF SCENARIO ANALYSIS (sleep editing)
// ============================================================================

export interface DutyModification {
  duty_id: string;
  report_shift_minutes?: number;
  release_shift_minutes?: number;
  crew_composition?: string;
  crew_set?: string;
  excluded?: boolean;
}

export interface SleepModification {
  duty_id: string;
  sleep_start_utc: string;   // ISO 8601 datetime in UTC
  sleep_end_utc: string;     // ISO 8601 datetime in UTC
  environment?: string;      // "home" | "hotel" (optional override)
}

export interface WhatIfRequest {
  analysis_id: string;
  modifications?: DutyModification[];
  sleep_modifications?: SleepModification[];
  config_preset?: string;
}

export async function runWhatIf(request: WhatIfRequest): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/what-if`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'What-if analysis failed' }));
    throw new Error(error.detail || 'What-if analysis failed');
  }

  return response.json();
}


// ============================================================================
// COMPARATIVE METRICS
// ============================================================================

export interface PilotMetrics {
  avg_performance: number | null;
  total_duties: number;
  total_sectors: number;
  total_duty_hours: number;
  avg_sleep_per_night: number;
  avg_sleep_debt: number;
  high_risk_duty_count: number;
}

export interface GroupMetrics {
  group_type: string;
  group_value: string;
  sample_size: number;
  avg_performance: number | null;
  min_performance: number | null;
  p25_performance: number | null;
  p75_performance: number | null;
  avg_sleep_debt: number | null;
  avg_sleep_per_night: number | null;
  avg_duty_hours: number | null;
  avg_sector_count: number | null;
  high_risk_duty_rate: number | null;
}

export interface PercentilePosition {
  group_type: string;
  group_value: string;
  metric: string;
  value: number | null;
  percentile: number | null;
  vs_avg: number | null;
}

export interface ComparativeMetrics {
  month: string;
  pilot: PilotMetrics;
  groups: GroupMetrics[];
  positions: PercentilePosition[];
  has_sufficient_data: boolean;
}

export interface TrendPoint {
  month: string;
  group_type: string;
  group_value: string;
  your_performance: number | null;
  group_avg_performance: number | null;
  percentile: number | null;
  sample_size: number;
}

export interface TrendData {
  months: TrendPoint[];
  primary_group: string | null;
}

export async function getComparativeMetrics(month?: string): Promise<ComparativeMetrics> {
  const params = month ? `?month=${month}` : '';
  const response = await fetch(`${API_BASE_URL}/api/metrics/comparative${params}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Not authenticated');
    if (response.status === 400) {
      const err = await response.json().catch(() => ({ detail: 'No company assigned' }));
      throw new Error(err.detail);
    }
    throw new Error('Failed to fetch comparative metrics');
  }

  return response.json();
}

export async function getComparativeTrend(): Promise<TrendData> {
  const response = await fetch(`${API_BASE_URL}/api/metrics/comparative/trend`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Not authenticated');
    throw new Error('Failed to fetch comparative trend');
  }

  return response.json();
}
