import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import type { DutyAnalysis } from '@/types/fatigue';
import { SLEEP_DEFICIT_BOUNDS, SLEEP_DEFICIT_LABELS, sleepDeficitColor, type SleepDeficitBand } from '@/lib/risk-scale';

interface SleepShortfallChartProps {
  duties: DutyAnalysis[];
  month: Date;
}

interface Point {
  t: number;
  hours: number;
  sleep: number;
  need: number;
  band: SleepDeficitBand;
  label: string;
}

/** One point per duty: the backend 7-day ledger at report time. Nothing is extrapolated. */
export function shortfallPoints(duties: DutyAnalysis[]): Point[] {
  return duties
    .filter((d) => d.sleepDeficit7d && Number.isFinite(d.sleepDeficit7d.deficitHours))
    .map((d) => {
      const t = Date.parse(d.reportTimeUtc ?? '') || d.date.getTime();
      const s = d.sleepDeficit7d!;
      return { t, hours: s.deficitHours, sleep: s.sleepHours, need: s.needHours, band: s.band, label: format(d.date, 'EEE d MMM') };
    })
    .sort((a, b) => a.t - b.t);
}

const BOUND_LINES: Array<[number, SleepDeficitBand]> = [
  [SLEEP_DEFICIT_BOUNDS.mild, 'mild'],
  [SLEEP_DEFICIT_BOUNDS.moderate, 'moderate'],
  [SLEEP_DEFICIT_BOUNDS.severe, 'severe'],
];

/**
 * The 7-day sleep shortfall at each duty: estimated sleep in the previous 7
 * days against 8h a day, exactly as the backend ledger reports it, with the
 * ledger's own bands (mild 5h, moderate 10h, severe 15h).
 */
export function SleepShortfallChart({ duties, month }: SleepShortfallChartProps) {
  const data = useMemo(() => shortfallPoints(duties), [duties]);
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No 7-day sleep shortfall is available for this analysis.</p>;
  }

  const peak = data.reduce((m, p) => (p.hours > m.hours ? p : m), data[0]);
  const yMax = Math.max(6, Math.ceil(peak.hours + 1));
  const domain: [number, number] = [startOfMonth(month).getTime(), endOfMonth(month).getTime()];
  const axisTick = { fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' };

  return (
    <figure className="space-y-3" aria-labelledby="shortfall-caption">
      <figcaption id="shortfall-caption" className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">7-day sleep shortfall at each duty</span>
        <span className="text-xs text-muted-foreground">
          Highest <span className="font-mono text-foreground tabular">{peak.hours.toFixed(1)}h</span> · {peak.label} · {SLEEP_DEFICIT_LABELS[peak.band]}
        </span>
      </figcaption>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
            <XAxis dataKey="t" type="number" scale="time" domain={domain} tick={axisTick} tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(t: number) => format(t, 'd')} minTickGap={12} />
            <YAxis domain={[0, yMax]} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} unit="h" />
            {BOUND_LINES.filter(([h]) => h <= yMax).map(([h, band]) => (
              <ReferenceLine key={band} y={h} stroke={sleepDeficitColor(band)} strokeDasharray="2 4" strokeOpacity={0.8}
                label={{ value: `${SLEEP_DEFICIT_LABELS[band]} ${h}h`, position: 'insideTopLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            ))}
            <Line type="stepAfter" dataKey="hours" stroke="hsl(var(--foreground) / 0.6)" strokeWidth={1.75} isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: Point }) => (
                <circle key={props.index} cx={props.cx} cy={props.cy} r={3.5} fill={sleepDeficitColor(props.payload?.band)} stroke="hsl(var(--card))" strokeWidth={1.5} />
              )} />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                    <p className="font-medium">{p.label}</p>
                    <p><span className="font-mono tabular">{p.hours.toFixed(1)}h</span> shortfall · {SLEEP_DEFICIT_LABELS[p.band]}</p>
                    <p className="text-muted-foreground">{p.sleep.toFixed(1)}h estimated sleep of {p.need.toFixed(0)}h in 7 days</p>
                  </div>
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">Estimated sleep over the previous 7 days against 8h a day, at each report. Sleep is estimated from the roster.</p>
    </figure>
  );
}

/** Former name, kept for existing imports. */
export const SleepDebtTrendChart = SleepShortfallChart;
