/**
 * Small typographic building blocks for the flight-deck editorial look:
 * no pills — severity is a thin rule or a square marker plus a text label.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, riskClasses, type RiskLevel } from '@/lib/risk-scale';

/** Small caps label above a heading or figure. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

/** Vertical severity rule on the leading edge of a row. */
export function SeverityRule({ level, className }: { level: RiskLevel; className?: string }) {
  return <span aria-hidden="true" className={cn('w-[3px] self-stretch rounded-[1px]', riskClasses(level).fill, className)} />;
}

/** 7px square marker + level word, coloured text — replaces risk "pills". */
export function RiskLabel({ level, className }: { level: RiskLevel; className?: string }) {
  const rc = riskClasses(level);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em]', rc.text, className)}>
      <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-[1px]', rc.fill)} />
      {RISK_LEVEL_LABELS[level]}
    </span>
  );
}

/** A labelled figure: small caps label over a large tabular value. */
export function Figure({ label, value, sub, className, valueClassName }: {
  label: string; value: ReactNode; sub?: ReactNode; className?: string; valueClassName?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <Eyebrow>{label}</Eyebrow>
      <p className={cn('font-mono text-xl md:text-2xl font-medium tabular leading-none', valueClassName)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Section heading row with an optional right-aligned aside. */
export function SectionHeading({ id, title, aside }: { id?: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2 id={id} className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">{title}</h2>
      {aside && <div className="hidden text-right text-xs text-muted-foreground sm:block">{aside}</div>}
    </div>
  );
}

/** Text-weight action (no filled buttons inside dense lists). */
export function TextAction({ children, onClick, ariaLabel, emphasis }: {
  children: ReactNode; onClick: () => void; ariaLabel?: string; emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        emphasis ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
