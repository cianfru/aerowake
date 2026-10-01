import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';

interface FDPUtilizationBarProps {
  actualFdpHours: number;
  maxFdpHours: number;
  extendedFdpHours?: number;
  usedDiscretion?: boolean;
}

/**
 * Flight duty period against the calculated ORO.FTL.205 maximum. Neutral
 * unless the duty is close to (>= 90%) or beyond the limit, the same rule as
 * the roster FTL gauges.
 */
export function FDPUtilizationBar({ actualFdpHours, maxFdpHours, extendedFdpHours, usedDiscretion }: FDPUtilizationBarProps) {
  const extended = extendedFdpHours && extendedFdpHours > maxFdpHours ? extendedFdpHours : undefined;
  const upper = Math.max((extended ?? maxFdpHours) * 1.08, actualFdpHours * 1.05);
  const ratio = maxFdpHours > 0 ? actualFdpHours / maxFdpHours : 0;
  const tone = actualFdpHours > (extended ?? maxFdpHours) ? 'bg-risk-critical' : ratio > 1 || ratio >= 0.9 ? 'bg-risk-moderate' : 'bg-foreground/50';
  const pct = (h: number) => `${Math.min(100, (h / upper) * 100)}%`;

  return (
    <section className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="fdp-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="fdp-heading" className="flex items-center gap-1.5 text-[15px] font-semibold">
          Flight duty period
          {FATIGUE_INFO.fdpUtilization && <InfoTooltip entry={FATIGUE_INFO.fdpUtilization} size="sm" />}
        </h3>
        <p className="font-mono text-sm tabular">
          {actualFdpHours.toFixed(1)}h <span className="text-muted-foreground">of {maxFdpHours.toFixed(1)}h max · {Math.round(ratio * 100)}%</span>
        </p>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-muted" role="img" aria-label={`FDP ${actualFdpHours.toFixed(1)} of ${maxFdpHours.toFixed(1)} hours`}>
        <div className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: pct(actualFdpHours) }} />
        <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-[2px] bg-foreground" style={{ left: pct(maxFdpHours) }} />
        {extended && <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px border-l border-dashed border-foreground/60" style={{ left: pct(extended) }} />}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Line: calculated maximum (ORO.FTL.205){extended ? `; dashed: ${extended.toFixed(1)}h with commander's discretion` : ''}.
      </p>
      {usedDiscretion && <p className="mt-1 text-xs font-medium text-risk-critical-ink">Commander&apos;s discretion applied (ORO.FTL.205(f)).</p>}
    </section>
  );
}
