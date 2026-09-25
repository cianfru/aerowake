import { CheckCircle2, AlertTriangle, Info, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { EasaFinding, EasaSummary } from '@/types/fatigue';
import { formatLimit } from './roster-utils';

interface EasaChecksCardProps {
  findings?: EasaFinding[];
  summary?: EasaSummary;
}

function SummaryRow({ summary }: { summary: EasaSummary }) {
  const items = [
    { label: 'Duty 7d', v: summary.duty7dMax, l: summary.limits.duty7d },
    { label: '14d', v: summary.duty14dMax, l: summary.limits.duty14d },
    { label: '28d', v: summary.duty28dMax, l: summary.limits.duty28d },
    { label: 'Block 28d', v: summary.block28dMax, l: summary.limits.block28d },
  ];
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Highest rolling totals versus EASA limits">
      {items.map((it, i) => (
        <span key={it.label} className="whitespace-nowrap">
          {i > 0 && <span aria-hidden="true" className="mr-3 text-border">·</span>}
          {it.label} <span className="font-mono text-foreground/80">{formatLimit(it.v, it.l)}</span>
        </span>
      ))}
    </p>
  );
}

/** Roster-level EASA ORO.FTL checks: warnings listed, otherwise a single "all met" line. */
export function EasaChecksCard({ findings, summary }: EasaChecksCardProps) {
  if (!findings && !summary) return null;
  const warnings = (findings ?? []).filter((f) => f.severity === 'warning');
  const infos = (findings ?? []).filter((f) => f.severity !== 'warning');

  return (
    <section aria-labelledby="easa-checks-heading" className="space-y-2">
      <h2 id="easa-checks-heading" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Scale className="h-4 w-4" aria-hidden="true" />
        EASA checks
      </h2>
      <Card variant="glass">
        <CardContent className="p-4 space-y-3">
          {warnings.length === 0 ? (
            <p className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" aria-hidden="true" />
              All EASA cumulative duty and rest checks met
            </p>
          ) : (
            <ul className="space-y-3">
              {warnings.map((f, i) => (
                <li key={`${f.rule}-${i}`} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-warning" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">{f.title}</p>
                    {f.detail && <p className="text-sm text-muted-foreground">{f.detail}</p>}
                    {f.reference && <p className="text-xs text-muted-foreground">{f.reference}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {summary && <SummaryRow summary={summary} />}

          {infos.length > 0 && (
            <ul className="space-y-1.5 border-t border-border/40 pt-3">
              {infos.map((f, i) => (
                <li key={`${f.rule}-info-${i}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{f.title}</span>
                    {f.detail ? ` — ${f.detail}` : ''}
                    {f.reference ? ` (${f.reference})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
