import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EasaFinding, EasaSummary } from '@/types/fatigue';
import { formatLimit } from './roster-utils';

interface EasaChecksCardProps {
  findings?: EasaFinding[];
  summary?: EasaSummary;
}

/** Human names for the backend's rule keys, with the rule they check. */
export const EASA_RULE_LABELS: Record<string, string> = {
  duty_7d: 'Duty in any 7 days (ORO.FTL.210)',
  duty_14d: 'Duty in any 14 days (ORO.FTL.210)',
  duty_28d: 'Duty in any 28 days (ORO.FTL.210)',
  block_28d: 'Flight time in any 28 days (ORO.FTL.210)',
  min_rest: 'Minimum rest (ORO.FTL.235)',
  reduced_rest: 'Reduced rest (ORO.FTL.235(c))',
  recovery_rest: 'Recurrent extended recovery rest (ORO.FTL.235(d))',
  time_zone_rest: 'Rest after time-zone rotations (CS FTL.1.235(b))',
  disruptive: 'Disruptive schedules (CS FTL.1.235(a))',
  standby: 'Standby (ORO.FTL.225)',
  fdp_max: 'Maximum daily FDP (ORO.FTL.205)',
  fdp_extension: 'Planned FDP extensions (ORO.FTL.205(d))',
  operator_approval: 'Operator approvals',
};

const ruleLabel = (rule: string) => EASA_RULE_LABELS[rule] ?? rule.replace(/_/g, ' ');

const STATUS_LABELS: Record<string, string> = {
  failed: 'finding listed above',
  incomplete_history: 'partly assessed',
  not_assessed: 'not assessed',
};

/**
 * Coverage notes grouped by reason, so a reason shared by six checks is
 * stated once with the list of checks it applies to.
 */
export function groupCoverage(coverage: EasaSummary['coverage']): Array<{ reason: string; rules: Array<{ rule: string; status: string }> }> {
  const groups = new Map<string, Array<{ rule: string; status: string }>>();
  for (const [rule, c] of Object.entries(coverage ?? {})) {
    if (c.status === 'passed') continue;
    const reason = c.reason || 'No reason given.';
    groups.set(reason, [...(groups.get(reason) ?? []), { rule, status: c.status }]);
  }
  return [...groups.entries()].map(([reason, rules]) => ({ reason, rules }));
}

/** One cumulative limit: label, value/limit and a neutral usage bar (band colour only near the limit). */
function Gauge({ label, value, limit }: { label: string; value: number; limit: number }) {
  const ratio = limit > 0 ? value / limit : 0;
  const tone = ratio > 1 ? 'bg-risk-critical' : ratio >= 0.9 ? 'bg-risk-moderate' : 'bg-foreground/60';
  return (
    <div className="instrument-inset min-w-0 space-y-3 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-medium leading-none tabular">{formatLimit(value, limit)}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-muted" role="img" aria-label={`${label}: highest rolling total ${Math.round(value)} of ${Math.round(limit)} hours`}>
        <div className={cn('h-full', tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

/** Roster-level EASA ORO.FTL checks: warnings listed, gauges for rolling totals. */
export function EasaChecksCard({ findings, summary }: EasaChecksCardProps) {
  const warnings = (findings ?? []).filter((f) => f.severity === 'warning');
  const infos = (findings ?? []).filter((f) => f.severity !== 'warning');
  const coverage = groupCoverage(summary?.coverage);

  return (
    <section aria-labelledby="easa-checks-heading" className="instrument-surface space-y-6">
      <div className="space-y-1">
        <h2 id="easa-checks-heading" className="text-title font-semibold">FTL checks</h2>
        <p className="text-sm text-muted-foreground">Supplied activities compared with the QCAA / EASA flight time limitations.</p>
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
        <p className="font-medium">Operator approval is not verified</p>
        <p className="mt-1 text-muted-foreground">Checks follow the QCAA / EASA flight time limitations; your operator’s approved scheme takes precedence. Confirm crew, rest facility, FRM and ULR city-pair approval with your operator: they cannot be established from a roster.</p>
      </div>

      {warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          {!summary || summary.status === 'unavailable' ? 'FTL checks unavailable' : 'No threshold exceedances found in the supplied activities'}
        </p>
      ) : (
        <ul className="space-y-3">
          {warnings.map((f, i) => (
            <li key={`${f.rule}-${i}`} className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-risk-moderate-ink" aria-hidden="true" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{f.title}</p>
                {f.detail && <p className="text-sm text-muted-foreground">{f.detail}</p>}
                {f.reference && <p className="font-mono text-[11px] text-muted-foreground">{f.reference}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {summary && summary.status !== 'unavailable' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Highest rolling total in this roster, against the limit</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Highest rolling totals versus limits">
            <Gauge label="Duty · 7 days" value={summary.duty7dMax} limit={summary.limits.duty7d} />
            <Gauge label="Duty · 14 days" value={summary.duty14dMax} limit={summary.limits.duty14d} />
            <Gauge label="Duty · 28 days" value={summary.duty28dMax} limit={summary.limits.duty28d} />
            <Gauge label="Flight time · 28 days" value={summary.block28dMax} limit={summary.limits.block28d} />
          </div>
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

      <div className="space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <p>A scoped check of the supplied roster, not a compliance certificate: earlier history, operator approvals, standby call-outs and reduced-rest compensation are not established here.</p>
        <a href="https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-air-operations-regulation-eu-no-9652012" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Read the public EASA Air Operations rules ↗</a>
        {coverage.length > 0 && (
          <details>
            <summary className="cursor-pointer py-1 font-medium text-foreground/80">What was and was not assessed</summary>
            <ul className="mt-2 space-y-3">
              {coverage.map((g) => (
                <li key={g.reason} className="space-y-1">
                  <p className="text-foreground/90">{g.reason}</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {g.rules.map((r) => <li key={r.rule}>{ruleLabel(r.rule)}{STATUS_LABELS[r.status] ? ` — ${STATUS_LABELS[r.status]}` : ''}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
