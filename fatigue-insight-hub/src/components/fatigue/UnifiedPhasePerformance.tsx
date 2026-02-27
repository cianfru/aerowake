import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, ChevronDown } from 'lucide-react';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DutyAnalysis, FlightPhase } from '@/types/fatigue';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { getPerformanceColor } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface UnifiedPhasePerformanceProps {
  duty: DutyAnalysis;
  timeline: DutyDetailTimeline | null;
}

/* ── Phase configuration ──────────────────────────────────── */

const phaseConfig: Record<string, { label: string; icon: string; critical: boolean }> = {
  preflight:         { label: 'Pre-flight', icon: '📋', critical: false },
  taxi:              { label: 'Taxi',       icon: '🛞', critical: false },
  taxi_out:          { label: 'Taxi Out',   icon: '🛞', critical: false },
  takeoff:           { label: 'Takeoff',    icon: '🛫', critical: true },
  climb:             { label: 'Climb',      icon: '📈', critical: false },
  cruise:            { label: 'Cruise',     icon: '✈️', critical: false },
  descent:           { label: 'Descent',    icon: '📉', critical: false },
  approach:          { label: 'Approach',   icon: '🎯', critical: true },
  landing:           { label: 'Landing',    icon: '🛬', critical: true },
  taxi_in:           { label: 'Taxi In',    icon: '🛞', critical: false },
  ground_turnaround: { label: 'Ground',     icon: '🔄', critical: false },
};

/** Workload multipliers (from backend WorkloadModel). */
const PHASE_WORKLOAD: Record<string, { multiplier: number; color: string; short: string }> = {
  preflight:         { multiplier: 1.1, color: 'hsl(var(--muted-foreground))', short: 'PRE' },
  taxi_out:          { multiplier: 1.0, color: 'hsl(160, 60%, 45%)',          short: 'TXO' },
  takeoff:           { multiplier: 1.8, color: 'hsl(30, 95%, 55%)',           short: 'T/O' },
  climb:             { multiplier: 1.3, color: 'hsl(200, 70%, 55%)',          short: 'CLB' },
  cruise:            { multiplier: 0.8, color: 'hsl(220, 60%, 55%)',          short: 'CRZ' },
  descent:           { multiplier: 1.2, color: 'hsl(200, 70%, 55%)',          short: 'DES' },
  approach:          { multiplier: 1.5, color: 'hsl(40, 95%, 50%)',           short: 'APP' },
  landing:           { multiplier: 2.0, color: 'hsl(0, 80%, 55%)',            short: 'LDG' },
  taxi_in:           { multiplier: 1.0, color: 'hsl(160, 60%, 45%)',          short: 'TXI' },
  ground_turnaround: { multiplier: 1.2, color: 'hsl(var(--muted-foreground))', short: 'GND' },
};

interface PhaseRow {
  phase: string;
  label: string;
  icon: string;
  performance: number;
  multiplier: number;
  durationMin: number;
  color: string;
  short: string;
  isCritical: boolean;
}

/* ── Helper: build phase rows from timeline segments ──────── */

function buildPhaseRowsFromTimeline(timeline: DutyDetailTimeline): PhaseRow[] {
  if (!timeline?.timeline?.length) return [];

  const result: PhaseRow[] = [];
  let currentPhase: string | null = null;
  let phaseStart = 0;
  let perfSum = 0;
  let count = 0;
  let anyCritical = false;

  const flushPhase = (endHours: number) => {
    if (!currentPhase || count === 0) return;
    const meta = PHASE_WORKLOAD[currentPhase] || { multiplier: 1.0, color: 'hsl(var(--muted-foreground))', short: '?' };
    const cfg = phaseConfig[currentPhase] || { label: currentPhase, icon: '•', critical: false };
    result.push({
      phase: currentPhase,
      label: cfg.label,
      icon: cfg.icon,
      performance: perfSum / count,
      multiplier: meta.multiplier,
      durationMin: count * 5,
      color: meta.color,
      short: meta.short,
      isCritical: anyCritical || cfg.critical,
    });
  };

  for (const pt of timeline.timeline) {
    const phase = pt.flight_phase;
    if (!phase) {
      flushPhase(pt.hours_on_duty);
      currentPhase = null;
      count = 0;
      perfSum = 0;
      anyCritical = false;
      continue;
    }
    if (phase !== currentPhase) {
      flushPhase(pt.hours_on_duty);
      currentPhase = phase;
      phaseStart = pt.hours_on_duty;
      perfSum = 0;
      count = 0;
      anyCritical = false;
    }
    perfSum += pt.performance;
    anyCritical = anyCritical || pt.is_critical;
    count++;
  }
  // Flush last
  if (currentPhase && count > 0) {
    const lastPt = timeline.timeline[timeline.timeline.length - 1];
    flushPhase(lastPt.hours_on_duty);
  }

  return result;
}

/* ── Helper: build phase rows from duty performance data ──── */

function buildPhaseRowsFromDuty(duty: DutyAnalysis): PhaseRow[] {
  const phases: { phase: FlightPhase; perf: number }[] = duty.phasePerformance?.map(pp => ({
    phase: pp.phase,
    perf: pp.performance,
  })) ?? [
    { phase: 'preflight' as FlightPhase, perf: duty.avgPerformance + 5 },
    { phase: 'taxi' as FlightPhase, perf: duty.avgPerformance + 3 },
    { phase: 'takeoff' as FlightPhase, perf: duty.avgPerformance + 2 },
    { phase: 'climb' as FlightPhase, perf: duty.avgPerformance },
    { phase: 'cruise' as FlightPhase, perf: duty.avgPerformance - 2 },
    { phase: 'descent' as FlightPhase, perf: duty.minPerformance + 5 },
    { phase: 'approach' as FlightPhase, perf: duty.minPerformance + 2 },
    { phase: 'landing' as FlightPhase, perf: duty.landingPerformance },
  ];

  return phases.map(p => {
    const cfg = phaseConfig[p.phase] || { label: p.phase, icon: '•', critical: false };
    const meta = PHASE_WORKLOAD[p.phase] || { multiplier: 1.0, color: 'hsl(var(--muted-foreground))', short: '?' };
    return {
      phase: p.phase,
      label: cfg.label,
      icon: cfg.icon,
      performance: Math.max(0, Math.min(100, p.perf)),
      multiplier: meta.multiplier,
      durationMin: 0, // Not available from duty-level data
      color: meta.color,
      short: meta.short,
      isCritical: cfg.critical,
    };
  });
}

/* ── Performance color helpers ────────────────────────────── */

const getTextColor = (v: number) =>
  v >= 70 ? 'text-success' : v >= 60 ? 'text-warning' : v >= 50 ? 'text-high' : 'text-critical';

/* ── Main component ──────────────────────────────────────── */

export function UnifiedPhasePerformance({ duty, timeline }: UnifiedPhasePerformanceProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());

  // Prefer timeline-derived rows (more accurate), fall back to duty-level data
  const rows = useMemo<PhaseRow[]>(() => {
    if (timeline && timeline.timeline.some(pt => pt.flight_phase)) {
      return buildPhaseRowsFromTimeline(timeline);
    }
    return buildPhaseRowsFromDuty(duty);
  }, [timeline, duty]);

  // Timeline segments for the workload lane bar
  const laneSegments = useMemo(() => {
    if (!timeline) return [];
    return buildPhaseRowsFromTimeline(timeline);
  }, [timeline]);

  const hasMultipleSegments = duty.flightSegments.length > 1;

  if (rows.length === 0) return null;

  const totalDuration = laneSegments.reduce((sum, s) => sum + s.durationMin, 0);

  const criticalRows = rows.filter(r => r.isCritical);
  const lowestCritical = criticalRows.length > 0
    ? criticalRows.reduce((a, b) => a.performance < b.performance ? a : b)
    : null;

  const toggleSegment = (index: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            Phase Performance
            {FATIGUE_INFO.workloadPhase && <InfoTooltip entry={FATIGUE_INFO.workloadPhase} size="sm" />}
            {hasMultipleSegments && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {duty.flightSegments.length} sectors
              </Badge>
            )}
          </span>
          {lowestCritical && lowestCritical.performance < 60 && (
            <Badge variant="critical" className="text-[10px]">
              {lowestCritical.label}: {lowestCritical.performance.toFixed(0)}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {/* Workload phase lane bar */}
        {laneSegments.length > 0 && totalDuration > 0 && (
          <div className="flex items-stretch h-6 rounded-lg overflow-hidden border border-border/50 bg-secondary/20">
            {laneSegments.map((seg, i) => {
              const widthPct = Math.max(2, (seg.durationMin / totalDuration) * 100);
              return (
                <div
                  key={`${seg.phase}-${i}`}
                  className="relative flex items-center justify-center overflow-hidden"
                  style={{ width: `${widthPct}%`, backgroundColor: seg.color, opacity: 0.85 }}
                  title={`${seg.label}: ${seg.durationMin}min, ${seg.multiplier}x, avg ${seg.performance.toFixed(0)}%`}
                >
                  {widthPct > 6 && (
                    <span className="text-[8px] font-bold text-white drop-shadow-sm">{seg.short}</span>
                  )}
                  <span
                    className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full"
                    style={{ backgroundColor: getPerformanceColor(seg.performance) }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Compact phase table */}
        <div className="space-y-0.5">
          {rows.map((row, i) => (
            <div
              key={`${row.phase}-${i}`}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded text-xs',
                row.isCritical && 'border-l-2 border-critical/60 bg-critical/5',
              )}
            >
              <span className="w-4 text-center text-[11px]">{row.icon}</span>
              <span className={cn('w-20 truncate', row.isCritical && 'font-medium')}>{row.label}</span>
              <span className={cn('w-10 text-right font-mono font-medium', getTextColor(row.performance))}>
                {row.performance.toFixed(0)}%
              </span>
              <span className="w-10 text-right text-muted-foreground font-mono">
                {row.multiplier}x
              </span>
              {row.durationMin > 0 && (
                <span className="w-10 text-right text-muted-foreground">
                  {row.durationMin}m
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Per-sector collapsible for multi-sector duties */}
        {hasMultipleSegments && (
          <div className="border-t border-border/50 pt-2 space-y-1">
            <h5 className="text-[10px] font-medium text-muted-foreground">Per-Sector</h5>
            {duty.flightSegments.map((seg, idx) => {
              const isExpanded = expandedSegments.has(idx);
              const segPerf = seg.performance || duty.avgPerformance;
              const segPhases = buildSegmentPhases(seg, duty.avgPerformance);

              return (
                <Collapsible key={idx} open={isExpanded} onOpenChange={() => toggleSegment(idx)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-secondary/40 hover:bg-secondary/50 transition-colors text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-primary">{seg.flightNumber}</span>
                        <span className="text-muted-foreground">{seg.departure} → {seg.arrival}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('font-mono font-medium', getTextColor(segPerf))}>{segPerf.toFixed(0)}%</span>
                        <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 pt-1">
                    <div className="space-y-0.5">
                      {segPhases.map((sp, si) => (
                        <div key={si} className={cn(
                          'flex items-center gap-2 px-1.5 py-0.5 rounded text-[11px]',
                          sp.isCritical && 'border-l-2 border-critical/60',
                        )}>
                          <span className="w-3 text-center text-[10px]">{sp.icon}</span>
                          <span className="w-16 truncate">{sp.label}</span>
                          <span className={cn('w-10 text-right font-mono', getTextColor(sp.performance))}>
                            {sp.performance.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Segment-level phase estimation (from FlightPhasePerformance) ── */

interface SimplePhase {
  label: string;
  icon: string;
  performance: number;
  isCritical: boolean;
}

function buildSegmentPhases(segment: { performance: number; flightNumber: string }, dutyAvg: number): SimplePhase[] {
  const base = segment.performance || dutyAvg;
  return [
    { label: 'Pre-flight', icon: '📋', performance: Math.min(100, base + 5), isCritical: false },
    { label: 'Taxi',       icon: '🛞', performance: Math.min(100, base + 3), isCritical: false },
    { label: 'Takeoff',    icon: '🛫', performance: Math.min(100, base + 2), isCritical: true },
    { label: 'Climb',      icon: '📈', performance: base,                    isCritical: false },
    { label: 'Cruise',     icon: '✈️', performance: base - 2,               isCritical: false },
    { label: 'Descent',    icon: '📉', performance: base - 3,               isCritical: false },
    { label: 'Approach',   icon: '🎯', performance: base - 4,               isCritical: true },
    { label: 'Landing',    icon: '🛬', performance: base - 5,               isCritical: true },
  ].map(p => ({ ...p, performance: Math.max(0, Math.min(100, p.performance)) }));
}
