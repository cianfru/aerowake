import { useMemo } from 'react';
import {
  ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { kssLabel, riskCssColor } from '@/lib/risk-scale';
import { localInputToUtcIso } from '@/lib/fatigue-report-api';
import type { AlertnessSample, DutyAnalysis } from '@/types/fatigue';
import { dutyRiskLevel, dutyRoute } from './roster-utils';

interface Props {
  samples: AlertnessSample[];
  duties: DutyAnalysis[];
  month: Date;
  homeTz: string;
}

function fmt(t: number, tz: string, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(new Date(t));
  } catch {
    return new Date(t).toISOString();
  }
}

/**
 * Predicted sleepiness (KSS) through the whole month, including days off.
 * Every point is backend model output with estimated sleep; the line breaks
 * during sleep. Duties are tinted by risk level, sleep is shaded.
 */
export function MonthlyAlertnessChart({ samples, duties, month, homeTz }: Props) {
  const { data, sleeps, dutyAreas, ticks, domain } = useMemo(() => {
    const data = samples.map((s) => ({ t: s.t, kss: s.asleep ? null : s.kss, onDuty: s.onDuty, asleep: s.asleep }));
    // Contiguous asleep runs -> shaded areas
    const sleeps: Array<[number, number]> = [];
    let runStart: number | null = null;
    samples.forEach((s, i) => {
      if (s.asleep && runStart == null) runStart = s.t;
      const next = samples[i + 1];
      if (runStart != null && (!next || !next.asleep)) {
        sleeps.push([runStart, next ? next.t : s.t]);
        runStart = null;
      }
    });
    const dutyAreas = duties
      .map((d) => ({
        x1: Date.parse(d.reportTimeUtc ?? ''),
        x2: Date.parse(d.releaseTimeUtc ?? ''),
        color: riskCssColor(dutyRiskLevel(d)),
        label: dutyRoute(d),
      }))
      .filter((a) => Number.isFinite(a.x1) && Number.isFinite(a.x2));
    // Local midnights of the month as ticks
    const y = month.getFullYear();
    const m = month.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const ticks: number[] = [];
    for (let d = 1; d <= days + 1; d++) {
      const date = new Date(y, m, d);
      const iso = localInputToUtcIso(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T00:00`,
        homeTz,
      );
      if (iso) ticks.push(Date.parse(iso));
    }
    const domain: [number, number] = [ticks[0] ?? samples[0]?.t ?? 0, ticks[ticks.length - 1] ?? samples[samples.length - 1]?.t ?? 1];
    return { data, sleeps, dutyAreas, ticks, domain };
  }, [samples, duties, month, homeTz]);

  if (!samples.length) {
    return <p className="text-sm text-muted-foreground">The monthly curve is available after re-analysing this roster.</p>;
  }

  const axisTick = { fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' };

  return (
    <figure className="space-y-3" aria-label="Predicted sleepiness through the month">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">Sleepiness through the month</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 bg-primary" aria-hidden="true" />Predicted KSS (awake)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 bg-muted-foreground/25" aria-hidden="true" />Sleep (estimated)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 bg-high/40" aria-hidden="true" />Duty, tinted by risk</span>
        </span>
      </figcaption>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="h-64 min-w-[640px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 72, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis
                dataKey="t" type="number" scale="time" domain={domain} ticks={ticks}
                tickFormatter={(t: number) => fmt(t, homeTz, { day: 'numeric' })}
                tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tick={axisTick} interval="preserveStartEnd" minTickGap={6}
              />
              <YAxis domain={[1, 9]} ticks={[1, 3, 5, 7, 9]} tickLine={false} axisLine={false} tick={axisTick} />
              {sleeps.map(([a, b], i) => (
                <ReferenceArea key={`s${i}`} x1={a} x2={b} fill="hsl(var(--muted-foreground))" fillOpacity={0.14} ifOverflow="hidden" />
              ))}
              {dutyAreas.map((d, i) => (
                <ReferenceArea key={`d${i}`} x1={d.x1} x2={d.x2} fill={d.color} fillOpacity={0.35} ifOverflow="hidden" />
              ))}
              <ReferenceLine y={6.5} stroke="hsl(var(--high))" strokeDasharray="3 3" strokeOpacity={0.7}
                label={{ value: 'High 6.5', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <ReferenceLine y={7.5} stroke="hsl(var(--critical))" strokeDasharray="3 3" strokeOpacity={0.7}
                label={{ value: 'Critical 7.5', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Line dataKey="kss" stroke="hsl(var(--primary))" strokeWidth={1.75} dot={false}
                connectNulls={false} isAnimationActive={false} />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }}
                content={({ active, payload }) => {
                  const p = active && (payload?.[0]?.payload as { t: number; kss: number | null; onDuty: boolean; asleep: boolean } | undefined);
                  if (!p) return null;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-foreground">{fmt(p.t, homeTz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      {p.asleep || p.kss == null ? (
                        <p className="text-muted-foreground">Asleep (estimated)</p>
                      ) : (
                        <>
                          <p className="text-foreground"><span className="font-mono">KSS {p.kss.toFixed(1)}</span>{p.onDuty ? ' · on duty' : ''}</p>
                          <p className="text-muted-foreground">{kssLabel(p.kss)}</p>
                        </>
                      )}
                    </div>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Home-base time ({homeTz}). Sleep outside duties is estimated from the roster; report your actual sleep in
        “Report fatigue” for a personal assessment.
      </p>
    </figure>
  );
}
