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
import { decomposePerformance } from '@/lib/fatigue-calculations';
import { kssLabel, riskReferenceLines } from '@/lib/risk-scale';

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
  /** 20–100 index (= 110 − 10·KSS). */
  performance: number;
  /** Predicted KSS (null while in bunk rest). */
  kss: number | null;
  /** Predicted KSS, 90th-percentile pilot. */
  kss90: number | null;
  /** Rested-at-circadian-peak reference KSS (stack base). */
  baseline: number | null;
  /** KSS points added by sleep pressure (Process S). */
  sleepPressure: number | null;
  /** KSS points added by circadian phase (Process C). */
  circadian: number | null;
  /** Remainder: ultradian process U. */
  ultradian: number | null;
  hoursAwake: number | null;
  pSevere: number | null;
  flightPhase: string | null;
  isCritical: boolean;
}

const COLORS = {
  sleepPressure: 'hsl(0, 80%, 60%)',       // Red — Process S
  circadian: 'hsl(220, 80%, 60%)',          // Blue — Process C
  ultradian: 'hsl(220, 10%, 50%)',          // Gray — Process U
  kss: 'hsl(195, 100%, 50%)',               // Cyan — KSS line
  kss90: 'hsl(280, 60%, 65%)',              // Violet — 90th-percentile KSS
};

const SERIES_META = {
  sleepPressure: { label: 'Sleep Pressure (S)', color: COLORS.sleepPressure, bg: 'hsla(0,80%,60%,0.15)' },
  circadian: { label: 'Circadian (C)', color: COLORS.circadian, bg: 'hsla(220,80%,60%,0.15)' },
  kss: { label: 'Predicted KSS', color: COLORS.kss, bg: 'hsla(195,100%,50%,0.15)' },
  kss90: { label: 'KSS 90th pct', color: COLORS.kss90, bg: 'hsla(280,60%,65%,0.15)' },
} as const;

/**
 * Three-Process Breakdown Chart — predicted KSS over the duty and how much of
 * it comes from sleep pressure (S) and circadian phase (C), per the Three
 * Process Model KSS = 9.68 − 0.46·(S + C + U) (Ingre et al. 2014).
 *
 * The stack starts at the rested / circadian-peak reference (≈ KSS 2) and the
 * S and C contributions are exact in KSS units; the small remainder is the
 * ultradian term. Sleep inertia and time-on-task are not in the model.
 */
export function ProcessBreakdownChart({
  timeline,
  duty,
  height = 280,
}: ProcessBreakdownChartProps) {
  const [visibleSeries, setVisibleSeries] = useState({
    sleepPressure: true,
    circadian: true,
    kss: true,
    kss90: true,
  });

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!timeline?.timeline?.length) return [];

    return timeline.timeline.map(pt => {
      const onDeck = !pt.is_in_rest;
      const d = decomposePerformance({
        performance: pt.performance,
        sleep_pressure: pt.sleep_pressure,
        circadian: pt.circadian,
        hours_on_duty: pt.hours_on_duty,
        kss: pt.kss,
      });
      return {
        timestampMs: new Date(pt.timestamp_local || pt.timestamp).getTime(),
        label: format(new Date(pt.timestamp_local || pt.timestamp), 'HH:mm'),
        hoursOnDuty: pt.hours_on_duty,
        performance: pt.performance,
        kss: onDeck ? d.kss : null,
        kss90: onDeck ? pt.kss_90 ?? null : null,
        baseline: onDeck ? d.referenceKss : null,
        sleepPressure: onDeck ? d.sKss : null,
        circadian: onDeck ? d.cKss : null,
        ultradian: onDeck ? Math.max(0, d.otherKss) : null,
        hoursAwake: pt.hours_awake ?? null,
        pSevere: pt.p_severe_sleepiness ?? null,
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
  const hasKss90 = chartData.some(d => d.kss90 != null);
  const bandLines = riskReferenceLines(duty.riskThresholds);

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
          {(Object.entries(SERIES_META) as [keyof typeof SERIES_META, typeof SERIES_META[keyof typeof SERIES_META]][])
            .filter(([key]) => key !== 'kss90' || hasKss90)
            .map(([key, meta]) => {
              const visible = visibleSeries[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSeries(key)}
                  aria-pressed={visible}
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
            })}
        </div>

        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
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
                domain={[1, 9]}
                ticks={[1, 3, 5, 7, 9]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `KSS ${v}`}
                stroke="hsl(var(--border))"
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Stack: rested reference, then S and C contributions, then U */}
              <Area
                type="monotone"
                dataKey="baseline"
                name="Rested reference"
                stackId="kss"
                fill="hsla(142, 70%, 45%, 0.08)"
                stroke="none"
                isAnimationActive={false}
                connectNulls={false}
              />
              {visibleSeries.sleepPressure && (
                <Area
                  type="monotone"
                  dataKey="sleepPressure"
                  name="Sleep Pressure (S)"
                  stackId="kss"
                  fill={COLORS.sleepPressure}
                  fillOpacity={0.3}
                  stroke={COLORS.sleepPressure}
                  strokeWidth={1}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              {visibleSeries.circadian && (
                <Area
                  type="monotone"
                  dataKey="circadian"
                  name="Circadian (C)"
                  stackId="kss"
                  fill={COLORS.circadian}
                  fillOpacity={0.3}
                  stroke={COLORS.circadian}
                  strokeWidth={1}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="ultradian"
                name="Ultradian (U)"
                stackId="kss"
                fill={COLORS.ultradian}
                fillOpacity={0.15}
                stroke="none"
                isAnimationActive={false}
                connectNulls={false}
              />

              {visibleSeries.kss && (
                <Line
                  type="monotone"
                  dataKey="kss"
                  name="Predicted KSS"
                  stroke={COLORS.kss}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              {hasKss90 && visibleSeries.kss90 && (
                <Line
                  type="monotone"
                  dataKey="kss90"
                  name="KSS 90th pct"
                  stroke={COLORS.kss90}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}

              {/* Risk band boundaries */}
              {bandLines.map((line) => (
                <ReferenceLine
                  key={line.value}
                  y={line.kss}
                  stroke={line.color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: line.label, position: 'right', fontSize: 9, fill: line.color }}
                />
              ))}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d: ChartDataPoint = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm max-w-xs">
      <p className="font-medium text-foreground font-mono">{d.label}</p>
      <p className="text-[10px] text-muted-foreground mb-2">
        {d.hoursOnDuty.toFixed(1)}h on duty
        {d.hoursAwake != null && ` \u00b7 ${d.hoursAwake.toFixed(1)}h awake`}
        {d.flightPhase && ` \u00b7 ${d.flightPhase.replace(/_/g, ' ')}`}
        {d.isCritical && ' \u26a0\ufe0f'}
      </p>
      {d.kss == null ? (
        <p className="text-xs text-muted-foreground">In crew rest</p>
      ) : (
        <div className="space-y-1">
          <TooltipRow label="Predicted KSS" value={`${d.kss.toFixed(1)} \u00b7 ${kssLabel(d.kss)}`} color={COLORS.kss} />
          {d.kss90 != null && <TooltipRow label="KSS 90th pct" value={d.kss90.toFixed(1)} color={COLORS.kss90} />}
          {d.pSevere != null && (
            <TooltipRow label="P(KSS ≥ 7)" value={`${(d.pSevere * 100).toFixed(0)}%`} color={COLORS.kss90} />
          )}
          <div className="border-t border-border/50 my-1" />
          <TooltipRow label="Sleep Pressure" value={`+${(d.sleepPressure ?? 0).toFixed(1)} KSS`} color={COLORS.sleepPressure} />
          <TooltipRow label="Circadian" value={`+${(d.circadian ?? 0).toFixed(1)} KSS`} color={COLORS.circadian} />
          <p className="text-[10px] text-muted-foreground font-mono pt-1">index {d.performance.toFixed(0)}</p>
        </div>
      )}
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
