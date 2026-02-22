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
  Legend,
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
  performance: number;
  /** Scaled to 0-100 for consistent Y-axis */
  sleepPressure: number;
  circadian: number;
  sleepInertia: number;
  timeOnTask: number;
  flightPhase: string | null;
  isCritical: boolean;
}

const COLORS = {
  sleepPressure: 'hsl(0, 80%, 60%)',      // Red — Process S
  circadian: 'hsl(220, 80%, 60%)',         // Blue — Process C
  sleepInertia: 'hsl(30, 90%, 55%)',       // Orange — Process W
  timeOnTask: 'hsl(var(--muted-foreground))', // Gray — ToT
  performance: 'hsl(var(--primary))',       // Cyan — Performance line
};

/**
 * S/C/W Process Breakdown Chart — shows how each fatigue factor
 * contributes to performance degradation over time during a duty.
 *
 * Renders as a stacked area chart (S=red, C=blue, W=orange) with
 * a performance line overlay.
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

    return timeline.timeline.map(pt => ({
      timestampMs: new Date(pt.timestamp).getTime(),
      label: format(new Date(pt.timestamp_local || pt.timestamp), 'HH:mm'),
      hoursOnDuty: pt.hours_on_duty,
      performance: pt.performance,
      sleepPressure: pt.sleep_pressure * 100,
      circadian: pt.circadian * 100,
      sleepInertia: pt.sleep_inertia * 100,
      timeOnTask: pt.time_on_task_penalty * 100,
      flightPhase: pt.flight_phase,
      isCritical: pt.is_critical,
    }));
  }, [timeline]);

  const toggleSeries = useCallback((key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (chartData.length === 0) {
    return null;
  }

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
            {chartData.length} pts &middot; 5min
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Series toggles */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.entries(SERIES_META) as [keyof typeof SERIES_META, typeof SERIES_META[keyof typeof SERIES_META]][]).map(
            ([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSeries(key as keyof typeof visibleSeries)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors"
                style={{
                  borderColor: visibleSeries[key as keyof typeof visibleSeries]
                    ? meta.color
                    : 'hsl(var(--border))',
                  backgroundColor: visibleSeries[key as keyof typeof visibleSeries]
                    ? `${meta.color.replace(')', ', 0.15)')}`
                    : 'transparent',
                  color: visibleSeries[key as keyof typeof visibleSeries]
                    ? meta.color
                    : 'hsl(var(--muted-foreground))',
                }}
              >
                {visibleSeries[key as keyof typeof visibleSeries] ? (
                  <Eye className="h-2.5 w-2.5" />
                ) : (
                  <EyeOff className="h-2.5 w-2.5" />
                )}
                {meta.label}
              </button>
            ),
          )}
        </div>

        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="hoursOnDuty"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${v.toFixed(0)}h`}
                stroke="hsl(var(--border))"
                label={{
                  value: 'Hours on Duty',
                  position: 'insideBottom',
                  offset: -2,
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${v}%`}
                stroke="hsl(var(--border))"
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Stacked areas — S, C, W, ToT */}
              {visibleSeries.sleepPressure && (
                <Area
                  type="monotone"
                  dataKey="sleepPressure"
                  name="Sleep Pressure (S)"
                  stackId="factors"
                  fill={COLORS.sleepPressure}
                  fillOpacity={0.25}
                  stroke={COLORS.sleepPressure}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.circadian && (
                <Area
                  type="monotone"
                  dataKey="circadian"
                  name="Circadian (C)"
                  stackId="factors"
                  fill={COLORS.circadian}
                  fillOpacity={0.25}
                  stroke={COLORS.circadian}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.sleepInertia && (
                <Area
                  type="monotone"
                  dataKey="sleepInertia"
                  name="Sleep Inertia (W)"
                  stackId="factors"
                  fill={COLORS.sleepInertia}
                  fillOpacity={0.25}
                  stroke={COLORS.sleepInertia}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.timeOnTask && (
                <Area
                  type="monotone"
                  dataKey="timeOnTask"
                  name="Time-on-Task"
                  stackId="factors"
                  fill="hsl(220, 10%, 50%)"
                  fillOpacity={0.15}
                  stroke="hsl(220, 10%, 50%)"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}

              {/* Performance line overlay */}
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
                  value: '77% Moderate',
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
                  value: '55% Critical',
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
// Series metadata
// ---------------------------------------------------------------------------

const SERIES_META = {
  sleepPressure: { label: 'Sleep Pressure (S)', color: COLORS.sleepPressure },
  circadian: { label: 'Circadian (C)', color: COLORS.circadian },
  sleepInertia: { label: 'Sleep Inertia (W)', color: COLORS.sleepInertia },
  timeOnTask: { label: 'Time-on-Task', color: 'hsl(220, 10%, 50%)' },
  performance: { label: 'Performance', color: COLORS.performance },
} as const;

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
        <TooltipRow label="Sleep Pressure" value={`${d.sleepPressure.toFixed(1)}%`} color={COLORS.sleepPressure} />
        <TooltipRow label="Circadian" value={`${d.circadian.toFixed(1)}%`} color={COLORS.circadian} />
        <TooltipRow label="Sleep Inertia" value={`${d.sleepInertia.toFixed(1)}%`} color={COLORS.sleepInertia} />
        <TooltipRow label="Time-on-Task" value={`${d.timeOnTask.toFixed(1)}%`} color="hsl(220, 10%, 50%)" />
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
