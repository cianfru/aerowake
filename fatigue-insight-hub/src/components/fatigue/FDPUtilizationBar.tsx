import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';
import { hhmm } from '@/lib/hhmm';

interface FDPUtilizationBarProps {
  actualFdpHours: number;
  maxFdpHours: number;
  extendedFdpHours?: number;
  /** Qatar OM-A 7.6.5 Table 7-8 limit; null = not allowed at this report time. */
  plannedExtensionFdpHours?: number | null;
  /** OM-A table the maximum comes from, e.g. 'OM-A 7.6.3 Table 7-6'. */
  fdpLimitReference?: string | null;
  usedDiscretion?: boolean;
}

/**
 * Flight duty period against the operator's limits, in the order they apply:
 * the maximum (OM-A 7.6.3 / 7.6.6 / 7.18), a planned extension (7.6.5, 2-pilot crews
 * only) and commander's discretion (7.7.1, unforeseen circumstances only).
 */
export function FDPUtilizationBar({ actualFdpHours, maxFdpHours, extendedFdpHours, plannedExtensionFdpHours, fdpLimitReference, usedDiscretion }: FDPUtilizationBarProps) {
  const discretion = extendedFdpHours && extendedFdpHours > maxFdpHours ? extendedFdpHours : undefined;
  const basicTable = !fdpLimitReference || fdpLimitReference.includes('7.6.3');
  const extension = basicTable && plannedExtensionFdpHours && plannedExtensionFdpHours > maxFdpHours ? plannedExtensionFdpHours : undefined;
  const planned = extension ?? maxFdpHours;
  const upper = Math.max((discretion ?? planned) * 1.08, actualFdpHours * 1.05);
  const ratio = maxFdpHours > 0 ? actualFdpHours / maxFdpHours : 0;
  const tone = actualFdpHours > planned + 1e-6 ? 'bg-risk-critical' : ratio > 1 || ratio >= 0.9 ? 'bg-risk-moderate' : 'bg-foreground/50';
  const pct = (h: number) => `${Math.min(100, (h / upper) * 100)}%`;
  const overBasic = actualFdpHours > maxFdpHours + 1e-6;

  const rows: [string, string, string][] = [
    ['Maximum', hhmm(maxFdpHours), fdpLimitReference ?? 'OM-A 7.6.3'],
  ];
  if (basicTable) {
    rows.push(['Planned extension', extension ? hhmm(extension) : 'Not allowed', 'OM-A 7.6.5 Table 7-8 · twice in 7 days']);
  }
  if (discretion) rows.push(["Commander's discretion", hhmm(discretion), 'OM-A 7.7.1 · unforeseen only']);

  return (
    <section className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="fdp-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="fdp-heading" className="flex items-center gap-1.5 text-[15px] font-semibold">
          Flight duty period
          {FATIGUE_INFO.fdpUtilization && <InfoTooltip entry={FATIGUE_INFO.fdpUtilization} size="sm" />}
        </h3>
        <p className="font-mono text-sm tabular">
          {hhmm(actualFdpHours)} <span className="text-muted-foreground">of {hhmm(maxFdpHours)} · {Math.round(ratio * 100)}%</span>
        </p>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-muted" role="img" aria-label={`FDP ${hhmm(actualFdpHours)} of ${hhmm(maxFdpHours)} maximum`}>
        <div className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: pct(actualFdpHours) }} />
        <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-[2px] bg-foreground" style={{ left: pct(maxFdpHours) }} />
        {extension && <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px border-l border-dotted border-foreground/70" style={{ left: pct(extension) }} />}
        {discretion && <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px border-l border-dashed border-foreground/50" style={{ left: pct(discretion) }} />}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, value, ref]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono tabular">{value}</dd>
            <dd className="text-muted-foreground">{ref}</dd>
          </div>
        ))}
      </dl>
      {overBasic && extension && actualFdpHours <= extension + 1e-6 && (
        <p className="mt-2 text-xs font-medium text-risk-moderate-ink">Uses a planned extension: pre- and post-flight rest each 2 h longer, or post-flight rest 4 h longer.</p>
      )}
      {overBasic && actualFdpHours > planned + 1e-6 && usedDiscretion !== false && (
        <p className="mt-2 text-xs font-medium text-risk-critical-ink">Above the planned maximum: only commander&apos;s discretion for unforeseen circumstances covers this.</p>
      )}
    </section>
  );
}
