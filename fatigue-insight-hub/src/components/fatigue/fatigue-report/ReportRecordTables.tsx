import type { FatigueReport } from '@/lib/fatigue-report-api';
import { formatDuration } from '@/lib/report-time';
import { cn } from '@/lib/utils';

const STATUS: Record<string, string> = {
  operated: 'Operated', planned: 'Planned', cancelled_fatigue: 'Not operated – fatigue', not_operated: 'Not operated',
};
const LOCATION: Record<string, string> = { home: 'Home', hotel: 'Hotel', crew_rest: 'Crew rest', other: 'Other' };
const KIND: Record<string, string> = { main: 'Main sleep', nap: 'Nap', inflight_rest: 'In-flight rest' };

/** Duty and sleep records: a table from `sm` (and always in print), stacked cards on phones. */
export function ReportRecordTables({ report }: { report: FatigueReport }) {
  return (
    <>
      <section className="space-y-2" aria-labelledby="report-duties">
        <h2 id="report-duties" className="border-b border-border pb-2 text-[13px] font-semibold">Duties <span className="font-normal text-muted-foreground">· home-base time, Z below</span></h2>
        {report.duties.length === 0 && <p className="text-sm text-muted-foreground">No duties entered.</p>}
        <ul className="space-y-2 sm:hidden print:hidden">
          {report.duties.map((d) => (
            <li key={d.id} className={cn('rounded-lg border p-3 text-sm', d.is_affected && 'border-foreground/60')}>
              <p className="font-medium">{d.flights_label ? `${d.flights_label} · ` : ''}{d.route}{d.is_affected && <span className="ml-1 text-xs font-normal text-muted-foreground">(affected duty)</span>}</p>
              <p className="mt-1 tabular-nums">{d.report_local} → {d.release_local.slice(-5)} <span className="text-xs text-muted-foreground">({d.report_z})</span></p>
              <p className="mt-1 text-xs text-muted-foreground">
                {STATUS[d.status] ?? d.status} · {formatDuration(d.duty_hours)}
                {d.rest_before_hours != null && ` · rest before ${formatDuration(d.rest_before_hours)}`}
                {d.predicted_kss_max != null && ` · peak KSS ${d.predicted_kss_max.toFixed(1)}`}
              </p>
            </li>
          ))}
        </ul>
        {report.duties.length > 0 && (
          <div className="hidden overflow-x-auto border-y border-border sm:block print:block">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <tr><th className="p-2">Duty</th><th className="p-2">Report</th><th className="p-2">Release</th><th className="p-2">Hours</th><th className="p-2">Rest before</th><th className="p-2">Status</th><th className="p-2">Peak KSS</th></tr>
              </thead>
              <tbody>
                {report.duties.map((d) => (
                  <tr key={d.id} className={cn('border-t border-border/70 align-top', d.is_affected && 'font-medium')}>
                    <td className="p-2">{d.flights_label && <span className="block">{d.flights_label}</span>}<span className={cn(d.flights_label && 'text-xs text-muted-foreground')}>{d.route}</span>{d.is_affected && <span className="block text-xs font-normal text-muted-foreground">Affected duty</span>}</td>
                    <td className="p-2 whitespace-nowrap tabular-nums">{d.report_local}<br /><span className="text-xs text-muted-foreground">{d.report_z}</span></td>
                    <td className="p-2 whitespace-nowrap tabular-nums">{d.release_local}<br /><span className="text-xs text-muted-foreground">{d.release_z}</span></td>
                    <td className="p-2 tabular-nums">{formatDuration(d.duty_hours)}</td>
                    <td className="p-2 tabular-nums">{formatDuration(d.rest_before_hours)}</td>
                    <td className="p-2">{STATUS[d.status] ?? d.status}</td>
                    <td className="p-2 tabular-nums">{d.predicted_kss_max?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="report-sleep">
        <h2 id="report-sleep" className="border-b border-border pb-2 text-[13px] font-semibold">Sleep <span className="font-normal text-muted-foreground">· reported and estimated shown separately</span></h2>
        {report.sleeps.length === 0 && <p className="text-sm text-muted-foreground">No sleep entered.</p>}
        <ul className="space-y-2 sm:hidden print:hidden">
          {report.sleeps.map((s, i) => (
            <li key={i} className={cn('rounded-lg border p-3 text-sm', s.source === 'estimated' && 'border-dashed')}>
              <p className="tabular-nums">{s.start_local} → {s.end_local.slice(-5)} · <span className="font-medium">{formatDuration(s.hours)}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{KIND[s.kind] ?? s.kind} · {LOCATION[s.location] ?? s.location} · {s.quality ? `quality ${s.quality}/5 · ` : ''}{s.source === 'estimated' ? 'Estimated' : 'Reported'}</p>
            </li>
          ))}
        </ul>
        {report.sleeps.length > 0 && (
          <div className="hidden overflow-x-auto border-y border-border sm:block print:block">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <tr><th className="p-2">Asleep</th><th className="p-2">Awake</th><th className="p-2">Duration</th><th className="p-2">Type</th><th className="p-2">Where</th><th className="p-2">Quality</th><th className="p-2">Source</th></tr>
              </thead>
              <tbody>
                {report.sleeps.map((s, i) => (
                  <tr key={i} className="border-t border-border/70">
                    <td className="p-2 whitespace-nowrap tabular-nums">{s.start_local}</td>
                    <td className="p-2 whitespace-nowrap tabular-nums">{s.end_local}</td>
                    <td className="p-2 tabular-nums">{formatDuration(s.hours)}</td>
                    <td className="p-2">{KIND[s.kind] ?? s.kind}</td>
                    <td className="p-2">{LOCATION[s.location] ?? s.location}</td>
                    <td className="p-2">{s.quality ? `${s.quality}/5` : '—'}</td>
                    <td className="p-2">{s.source === 'estimated' ? 'Estimated' : 'Reported'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
