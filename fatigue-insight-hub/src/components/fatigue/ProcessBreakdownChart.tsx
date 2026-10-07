import type { TooltipProps } from 'recharts';
import { useMemo } from 'react';
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
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyAnalysis } from '@/types/fatigue';
import type { DutyDetailTimeline } from '@/types/duty-timeline';
import { decomposePerformance } from '@/lib/fatigue-calculations';
import { KSS_BAND_BOUNDARIES, classifyKss, kssLabel, riskInkColor } from '@/lib/risk-scale';
import { formatHomeTime } from '@/lib/home-time';

interface ProcessBreakdownChartProps {
  /** High-resolution duty timeline (GET /api/duty/{id}/{dutyId}). */
  timeline: DutyDetailTimeline;
  duty: DutyAnalysis;
  /** Home-base IANA zone: every time on the axis is home-base 24-hour. */
  homeTz: string;
  /** Short zone label, e.g. "DOH · UTC+3". */
  zoneLabel?: string;
  height?: number;
}

interface ChartDataPoint {
  t: number;
  hoursOnDuty: number;
  kss: number | null;
  kss90: number | null;
  baseline: number | null;
  sleepPressure: number | null;
  circadian: number | null;
  ultradian: number | null;
  hoursAwake: number | null;
  pSevere: number | null;
  flightPhase: string | null;
}

/* Process colours are categorical (not risk): teal for sleep pressure, lilac for the body clock. */
const S_COLOUR = 'hsl(var(--primary))';
const C_COLOUR = 'hsl(var(--wocl))';

/**
 * Predicted KSS through the duty, with how much sleep pressure (S) and the
 * body clock (C) add above a rested pilot at the circadian peak. Exact in KSS
 * units for the Three Process Model KSS = 9.68 − 0.46·(S + C + U)
 * (Ingre et al. 2014).
 */
export function ProcessBreakdownChart({ timeline, duty, homeTz, zoneLabel, height = 260 }: ProcessBreakdownChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!timeline?.timeline?.length) return [];
    return timeline.timeline
      .map((pt) => {
        const onDeck = !pt.is_in_rest;
        const d = decomposePerformance({
          performance: pt.performance,
          sleep_pressure: pt.sleep_pressure,
          circadian: pt.circadian,
          hours_on_duty: pt.hours_on_duty,
          kss: pt.kss,
        });
        return {
          t: Date.parse(pt.timestamp || pt.timestamp_local),
          hoursOnDuty: pt.hours_on_duty,
          kss: onDeck ? d.kss : null,
          kss90: onDeck ? pt.kss_90 ?? null : null,
          baseline: onDeck ? d.referenceKss : null,
          sleepPressure: onDeck ? d.sKss : null,
          circadian: onDeck ? d.cKss : null,
          ultradian: onDeck ? Math.max(0, d.otherKss) : null,
          hoursAwake: pt.hours_awake ?? null,
          pSevere: pt.p_severe_sleepiness ?? null,
          flightPhase: pt.flight_phase,
        };
      })
      .filter((p) => Number.isFinite(p.t));
  }, [timeline]);

  if (chartData.length === 0) return null;

  const fmt = (ms: number) => formatHomeTime(new Date(ms).toISOString(), homeTz);
  const hasKss90 = chartData.some((d) => d.kss90 != null);
  const axisTick = { fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="duty-kss-chart-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="duty-kss-chart-heading" className="flex items-center gap-1.5 text-[15px] font-semibold">
          Predicted KSS through the duty
          <InfoTooltip entry={FATIGUE_INFO.performance} size="sm" />
        </h3>
        <p className="font-mono text-xs text-muted-foreground tabular">
          {fmt(chartData[0].t)}–{fmt(chartData[chartData.length - 1].t)}{zoneLabel ? ` ${zoneLabel}` : ''}
        </p>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Chart key">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-[2px] w-4 bg-foreground" />Predicted KSS</li>
        {hasKss90 && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-muted-foreground" />90th-percentile pilot</li>}
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3 rounded-[2px]" style={{ background: S_COLOUR, opacity: 0.35 }} />Added by time awake (S)</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3 rounded-[2px]" style={{ background: C_COLOUR, opacity: 0.45 }} />Added by body clock (C)</li>
      </ul>

      <div className="mt-3" style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tick={axisTick}
              tickFormatter={fmt}
              tickCount={6}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis domain={[1, 9]} ticks={[1, 3, 5, 7, 9]} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip fmt={fmt} />} />

            <Area type="monotone" dataKey="baseline" stackId="kss" fill="hsl(var(--muted-foreground))" fillOpacity={0.06} stroke="none" isAnimationActive={false} connectNulls={false} />
            <Area type="monotone" dataKey="sleepPressure" stackId="kss" fill={S_COLOUR} fillOpacity={0.22} stroke="none" isAnimationActive={false} connectNulls={false} />
            <Area type="monotone" dataKey="circadian" stackId="kss" fill={C_COLOUR} fillOpacity={0.32} stroke="none" isAnimationActive={false} connectNulls={false} />
            <Area type="monotone" dataKey="ultradian" stackId="kss" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} stroke="none" isAnimationActive={false} connectNulls={false} />

            {KSS_BAND_BOUNDARIES.map((k) => (
              <ReferenceLine key={k} y={k} stroke={riskInkColor(classifyKss(k))} strokeOpacity={0.5} strokeDasharray="2 4"
                label={{ value: `${k}`, position: 'insideRight', fontSize: 11, fill: riskInkColor(classifyKss(k)) }} />
            ))}

            {hasKss90 && (
              <Line type="monotone" dataKey="kss90" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls={false} />
            )}
            <Line type="monotone" dataKey="kss" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Group-average prediction; individual accuracy has not been established for Aerowake. {duty.dutyType === 'flight' || !duty.dutyType ? 'Crew rest periods are left blank.' : ''}</p>
    </section>
  );
}

function ChartTooltip({ active, payload, fmt }: TooltipProps<number, string> & { fmt: (ms: number) => string }) {
  if (!active || !payload || !payload.length) return null;
  const d: ChartDataPoint = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="max-w-xs rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
      <p className="font-mono font-medium text-foreground">{fmt(d.t)}</p>
      <p className="mb-2 text-muted-foreground">
        {d.hoursOnDuty.toFixed(1)}h on duty
        {d.hoursAwake != null && ` · ${d.hoursAwake.toFixed(1)}h awake`}
        {d.flightPhase && ` · ${d.flightPhase.replace(/_/g, ' ')}`}
      </p>
      {d.kss == null ? (
        <p className="text-muted-foreground">In crew rest</p>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Predicted KSS</dt><dd className="font-mono tabular">{d.kss.toFixed(1)}</dd>
          <dd className="col-span-2 text-muted-foreground">{kssLabel(d.kss)}</dd>
          {d.kss90 != null && <><dt className="text-muted-foreground">90th-percentile pilot</dt><dd className="font-mono tabular">{d.kss90.toFixed(1)}</dd></>}
          {d.pSevere != null && <><dt className="text-muted-foreground">Chance of KSS 7 or more</dt><dd className="font-mono tabular">{(d.pSevere * 100).toFixed(0)}%</dd></>}
          <dt className="text-muted-foreground">Time awake adds</dt><dd className="font-mono tabular">+{(d.sleepPressure ?? 0).toFixed(1)}</dd>
          <dt className="text-muted-foreground">Body clock adds</dt><dd className="font-mono tabular">+{(d.circadian ?? 0).toFixed(1)}</dd>
        </dl>
      )}
    </div>
  );
}
