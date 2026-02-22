import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DutyAnalysis, FlightPhase, FlightSegment } from '@/types/fatigue';
import { Badge } from '@/components/ui/badge';
import { Plane, AlertTriangle, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface FlightPhasePerformanceProps {
  duty: DutyAnalysis;
}

interface PhaseData {
  phase: FlightPhase;
  label: string;
  icon: string;
  performance: number;
  isCritical: boolean;
}

const phaseConfig: Record<FlightPhase, { label: string; icon: string; critical: boolean }> = {
  preflight: { label: 'Pre-flight', icon: '📋', critical: false },
  taxi: { label: 'Taxi', icon: '🛞', critical: false },
  takeoff: { label: 'Takeoff', icon: '🛫', critical: true },
  climb: { label: 'Climb', icon: '📈', critical: false },
  cruise: { label: 'Cruise', icon: '✈️', critical: false },
  descent: { label: 'Descent', icon: '📉', critical: false },
  approach: { label: 'Approach', icon: '🎯', critical: true },
  landing: { label: 'Landing', icon: '🛬', critical: true },
};

const getPerformanceColor = (performance: number): string => {
  if (performance >= 70) return 'bg-success';
  if (performance >= 60) return 'bg-warning';
  if (performance >= 50) return 'bg-high';
  return 'bg-critical';
};

const getPerformanceTextColor = (performance: number): string => {
  if (performance >= 70) return 'text-success';
  if (performance >= 60) return 'text-warning';
  if (performance >= 50) return 'text-high';
  return 'text-critical';
};

// Generate simulated phase performance for a single flight segment
const generateSegmentPhases = (segment: FlightSegment, dutyAvg: number): PhaseData[] => {
  const basePerf = segment.performance || dutyAvg;
  // Landing performance is derived from segment's own performance (represents end of this segment)
  // Slightly lower than approach due to final phase fatigue
  const segmentLandingPerf = basePerf - 5;

  return [
    { phase: 'preflight' as FlightPhase, label: 'Pre-flight', icon: '📋', performance: Math.min(100, basePerf + 5), isCritical: false },
    { phase: 'taxi' as FlightPhase, label: 'Taxi', icon: '🛞', performance: Math.min(100, basePerf + 3), isCritical: false },
    { phase: 'takeoff' as FlightPhase, label: 'Takeoff', icon: '🛫', performance: Math.min(100, basePerf + 2), isCritical: true },
    { phase: 'climb' as FlightPhase, label: 'Climb', icon: '📈', performance: basePerf, isCritical: false },
    { phase: 'cruise' as FlightPhase, label: 'Cruise', icon: '✈️', performance: basePerf - 2, isCritical: false },
    { phase: 'descent' as FlightPhase, label: 'Descent', icon: '📉', performance: basePerf - 3, isCritical: false },
    { phase: 'approach' as FlightPhase, label: 'Approach', icon: '🎯', performance: basePerf - 4, isCritical: true },
    { phase: 'landing' as FlightPhase, label: 'Landing', icon: '🛬', performance: segmentLandingPerf, isCritical: true },
  ].map(p => ({ ...p, performance: Math.max(0, Math.min(100, p.performance)) }));
};

// Single flight phase display component
function FlightPhaseBar({ phase }: { phase: PhaseData }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 w-24 ${phase.isCritical ? 'font-medium' : ''}`}>
        <span>{phase.icon}</span>
        <span className="text-xs">{phase.label}</span>
        {phase.isCritical && (
          <span className="text-[10px] text-critical">●</span>
        )}
      </div>
      <div className="flex-1 h-5 bg-secondary/50 rounded-full overflow-hidden relative">
        <div
          className={`h-full ${getPerformanceColor(phase.performance)} transition-all duration-500`}
          style={{ width: `${phase.performance}%` }}
        />
        <div className="absolute top-0 bottom-0 left-[50%] w-px bg-critical/50" />
        <div className="absolute top-0 bottom-0 left-[70%] w-px bg-success/50" />
      </div>
      <div className={`w-12 text-right text-xs font-mono ${getPerformanceTextColor(phase.performance)}`}>
        {phase.performance.toFixed(0)}%
      </div>
    </div>
  );
}

export function FlightPhasePerformance({ duty }: FlightPhasePerformanceProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const hasMultipleSegments = duty.flightSegments.length > 1;

  const toggleSegment = (index: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Generate overall duty phase performance
  const overallPhasePerformance: PhaseData[] = duty.phasePerformance?.map(pp => ({
    phase: pp.phase,
    label: phaseConfig[pp.phase].label,
    icon: phaseConfig[pp.phase].icon,
    performance: pp.performance,
    isCritical: pp.isCritical,
  })) || [
    { phase: 'preflight' as FlightPhase, label: 'Pre-flight', icon: '📋', performance: duty.avgPerformance + 5, isCritical: false },
    { phase: 'taxi' as FlightPhase, label: 'Taxi', icon: '🛞', performance: duty.avgPerformance + 3, isCritical: false },
    { phase: 'takeoff' as FlightPhase, label: 'Takeoff', icon: '🛫', performance: duty.avgPerformance + 2, isCritical: true },
    { phase: 'climb' as FlightPhase, label: 'Climb', icon: '📈', performance: duty.avgPerformance, isCritical: false },
    { phase: 'cruise' as FlightPhase, label: 'Cruise', icon: '✈️', performance: duty.avgPerformance - 2, isCritical: false },
    { phase: 'descent' as FlightPhase, label: 'Descent', icon: '📉', performance: duty.minPerformance + 5, isCritical: false },
    { phase: 'approach' as FlightPhase, label: 'Approach', icon: '🎯', performance: duty.minPerformance + 2, isCritical: true },
    { phase: 'landing' as FlightPhase, label: 'Landing', icon: '🛬', performance: duty.landingPerformance, isCritical: true },
  ];

  const clampedPhases = overallPhasePerformance.map(p => ({
    ...p,
    performance: Math.max(0, Math.min(100, p.performance)),
  }));

  const criticalPhases = clampedPhases.filter(p => p.isCritical);
  const lowestCritical = criticalPhases.reduce((a, b) => 
    a.performance < b.performance ? a : b
  , criticalPhases[0]);

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            Flight Phase Performance
            {hasMultipleSegments && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {duty.flightSegments.length} sectors
              </Badge>
            )}
          </span>
          {lowestCritical && lowestCritical.performance < 60 && (
            <Badge variant="critical" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {lowestCritical.label}: {lowestCritical.performance.toFixed(0)}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Duty Summary */}
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">
            {hasMultipleSegments ? 'Overall Duty (All Sectors Combined)' : 'Phase Breakdown'}
          </h5>
          <div className="space-y-2">
            {clampedPhases.map((phase) => (
              <FlightPhaseBar key={phase.phase} phase={phase} />
            ))}
          </div>
        </div>

        {/* Per-Sector Breakdown (for multi-sector duties) */}
        {hasMultipleSegments && (
          <div className="border-t border-border pt-4 space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground">Per-Sector Breakdown</h5>
            {duty.flightSegments.map((segment, index) => {
              const isExpanded = expandedSegments.has(index);
              const segmentPhases = generateSegmentPhases(segment, duty.avgPerformance);
              const lowestPhase = segmentPhases.reduce((a, b) => a.performance < b.performance ? a : b);
              
              return (
                <Collapsible key={index} open={isExpanded} onOpenChange={() => toggleSegment(index)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-primary">
                          {segment.flightNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {segment.departure} → {segment.arrival}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={segment.performance < 50 ? 'critical' : segment.performance < 60 ? 'warning' : 'success'}
                          className="text-[10px]"
                        >
                          {segment.performance.toFixed(0)}%
                        </Badge>
                        {lowestPhase.performance < 60 && (
                          <span className="text-[10px] text-critical">
                            ⚠️ {phaseConfig[lowestPhase.phase].label}
                          </span>
                        )}
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 pl-4">
                    <div className="space-y-1.5 text-xs">
                      {segmentPhases.map((phase) => (
                        <FlightPhaseBar key={phase.phase} phase={phase} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="text-critical">●</span>
              Critical Phase
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" />
              70%+
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warning" />
              60-70%
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-critical" />
              &lt;60%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
