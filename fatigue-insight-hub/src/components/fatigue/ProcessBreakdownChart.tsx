import { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Eye, EyeOff } from 'lucide-react';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyAnalysis } from '@/types/fatigue';
import { DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { format } from 'date-fns';

interface ProcessBreakdownChartProps {
  /** High-resolution duty timeline data (from GET /api/duty/{id}/{dutyId}). */
  timeline: DutyDetailTimeline;
  /** The duty this timeline belongs to (for context). */
  duty: DutyAnalysis;
  /** Optional: compact height. */
  height?: number;
}

interface ChartDataPoint {
  timestampMs: number;
  label: string;
  hoursOnDuty: number;
  /** Actual performance score (20-100). Also used as base stacked area. */
  performance: number;
  /** Deficit contribution: pp of performance lost to Process S. */
  sleepPressure: number;
  /** Deficit contribution: pp of performance lost to Process C. */
  circadian: number;
  /** Deficit contribution: pp of performance lost to Process W. */
  sleepInertia: number;
  /** Deficit contribution: pp of performance lost to Time-on-Task. */
  timeOnTask: number;
  flightPhase: string | null;
  isCritical: boolean;
}

const COLORS = {
  sleepPressure: 'hsl(0, 80%, 60%)',       // Red — Process S
  circadian: 'hsl(220, 80%, 60%)',          // Blue — Process C
  sleepInertia: 'hsl(30, 90%, 55%)',        // Orange — Process W
  timeOnTask: 'hsl(220, 10%, 50%)',         // Gray — ToT
  performance: 'hsl(195, 100%, 50%)',       // Cyan — Performance line
};

const SERIES_META = {
  sleepPressure: { label: 'Sleep Pressure (S)', color: COLORS.sleepPressure, bg: 'hsla(0,80%,60%,0.15)' },
  circadian: { label: 'Circadian (C)', color: COLORS.circadian, bg: 'hsla(220,80%,60%,0.15)' },
  sleepInertia: { label: 'Sleep Inertia (W)', color: COLORS.sleepInertia, bg: 'hsla(30,90%,55%,0.15)' },
  timeOnTask: { label: 'Time-on-Task', color: COLORS.timeOnTask, bg: 'hsla(220,10%,50%,0.15)' },
  performance: { label: 'Performance', color: COLORS.performance, bg: 'hsla(195,100%,50%,0.15)' },
} as const;

/**
 * S/C/W Process Breakdown Chart — shows how each fatigue factor
 * contributes to performance degradation over time during a duty.
 *
 * Uses proportional deficit decomposition: performance is the base area,
 * and deficit contributions (S, C, W, ToT) stack on top to fill up to 100%.
 */
export function ProcessBreakdownChart({
  timeline,
  duty,
  height = 280,
}: ProcessBreakdownChartProps) {
  const [visibleSeries, setVisibleSeries] = useState({
    sleepPressure: true,
    circadian: true,
    sleepInertia: true,
    timeOnTask: true,
    performance: true,
  });

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!timeline?.timeline?.length) return [];

    return timeline.timeline.map(pt => {
      // Proportional deficit decomposition (same logic as decomposePerformance)
      const S_def = pt.sleep_pressure;              // already deficit form
      const C_def = 1 - pt.circadian;               // invert alertness → deficit
      const W_def = 1 - pt.sleep_inertia;           // invert alertness → deficit
      const ToT_def = 1 - pt.time_on_task_penalty;  // invert alertness → deficit
      const rawTotal = S_def + C_def + W_def + ToT_def;
      const totalDeficit = Math.max(0, 100 - pt.performance);

      let sC = 0, cC = 0, wC = 0, tC = 0;
      if (rawTotal > 0 && totalDeficit > 0) {
        sC = (S_def / rawTotal) * totalDeficit;
        cC = (C_def / rawTotal) * totalDeficit;
        wC = (W_def / rawTotal) * totalDeficit;
        tC = (ToT_def / rawTotal) * totalDeficit;
      }

      return {
        timestampMs: new Date(pt.timestamp_local || pt.timestamp).getTime(),
        label: format(new Date(pt.timestamp_local || pt.timestamp), 'HH:mm'),
        hoursOnDuty: pt.hours_on_duty,
        performance: pt.performance,
        sleepPressure: Math.round(sC * 10) / 10,
        circadian: Math.round(cC * 10) / 10,
        sleepInertia: Math.round(wC * 10) / 10,
        timeOnTask: Math.round(tC * 10) / 10,
        flightPhase: pt.flight_phase,
        isCritical: pt.is_critical,
      };
    });
  }, [timeline]);

  const toggleSeries = useCallback((key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (chartData.length === 0) {
    return null;
  }

  const tickInterval = Math.max(1, Math.floor(chartData.length / 10));

  // Dynamic Y-axis floor: round down to nearest 10 below min performance, with 10pp padding
  const minPerf = Math.min(...chartData.map(d => d.performance));
  const yFloor = Math.max(0, Math.floor((minPerf - 10) / 10) * 10);
  const yTicks = Array.from({ length: Math.floor((100 - yFloor) / 10) + 1 }, (_, i) => yFloor + i * 10);

  return (
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Layers className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            Three-Process Breakdown
            <InfoTooltip entry={FATIGUE_INFO.performance} />
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono">
            {chartData[0].label} &ndash; {chartData[chartData.length - 1].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Series toggles */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.entries(SERIES_META) as [keyof typeof SERIES_META, typeof SERIES_META[keyof typeof SERIES_META]][]).map(
            ([key, meta]) => {
              const visible = visibleSeries[key as keyof typeof visibleSeries];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSeries(key as keyof typeof visibleSeries)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors"
                  style={{
                    borderColor: visible ? meta.color : 'hsl(var(--border))',
                    backgroundColor: visible ? meta.bg : 'transparent',
                    color: visible ? meta.color : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                  {meta.label}
                </button>
              );
            },
          )}
        </div>

        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="timestampMs"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(ms: number) => format(new Date(ms), 'HH:mm')}
                interval={tickInterval}
                stroke="hsl(var(--border))"
                label={{
                  value: 'Local Time',
                  position: 'insideBottom',
                  offset: -2,
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
              <YAxis
                domain={[yFloor, 100]}
                ticks={yTicks}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${v}%`}
                stroke="hsl(var(--border))"
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Performance base area (stacked bottom) */}
              <Area
                type="monotone"
                dataKey="performance"
                name="Performance"
                stackId="full"
                fill="hsla(195, 100%, 50%, 0.08)"
                stroke="none"
                isAnimationActive={false}
              />

              {/* Deficit contributions stacked on top of performance */}
              {visibleSeries.sleepPressure && (
                <Area
                  type="monotone"
                  dataKey="sleepPressure"
                  name="Sleep Pressure (S)"
                  stackId="full"
                  fill={COLORS.sleepPressure}
                  fillOpacity={0.3}
                  stroke={COLORS.sleepPressure}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.circadian && (
                <Area
                  type="monotone"
                  dataKey="circadian"
                  name="Circadian (C)"
                  stackId="full"
                  fill={COLORS.circadian}
                  fillOpacity={0.3}
                  stroke={COLORS.circadian}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.sleepInertia && (
                <Area
                  type="monotone"
                  dataKey="sleepInertia"
                  name="Sleep Inertia (W)"
                  stackId="full"
                  fill={COLORS.sleepInertia}
                  fillOpacity={0.3}
                  stroke={COLORS.sleepInertia}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.timeOnTask && (
                <Area
                  type="monotone"
                  dataKey="timeOnTask"
                  name="Time-on-Task"
                  stackId="full"
                  fill={COLORS.timeOnTask}
                  fillOpacity={0.2}
                  stroke={COLORS.timeOnTask}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              )}

              {/* Performance line overlay (not stacked) */}
              {visibleSeries.performance && (
                <Line
                  type="monotone"
                  dataKey="performance"
                  name="Performance"
                  stroke={COLORS.performance}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Reference thresholds */}
              <ReferenceLine
                y={77}
                stroke="hsl(var(--warning))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: '77%',
                  position: 'right',
                  fontSize: 9,
                  fill: 'hsl(var(--warning))',
                }}
              />
              <ReferenceLine
                y={55}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: '55%',
                  position: 'right',
                  fontSize: 9,
                  fill: 'hsl(var(--destructive))',
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d: ChartDataPoint = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm max-w-xs">
      <p className="font-medium text-foreground font-mono">{d.label}</p>
      <p className="text-[10px] text-muted-foreground mb-2">
        {d.hoursOnDuty.toFixed(1)}h on duty
        {d.flightPhase && ` \u00b7 ${d.flightPhase.replace(/_/g, ' ')}`}
        {d.isCritical && ' \u26a0\ufe0f'}
      </p>
      <div className="space-y-1">
        <TooltipRow label="Performance" value={`${d.performance.toFixed(1)}%`} color={COLORS.performance} />
        <div className="border-t border-border/50 my-1" />
        <TooltipRow label="Sleep Pressure" value={`\u2212${d.sleepPressure.toFixed(1)} pp`} color={COLORS.sleepPressure} />
        <TooltipRow label="Circadian" value={`\u2212${d.circadian.toFixed(1)} pp`} color={COLORS.circadian} />
        <TooltipRow label="Sleep Inertia" value={`\u2212${d.sleepInertia.toFixed(1)} pp`} color={COLORS.sleepInertia} />
        <TooltipRow label="Time-on-Task" value={`\u2212${d.timeOnTask.toFixed(1)} pp`} color={COLORS.timeOnTask} />
      </div>
    </div>
  );
}

function TooltipRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
