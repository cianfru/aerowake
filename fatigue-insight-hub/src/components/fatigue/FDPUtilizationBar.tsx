import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';
import { hhmm } from '@/lib/hhmm';

interface FDPUtilizationBarProps {
  actualFdpHours: number;
  maxFdpHours: number;
  extendedFdpHours?: number;
  /** Planned extension limit (CS FTL.1.205(a)); null = not allowed at this report time. */
  plannedExtensionFdpHours?: number | null;
  /** Where the maximum comes from, e.g. 'ORO.FTL.205(b) Table 2'. */
  fdpLimitReference?: string | null;
  usedDiscretion?: boolean;
}

/**
 * Flight duty period against the operator's limits, in the order they apply:
 * the maximum (ORO.FTL.205, CS FTL.1.205(c) or the ULR approval), a planned extension (CS FTL.1.205(a), 2-pilot crews
 * only) and commander's discretion (ORO.FTL.205(f); operator OM-A 7.7.1), unforeseen circumstances only.
 */
export function FDPUtilizationBar({ actualFdpHours, maxFdpHours, extendedFdpHours, plannedExtensionFdpHours, fdpLimitReference, usedDiscretion }: FDPUtilizationBarProps) {
  const discretion = extendedFdpHours && extendedFdpHours > maxFdpHours ? extendedFdpHours : undefined;
  // 'Table 7-7': analyses saved before the QCAA / EASA wording (same values as Table 4).
  const basicTable = !fdpLimitReference || fdpLimitReference.startsWith('ORO.FTL.205') || fdpLimitReference.includes('Table 7-7');
  const extension = basicTable && plannedExtensionFdpHours && plannedExtensionFdpHours > maxFdpHours ? plannedExtensionFdpHours : undefined;
  const planned = extension ?? maxFdpHours;
  const upper = Math.max((discretion ?? planned) * 1.08, actualFdpHours * 1.05);
  const ratio = maxFdpHours > 0 ? actualFdpHours / maxFdpHours : 0;
  const tone = actualFdpHours > planned + 1e-6 ? 'bg-risk-critical' : ratio > 1 || ratio >= 0.9 ? 'bg-risk-moderate' : 'bg-foreground/50';
  const pct = (h: number) => `${Math.min(100, (h / upper) * 100)}%`;
  const overBasic = actualFdpHours > maxFdpHours + 1e-6;

  const rows: [string, string, string][] = [
    ['Maximum', hhmm(maxFdpHours), fdpLimitReference ?? 'ORO.FTL.205(b)'],
  ];
  if (basicTable) {
    rows.push(['Planned extension', extension ? hhmm(extension) : 'Not allowed', 'CS FTL.1.205(a) · twice in 7 days']);
  }
  if (discretion) rows.push(["Commander's discretion", hhmm(discretion), 'ORO.FTL.205(f) · unforeseen only']);

  return (
    <section className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="fdp-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="fdp-heading" className="flex items-center gap-1.5 text-[15px] font-semibold">
          Flight duty period
          {FATIGUE_INFO.fdpUtilization && <InfoTooltip entry={FATIGUE_INFO.fdpUtilization} size="sm" />}
        </h3>
        <p className="font-mono text-sm tabular">
          {hhmm(actualFdpHours)} <span className="text-muted-foreground">of {hhmm(maxFdpHours)} · {Math.round(ratio * 100)}%</span>
        </p>
      </div>
      <div className="relative mt-3 h-2 rounded-[2px] bg-muted" role="img" aria-label={`FDP ${hhmm(actualFdpHours)} of ${hhmm(maxFdpHours)} maximum`}>
        <div className={cn('absolute inset-y-0 left-0 rounded-[2px]', tone)} style={{ width: pct(actualFdpHours) }} />
        <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-[2px] bg-foreground" style={{ left: pct(maxFdpHours) }} />
        {extension && <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px border-l border-dotted border-foreground/70" style={{ left: pct(extension) }} />}
        {discretion && <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px border-l border-dashed border-foreground/50" style={{ left: pct(discretion) }} />}
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        {rows.map(([label, value, ref]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono tabular">{value}</dd>
            <dd className="col-span-2 break-words text-muted-foreground">{ref}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">QCAA / EASA flight time limitations. Operator approvals and use of discretion are not verified from the roster.</p>
      {discretion && actualFdpHours > discretion + 1e-6 && (
        <p className="mt-2 text-xs font-medium text-risk-critical-ink">Above the maximum even with commander’s discretion.</p>
      )}
      {overBasic && extension && actualFdpHours <= extension + 1e-6 && (
        <p className="mt-2 text-xs font-medium text-risk-moderate-ink">Uses a planned extension: pre- and post-flight rest each 2 h longer, or post-flight rest 4 h longer.</p>
      )}
      {overBasic && actualFdpHours > planned + 1e-6 && usedDiscretion !== false && (
        <p className="mt-2 text-xs font-medium text-risk-critical-ink">Above the planned maximum: this cannot be planned as discretion. Any operational use requires unforeseen circumstances and the commander’s decision.</p>
      )}
    </section>
  );
}
