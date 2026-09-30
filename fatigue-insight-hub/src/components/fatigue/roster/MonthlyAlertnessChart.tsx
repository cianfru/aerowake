import { useMemo } from 'react';
import {
  ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { KSS_BAND_BOUNDARIES, RISK_LEVEL_LABELS, classifyKss, kssLabel, riskCssColor, riskInkColor } from '@/lib/risk-scale';
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
 * during sleep. Sleep is shaded; duties sit in a strip under the curve.
 */
export function MonthlyAlertnessChart({ samples, duties, month, homeTz }: Props) {
  const { data, sleeps, dutyAreas, ticks, domain, weekends, dataEnd } = useMemo(() => {
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
        level: dutyRiskLevel(d),
        label: dutyRoute(d),
      }))
      .filter((a) => Number.isFinite(a.x1) && Number.isFinite(a.x2));
    // Local midnights bound the month; ticks sit at local noon so a label names the day it is under.
    const y = month.getFullYear();
    const m = month.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const localIso = (d: Date, hhmm: string) => localInputToUtcIso(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${hhmm}`,
      homeTz,
    );
    const midnights: number[] = [];
    const ticks: number[] = [];
    const weekends: Array<[number, number]> = [];
    for (let d = 1; d <= days + 1; d++) {
      const date = new Date(y, m, d);
      const mid = localIso(date, '00:00');
      if (mid) midnights.push(Date.parse(mid));
      if (d <= days) {
        const noon = localIso(date, '12:00');
        if (noon) ticks.push(Date.parse(noon));
      }
    }
    for (let d = 1; d <= days; d++) {
      const dow = new Date(y, m, d).getDay();
      if ((dow === 0 || dow === 6) && midnights[d]) weekends.push([midnights[d - 1], midnights[d]]);
    }
    const domain: [number, number] = [midnights[0] ?? samples[0]?.t ?? 0, midnights[midnights.length - 1] ?? samples[samples.length - 1]?.t ?? 1];
    const lastSample = samples.length ? samples[samples.length - 1].t : null;
    const dataEnd = lastSample != null && lastSample < domain[1] - 36 * 3600000 ? lastSample : null;
    return { data, sleeps, dutyAreas, ticks, domain, weekends, dataEnd };
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
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-[2px] bg-primary/15" aria-hidden="true" />Estimated sleep</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-[1px]" style={{ background: riskCssColor('high') }} aria-hidden="true" />Duty, in its peak band</span>
        </span>
      </figcaption>
      <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} horizontal={false} />
              {weekends.map(([a, b], i) => (
                <ReferenceArea key={`w${i}`} x1={a} x2={b} y1={0.3} y2={9} fill="hsl(var(--foreground))" fillOpacity={0.03} ifOverflow="hidden" />
              ))}
              <XAxis
                dataKey="t" type="number" scale="time" domain={domain} ticks={ticks}
                tickFormatter={(t: number) => fmt(t, homeTz, { day: 'numeric' })}
                tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tick={axisTick} interval="preserveStartEnd" minTickGap={4}
              />
              <YAxis domain={[0.3, 9]} ticks={[1, 3, 5, 7, 9]} tickLine={false} axisLine={false} tick={axisTick}
                label={{ value: 'KSS', position: 'insideTopLeft', offset: 0, dx: 26, dy: -6, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              {sleeps.map(([a, b], i) => (
                <ReferenceArea key={`s${i}`} x1={a} x2={b} y1={1} y2={9} fill="hsl(var(--primary))" fillOpacity={0.1} ifOverflow="hidden" />
              ))}
              {KSS_BAND_BOUNDARIES.map((k) => (
                <ReferenceLine key={k} y={k} stroke={riskCssColor(classifyKss(k))} strokeDasharray="2 4" strokeOpacity={0.7}
                  label={{ value: `${RISK_LEVEL_LABELS[classifyKss(k)]} ${k}`, position: 'insideTopRight', fontSize: 11, fill: riskInkColor(classifyKss(k)) }} />
              ))}
              {/* Duties: a strip under the curve, in the duty's peak band, so sleep shading stays readable. */}
              {dutyAreas.map((d, i) => (
                <ReferenceArea key={`d${i}`} x1={d.x1} x2={d.x2} y1={0.35} y2={0.75} fill={riskCssColor(d.level)} fillOpacity={1} ifOverflow="hidden" />
              ))}
              {dataEnd != null && (
                <ReferenceLine x={dataEnd} stroke="hsl(var(--muted-foreground))" strokeDasharray="1 3"
                  label={{ value: `No roster data after ${fmt(dataEnd, homeTz, { day: 'numeric', month: 'short' })}`, position: 'insideTopLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              )}
              <Line dataKey="kss" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false}
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
      <p className="text-xs text-muted-foreground">
        Home-base time ({homeTz}); weekends shaded. Sleep is estimated from the roster; you can record your actual
        sleep when you report fatigue.
      </p>
    </figure>
  );
}
