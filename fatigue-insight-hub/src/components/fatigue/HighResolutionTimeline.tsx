import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DutyAnalysis, DutyStatistics } from '@/types/fatigue';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface HighResolutionTimelineProps {
  duties: DutyAnalysis[];
  statistics: DutyStatistics;
  month: Date;
  pilotId: string;
}

interface DutyBar {
  dayIndex: number;
  startHour: number;
  endHour: number;
  startPerformance: number;
  endPerformance: number;
  duty: DutyAnalysis;
}

// WOCL (Window of Circadian Low) is typically 02:00 - 06:00
const WOCL_START = 2;
const WOCL_END = 6;

const getPerformanceColor = (performance: number): string => {
  // Create gradient from red (0) to yellow (50) to green (100)
  if (performance >= 80) return 'hsl(120, 70%, 45%)'; // Green
  if (performance >= 70) return 'hsl(90, 70%, 50%)'; // Yellow-green
  if (performance >= 60) return 'hsl(55, 90%, 55%)'; // Yellow
  if (performance >= 50) return 'hsl(40, 95%, 50%)'; // Orange-yellow
  if (performance >= 40) return 'hsl(25, 95%, 50%)'; // Orange
  return 'hsl(0, 80%, 50%)'; // Red
};

export function HighResolutionTimeline({ duties, statistics, month, pilotId }: HighResolutionTimelineProps) {
  const daysInMonth = getDaysInMonth(month);
  const monthStart = startOfMonth(month);

  // Generate all days of the month
  const allDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));
  }, [daysInMonth, monthStart]);

  // Convert duties to bar positions with start/end performance for gradients
  const dutyBars = useMemo(() => {
    const bars: DutyBar[] = [];
    
    duties.forEach((duty) => {
      const dayOfMonth = duty.date.getDate();
      
      // Calculate start and end times from flight segments
      if (duty.flightSegments.length > 0) {
        const firstSegment = duty.flightSegments[0];
        const lastSegment = duty.flightSegments[duty.flightSegments.length - 1];
        
        const [startH, startM] = firstSegment.departureTime.split(':').map(Number);
        const [endH, endM] = lastSegment.arrivalTime.split(':').map(Number);
        
        const startHour = startH + startM / 60;
        let endHour = endH + endM / 60;
        
        // Get performance at start (first segment) and end (last segment/landing)
        const startPerformance = firstSegment.performance;
        const endPerformance = duty.landingPerformance;
        
        // Handle overnight duties
        if (endHour < startHour) {
          // Calculate mid-point performance for the split
          const totalDuration = (24 - startHour) + endHour;
          const firstPartRatio = (24 - startHour) / totalDuration;
          const midPerformance = startPerformance - (startPerformance - endPerformance) * firstPartRatio;
          
          // First bar: from start to midnight
          bars.push({
            dayIndex: dayOfMonth,
            startHour,
            endHour: 24,
            startPerformance,
            endPerformance: midPerformance,
            duty,
          });
          // Second bar: from midnight to end (next day)
          if (dayOfMonth < daysInMonth) {
            bars.push({
              dayIndex: dayOfMonth + 1,
              startHour: 0,
              endHour,
              startPerformance: midPerformance,
              endPerformance,
              duty,
            });
          }
        } else {
          bars.push({
            dayIndex: dayOfMonth,
            startHour,
            endHour,
            startPerformance,
            endPerformance,
            duty,
          });
        }
      }
    });
    
    return bars;
  }, [duties, daysInMonth]);

  // Check for WOCL exposure, FLIP violations, and sleep recovery
  const getDayWarnings = (dayOfMonth: number) => {
    const duty = duties.find(d => d.date.getDate() === dayOfMonth);
    if (!duty) return { wocl: false, flip: null, sleepRecovery: null };
    
    // Calculate recovery score from strategic sleep estimator
    const sleepEstimate = duty.sleepEstimate;
    let recoveryScore: number | null = null;
    if (sleepEstimate) {
      const baseScore = (sleepEstimate.effectiveSleepHours / 8) * 100;
      const efficiencyBonus = sleepEstimate.sleepEfficiency * 20;
      const woclPenalty = sleepEstimate.woclOverlapHours * 5;
      recoveryScore = Math.min(100, Math.max(0, baseScore + efficiencyBonus - woclPenalty));
    }
    
    return {
      wocl: duty.woclExposure > 2,
      flip: duty.priorSleep < 20 ? Math.round(duty.priorSleep) : null,
      sleepRecovery: recoveryScore,
      sleepStrategy: sleepEstimate?.sleepStrategy,
      effectiveSleep: sleepEstimate?.effectiveSleepHours,
    };
  };
  
  const getRecoveryColor = (score: number): string => {
    if (score >= 80) return 'text-success';
    if (score >= 65) return 'text-success/80';
    if (score >= 50) return 'text-warning';
    if (score >= 35) return 'text-high';
    return 'text-critical';
  };
  
  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'anchor': return '⚓';
      case 'split': return '✂️';
      case 'nap': return '💤';
      case 'extended': return '🛏️';
      case 'restricted': return '⏰';
      case 'recovery': return '🔋';
      default: return '😴';
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-center">
          {format(month, 'MMMM yyyy')} - High-Resolution Duty Timeline
        </CardTitle>
        <p className="text-center text-sm text-muted-foreground">
          Pilot: {pilotId} | Duties: {statistics.totalDuties} | High Risk: {statistics.highRiskDuties} | Critical: {statistics.criticalRiskDuties}
        </p>
        <div className="flex items-center justify-center gap-4 pt-2 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-4 w-8 rounded bg-purple-300/30" />
            WOCL
          </span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pb-4">
        <div className="relative min-w-[900px]">
          {/* Timeline Grid */}
          <div className="flex">
            {/* Y-axis labels (days) */}
            <div className="w-24 flex-shrink-0">
              <div className="h-8" /> {/* Header spacer */}
              {allDays.map((day, index) => {
                const warnings = getDayWarnings(index + 1);
                return (
                  <div
                    key={index}
                    className="relative flex h-7 items-center justify-end gap-1 pr-2 text-xs"
                  >
                    {warnings.sleepRecovery !== null && (
                      <span className={cn("text-[10px] font-medium", getRecoveryColor(warnings.sleepRecovery))}>
                        {warnings.sleepStrategy && getStrategyIcon(warnings.sleepStrategy)}
                        {Math.round(warnings.sleepRecovery)}%
                      </span>
                    )}
                    {warnings.wocl && (
                      <span className="text-[10px] text-warning">⚠ WOCL</span>
                    )}
                    {warnings.flip && (
                      <span className="text-[10px] text-critical">⚠ {warnings.flip}h</span>
                    )}
                    <span className="font-medium text-foreground">
                      {format(day, 'EEE d')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Main chart area */}
            <div className="relative flex-1">
              {/* X-axis header */}
              <div className="flex h-8 border-b border-border">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-[10px] text-muted-foreground"
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Grid with WOCL shading and duty bars */}
              <div className="relative">
                {/* WOCL shading */}
                <div
                  className="absolute top-0 bottom-0 bg-purple-400/20"
                  style={{
                    left: `${(WOCL_START / 24) * 100}%`,
                    width: `${((WOCL_END - WOCL_START) / 24) * 100}%`,
                  }}
                />

                {/* Grid lines */}
                <div className="absolute inset-0 flex">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 border-r",
                        hour % 3 === 0 ? "border-border/50" : "border-border/50"
                      )}
                    />
                  ))}
                </div>

                {/* Day rows */}
                {allDays.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="relative h-7 border-b border-border/50"
                  >
                    {/* Duty bars for this day with gradient showing performance decay */}
                    {dutyBars
                      .filter((bar) => bar.dayIndex === dayIndex + 1)
                      .map((bar, barIndex) => {
                        const sleepEstimate = bar.duty.sleepEstimate;
                        const sleepInfo = sleepEstimate 
                          ? ` | Sleep: ${sleepEstimate.effectiveSleepHours.toFixed(1)}h (${(sleepEstimate.sleepEfficiency * 100).toFixed(0)}% eff) ${getStrategyIcon(sleepEstimate.sleepStrategy)}`
                          : '';
                        
                        return (
                          <div
                            key={barIndex}
                            className="absolute top-1 bottom-1 rounded-sm transition-all hover:ring-2 hover:ring-foreground/50 cursor-pointer"
                            style={{
                              left: `${(bar.startHour / 24) * 100}%`,
                              width: `${((bar.endHour - bar.startHour) / 24) * 100}%`,
                              background: `linear-gradient(to right, ${getPerformanceColor(bar.startPerformance)}, ${getPerformanceColor(bar.endPerformance)})`,
                            }}
                            title={`${format(bar.duty.date, 'MMM d')}: ${bar.duty.flightSegments.map(s => s.flightNumber).join(', ')} - Start: ${bar.startPerformance.toFixed(0)}% → End: ${bar.endPerformance.toFixed(0)}%${sleepInfo}`}
                          />
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>

            {/* Color legend */}
            <div className="ml-4 flex w-16 flex-shrink-0 flex-col items-center">
              <div className="h-8 text-[10px] text-muted-foreground">Score</div>
              <div className="relative h-full w-4 rounded-sm overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to bottom, hsl(120, 70%, 45%), hsl(90, 70%, 50%), hsl(55, 90%, 55%), hsl(40, 95%, 50%), hsl(25, 95%, 50%), hsl(0, 80%, 50%))',
                  }}
                />
              </div>
              <div className="mt-1 flex w-full flex-col text-[9px] text-muted-foreground">
                <span className="text-right">100</span>
                <span className="mt-auto text-right">0</span>
              </div>
            </div>
          </div>

          {/* X-axis label */}
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Time of Day (Home Base)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
