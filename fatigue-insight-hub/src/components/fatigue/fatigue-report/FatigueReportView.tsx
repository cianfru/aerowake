import { useMemo, useState } from 'react';
import {
  AlertOctagon, AlertTriangle, ArrowLeft, Check, Copy, Download, Info, Printer, ShieldAlert,
} from 'lucide-react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { reportToText, tzOffsetMinutes, type FatigueReport, type Severity } from '@/lib/fatigue-report-api';

const SEVERITY_STYLE: Record<Severity, { label: string; className: string; icon: typeof Info }> = {
  critical: { label: 'Critical', className: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300', icon: AlertOctagon },
  warning: { label: 'Warning', className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300', icon: AlertTriangle },
  caution: { label: 'Caution', className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: ShieldAlert },
  info: { label: 'Info', className: 'border-border bg-muted/40 text-muted-foreground', icon: Info },
};

const LEVEL_STYLE: Record<string, string> = {
  low: 'border-emerald-500/40 bg-emerald-500/10',
  moderate: 'border-amber-500/40 bg-amber-500/10',
  high: 'border-orange-500/40 bg-orange-500/10',
  critical: 'border-red-500/40 bg-red-500/10',
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
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums', tone === 'bad' && 'text-red-600 dark:text-red-400')}>{value}</p>
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
    <div id="fatigue-report-print" className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onEdit}><ArrowLeft className="mr-1 h-4 w-4" />Edit inputs</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copy}>{copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}{copied ? 'Copied' : 'Copy text'}</Button>
          <Button variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" />JSON</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
        </div>
      </div>

      <section className="space-y-1">
        <p className="text-sm font-medium text-primary">Fatigue report</p>
        <h1 className="text-2xl font-semibold">{report.event.affected_duty_label ?? `Fatigue reported ${report.event.time_local}`}</h1>
        {pilotLine && <p className="text-sm">{pilotLine}</p>}
        <p className="text-xs text-muted-foreground">
          Event {report.event.time_local} ({report.event.time_z}) · Period {report.period.start_local} – {report.period.end_local} ·
          Times in {tz} · Generated {new Date(report.generated_at).toUTCString()} · {report.report_version} / {report.engine_version}
        </p>
      </section>

      <section className={cn('rounded-xl border p-5 space-y-2', LEVEL_STYLE[report.summary.overall_level])}>
        <p className="text-lg font-semibold">{report.summary.headline}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {(['critical', 'warning', 'caution', 'info'] as Severity[]).map((s) => report.summary.counts[s] > 0 && (
            <Badge key={s} variant="outline" className={SEVERITY_STYLE[s].className}>{report.summary.counts[s]} {SEVERITY_STYLE[s].label.toLowerCase()}</Badge>
          ))}
          <Badge variant="outline">Data confidence: {report.data_quality.confidence}</Badge>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sleep, prior 24 h" value={fmtH(sw?.sleep_24h)} hint="≥ 5h recommended" tone={sw && sw.sleep_24h < 5 ? 'bad' : undefined} />
        <Stat label="Sleep, prior 48 h" value={fmtH(sw?.sleep_48h)} hint="≥ 12h recommended" tone={sw && sw.sleep_48h < 12 ? 'bad' : undefined} />
        <Stat label="Awake by end" value={fmtH(a?.hours_awake_at_end ?? sw?.hours_awake_at_end)} tone={(a?.hours_awake_at_end ?? 0) >= 17 ? 'bad' : undefined} />
        <Stat label="Predicted peak KSS" value={a ? a.kss_max.toFixed(1) : '—'}
          hint={a ? `${a.kss_label} · 90th pct ${a.kss_max_90.toFixed(1)}` : 'Not modelled'} tone={a && a.kss_max >= 7 ? 'bad' : undefined} />
      </section>

      {report.timeline.length > 0 && (
        <section className="rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold">Predicted sleepiness (KSS) across the period</h2>
          <p className="text-xs text-muted-foreground">
            Line: average pilot with the sleep entered. Dashed: 90th-percentile (more susceptible) pilot.
            Blue bands: sleep. Grey bands: duties (outlined = affected duty). KSS 7 = sleepy.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tickLabel}
                  tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[1, 9]} ticks={[1, 3, 5, 7, 9]} tick={{ fontSize: 11 }} />
                {chart.sleeps.map((s, i) => <ReferenceArea key={`s${i}`} x1={s.x1} x2={s.x2} fill="#3b82f6" fillOpacity={0.12} ifOverflow="hidden" />)}
                {chart.duties.map((d, i) => (
                  <ReferenceArea key={`d${i}`} x1={d.x1} x2={d.x2} fill="#94a3b8" fillOpacity={d.status === 'cancelled_fatigue' ? 0.08 : 0.18}
                    stroke={d.affected ? '#f97316' : undefined} strokeWidth={d.affected ? 1.5 : 0} ifOverflow="hidden" />
                ))}
                <ReferenceLine y={7} stroke="#f97316" strokeDasharray="4 4" />
                <ReferenceLine x={chart.eventX} stroke="#ef4444" label={{ value: 'Event', fontSize: 10, position: 'top' }} />
                <Area dataKey="kss" stroke="none" fill="#8b5cf6" fillOpacity={0.08} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="kss" stroke="#8b5cf6" dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="kss90" stroke="#8b5cf6" dot={false} strokeWidth={1} strokeDasharray="4 3" connectNulls={false} isAnimationActive={false} />
                <Tooltip
                  labelFormatter={(x: number) => tickLabel(Math.round(x))}
                  formatter={(v: number, name: string) => [v?.toFixed?.(1) ?? '—', name === 'kss90' ? 'KSS (90th pct)' : 'KSS']}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Findings</h2>
        {report.findings.length === 0 && <p className="text-sm text-muted-foreground">No findings.</p>}
        {report.findings.map((f, i) => {
          const s = SEVERITY_STYLE[f.severity];
          return (
            <div key={i} className={cn('flex gap-3 rounded-lg border p-3', s.className)}>
              <s.icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5 text-sm">
                <p className="font-medium text-foreground">{f.title} <span className="font-normal text-muted-foreground">· {s.label}</span></p>
                <p className="text-foreground/90">{f.detail}</p>
                {f.reference && <p className="text-xs text-muted-foreground">{f.reference}</p>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Report</h2>
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
        <h2 className="text-lg font-semibold">Duties</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="p-2">Duty</th><th className="p-2">Report</th><th className="p-2">Release</th><th className="p-2">Hours</th><th className="p-2">Rest before</th><th className="p-2">Status</th><th className="p-2">Peak KSS</th></tr>
            </thead>
            <tbody>
              {report.duties.map((d) => (
                <tr key={d.id} className={cn('border-t', d.is_affected && 'bg-orange-500/5 font-medium')}>
                  <td className="p-2">{d.route}{d.is_affected && ' ★'}</td>
                  <td className="p-2 whitespace-nowrap">{d.report_local}<br /><span className="text-xs text-muted-foreground">{d.report_z}</span></td>
                  <td className="p-2 whitespace-nowrap">{d.release_local}<br /><span className="text-xs text-muted-foreground">{d.release_z}</span></td>
                  <td className="p-2 tabular-nums">{fmtH(d.duty_hours)}</td>
                  <td className={cn('p-2 tabular-nums', d.rest_before_hours != null && d.rest_before_hours < 12 && 'text-red-600 dark:text-red-400')}>{fmtH(d.rest_before_hours)}</td>
                  <td className="p-2">{d.status.replace(/_/g, ' ')}</td>
                  <td className="p-2 tabular-nums">{d.predicted_kss_max?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Sleep</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="p-2">Asleep</th><th className="p-2">Awake</th><th className="p-2">Duration</th><th className="p-2">Type</th><th className="p-2">Where</th><th className="p-2">Quality</th><th className="p-2">Source</th></tr>
            </thead>
            <tbody>
              {report.sleeps.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 whitespace-nowrap">{s.start_local}</td>
                  <td className="p-2 whitespace-nowrap">{s.end_local}</td>
                  <td className={cn('p-2 tabular-nums', s.kind === 'main' && s.hours < 5 && 'text-red-600 dark:text-red-400')}>{fmtH(s.hours)}</td>
                  <td className="p-2">{s.kind.replace('_', ' ')}</td>
                  <td className="p-2">{s.location.replace('_', ' ')}</td>
                  <td className="p-2">{s.quality ? `${s.quality}/5` : '—'}</td>
                  <td className="p-2">{s.source === 'estimated' ? <span className="text-amber-600 dark:text-amber-400">estimated</span> : 'reported'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sw && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Prior sleep / wake check</h2>
          <ul className="space-y-1 text-sm">
            {sw.checks.map((c) => (
              <li key={c.rule} className="flex items-center gap-2">
                {c.passed ? <Check className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
                {c.label}: <span className="tabular-nums">{fmtH(c.value)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{sw.source}</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Data quality and limitations</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {report.data_quality.notes.map((n) => <li key={n}>{n}</li>)}
          {report.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </div>
  );
}
