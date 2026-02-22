import { useMemo } from 'react';
import { DutyAnalysis, RestDaySleep } from '@/types/fatigue';
import { startOfMonth, endOfMonth, addHours } from 'date-fns';

export interface ContinuousTimelinePoint {
  timestampMs: number;
  performance: number;        // 0-100 (left Y-axis)
  sleepReservoir: number;     // 50-100 (right Y-axis)
  circadian?: number;         // 0-1 (high-res only)
  homeostatic?: number;       // 0-1 (high-res only)
  sleepInertia?: number;      // 0-1 (high-res only)
  hoursAwake?: number;
  sleepDebt?: number;
  priorSleep?: number;
  phase: 'duty' | 'sleep' | 'awake' | 'rest';
  dutyId?: string;
  flightPhase?: string | null;
  riskLevel: string;
  isHighRes?: boolean;
  // Duty context for tooltip
  dutyLabel?: string;
  flightNumber?: string;
  departure?: string;
  arrival?: string;
}

export interface TimelineRegion {
  startMs: number;
  endMs: number;
  type: 'duty' | 'sleep';
  label?: string;
  dutyId?: string;
  riskLevel?: string;
}

/** Shape returned by GET /api/duty/{analysisId}/{dutyId} */
export interface DutyDetailTimeline {
  duty_id: string;
  timeline: Array<{
    timestamp: string;
    timestamp_local: string;
    performance: number;
    sleep_pressure: number;
    circadian: number;
    sleep_inertia: number;
    hours_on_duty: number;
    time_on_task_penalty: number;
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

const MAX_DEBT_HOURS = 16;

function debtToReservoir(sleepDebt: number): number {
  return Math.max(50, Math.min(100, 100 - (sleepDebt / MAX_DEBT_HOURS) * 50));
}

function getRiskLevel(performance: number): string {
  if (performance < 55) return 'CRITICAL';
  if (performance < 65) return 'HIGH';
  if (performance < 75) return 'MODERATE';
  return 'LOW';
}

/** Parse a duty's report/release time into epoch ms using the duty date and HH:mm string */
function parseTimeToMs(date: Date, timeStr: string | undefined, fallbackHour: number): number {
  if (!timeStr) {
    const d = new Date(date);
    d.setHours(fallbackHour, 0, 0, 0);
    return d.getTime();
  }
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

interface UseContinuousTimelineDataProps {
  duties: DutyAnalysis[];
  restDaysSleep?: RestDaySleep[];
  month: Date;
  highResTimelines?: Map<string, DutyDetailTimeline>;
}

export function useContinuousTimelineData({
  duties,
  restDaysSleep,
  month,
  highResTimelines,
}: UseContinuousTimelineDataProps) {
  return useMemo(() => {
    if (!duties || duties.length === 0) {
      return { data: [] as ContinuousTimelinePoint[], dutyRegions: [] as TimelineRegion[], sleepRegions: [] as TimelineRegion[] };
    }

    const points: ContinuousTimelinePoint[] = [];
    const dutyRegions: TimelineRegion[] = [];
    const sleepRegions: TimelineRegion[] = [];

    // Sort duties by date
    const sortedDuties = [...duties].sort((a, b) => a.date.getTime() - b.date.getTime());

    const monthStart = startOfMonth(month).getTime();
    const monthEnd = endOfMonth(month).getTime() + 24 * 60 * 60 * 1000; // end of last day

    // Add a starting point at month start (baseline performance)
    const firstDuty = sortedDuties[0];
    const firstDutyStartMs = parseTimeToMs(firstDuty.date, firstDuty.reportTimeLocal, 6);

    // Pre-first-duty baseline (rested state)
    if (firstDutyStartMs > monthStart) {
      points.push({
        timestampMs: monthStart,
        performance: 97,
        sleepReservoir: 98,
        phase: 'rest',
        riskLevel: 'LOW',
      });
    }

    for (let i = 0; i < sortedDuties.length; i++) {
      const duty = sortedDuties[i];
      const reportMs = parseTimeToMs(duty.date, duty.reportTimeLocal, 6);
      const releaseMs = reportMs + duty.dutyHours * 60 * 60 * 1000;
      const reservoir = debtToReservoir(duty.sleepDebt);

      // Build duty label for tooltips
      const dutyLabel = duty.flightSegments.length > 0
        ? duty.flightSegments.map(s => s.flightNumber).filter(Boolean).join(' → ')
        : `Duty ${i + 1}`;

      // Check for high-res data
      const highRes = duty.dutyId && highResTimelines?.get(duty.dutyId);

      if (highRes && highRes.timeline.length > 0) {
        // Use high-resolution 5-min data
        for (const pt of highRes.timeline) {
          const tsMs = new Date(pt.timestamp).getTime();
          points.push({
            timestampMs: tsMs,
            performance: pt.performance,
            sleepReservoir: debtToReservoir(highRes.summary.sleep_debt),
            circadian: pt.circadian,
            homeostatic: pt.sleep_pressure,
            sleepInertia: pt.sleep_inertia,
            hoursAwake: pt.hours_on_duty + (duty.preDutyAwakeHours || 0),
            sleepDebt: highRes.summary.sleep_debt,
            priorSleep: highRes.summary.prior_sleep,
            phase: pt.is_in_rest ? 'sleep' : 'duty',
            dutyId: duty.dutyId,
            flightPhase: pt.flight_phase,
            riskLevel: getRiskLevel(pt.performance),
            isHighRes: true,
            dutyLabel,
            flightNumber: duty.flightSegments.find(s =>
              s.flightNumber && pt.flight_phase
            )?.flightNumber,
            departure: duty.flightSegments[0]?.departure,
            arrival: duty.flightSegments[duty.flightSegments.length - 1]?.arrival,
          });
        }
      } else {
        // Coarse mode: place key points across the duty

        // Transition point just before duty (from rest to duty)
        const preReportMs = reportMs - 30 * 60 * 1000; // 30 min before report
        if (points.length > 0 && preReportMs > points[points.length - 1].timestampMs) {
          const lastPerf = points[points.length - 1].performance;
          points.push({
            timestampMs: preReportMs,
            performance: Math.min(lastPerf, duty.avgPerformance + 3),
            sleepReservoir: reservoir + 2,
            sleepDebt: duty.sleepDebt,
            priorSleep: duty.priorSleep,
            phase: 'awake',
            riskLevel: getRiskLevel(duty.avgPerformance + 3),
            dutyLabel,
          });
        }

        // Report time (duty start)
        points.push({
          timestampMs: reportMs,
          performance: duty.avgPerformance,
          sleepReservoir: reservoir,
          sleepDebt: duty.sleepDebt,
          priorSleep: duty.priorSleep,
          hoursAwake: duty.preDutyAwakeHours,
          phase: 'duty',
          dutyId: duty.dutyId,
          riskLevel: getRiskLevel(duty.avgPerformance),
          dutyLabel,
          departure: duty.flightSegments[0]?.departure,
          arrival: duty.flightSegments[duty.flightSegments.length - 1]?.arrival,
        });

        // Mid-duty nadir (performance dip)
        const midMs = reportMs + (releaseMs - reportMs) * 0.6;
        points.push({
          timestampMs: midMs,
          performance: duty.minPerformance,
          sleepReservoir: reservoir - 2,
          sleepDebt: duty.sleepDebt,
          phase: 'duty',
          dutyId: duty.dutyId,
          riskLevel: getRiskLevel(duty.minPerformance),
          dutyLabel,
        });

        // Landing performance (near end of duty)
        if (duty.landingPerformance && duty.landingPerformance !== duty.minPerformance) {
          const landingMs = reportMs + (releaseMs - reportMs) * 0.85;
          points.push({
            timestampMs: landingMs,
            performance: duty.landingPerformance,
            sleepReservoir: reservoir - 3,
            sleepDebt: duty.sleepDebt,
            phase: 'duty',
            dutyId: duty.dutyId,
            riskLevel: getRiskLevel(duty.landingPerformance),
            dutyLabel,
            flightNumber: duty.flightSegments[duty.flightSegments.length - 1]?.flightNumber,
          });
        }

        // Release time
        points.push({
          timestampMs: releaseMs,
          performance: duty.avgPerformance - 2,
          sleepReservoir: reservoir - 3,
          sleepDebt: duty.sleepDebt,
          phase: 'duty',
          dutyId: duty.dutyId,
          riskLevel: getRiskLevel(duty.avgPerformance - 2),
          dutyLabel,
        });
      }

      // Duty region
      dutyRegions.push({
        startMs: reportMs,
        endMs: releaseMs,
        type: 'duty',
        label: dutyLabel,
        dutyId: duty.dutyId,
        riskLevel: duty.overallRisk,
      });

      // Sleep region (from sleep estimate)
      if (duty.sleepEstimate?.sleepStartIso && duty.sleepEstimate?.sleepEndIso) {
        const sleepStartMs = new Date(duty.sleepEstimate.sleepStartIso).getTime();
        const sleepEndMs = new Date(duty.sleepEstimate.sleepEndIso).getTime();
        if (!isNaN(sleepStartMs) && !isNaN(sleepEndMs)) {
          sleepRegions.push({
            startMs: sleepStartMs,
            endMs: sleepEndMs,
            type: 'sleep',
            label: duty.sleepEstimate.sleepStrategy,
          });
        }
      }

      // Recovery between duties
      const nextDuty = sortedDuties[i + 1];
      if (nextDuty) {
        const nextReportMs = parseTimeToMs(nextDuty.date, nextDuty.reportTimeLocal, 6);
        const gapHours = (nextReportMs - releaseMs) / (1000 * 60 * 60);

        if (gapHours > 2) {
          // Sleep period performance (deep recovery)
          const sleepStartMs = releaseMs + 2 * 60 * 60 * 1000; // ~2h after release
          const sleepEndMs = sleepStartMs + Math.min(8, gapHours - 3) * 60 * 60 * 1000;
          const sleepEfficiency = duty.sleepEstimate?.sleepEfficiency || 0.85;
          const recoveryRate = 3 + sleepEfficiency * 5; // 3-8% per hour of gap
          const recoveredPerf = Math.min(97, (duty.avgPerformance - 2) + gapHours * recoveryRate / 10);
          const recoveredReservoir = Math.min(98, (reservoir - 3) + gapHours * 1.5);

          // Post-duty wind-down
          points.push({
            timestampMs: sleepStartMs,
            performance: duty.avgPerformance - 5,
            sleepReservoir: reservoir - 4,
            phase: 'awake',
            riskLevel: getRiskLevel(duty.avgPerformance - 5),
          });

          // Post-sleep recovery
          points.push({
            timestampMs: sleepEndMs,
            performance: recoveredPerf,
            sleepReservoir: recoveredReservoir,
            phase: 'rest',
            riskLevel: getRiskLevel(recoveredPerf),
          });
        }
      }
    }

    // Rest day sleep regions
    if (restDaysSleep) {
      for (const restDay of restDaysSleep) {
        for (const block of restDay.sleepBlocks) {
          if (block.sleepStartIso && block.sleepEndIso) {
            const startMs = new Date(block.sleepStartIso).getTime();
            const endMs = new Date(block.sleepEndIso).getTime();
            if (!isNaN(startMs) && !isNaN(endMs)) {
              sleepRegions.push({
                startMs: startMs,
                endMs: endMs,
                type: 'sleep',
                label: block.sleepType,
              });
            }
          }
        }
      }
    }

    // Post-last-duty recovery to month end
    if (sortedDuties.length > 0) {
      const lastDuty = sortedDuties[sortedDuties.length - 1];
      const lastReleaseMs = parseTimeToMs(lastDuty.date, lastDuty.reportTimeLocal, 6) +
        lastDuty.dutyHours * 60 * 60 * 1000;

      if (monthEnd > lastReleaseMs + 12 * 60 * 60 * 1000) {
        points.push({
          timestampMs: monthEnd - 1000,
          performance: 97,
          sleepReservoir: 98,
          phase: 'rest',
          riskLevel: 'LOW',
        });
      }
    }

    // Sort by timestamp
    points.sort((a, b) => a.timestampMs - b.timestampMs);

    return { data: points, dutyRegions, sleepRegions };
  }, [duties, restDaysSleep, month, highResTimelines]);
}
