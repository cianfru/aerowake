import { useState, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plane, Moon, Home } from 'lucide-react';
import { DutyAnalysis, RestDaySleep } from '@/types/fatigue';
import { useContinuousTimelineData, ContinuousTimelinePoint, DutyDetailTimeline } from '@/hooks/useContinuousTimelineData';
import { useFetchAllDutyTimelines } from '@/hooks/useFetchAllDutyTimelines';
import { format } from 'date-fns';

interface ContinuousPerformanceTimelineProps {
  duties: DutyAnalysis[];
  month: Date;
  analysisId?: string;
  restDaysSleep?: RestDaySleep[];
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  pilotBase?: string;
}

const getRiskColor = (level: string) => {
  switch (level) {
    case 'CRITICAL': return 'hsl(var(--destructive))';
    case 'HIGH': return 'hsl(var(--warning))';
    case 'MODERATE': return 'hsl(var(--chart-4))';
    default: return 'hsl(var(--success))';
  }
};

const formatTimestamp = (ms: number) => {
  const d = new Date(ms);
  return format(d, 'dd MMM HH:mm');
};

const formatXAxis = (ms: number) => {
  const d = new Date(ms);
  return format(d, 'dd');
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d: ContinuousTimelinePoint = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm max-w-xs">
      <p className="font-medium text-foreground">{formatTimestamp(d.timestampMs)}</p>
      {d.dutyLabel && (
        <p className="text-xs text-muted-foreground mb-1">
          {d.phase === 'duty' ? <Plane className="h-3 w-3 inline-block mr-0.5" /> : d.phase === 'sleep' ? <Moon className="h-3 w-3 inline-block mr-0.5" /> : <Home className="h-3 w-3 inline-block mr-0.5" />} {d.dutyLabel}
        </p>
      )}
      {d.departure && d.arrival && (
        <p className="text-xs text-muted-foreground mb-1">{d.departure} → {d.arrival}</p>
      )}

      <div className="mt-2 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Performance:</span>
          <span className="font-mono font-bold" style={{ color: getRiskColor(d.riskLevel) }}>
            {d.performance.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Sleep Reservoir:</span>
          <span className="font-mono">{d.sleepReservoir.toFixed(1)}%</span>
        </div>

        {d.sleepDebt !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sleep Debt:</span>
            <span className="font-mono">{d.sleepDebt.toFixed(1)}h</span>
          </div>
        )}
        {d.priorSleep !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Prior Sleep:</span>
            <span className="font-mono">{d.priorSleep.toFixed(1)}h</span>
          </div>
        )}
        {d.hoursAwake !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Hours Awake:</span>
            <span className="font-mono">{d.hoursAwake.toFixed(1)}h</span>
          </div>
        )}

        {/* High-res three-process breakdown */}
        {d.isHighRes && d.circadian !== undefined && (
          <div className="border-t border-border/50 mt-1.5 pt-1.5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Borbely Components</p>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Circadian (C):</span>
              <span className="font-mono">{((d.circadian ?? 0) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Homeostatic (S):</span>
              <span className="font-mono">{((d.homeostatic ?? 0) * 100).toFixed(0)}%</span>
            </div>
            {d.sleepInertia !== undefined && d.sleepInertia < 0.99 && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Sleep Inertia (W):</span>
                <span className="font-mono">{(d.sleepInertia * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}

        {d.flightPhase && (
          <p className="text-xs text-muted-foreground mt-1">Phase: {d.flightPhase}</p>
        )}

        <Badge
          variant="outline"
          className="mt-1"
          style={{ borderColor: getRiskColor(d.riskLevel), color: getRiskColor(d.riskLevel) }}
        >
          {d.riskLevel} RISK
        </Badge>
      </div>
    </div>
  );
}

export function ContinuousPerformanceTimeline({
  duties,
  month,
  analysisId,
  restDaysSleep,
  onDutySelect,
  selectedDuty,
  pilotBase,
}: ContinuousPerformanceTimelineProps) {
  // Fetch high-res timelines in background when this component mounts
  const { timelines: highResTimelines, loading: highResLoading, progress } = useFetchAllDutyTimelines({
    analysisId,
    duties,
  });

  const { data, dutyRegions, sleepRegions } = useContinuousTimelineData({
    duties,
    restDaysSleep,
    month,
    highResTimelines: highResTimelines.size > 0 ? highResTimelines : undefined,
  });

  // Click handler to find nearest duty
  const handleChartClick = useCallback((chartData: any) => {
    if (!chartData?.activePayload?.[0]) return;
    const point: ContinuousTimelinePoint = chartData.activePayload[0].payload;
    if (point.dutyId) {
      const duty = duties.find(d => d.dutyId === point.dutyId);
      if (duty) onDutySelect(duty);
    }
  }, [duties, onDutySelect]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No timeline data available
      </div>
    );
  }

  // Compute chart time bounds
  const minTime = data[0].timestampMs;
  const maxTime = data[data.length - 1].timestampMs;

  // Generate WOCL bands (02:00-06:00 each day) and WMZ bands (18:00-21:00 each day)
  const woclBands: Array<{ start: number; end: number }> = [];
  const wmzBands: Array<{ start: number; end: number }> = [];
  const dayStart = new Date(minTime);
  dayStart.setHours(0, 0, 0, 0);
  for (let d = dayStart.getTime(); d < maxTime + 24 * 60 * 60 * 1000; d += 24 * 60 * 60 * 1000) {
    const woclStart = d + 2 * 60 * 60 * 1000; // 02:00
    const woclEnd = d + 6 * 60 * 60 * 1000;   // 06:00
    if (woclEnd > minTime && woclStart < maxTime) {
      woclBands.push({ start: Math.max(woclStart, minTime), end: Math.min(woclEnd, maxTime) });
    }
    // WMZ — Wake Maintenance Zone (Dijk & Czeisler, 1994)
    const wmzStart = d + 18 * 60 * 60 * 1000; // 18:00
    const wmzEnd = d + 21 * 60 * 60 * 1000;   // 21:00
    if (wmzEnd > minTime && wmzStart < maxTime) {
      wmzBands.push({ start: Math.max(wmzStart, minTime), end: Math.min(wmzEnd, maxTime) });
    }
  }

  // Chart width scales with days: ~120px per day for good readability
  const daysInRange = Math.ceil((maxTime - minTime) / (24 * 60 * 60 * 1000));
  const chartMinWidth = Math.max(900, daysInRange * 120);

  // Y-axis domain: position activity lanes from 0-10, performance from 20-100
  const activityLaneTop = 10;

  return (
    <div className="space-y-3">
      {/* Header with legend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-foreground inline-block" />
            Performance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-destructive inline-block" />
            Sleep Reservoir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 bg-foreground/80 inline-block rounded-sm" />
            Duty
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 bg-blue-500/60 inline-block rounded-sm" />
            Sleep
          </span>
        </div>
        {highResLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading high-res data ({progress}%)
          </div>
        )}
        {!highResLoading && highResTimelines.size > 0 && (
          <span className="text-xs text-success">High-resolution data loaded</span>
        )}
      </div>

      {/* Scrollable chart container */}
      <div className="overflow-x-auto border border-border/50 rounded-lg">
        <div style={{ minWidth: `${chartMinWidth}px`, height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 40, left: 0, bottom: 5 }}
              onClick={handleChartClick}
            >
              <defs>
                <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />

              {/* Risk zone background bands */}
              <ReferenceArea y1={75} y2={100} fill="hsl(var(--success))" fillOpacity={0.06} yAxisId="left" />
              <ReferenceArea y1={65} y2={75} fill="hsl(var(--chart-4))" fillOpacity={0.06} yAxisId="left" />
              <ReferenceArea y1={55} y2={65} fill="hsl(var(--warning))" fillOpacity={0.08} yAxisId="left" />
              <ReferenceArea y1={0} y2={55} fill="hsl(var(--destructive))" fillOpacity={0.06} yAxisId="left" />

              {/* WOCL bands */}
              {woclBands.map((band, idx) => (
                <ReferenceArea
                  key={`wocl-${idx}`}
                  x1={band.start}
                  x2={band.end}
                  fill="hsl(var(--chart-5))"
                  fillOpacity={0.08}
                  yAxisId="left"
                />
              ))}

              {/* WMZ bands (Wake Maintenance Zone — Dijk & Czeisler 1994) */}
              {wmzBands.map((band, idx) => (
                <ReferenceArea
                  key={`wmz-${idx}`}
                  x1={band.start}
                  x2={band.end}
                  fill="hsl(var(--warning))"
                  fillOpacity={0.06}
                  yAxisId="left"
                />
              ))}

              {/* Duty bars in activity lane */}
              {dutyRegions.map((region, idx) => (
                <ReferenceArea
                  key={`duty-${idx}`}
                  x1={region.startMs}
                  x2={region.endMs}
                  y1={0}
                  y2={5}
                  fill="hsl(var(--foreground))"
                  fillOpacity={0.7}
                  yAxisId="left"
                />
              ))}

              {/* Sleep bars in activity lane */}
              {sleepRegions.map((region, idx) => (
                <ReferenceArea
                  key={`sleep-${idx}`}
                  x1={region.startMs}
                  x2={region.endMs}
                  y1={5}
                  y2={activityLaneTop}
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.5}
                  yAxisId="left"
                />
              ))}

              {/* Threshold reference lines */}
              <ReferenceLine y={77} stroke="hsl(var(--success))" strokeDasharray="6 3" strokeOpacity={0.5} yAxisId="left" label={{ value: '77%', position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <ReferenceLine y={55} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeOpacity={0.5} yAxisId="left" label={{ value: '55%', position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />

              {/* Activity lane separator */}
              <ReferenceLine y={activityLaneTop} stroke="hsl(var(--border))" strokeWidth={1} yAxisId="left" />

              {/* X-Axis: continuous time */}
              <XAxis
                dataKey="timestampMs"
                type="number"
                domain={[minTime, maxTime]}
                scale="time"
                tickFormatter={formatXAxis}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />

              {/* Left Y-Axis: Performance % */}
              <YAxis
                yAxisId="left"
                domain={[0, 100]}
                ticks={[0, 25, 50, 55, 65, 75, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(v) => v > activityLaneTop ? `${v}%` : ''}
                tickLine={false}
                axisLine={false}
                width={40}
              />

              {/* Right Y-Axis: Sleep Reservoir % */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[50, 100]}
                ticks={[50, 60, 70, 80, 90, 100]}
                tick={{ fill: 'hsl(var(--destructive))', fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
                width={40}
              />

              <Tooltip
                content={<CustomTooltip />}
                isAnimationActive={false}
              />

              {/* Performance area (left axis) */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="performance"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.5}
                fill="url(#perfGradient)"
                dot={false}
                isAnimationActive={false}
                name="Performance"
                connectNulls
              />

              {/* Sleep Reservoir line (right axis) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sleepReservoir"
                stroke="hsl(var(--destructive))"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="Sleep Reservoir"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom legend */}
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="h-px w-4 border-t-2 border-dashed border-success" />
            EASA Threshold (77%)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-px w-4 border-t-2 border-dashed border-destructive" />
            Critical (55%)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--success))', opacity: 0.3 }} />
            Low Risk
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-4))', opacity: 0.3 }} />
            Moderate
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--warning))', opacity: 0.4 }} />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--destructive))', opacity: 0.3 }} />
            Critical
          </span>
        </div>
      </div>
    </div>
  );
}
