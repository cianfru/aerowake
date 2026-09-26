import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EasaFinding, EasaSummary } from '@/types/fatigue';
import { formatLimit } from './roster-utils';
import { SectionHeading } from './primitives';

interface EasaChecksCardProps {
  findings?: EasaFinding[];
  summary?: EasaSummary;
}

/** One cumulative limit: label, value/limit and a square-ended usage bar. */
function Gauge({ label, value, limit }: { label: string; value: number; limit: number }) {
  const ratio = limit > 0 ? value / limit : 0;
  const tone = ratio > 1 ? 'bg-critical' : ratio >= 0.9 ? 'bg-warning' : 'bg-foreground/45';
  return (
    <div className="min-w-0 space-y-2">
      <p className="eyebrow">{label}</p>
      <p className="font-mono text-lg font-medium leading-none tabular">{formatLimit(value, limit)}</p>
      <div className="h-[3px] w-full bg-border" aria-hidden="true">
        <div className={cn('h-full', tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

/** Roster-level EASA ORO.FTL checks: warnings listed, gauges for rolling totals. */
export function EasaChecksCard({ findings, summary }: EasaChecksCardProps) {
  if (!findings && !summary) return null;
  const warnings = (findings ?? []).filter((f) => f.severity === 'warning');
  const infos = (findings ?? []).filter((f) => f.severity !== 'warning');

  return (
    <section aria-labelledby="easa-checks-heading" className="space-y-4">
      <SectionHeading
        id="easa-checks-heading"
        title="EASA flight-time limitations"
        aside="Regulation (EU) 965/2012, ORO.FTL"
      />

      {warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
          All EASA cumulative duty and rest checks met
        </p>
      ) : (
        <ul className="space-y-3">
          {warnings.map((f, i) => (
            <li key={`${f.rule}-${i}`} className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{f.title}</p>
                {f.detail && <p className="text-sm text-muted-foreground">{f.detail}</p>}
                {f.reference && <p className="font-mono text-[11px] text-muted-foreground">{f.reference}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4" aria-label="Highest rolling totals versus EASA limits">
          <Gauge label="Duty · 7 days" value={summary.duty7dMax} limit={summary.limits.duty7d} />
          <Gauge label="Duty · 14 days" value={summary.duty14dMax} limit={summary.limits.duty14d} />
          <Gauge label="Duty · 28 days" value={summary.duty28dMax} limit={summary.limits.duty28d} />
          <Gauge label="Block · 28 days" value={summary.block28dMax} limit={summary.limits.block28d} />
        </div>
      )}

      {infos.length > 0 && (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {infos.map((f, i) => (
            <li key={`${f.rule}-info-${i}`}>
              <span className="font-medium text-foreground/80">{f.title}</span>
              {f.detail ? ` — ${f.detail}` : ''}
              {f.reference ? <span className="font-mono"> · {f.reference}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
