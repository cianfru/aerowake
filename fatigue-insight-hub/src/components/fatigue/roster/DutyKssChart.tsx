import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { RISK_LEVEL_LABELS, kssLabel, riskCssColor, type RiskLevel } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { dutyPeakKss, dutyRiskLevel, dutyRoute, dutyTimes } from './roster-utils';

interface Point {
  day: number;
  label: string;
  kss: number | null;
  level: RiskLevel;
  route: string;
  times: string;
}

/**
 * Predicted peak sleepiness for each duty day. Only real model output is
 * plotted: days without duty stay empty (no interpolated "recovery" values).
 */
export function DutyKssChart({ duties, month }: { duties: DutyAnalysis[]; month: Date }) {
  const data = useMemo<Point[]>(() => {
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    return days.map((day) => {
      const onDay = duties.filter((d) => isSameDay(d.date, day));
      const worst = onDay.reduce<DutyAnalysis | null>((a, d) => ((dutyPeakKss(d) ?? 0) > (a ? dutyPeakKss(a) ?? 0 : -1) ? d : a), null);
      const kss = worst ? dutyPeakKss(worst) : null;
      return {
        day: day.getDate(),
        label: format(day, 'EEE d MMM'),
        kss,
        level: worst ? dutyRiskLevel(worst) : 'unknown',
        route: worst ? dutyRoute(worst) : '',
        times: worst ? dutyTimes(worst) : '',
      };
    });
  }, [duties, month]);

  const hasData = data.some((p) => p.kss != null);

  return (
    <figure className="space-y-3" aria-label="Predicted peak sleepiness by duty day">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">Predicted peak sleepiness by duty</span>
        <span className="text-xs text-muted-foreground">KSS 1 (extremely alert) – 9 (fighting sleep)</span>
      </figcaption>
      {hasData ? (
        <div className="h-56 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={240}>
            <BarChart data={data} margin={{ top: 8, right: 72, bottom: 0, left: -24 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                domain={[1, 9]}
                ticks={[1, 3, 5, 7, 9]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <ReferenceLine y={6.5} stroke="hsl(var(--high))" strokeDasharray="3 3" strokeOpacity={0.7}
                label={{ value: 'High 6.5', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <ReferenceLine y={7.5} stroke="hsl(var(--critical))" strokeDasharray="3 3" strokeOpacity={0.7}
                label={{ value: 'Critical 7.5', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload as Point | undefined;
                  if (!p || p.kss == null) return null;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-foreground">{p.label}</p>
                      <p className="text-muted-foreground">{p.route}{p.times ? ` · ${p.times}` : ''}</p>
                      <p className="mt-1 text-foreground">
                        <span className="font-mono">KSS {p.kss.toFixed(1)}</span> · {RISK_LEVEL_LABELS[p.level]}
                      </p>
                      <p className="text-muted-foreground">{kssLabel(p.kss)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="kss" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false}>
                {data.map((p) => (
                  <Cell key={p.day} fill={riskCssColor(p.level)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No duties with a prediction this month.</p>
      )}
    </figure>
  );
}
