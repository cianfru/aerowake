import { useMemo } from 'react';
import { DutyAnalysis } from '@/types/fatigue';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { PerformanceSummaryCard } from './PerformanceSummaryCard';
import { ProcessBreakdownChart } from './ProcessBreakdownChart';
import { FlightPhasePerformance } from './FlightPhasePerformance';
import { WorkloadPhaseIndicator } from './WorkloadPhaseIndicator';
import { isTrainingDuty } from '@/lib/fatigue-utils';

interface DutyDetailsPerformanceTabProps {
  duty: DutyAnalysis;
}

/**
 * Performance tab — "How fatigued was I and why?"
 *
 * Composes:
 *  1. PerformanceSummaryCard — big score, KSS/PVT/FHA badges, S/C/W bars
 *  2. ProcessBreakdownChart — S/C/W stacked area chart at full width (height=400)
 *  3. FlightPhasePerformance — 8-phase bars per sector
 *  4. WorkloadPhaseIndicator — phase lane + chips (conditional)
 */
export function DutyDetailsPerformanceTab({ duty }: DutyDetailsPerformanceTabProps) {
  // Build DutyDetailTimeline-shaped object for Phase 2 charts
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
    <div className="space-y-4 md:space-y-5 animate-fade-in">
      {/* 1. Performance Summary — key insights */}
      <PerformanceSummaryCard duty={duty} />

      {/* 2. Three-Process Breakdown Chart — bigger, full width */}
      {dutyTimeline && dutyTimeline.timeline.length > 2 && (
        <ProcessBreakdownChart timeline={dutyTimeline} duty={duty} height={400} />
      )}

      {/* 3. Flight Phase Performance — per-sector bars */}
      {!isTrainingDuty(duty) && (
        <FlightPhasePerformance duty={duty} />
      )}

      {/* 4. Workload Phase Indicators */}
      {dutyTimeline && dutyTimeline.timeline.some(pt => pt.flight_phase) && (
        <WorkloadPhaseIndicator timeline={dutyTimeline} />
      )}
    </div>
  );
}
