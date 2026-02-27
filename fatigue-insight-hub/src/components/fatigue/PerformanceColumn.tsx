import { useMemo } from 'react';
import { DutyAnalysis } from '@/types/fatigue';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { PerformanceSummaryCard } from './PerformanceSummaryCard';
import { ProcessBreakdownChart } from './ProcessBreakdownChart';
import { UnifiedPhasePerformance } from './UnifiedPhasePerformance';
import { isTrainingDuty } from '@/lib/fatigue-utils';

interface PerformanceColumnProps {
  duty: DutyAnalysis;
}

/**
 * Right column of the DutyDetailsDialog — performance analysis.
 *
 * Composes:
 *  1. PerformanceSummaryCard — big score, scale badges, S/C/W/ToT/D/Hx factor bars
 *  2. ProcessBreakdownChart — S/C/W stacked area chart (h=300)
 *  3. UnifiedPhasePerformance — workload lane + compact phase table
 */
export function PerformanceColumn({ duty }: PerformanceColumnProps) {
  // Build DutyDetailTimeline for ProcessBreakdownChart & UnifiedPhasePerformance
  const dutyTimeline: DutyDetailTimeline | null = useMemo(() => {
    if (!duty.timelinePoints || duty.timelinePoints.length === 0) return null;
    return {
      duty_id: duty.dutyId || '',
      timeline: duty.timelinePoints.map(pt => ({
        timestamp: pt.timestamp || '',
        timestamp_local: pt.timestamp_local || '',
        performance: pt.performance ?? 0,
        sleep_pressure: pt.sleep_pressure,
        circadian: pt.circadian,
        sleep_inertia: pt.sleep_inertia,
        hours_on_duty: pt.hours_on_duty,
        time_on_task_penalty: pt.time_on_task_penalty,
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
  }, [duty]);

  return (
    <div className="space-y-3">
      {/* 1. Performance Summary — key insights */}
      <PerformanceSummaryCard duty={duty} />

      {/* 2. Three-Process Breakdown Chart */}
      {dutyTimeline && dutyTimeline.timeline.length > 2 && (
        <ProcessBreakdownChart timeline={dutyTimeline} duty={duty} height={300} />
      )}

      {/* 3. Unified Phase Performance (merged FlightPhase + Workload) */}
      {!isTrainingDuty(duty) && (
        <UnifiedPhasePerformance duty={duty} timeline={dutyTimeline} />
      )}
    </div>
  );
}
