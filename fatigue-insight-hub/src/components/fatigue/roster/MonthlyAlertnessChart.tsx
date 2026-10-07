import { useId, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { KSS_BAND_BOUNDARIES, classifyKss, kssLabel, riskCssColor, riskInkColor } from '@/lib/risk-scale';
import { localInputToUtcIso } from '@/lib/fatigue-report-api';
import type { AlertnessSample, DutyAnalysis } from '@/types/fatigue';
import { dutyRiskLevel, dutyRoute } from './roster-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { dailyAlertnessSummaries } from './alertness-summary';

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
  const mobile = useIsMobile();
  const [view, setView] = useState<'week' | 'month' | null>(null);
  const [week, setWeek] = useState(0);
  const weekly = (view ?? (mobile ? 'week' : 'month')) === 'week';
  const gradientId = useId();
  const { data, sleeps, dutyAreas, ticks, domain, midnights, weekends, dataEnd } = useMemo(() => {
    const data = samples.map((s) => ({ t: s.t, kss: s.asleep || s.kss == null || !Number.isFinite(s.kss) || s.kss < 1 || s.kss > 9 ? null : s.kss, onDuty: s.onDuty, asleep: s.asleep }));
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
    return { data, sleeps, dutyAreas, ticks, domain, midnights, weekends, dataEnd };
  }, [samples, duties, month, homeTz]);

  const startDay = Math.min(week * 7, Math.max(0, Math.floor((ticks.length - 1) / 7) * 7));
  const endDay = Math.min(startDay + 7, ticks.length);
  const visibleDomain: [number, number] = weekly ? [midnights[startDay] ?? domain[0], midnights[endDay] ?? domain[1]] : domain;
  const visibleData = data.filter(s => s.t >= visibleDomain[0] && s.t <= visibleDomain[1]);
  const summaries = dailyAlertnessSummaries(samples.filter(s => s.t >= visibleDomain[0] && s.t < visibleDomain[1]), homeTz);

  if (!samples.length) {
    return <p className="text-sm text-muted-foreground">The monthly curve is available after re-analysing this roster.</p>;
  }

  const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' };

  return (
    <figure className="space-y-3" aria-label="Predicted sleepiness through the month">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">Sleepiness through the month</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 bg-primary" aria-hidden="true" />Predicted KSS (awake)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-[2px] bg-primary/15" aria-hidden="true" />Estimated sleep</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-[1px]" style={{ background: riskCssColor('high') }} aria-hidden="true" />Duty, in its peak band</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dotted border-muted-foreground" aria-hidden="true" />Band limits 5.5 · 6.5 · 7.5 · 8.5</span>
        </span>
      </figcaption>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex gap-1" role="group" aria-label="Sleepiness chart range">
          {(['week', 'month'] as const).map(option => <button key={option} type="button" aria-pressed={(option === 'week') === weekly}
            className={cn('min-h-11 rounded-lg px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', (option === 'week') === weekly ? 'bg-muted text-foreground' : 'text-muted-foreground')}
            onClick={() => setView(option)}>{option === 'week' ? '7 days' : 'Full month'}</button>)}
        </div>
        {weekly && <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous 7 days of sleepiness" disabled={startDay === 0} onClick={() => setWeek(Math.max(0, week - 1))} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <p className="min-w-[6rem] text-center text-xs tabular" aria-live="polite">{fmt(visibleDomain[0], homeTz, { day: 'numeric' })}–{fmt(visibleDomain[1] - 1, homeTz, { day: 'numeric', month: 'short' })}</p>
          <button type="button" aria-label="Next 7 days of sleepiness" disabled={endDay >= ticks.length} onClick={() => setWeek(week + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>}
      </div>
      <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={visibleData} margin={{ top: 8, right: 30, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} horizontal={false} />
              {weekends.map(([a, b], i) => (
                <ReferenceArea key={`w${i}`} x1={a} x2={b} y1={0.3} y2={9} fill="hsl(var(--foreground))" fillOpacity={0.03} ifOverflow="hidden" />
              ))}
              <XAxis
                dataKey="t" type="number" scale="time" domain={visibleDomain} ticks={weekly ? ticks.slice(startDay, endDay) : ticks} allowDataOverflow
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
                  label={{ value: `${k}`, position: 'right', fontSize: 11, fill: riskInkColor(classifyKss(k)) }} />
              ))}
              {/* Duties: a strip under the curve, in the duty's peak band, so sleep shading stays readable. */}
              {dutyAreas.map((d, i) => (
                <ReferenceArea key={`d${i}`} x1={d.x1} x2={d.x2} y1={0.35} y2={0.75} fill={riskCssColor(d.level)} fillOpacity={1} ifOverflow="hidden" />
              ))}
              {dataEnd != null && (
                <ReferenceLine x={dataEnd} stroke="hsl(var(--muted-foreground))" strokeDasharray="1 3"
                  label={{ value: `No roster data after ${fmt(dataEnd, homeTz, { day: 'numeric', month: 'short' })}`, position: 'insideTopLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              )}
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* A soft wash under the curve: shape only, the bands stay on the dotted limits. */}
              <Area dataKey="kss" baseValue={0.3} fill={`url(#${gradientId})`} stroke="none" connectNulls={false}
                isAnimationActive={false} activeDot={false} tooltipType="none" />
              <Line dataKey="kss" stroke="hsl(var(--primary))" strokeWidth={1.75} dot={false}
                connectNulls={false} isAnimationActive={false} className="chart-glow" />
              <Tooltip
                filterNull={false}
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }}
                content={({ active, payload }) => {
                  const p = active && (payload?.[0]?.payload as { t: number; kss: number | null; onDuty: boolean; asleep: boolean } | undefined);
                  if (!p) return null;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-foreground">{fmt(p.t, homeTz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      {p.asleep || p.kss == null ? (
                        <p className="text-muted-foreground">{p.asleep ? 'Asleep (estimated)' : 'Prediction unavailable'}</p>
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
        sleep in a duty debrief or fatigue report. This curve includes time off duty; it may peak above the duty-only headline.
      </p>
      <details className="text-xs">
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Read daily values</summary>
        <p className="mb-3 leading-relaxed text-muted-foreground">Highest awake KSS among supplied samples each day, including time off duty. Missing periods are not filled in.</p>
        <table className="w-full text-left" aria-label="Daily model sleepiness values">
          <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-2 font-medium">Day</th><th scope="col" className="py-2 font-medium">Peak KSS</th><th scope="col" className="py-2 font-medium">Sample context</th></tr></thead>
          <tbody>{summaries.map(row => <tr key={row.day} className="border-b border-border/50"><th scope="row" className="py-2 font-normal">{fmt(row.timestamp, homeTz, { day: 'numeric', month: 'short' })}</th><td className="py-2 font-mono">{row.peak != null ? row.peak.toFixed(1) : '—'}</td><td className="py-2 text-muted-foreground">{row.missing ? `${row.missing} awake samples unavailable` : row.asleep === row.samples ? 'Sleep samples only' : 'Model estimate'}</td></tr>)}</tbody>
        </table>
        {!summaries.length && <p className="py-3 text-muted-foreground">No model samples supplied for these dates.</p>}
      </details>
    </figure>
  );
}
