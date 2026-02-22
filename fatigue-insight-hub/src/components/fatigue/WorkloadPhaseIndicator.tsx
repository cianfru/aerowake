import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge } from 'lucide-react';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { getPerformanceColor } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface WorkloadPhaseIndicatorProps {
  /** High-resolution duty timeline from backend. */
  timeline: DutyDetailTimeline;
  /** Compact variant — just the bar, no card wrapper. */
  variant?: 'card' | 'inline';
}

/** Flight phase workload multipliers from backend WorkloadModel. */
const PHASE_WORKLOAD: Record<string, { multiplier: number; color: string; short: string }> = {
  preflight:          { multiplier: 1.1, color: 'hsl(var(--muted-foreground))', short: 'PRE' },
  taxi_out:           { multiplier: 1.0, color: 'hsl(160, 60%, 45%)', short: 'TXO' },
  takeoff:            { multiplier: 1.8, color: 'hsl(30, 95%, 55%)', short: 'T/O' },
  climb:              { multiplier: 1.3, color: 'hsl(200, 70%, 55%)', short: 'CLB' },
  cruise:             { multiplier: 0.8, color: 'hsl(220, 60%, 55%)', short: 'CRZ' },
  descent:            { multiplier: 1.2, color: 'hsl(200, 70%, 55%)', short: 'DES' },
  approach:           { multiplier: 1.5, color: 'hsl(40, 95%, 50%)', short: 'APP' },
  landing:            { multiplier: 2.0, color: 'hsl(0, 80%, 55%)', short: 'LDG' },
  taxi_in:            { multiplier: 1.0, color: 'hsl(160, 60%, 45%)', short: 'TXI' },
  ground_turnaround:  { multiplier: 1.2, color: 'hsl(var(--muted-foreground))', short: 'GND' },
};

interface PhaseSegment {
  phase: string;
  startHours: number;
  endHours: number;
  durationMin: number;
  avgPerformance: number;
  minPerformance: number;
  multiplier: number;
  color: string;
  short: string;
  isCritical: boolean;
}

/**
 * Workload Phase Indicator — shows color-coded flight phase segments
 * along the duty timeline with workload multipliers and performance.
 */
export function WorkloadPhaseIndicator({
  timeline,
  variant = 'card',
}: WorkloadPhaseIndicatorProps) {
  const segments = useMemo<PhaseSegment[]>(() => {
    if (!timeline?.timeline?.length) return [];

    const result: PhaseSegment[] = [];
    let currentPhase: string | null = null;
    let phaseStart = 0;
    let perfSum = 0;
    let perfMin = 100;
    let count = 0;
    let anyCritical = false;

    for (const pt of timeline.timeline) {
      const phase = pt.flight_phase;
      if (!phase) {
        // Flush current if exists
        if (currentPhase && count > 0) {
          const meta = PHASE_WORKLOAD[currentPhase] || { multiplier: 1.0, color: 'hsl(var(--muted-foreground))', short: '?' };
          result.push({
            phase: currentPhase,
            startHours: phaseStart,
            endHours: pt.hours_on_duty,
            durationMin: count * 5,
            avgPerformance: perfSum / count,
            minPerformance: perfMin,
            multiplier: meta.multiplier,
            color: meta.color,
            short: meta.short,
            isCritical: anyCritical,
          });
          currentPhase = null;
          count = 0;
          perfSum = 0;
          perfMin = 100;
          anyCritical = false;
        }
        continue;
      }

      if (phase !== currentPhase) {
        // Flush previous phase
        if (currentPhase && count > 0) {
          const meta = PHASE_WORKLOAD[currentPhase] || { multiplier: 1.0, color: 'hsl(var(--muted-foreground))', short: '?' };
          result.push({
            phase: currentPhase,
            startHours: phaseStart,
            endHours: pt.hours_on_duty,
            durationMin: count * 5,
            avgPerformance: perfSum / count,
            minPerformance: perfMin,
            multiplier: meta.multiplier,
            color: meta.color,
            short: meta.short,
            isCritical: anyCritical,
          });
        }
        currentPhase = phase;
        phaseStart = pt.hours_on_duty;
        perfSum = 0;
        perfMin = 100;
        count = 0;
        anyCritical = false;
      }

      perfSum += pt.performance;
      perfMin = Math.min(perfMin, pt.performance);
      anyCritical = anyCritical || pt.is_critical;
      count++;
    }

    // Flush last phase
    if (currentPhase && count > 0) {
      const lastPt = timeline.timeline[timeline.timeline.length - 1];
      const meta = PHASE_WORKLOAD[currentPhase] || { multiplier: 1.0, color: 'hsl(var(--muted-foreground))', short: '?' };
      result.push({
        phase: currentPhase,
        startHours: phaseStart,
        endHours: lastPt.hours_on_duty,
        durationMin: count * 5,
        avgPerformance: perfSum / count,
        minPerformance: perfMin,
        multiplier: meta.multiplier,
        color: meta.color,
        short: meta.short,
        isCritical: anyCritical,
      });
    }

    return result;
  }, [timeline]);

  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, s) => sum + s.durationMin, 0);

  const content = (
    <div className="space-y-2">
      {/* Horizontal phase bar */}
      <div className="flex items-stretch h-7 rounded-lg overflow-hidden border border-border/40 bg-secondary/20">
        {segments.map((seg, i) => {
          const widthPct = Math.max(2, (seg.durationMin / totalDuration) * 100);
          return (
            <div
              key={`${seg.phase}-${i}`}
              className="relative flex items-center justify-center overflow-hidden group transition-all"
              style={{
                width: `${widthPct}%`,
                backgroundColor: seg.color,
                opacity: 0.85,
              }}
              title={`${formatPhase(seg.phase)}: ${seg.durationMin}min, ${seg.multiplier}x workload, avg ${seg.avgPerformance.toFixed(0)}%`}
            >
              {widthPct > 6 && (
                <span className="text-[9px] font-bold text-white drop-shadow-sm">
                  {seg.short}
                </span>
              )}
              {/* Performance overlay dot */}
              <span
                className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getPerformanceColor(seg.avgPerformance) }}
              />
            </div>
          );
        })}
      </div>

      {/* Phase detail chips */}
      <div className="flex flex-wrap gap-1">
        {segments.map((seg, i) => (
          <div
            key={`${seg.phase}-${i}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
              seg.isCritical ? 'border-critical/50' : 'border-border/40',
            )}
            style={{
              backgroundColor: `${seg.color}15`,
              color: seg.color,
            }}
          >
            <span className="font-semibold">{seg.short}</span>
            <span className="text-muted-foreground">{seg.durationMin}m</span>
            <span className="font-mono" style={{ color: getPerformanceColor(seg.avgPerformance) }}>
              {seg.avgPerformance.toFixed(0)}%
            </span>
            <span className="text-muted-foreground">{seg.multiplier}x</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (variant === 'inline') return content;

  return (
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Gauge className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          Workload Phases
          <InfoTooltip entry={FATIGUE_INFO.workloadPhase} />
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function formatPhase(phase: string): string {
  return phase
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
