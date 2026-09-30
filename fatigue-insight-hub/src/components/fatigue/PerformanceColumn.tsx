import { useMemo } from 'react';
import { DutyAnalysis } from '@/types/fatigue';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { ProcessBreakdownChart } from './ProcessBreakdownChart';

interface PerformanceColumnProps {
  duty: DutyAnalysis;
  /** Home-base IANA zone: every time in the chart is home-base 24-hour. */
  homeTz?: string;
  /** Short zone label for the chart header, e.g. "DOH · UTC+3". */
  zoneLabel?: string;
}

/** The duty's high-resolution timeline in the shape the chart expects. */
export function toDutyDetailTimeline(duty: DutyAnalysis): DutyDetailTimeline | null {
  if (!duty.timelinePoints || duty.timelinePoints.length === 0) return null;
  return {
    duty_id: duty.dutyId || '',
    timeline: duty.timelinePoints.map((pt) => ({
      timestamp: pt.timestamp || '',
      timestamp_local: pt.timestamp_local || '',
      performance: pt.performance ?? 0,
      sleep_pressure: pt.sleep_pressure,
      circadian: pt.circadian,
      hours_on_duty: pt.hours_on_duty,
      kss: pt.kss,
      kss_90: pt.kss_90,
      p_severe_sleepiness: pt.p_severe_sleepiness,
      hours_awake: pt.hours_awake,
      flight_phase: pt.flight_phase ?? null,
      is_critical: pt.is_critical ?? false,
      is_in_rest: pt.is_in_rest ?? false,
    })),
    summary: {
      min_performance: duty.minPerformance,
      avg_performance: duty.avgPerformance,
      landing_performance: duty.landingPerformance,
      wocl_hours: duty.woclExposure,
      prior_sleep: duty.priorSleep,
      pre_duty_awake_hours: duty.preDutyAwakeHours,
      sleep_debt: duty.sleepDebt,
    },
  };
}

/**
 * Predicted KSS through the duty, straight from the model's duty timeline.
 * Renders nothing until the timeline has loaded (or when no zone is known,
 * since a time axis in the device zone would mislead).
 */
export function PerformanceColumn({ duty, homeTz, zoneLabel }: PerformanceColumnProps) {
  const timeline = useMemo(() => toDutyDetailTimeline(duty), [duty]);
  if (!timeline || timeline.timeline.length <= 2 || !homeTz) return null;
  return <ProcessBreakdownChart timeline={timeline} duty={duty} homeTz={homeTz} zoneLabel={zoneLabel} height={260} />;
}
