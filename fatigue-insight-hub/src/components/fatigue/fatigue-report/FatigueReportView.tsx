import { useMemo, useState } from 'react';
import {
  AlertOctagon, AlertTriangle, ArrowLeft, Check, Copy, Download, Info, Printer, ShieldAlert,
} from 'lucide-react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { reportToText, tzOffsetMinutes, type FatigueReport, type Severity } from '@/lib/fatigue-report-api';

/** Severity: text colour + a thin leading rule; no filled boxes or pills. */
const SEVERITY_STYLE: Record<Severity, { label: string; text: string; rule: string; icon: typeof Info }> = {
  critical: { label: 'Critical', text: 'text-critical', rule: 'bg-critical', icon: AlertOctagon },
  warning: { label: 'Warning', text: 'text-high', rule: 'bg-high', icon: AlertTriangle },
  caution: { label: 'Caution', text: 'text-warning', rule: 'bg-warning', icon: ShieldAlert },
  info: { label: 'Info', text: 'text-muted-foreground', rule: 'bg-border', icon: Info },
};

const LEVEL_RULE: Record<string, string> = {
  low: 'bg-muted-foreground/50',
  moderate: 'bg-warning',
  high: 'bg-high',
  critical: 'bg-critical',
};

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #fatigue-report-print, #fatigue-report-print * { visibility: visible !important; }
  #fatigue-report-print { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0 12mm; color: #000; }
  #fatigue-report-print .no-print { display: none !important; }
  #fatigue-report-print section { break-inside: avoid; }
}`;

function fmtH(h: number | null | undefined): string {
  if (h == null) return '—';
  const whole = Math.floor(h);
  return `${whole}h${String(Math.round((h - whole) * 60)).padStart(2, '0')}`;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'bad' | 'ok' }) {
  return (
    <div className="min-w-0 space-y-1.5 py-1 sm:px-5 sm:first:pl-0">
      <p className="eyebrow">{label}</p>
      <p className={cn('font-mono text-2xl font-medium leading-none tabular', tone === 'bad' && 'text-critical')}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FatigueReportView({ report, onEdit }: { report: FatigueReport; onEdit: () => void }) {
  const [copied, setCopied] = useState(false);
  const tz = report.home_timezone;
  const a = report.assessment;
  const sw = report.prior_sleep_wake;

  // Chart in home-base local hours since period start.
  const chart = useMemo(() => {
    const t0 = new Date(report.period.start_utc).getTime();
    const toX = (iso: string) => (new Date(iso).getTime() - t0) / 3600e3;
    const points = report.timeline.map((p) => ({
      x: toX(p.time_utc),
      kss: p.asleep ? null : p.kss,
      kss90: p.asleep ? null : p.kss_90,
    }));
    const duties = report.duties.map((d) => ({
      x1: toX(d.report_utc), x2: toX(d.release_utc), affected: d.is_affected, status: d.status,
    }));
    const sleeps = report.sleeps.map((s) => ({ x1: toX(s.start_utc), x2: toX(s.end_utc) }));
    const eventX = toX(report.event.time_utc);
    return { points, duties, sleeps, eventX, t0 };
  }, [report]);

  const tickLabel = (x: number) => {
    const d = new Date(chart.t0 + x * 3600e3);
    const local = new Date(d.getTime() + tzOffsetMinutes(d, tz) * 60000);
    const hh = String(local.getUTCHours()).padStart(2, '0');
    return hh === '00' ? `${local.getUTCDate()}/${local.getUTCMonth() + 1}` : `${hh}:00`;
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fatigue-report-${report.event.time_utc.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const pilotLine = Object.entries(report.pilot).map(([, v]) => v).join(' · ');

  return (
    <div id="fatigue-report-print" className="mx-auto max-w-4xl space-y-10 px-4 py-10 md:px-8">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onEdit}><ArrowLeft className="mr-1 h-4 w-4" />Edit inputs</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copy}>{copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}{copied ? 'Copied' : 'Copy text'}</Button>
          <Button variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" />JSON</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
        </div>
      </div>

      <section className="space-y-3 border-b border-border pb-6">
        <p className="eyebrow">Fatigue report</p>
        <h1 className="text-2xl md:text-3xl font-semibold leading-tight tracking-[-0.02em]">
          {report.event.affected_duty_label ?? `Fatigue reported ${report.event.time_local}`}
        </h1>
        {pilotLine && <p className="text-sm">{pilotLine}</p>}
        <p className="break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          Event {report.event.time_local} ({report.event.time_z}) · Period {report.period.start_local} – {report.period.end_local} ·
          Times in {tz} · Generated {new Date(report.generated_at).toUTCString()} · {report.report_version} / {report.engine_version}
        </p>
      </section>

      <section className="flex gap-4">
        <span aria-hidden="true" className={cn('w-[3px] rounded-[1px]', LEVEL_RULE[report.summary.overall_level] ?? 'bg-border')} />
        <div className="min-w-0 space-y-2">
          <p className="text-lg font-medium leading-snug">{report.summary.headline}</p>
          <p className="flex flex-wrap gap-y-1 text-[13px] text-muted-foreground">
            {(['critical', 'warning', 'caution', 'info'] as Severity[])
              .filter((s) => report.summary.counts[s] > 0)
              .map((s) => (
                <span key={s} className="mr-3 whitespace-nowrap">
                  <span className={cn('font-mono', SEVERITY_STYLE[s].text)}>{report.summary.counts[s]}</span>{' '}
                  {SEVERITY_STYLE[s].label.toLowerCase()}
                </span>
              ))}
            <span className="whitespace-nowrap">Data confidence: <span className="text-foreground">{report.data_quality.confidence}</span></span>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-5 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-border">
        <Stat label="Sleep, prior 24 h" value={fmtH(sw?.sleep_24h)} hint="5h or more recommended" tone={sw && sw.sleep_24h < 5 ? 'bad' : undefined} />
        <Stat label="Sleep, prior 48 h" value={fmtH(sw?.sleep_48h)} hint="12h or more recommended" tone={sw && sw.sleep_48h < 12 ? 'bad' : undefined} />
        <Stat label="Awake by end" value={fmtH(a?.hours_awake_at_end ?? sw?.hours_awake_at_end)} tone={(a?.hours_awake_at_end ?? 0) >= 17 ? 'bad' : undefined} />
        <Stat label="Predicted peak KSS" value={a ? a.kss_max.toFixed(1) : '—'}
          hint={a ? `${a.kss_label} · 90th pct ${a.kss_max_90.toFixed(1)}` : 'Not modelled'} tone={a && a.kss_max >= 7 ? 'bad' : undefined} />
      </section>

      {report.timeline.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
            <h2 className="text-[13px] font-semibold">Predicted sleepiness across the period</h2>
            <p className="text-xs text-muted-foreground">KSS 1 (extremely alert) – 9 (fighting sleep)</p>
          </div>
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240}>
              <ComposedChart data={chart.points} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tickLabel}
                  tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
                  interval="preserveStartEnd" />
                <YAxis domain={[1, 9]} ticks={[1, 3, 5, 7, 9]} tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }} />
                {chart.sleeps.map((s, i) => <ReferenceArea key={`s${i}`} x1={s.x1} x2={s.x2} fill="hsl(var(--primary))" fillOpacity={0.1} ifOverflow="hidden" />)}
                {chart.duties.map((d, i) => (
                  <ReferenceArea key={`d${i}`} x1={d.x1} x2={d.x2} fill="hsl(var(--muted-foreground))" fillOpacity={d.status === 'cancelled_fatigue' ? 0.06 : 0.14}
                    stroke={d.affected ? 'hsl(var(--high))' : undefined} strokeWidth={d.affected ? 1 : 0} ifOverflow="hidden" />
                ))}
                <ReferenceLine y={7} stroke="hsl(var(--high))" strokeDasharray="3 3" strokeOpacity={0.8}
                  label={{ value: 'Sleepy (7)', position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <ReferenceLine x={chart.eventX} stroke="hsl(var(--critical))" strokeOpacity={0.8}
                  label={{ value: 'Event', fontSize: 10, position: 'top', fill: 'hsl(var(--muted-foreground))' }} />
                <Area dataKey="kss" stroke="none" fill="hsl(var(--foreground))" fillOpacity={0.05} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="kss" stroke="hsl(var(--foreground))" dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="kss90" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={1} strokeDasharray="4 3" connectNulls={false} isAnimationActive={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(x: number) => tickLabel(Math.round(x))}
                  formatter={(v: number, name: string) => [v?.toFixed?.(1) ?? '—', name === 'kss90' ? 'KSS (90th pct)' : 'KSS']}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            Solid line: average pilot with the sleep entered. Dashed: more fatigue-susceptible pilot (90th percentile).
            Tinted bands: sleep. Grey bands: duties; outlined = the affected duty.
          </p>
        </section>
      )}

      <section className="space-y-1">
        <div className="border-b border-border pb-2">
          <h2 className="text-[13px] font-semibold">Findings</h2>
        </div>
        {report.findings.length === 0 && <p className="py-3 text-sm text-muted-foreground">No findings.</p>}
        <ul className="divide-y divide-border/70">
          {report.findings.map((f, i) => {
            const s = SEVERITY_STYLE[f.severity];
            return (
              <li key={i} className="flex gap-4 py-4">
                <span aria-hidden="true" className={cn('w-[3px] rounded-[1px]', s.rule)} />
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium text-foreground">{f.title}</span>
                    <span className={cn('text-[11px] font-medium uppercase tracking-[0.08em]', s.text)}>{s.label}</span>
                  </p>
                  <p className="text-foreground/85">{f.detail}</p>
                  {f.reference && <p className="font-mono text-[11px] text-muted-foreground">{f.reference}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-border pb-2 text-[13px] font-semibold">Report</h2>
        {report.narrative.map((p) => (
          <div key={p.title}>
            <h3 className="text-sm font-semibold">{p.title}</h3>
            <p className="text-sm leading-relaxed text-foreground/90">{p.text}</p>
          </div>
        ))}
        {report.pilot_narrative && (
          <div>
            <h3 className="text-sm font-semibold">Pilot statement</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{report.pilot_narrative}</p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="border-b border-border pb-2 text-[13px] font-semibold">Duties</h2>
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <tr><th className="p-2">Duty</th><th className="p-2">Report</th><th className="p-2">Release</th><th className="p-2">Hours</th><th className="p-2">Rest before</th><th className="p-2">Status</th><th className="p-2">Peak KSS</th></tr>
            </thead>
            <tbody>
              {report.duties.map((d) => (
                <tr key={d.id} className={cn('border-t border-border/70', d.is_affected && 'bg-muted/40 font-medium')}>
                  <td className="p-2">{d.route}{d.is_affected && ' ★'}</td>
                  <td className="p-2 whitespace-nowrap">{d.report_local}<br /><span className="text-xs text-muted-foreground">{d.report_z}</span></td>
                  <td className="p-2 whitespace-nowrap">{d.release_local}<br /><span className="text-xs text-muted-foreground">{d.release_z}</span></td>
                  <td className="p-2 tabular-nums">{fmtH(d.duty_hours)}</td>
                  <td className={cn('p-2 tabular-nums', d.rest_before_hours != null && d.rest_before_hours < 12 && 'text-critical')}>{fmtH(d.rest_before_hours)}</td>
                  <td className="p-2">{d.status.replace(/_/g, ' ')}</td>
                  <td className="p-2 tabular-nums">{d.predicted_kss_max?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="border-b border-border pb-2 text-[13px] font-semibold">Sleep</h2>
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <tr><th className="p-2">Asleep</th><th className="p-2">Awake</th><th className="p-2">Duration</th><th className="p-2">Type</th><th className="p-2">Where</th><th className="p-2">Quality</th><th className="p-2">Source</th></tr>
            </thead>
            <tbody>
              {report.sleeps.map((s, i) => (
                <tr key={i} className="border-t border-border/70">
                  <td className="p-2 whitespace-nowrap">{s.start_local}</td>
                  <td className="p-2 whitespace-nowrap">{s.end_local}</td>
                  <td className={cn('p-2 tabular-nums', s.kind === 'main' && s.hours < 5 && 'text-critical')}>{fmtH(s.hours)}</td>
                  <td className="p-2">{s.kind.replace('_', ' ')}</td>
                  <td className="p-2">{s.location.replace('_', ' ')}</td>
                  <td className="p-2">{s.quality ? `${s.quality}/5` : '—'}</td>
                  <td className="p-2">{s.source === 'estimated' ? <span className="text-warning">estimated</span> : 'reported'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sw && (
        <section className="space-y-2">
          <h2 className="border-b border-border pb-2 text-[13px] font-semibold">Prior sleep / wake check</h2>
          <ul className="space-y-1 text-sm">
            {sw.checks.map((c) => (
              <li key={c.rule} className="flex items-center gap-2">
                {c.passed ? <Check className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-critical" />}
                {c.label}: <span className="tabular-nums">{fmtH(c.value)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{sw.source}</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="border-b border-border pb-2 text-[13px] font-semibold">Data quality and limitations</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {report.data_quality.notes.map((n) => <li key={n}>{n}</li>)}
          {report.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </div>
  );
}
