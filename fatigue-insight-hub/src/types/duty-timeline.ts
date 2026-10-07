/** Model samples returned by GET /api/duty/{analysisId}/{dutyId}. */
export interface DutyDetailTimeline {
  duty_id: string;
  timeline: Array<{
    timestamp: string;
    timestamp_local: string;
    performance: number;
    sleep_pressure: number;
    circadian: number;
    hours_on_duty: number;
    kss?: number;
    kss_90?: number;
    p_severe_sleepiness?: number;
    hours_awake?: number;
    /** @deprecated constant 1.0 since aerowake-4.0-kss */
    sleep_inertia?: number;
    /** @deprecated constant 1.0 since aerowake-4.0-kss */
    time_on_task_penalty?: number;
    flight_phase: string | null;
    is_critical: boolean;
    is_in_rest: boolean;
  }>;
  summary: {
    min_performance: number;
    avg_performance: number;
    landing_performance: number | null;
    wocl_hours: number;
    prior_sleep: number;
    pre_duty_awake_hours: number;
    sleep_debt: number;
  };
}
