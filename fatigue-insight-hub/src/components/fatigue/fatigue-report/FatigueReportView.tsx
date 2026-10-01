import { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, ArrowLeft, Check, Info, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FTL_RULE_LABELS, FTL_STATUS_LABELS, formatGeneratedAt, type FatigueReport, type Severity } from '@/lib/fatigue-report-api';
import { formatDuration, formatInstant } from '@/lib/report-time';
import { actogramCaption, buildKssSeries, kssBand, kssCaption } from './charts/chart-model';
import { CHART_CSS } from './charts/chart-palette';
import { ReportActogram } from './charts/ReportActogram';
import { ReportFigure } from './charts/ReportFigure';
import { ReportKssChart } from './charts/ReportKssChart';
import { ReportExportBar } from './ReportExportBar';
import { ReportRecordTables } from './ReportRecordTables';
import { printTitle, reportPrintCss } from './report-print';

/** Severity: text colour + a leading rule (border, so it survives print). */
const SEVERITY_STYLE: Record<Severity, { label: string; plural: string; text: string; rule: string; icon: typeof Info }> = {
  critical: { label: 'Critical', plural: 'critical', text: 'text-critical', rule: 'border-l-critical', icon: AlertOctagon },
  warning: { label: 'Warning', plural: 'warnings', text: 'text-high', rule: 'border-l-high', icon: AlertTriangle },
  caution: { label: 'Caution', plural: 'cautions', text: 'text-foreground', rule: 'border-l-warning', icon: ShieldAlert },
  info: { label: 'Note', plural: 'notes', text: 'text-muted-foreground', rule: 'border-l-border', icon: Info },
};

/** Canonical KSS band → rule colour. Low (and unknown) stay neutral. */
const BAND_RULE: Record<string, string> = {
  low: 'border-l-border', unknown: 'border-l-border', moderate: 'border-l-warning', high: 'border-l-high',
  critical: 'border-l-critical', extreme: 'border-l-critical',
};
const BAND_WORD: Record<string, string> = {
  low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical', extreme: 'Extreme', unknown: 'Not modelled',
};

const EVENT_EYEBROW: Record<string, string> = {
  roster_concern: 'Roster concern · planned duty',
  fatigue_call_before_duty: 'Fatigue report · fatigue call before duty',
  fatigue_during_duty: 'Fatigue report · fatigue during duty',
  fatigue_after_duty: 'Fatigue report · fatigue after duty',
};

const PILOT_FIELDS: [string, string][] = [['name', 'Name'], ['staff_number', 'Staff number'], ['rank', 'Rank'], ['fleet', 'Fleet'], ['operator', 'Operator']];

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-mono text-xl font-medium leading-none tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function FatigueReportView({ report, onEdit }: { report: FatigueReport; onEdit: () => void }) {
  const [signature, setSignature] = useState(true);
  const tz = report.home_timezone;
  const a = report.assessment;
  const ss = report.sleep_summary;
  const sa = report.self_assessment;
  const op = report.operational;
  const prospective = report.event.type === 'roster_concern';
  const hasCurve = useMemo(() => !!buildKssSeries(report), [report]);
  const printCss = useMemo(() => reportPrintCss(report), [report]);
  const stem = `fatigue-report-${report.home_base ?? 'report'}-${report.event.time_utc.slice(0, 10)}`;

  // The document title becomes the default PDF file name.
  useEffect(() => {
    const original = document.title;
    const before = () => { document.title = printTitle(report); };
    const after = () => { document.title = original; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); document.title = original; };
  }, [report]);

  const pilotRows = PILOT_FIELDS.filter(([k]) => report.pilot?.[k]).map(([k, l]) => [l, report.pilot[k]] as const);
  if (report.home_base) pilotRows.push(['Base', report.home_base]);
  if (op?.crew_position_label || op?.pilot_role_label) pilotRows.push(['Crew position', [op.crew_position_label, op.pilot_role_label].filter(Boolean).join(', ')]);
  const counts = (['critical', 'warning', 'caution', 'info'] as Severity[]).filter((s) => report.summary.counts[s] > 0);
  const notes = [...new Set([...(report.data_quality.notes ?? []), ...(report.limitations ?? [])])];
  const coverage = Object.entries(report.easa_summary?.coverage ?? {});
  const peakBand = a ? kssBand(a.kss_max) : 'unknown';
  const operational = op && (op.phase_of_flight_label || op.mitigations.length || op.effect_on_operation_label || op.suggested_action);

  return (
    <div id="fatigue-report-print" className="fatigue-report-doc mx-auto max-w-4xl space-y-10 px-4 pb-16 pt-8 md:px-8">
      <style>{printCss}</style>
      <style>{CHART_CSS}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onEdit}><ArrowLeft className="mr-1 h-4 w-4" />Edit inputs</Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} />
          Include reporter confirmation block
        </label>
      </div>
      <ReportExportBar report={report} fileStem={stem} />

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="space-y-4 border-b border-border pb-6">
        <p className="eyebrow">{EVENT_EYEBROW[report.event.type] ?? 'Fatigue report'}</p>
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-3xl">
          {report.event.affected_duty_label ?? `${prospective ? 'Concern' : 'Fatigue reported'} ${report.event.time_local}`}
        </h1>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 print:grid-cols-2">
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">{prospective ? 'Concern for' : 'Event'}</dt><dd className="tabular-nums">{formatInstant(report.event.time_utc, tz, report.home_base)}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">Period</dt><dd className="tabular-nums">{report.period.start_local_long ?? report.period.start_local} – {report.period.end_local_long ?? report.period.end_local}</dd></div>
          {pilotRows.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">Generated</dt><dd className="tabular-nums">{formatGeneratedAt(report.generated_at)}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">Report</dt><dd className="break-all font-mono text-xs leading-5">{report.report_id} · {report.report_version}</dd></div>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          A fatigue report is a normal safety report within the operator’s fatigue risk management (EASA ORO.FTL.120), handled under a just culture (Regulation (EU) 376/2014). Times are {report.home_base ? `${report.home_base} ` : ''}local ({tz}) with Z in brackets.
        </p>
      </header>

      {/* ── Key facts ────────────────────────────────────────── */}
      <section aria-label="Key facts" className="report-keep">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4 print:grid-cols-4">
          <Fact label="Sleep 24 / 48 h" value={ss ? `${formatDuration(ss.sleep_24h)} / ${formatDuration(ss.sleep_48h)}` : '—'} hint="before the event" />
          <Fact label="Sleep 72 h" value={formatDuration(ss?.sleep_72h)}
            hint={ss ? (ss.basis === 'reported' ? 'all reported' : ss.basis === 'none' ? 'none entered' : `${formatDuration(ss.estimated_72h)} estimated`) : undefined} />
          {ss?.hours_awake_at_event != null || !ss?.hours_since_last_sleep
            ? <Fact label="Awake at event" value={formatDuration(ss?.hours_awake_at_event)} hint={ss?.last_wake_local ? `woke ${ss.last_wake_local.slice(-5)}` : undefined} />
            : <Fact label="Since last sleep entered" value={formatDuration(ss.hours_since_last_sleep)} hint="sleep history not confirmed complete" />}
          <Fact label="Self-rating" value={sa ? [sa.kss != null ? `KSS ${sa.kss}` : '', sa.samn_perelli != null ? `SP ${sa.samn_perelli}` : ''].filter(Boolean).join(' · ') : '—'}
            hint={sa ? `at ${sa.rated_at_local.slice(-5)}` : 'none given'} />
        </dl>
      </section>

      {/* ── Figures ──────────────────────────────────────────── */}
      <ReportFigure number={1} title="Sleep, duty and event, last 72 hours" caption={actogramCaption(report)}
        chart={ReportActogram} report={report} fileStem={`${stem}-actogram`} />
      {hasCurve ? (
        <ReportFigure number={2} title={buildKssSeries(report)?.provisional ? 'Predicted sleepiness (provisional)' : 'Predicted sleepiness (KSS)'}
          caption={kssCaption(report)} chart={ReportKssChart} report={report} fileStem={`${stem}-kss`} />
      ) : (
        <p className="border-l-2 border-border pl-4 text-sm text-muted-foreground">
          No predicted sleepiness curve: at least two sleep periods covering the event are needed. The actogram above uses the records as entered.
        </p>
      )}

      {/* ── Statement and summary ────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="report-summary">
        <h2 id="report-summary" className="border-b border-border pb-2 text-[13px] font-semibold">Pilot account and summary</h2>
        {report.pilot_narrative && (
          <div className="report-keep"><h3 className="text-sm font-semibold">Pilot statement</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{report.pilot_narrative}</p></div>
        )}
        {report.narrative.filter((p) => p.title !== 'Conclusion' && p.title !== 'Operational context (pilot)').map((p) => (
          <div key={p.title}><h3 className="text-sm font-semibold">{p.title}</h3><p className="mt-1 text-sm leading-relaxed text-foreground/90">{p.text}</p></div>
        ))}
      </section>

      {operational && (
        <section className="report-keep space-y-2" aria-labelledby="report-ops">
          <h2 id="report-ops" className="border-b border-border pb-2 text-[13px] font-semibold">Operational context <span className="font-normal text-muted-foreground">· as reported by the pilot</span></h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr] print:grid-cols-[12rem_1fr]">
            {op.phase_of_flight_label && <><dt className="text-muted-foreground">Phase of flight</dt><dd>{op.phase_of_flight_label}</dd></>}
            {op.mitigations.length > 0 && <><dt className="text-muted-foreground">Mitigations taken</dt><dd>{op.mitigations.map((m) => m.label).join('; ')}</dd></>}
            {op.effect_on_operation_label && <><dt className="text-muted-foreground">Effect on the operation</dt><dd>{op.effect_on_operation_label}</dd></>}
            {op.suggested_action && <><dt className="text-muted-foreground">Suggested action</dt><dd className="whitespace-pre-wrap">{op.suggested_action}</dd></>}
          </dl>
        </section>
      )}

      {/* ── Assessment ───────────────────────────────────────── */}
      <section className={cn('report-keep space-y-2 border-l-[3px] pl-4', BAND_RULE[report.summary.overall_level] ?? 'border-l-border')} data-print-keep>
        <p className="text-lg font-medium leading-snug">{report.summary.headline}</p>
        <p className="text-sm text-muted-foreground">
          {a ? <>Predicted peak KSS <span className="font-mono text-foreground">{a.kss_max.toFixed(1)}</span> ({BAND_WORD[peakBand].toLowerCase()} band) at {a.kss_max_time_local}; 90th-percentile pilot {a.kss_max_90.toFixed(1)}. Model estimate, not a measurement.</>
            : 'No modelled assessment: the sleep history was not confirmed complete or does not cover the event.'}
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          {counts.map((s) => (
            <span key={s} className="whitespace-nowrap">
              <span className={cn('font-mono font-medium', SEVERITY_STYLE[s].text)} data-print-keep>{report.summary.counts[s]}</span>{' '}
              {report.summary.counts[s] === 1 ? SEVERITY_STYLE[s].label.toLowerCase() : SEVERITY_STYLE[s].plural}
            </span>
          ))}
          <span className="whitespace-nowrap">Record coverage: <span className="text-foreground">{report.data_quality.confidence}</span></span>
        </p>
      </section>

      <section className="space-y-1" aria-labelledby="report-findings">
        <h2 id="report-findings" className="border-b border-border pb-2 text-[13px] font-semibold">Findings</h2>
        {report.findings.length === 0 && <p className="py-3 text-sm text-muted-foreground">No findings.</p>}
        <ul className="space-y-3 pt-2">
          {report.findings.map((f, i) => {
            const s = SEVERITY_STYLE[f.severity];
            return (
              <li key={i} className={cn('border-l-[3px] py-1 pl-4 text-sm', s.rule)} data-print-keep>
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium text-foreground">{f.title}</span>
                  <span className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', s.text)} data-print-keep>{s.label}</span>
                </p>
                <p className="mt-0.5 text-foreground/85">{f.detail}</p>
                {f.reference && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{f.reference}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {signature && (
        <section className="report-keep space-y-4 rounded-lg border border-dashed border-border p-4 text-sm" aria-label="Reporter confirmation">
          <h2 className="font-semibold">Reporter confirmation</h2>
          <p className="text-muted-foreground">I confirm that this report reflects my own account to the best of my recollection. Model estimates are shown for context only.</p>
          <div className="grid gap-6 pt-2 sm:grid-cols-3 print:grid-cols-3">
            {['Name', 'Date', 'Signature'].map((l) => (
              <div key={l}><div className="h-8 border-b border-foreground/50" /><p className="mt-1 text-xs text-muted-foreground">{l}</p></div>
            ))}
          </div>
        </section>
      )}

      {/* ── Supporting detail (from page 2 in print) ─────────── */}
      <div className="report-appendix space-y-2 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Supporting detail</h2>
        <p className="text-sm text-muted-foreground">Roster records, pilot-entered sleep and model estimates, each labelled by source. Estimates never replace the pilot’s account.</p>
      </div>

      <ReportRecordTables report={report} />

      {coverage.length > 0 && (
        <section className="space-y-2" aria-labelledby="report-ftl">
          <h2 id="report-ftl" className="border-b border-border pb-2 text-[13px] font-semibold">FTL checks performed <span className="font-normal text-muted-foreground">· on the supplied records only</span></h2>
          <ul className="divide-y divide-border/70 text-sm">
            {coverage.map(([rule, c]) => (
              <li key={rule} className="grid gap-1 py-2 sm:grid-cols-[16rem_12rem_1fr] print:grid-cols-[16rem_12rem_1fr]">
                <span>{FTL_RULE_LABELS[rule] ?? rule}</span>
                <span className={cn('flex items-center gap-1.5', c.status === 'failed' && 'font-medium')}>
                  {c.status === 'passed' ? <Check className="h-3.5 w-3.5" aria-hidden /> : c.status === 'failed' ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : null}
                  {FTL_STATUS_LABELS[c.status] ?? c.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground">{c.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">A scoped check, not a compliance certificate: history before the reporting period and operator-specific schemes are not known.</p>
        </section>
      )}

      {(report.prior_sleep_wake || report.cumulative_deficit) && (
        <section className="space-y-2" aria-labelledby="report-screen">
          <h2 id="report-screen" className="border-b border-border pb-2 text-[13px] font-semibold">Sleep screening</h2>
          {report.prior_sleep_wake && (
            <ul className="space-y-1 text-sm">
              {report.prior_sleep_wake.checks.map((c) => (
                <li key={c.rule} className="flex items-center gap-2">
                  {c.passed ? <Check className="h-4 w-4" aria-label="Met" /> : <AlertTriangle className="h-4 w-4 text-high" aria-label="Not met" data-print-keep />}
                  {c.label}: <span className="tabular-nums">{formatDuration(c.value)}</span>
                </li>
              ))}
            </ul>
          )}
          {report.cumulative_deficit && (
            <p className="text-sm">Seven-day sleep shortfall against an 8 h/day need: <span className="tabular-nums">{formatDuration(report.cumulative_deficit.deficit_hours)}</span> over {report.cumulative_deficit.days.toFixed(1)} days ({report.cumulative_deficit.band}).</p>
          )}
          <p className="text-xs text-muted-foreground">{report.prior_sleep_wake?.source ?? ''} Screening references, not regulatory limits or individual fitness criteria.</p>
        </section>
      )}

      {report.scientific_basis && (
        <section className="space-y-3" aria-labelledby="report-science">
          <h2 id="report-science" className="border-b border-border pb-2 text-[13px] font-semibold">Scientific basis</h2>
          {report.scientific_basis.map((source) => (
            <div key={source.url} className="text-sm">
              <a href={source.url} target="_blank" rel="noreferrer" className="font-medium underline">{source.citation}</a>
              <p className="mt-1 text-muted-foreground">{source.application}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="report-limits">
        <h2 id="report-limits" className="border-b border-border pb-2 text-[13px] font-semibold">Data quality and limitations</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>
    </div>
  );
}
