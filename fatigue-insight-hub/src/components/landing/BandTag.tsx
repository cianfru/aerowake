import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, riskClasses } from '@/lib/risk-scale';
import { kssBand } from './landingKss';

/** Square marker in the band colour plus the band word in ink (text never wears the data colour). */
export function BandTag({ kss, className }: { kss: number; className?: string }) {
  const level = kssBand(kss);
  return <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--lp-304a5f)]', className)}>
    <span aria-hidden="true" className={cn('h-2 w-2 rounded-[2px]', riskClasses(level).fill)} />
    {RISK_LEVEL_LABELS[level]}
  </span>;
}
