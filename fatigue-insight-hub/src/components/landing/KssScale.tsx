import { cn } from '@/lib/utils';
import { riskClasses } from '@/lib/risk-scale';
import { BAND_TICKS, kssBand, kssFraction, roundKss } from './landingKss';

/**
 * A 1–9 KSS meter: the fill and marker carry the band of the displayed value,
 * ticks mark where the higher bands begin. Decorative; the value is in text.
 */
export function KssScale({ kss, className }: { kss: number; className?: string }) {
  const fill = riskClasses(kssBand(kss)).fill;
  const at = `${kssFraction(roundKss(kss)) * 100}%`;
  return <div aria-hidden="true" className={cn('relative h-4', className)}>
    <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-[2px] bg-[color:var(--lp-dde8ee)]">
      <div className={cn('h-full rounded-[2px]', fill)} style={{ width: at }} />
    </div>
    {BAND_TICKS.map((tick) => <span key={tick.kss} className="absolute inset-y-0.5 w-px bg-[color:var(--lp-9fb3c2)]" style={{ left: tick.at * 100 + '%' }} />)}
    <span className={cn('absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[color:var(--lp-fcfdfe)]', fill)} style={{ left: at }} />
  </div>;
}
