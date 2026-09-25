import { forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DutyAnalysis } from '@/types/fatigue';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { INDEX_AXIS_TICKS, INDEX_DOMAIN, indexTickAsKss, indexToKss, riskReferenceLines } from '@/lib/risk-scale';

/** Illustrative "rested" ceiling for rest days: index 80 = KSS 3 ("alert"). */
const RESTED_INDEX = 80;

interface PerformanceTimelineProps {
  duties: DutyAnalysis[];
  month: Date;
}

export function PerformanceTimeline({ duties, month }: PerformanceTimelineProps) {
  // Generate all days of the month
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Create chart data with recovery simulation using real backend sleep data
  const chartData = allDays.map((day, index) => {
    const duty = duties.find(d => isSameDay(d.date, day));
    
    if (duty) {
      // Use real backend sleep data (sleep_quality / sleepEstimate)
      const sleepEstimate = duty.sleepEstimate;
      
      // Recovery score based on effective sleep vs 8h target
      const recoveryScore = sleepEstimate 
        ? Math.min(100, (sleepEstimate.effectiveSleepHours / 8) * 100)
        : null;
      
      return {
        date: format(day, 'dd'),
        fullDate: format(day, 'MMM dd'),
        minPerformance: duty.minPerformance,
        avgPerformance: duty.avgPerformance,
        recoveryScore,
        // Real backend data
        totalSleep: sleepEstimate?.totalSleepHours,
        effectiveSleep: sleepEstimate?.effectiveSleepHours,
        sleepEfficiency: sleepEstimate?.sleepEfficiency,
        sleepStrategy: sleepEstimate?.sleepStrategy,
        woclOverlap: sleepEstimate?.woclOverlapHours,
        sleepTiming: sleepEstimate?.sleepStartTime && sleepEstimate?.sleepEndTime
          ? `${sleepEstimate.sleepStartTime}–${sleepEstimate.sleepEndTime}`
          : null,
        confidence: sleepEstimate?.confidence,
        warnings: sleepEstimate?.warnings,
        isDuty: true,
        dutyType: 'flight',
      };
    } else {
      // Rest day - find most recent duty for recovery modeling
      const previousDuties = duties.filter(d => d.date < day);
      const lastDuty = previousDuties.length > 0 
        ? previousDuties.reduce((a, b) => a.date > b.date ? a : b)
        : null;
      
      const daysSinceLastDuty = lastDuty 
        ? Math.floor((day.getTime() - lastDuty.date.getTime()) / (1000 * 60 * 60 * 24))
        : 5;
      
      // Use last duty's sleep efficiency for recovery modeling
      const lastSleepEstimate = lastDuty?.sleepEstimate;
      const baseSleepEfficiency = lastSleepEstimate?.sleepEfficiency || 0.85;
      
      // Recovery model: better prior sleep = faster recovery
      const baseRecovery = lastDuty ? lastDuty.avgPerformance : RESTED_INDEX;
      const recoveryRate = 5 + (baseSleepEfficiency * 5); // 5-10% per day
      const recoveredPerformance = Math.min(RESTED_INDEX, baseRecovery + (daysSinceLastDuty * recoveryRate));
      const minRecovered = Math.min(RESTED_INDEX - 3, (lastDuty?.minPerformance || RESTED_INDEX - 5) + (daysSinceLastDuty * recoveryRate));
      
      // Recovery score improves with rest days (home sleep quality ~90%)
      const recoveryScore = Math.min(100, 65 + (daysSinceLastDuty * 8));
      
      return {
        date: format(day, 'dd'),
        fullDate: format(day, 'MMM dd'),
        minPerformance: minRecovered,
        avgPerformance: recoveredPerformance,
        recoveryScore,
        // Estimated rest day values
        totalSleep: 7.5 + Math.min(0.5, daysSinceLastDuty * 0.1),
        effectiveSleep: 7 + Math.min(0.5, daysSinceLastDuty * 0.1),
        sleepEfficiency: 0.90, // Home sleep efficiency
        sleepStrategy: 'recovery' as const,
        woclOverlap: 0, // Normal bedtime = no WOCL overlap
        sleepTiming: '23:00–07:00', // Normal sleep pattern
        confidence: null,
        warnings: [],
        isDuty: false,
        dutyType: 'rest',
      };
    }
  });

  const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'anchor': return '⚓ Anchor Sleep';
      case 'split': return '✂️ Split Sleep';
      case 'nap': return '💤 Nap Strategy';
      case 'afternoon_nap': return '☀️ Afternoon Nap'; // For night departures
      case 'early_bedtime': return '🌙 Early Bedtime'; // For early reports
      case 'extended': return '🛏️ Extended Rest';
      case 'restricted': return '⏰ Restricted';
      case 'recovery': return '🔋 Recovery';
      case 'normal': return '😴 Normal Sleep';
      default: return '😴 Normal Sleep';
    }
  };

  const CustomTooltip = forwardRef<HTMLDivElement, any>(({ active, payload }: any, ref) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div ref={ref} className="rounded-lg border border-border bg-card p-3 shadow-lg max-w-xs">
          <p className="text-sm font-medium text-foreground">{data.fullDate}</p>
          <p className="text-xs text-muted-foreground mb-2">
            {data.isDuty ? '✈️ Flight Duty' : '🛏️ Rest Day'}
          </p>
          <div className="space-y-1">
            <p className="text-xs">
              <span className="text-muted-foreground">Avg KSS: </span>
              <span className="font-medium text-primary">{indexToKss(data.avgPerformance).toFixed(1)}</span>
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Peak KSS: </span>
              <span className="font-medium text-critical">{indexToKss(data.minPerformance).toFixed(1)}</span>
            </p>
            {data.recoveryScore !== null && (
              <>
                <div className="border-t border-border/50 my-1.5 pt-1.5">
                  <p className="text-xs font-medium text-success">
                    🔋 Recovery Score: {data.recoveryScore.toFixed(0)}%
                  </p>
                </div>
                {/* Sleep timing from backend */}
                {data.sleepTiming && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Sleep Window: </span>
                    <span className="font-medium">{data.sleepTiming}</span>
                  </p>
                )}
                {data.totalSleep && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Total Sleep: </span>
                    <span className="font-medium">{data.totalSleep.toFixed(1)}h</span>
                  </p>
                )}
                {data.effectiveSleep && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Effective Sleep: </span>
                    <span className="font-medium">{data.effectiveSleep.toFixed(1)}h</span>
                  </p>
                )}
                {data.sleepEfficiency && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Sleep Efficiency: </span>
                    <span className="font-medium">{(data.sleepEfficiency * 100).toFixed(0)}%</span>
                  </p>
                )}
                {/* WOCL overlap warning */}
                {data.woclOverlap > 0 && (
                  <p className="text-xs text-warning">
                    ⚠️ WOCL Overlap: {data.woclOverlap.toFixed(1)}h
                  </p>
                )}
                {data.sleepStrategy && (
                  <p className="text-xs text-muted-foreground">
                    {getStrategyLabel(data.sleepStrategy)}
                  </p>
                )}
                {/* Backend confidence indicator */}
                {data.confidence && (
                  <p className="text-xs text-muted-foreground">
                    Confidence: {(data.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  });
  CustomTooltip.displayName = 'PerformanceTimelineTooltip';

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Alertness Timeline (predicted KSS) - {format(month, 'MMMM yyyy')}</span>
          <div className="flex items-center gap-4 text-xs font-normal">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Flight Days
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success/50" />
              Rest/Recovery
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--critical))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--critical))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                domain={INDEX_DOMAIN}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `KSS ${indexTickAsKss(value)}`}
                ticks={INDEX_AXIS_TICKS}
              />
               <Tooltip content={<CustomTooltip />} />
              {riskReferenceLines().map((line) => (
                <ReferenceLine
                  key={line.value}
                  y={line.value}
                  stroke={line.color}
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{ value: line.label, position: 'right', fontSize: 9, fill: line.color }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="minPerformance"
                stroke="hsl(var(--critical))"
                fillOpacity={1}
                fill="url(#colorMin)"
                strokeWidth={2}
                name="Peak sleepiness"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.isDuty) {
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="hsl(var(--critical))"
                        stroke="hsl(var(--background))"
                        strokeWidth={1}
                      />
                    );
                  }
                  return <circle cx={cx} cy={cy} r={0} />;
                }}
              />
              <Area
                type="monotone"
                dataKey="avgPerformance"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorAvg)"
                strokeWidth={2}
                name="Average"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.isDuty) {
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--background))"
                        strokeWidth={1}
                      />
                    );
                  }
                  return <circle cx={cx} cy={cy} r={0} />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-critical" />
              Peak sleepiness (worst KSS)
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary" />
              Average KSS
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="h-px w-4 border-t-2 border-dashed border-warning" />
              Band boundaries: KSS 5.5 / 6.5 / 7.5 / 8.5
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
