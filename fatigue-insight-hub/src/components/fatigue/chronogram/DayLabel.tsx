import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, riskClasses, type RiskLevel } from '@/lib/risk-scale';
import type { RowLabel } from '@/lib/timeline-types';

const BORDER: Record<RiskLevel, string> = {
  low: 'risk-border-low',
  moderate: 'risk-border-moderate',
  high: 'risk-border-high',
  critical: 'risk-border-critical',
  extreme: 'risk-border-extreme',
  unknown: 'risk-border-low',
};

interface DayLabelProps {
  label: RowLabel;
  rowHeight: number;
}

/**
 * Day label: weekday and date, plus the day's duty peak (band square and KSS).
 * Stacked on phones so the 24-hour grid keeps its width.
 */
export function DayLabel({ label, rowHeight }: DayLabelProps) {
  const level = label.level;
  const rc = level ? riskClasses(level) : null;
  const peak = label.peakKss;

  return (
    <div
      className={cn(
        'relative flex flex-col justify-center gap-0.5 pl-1.5 pr-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:pl-2 sm:pr-2',
        label.hasDuty && 'rounded-l-md bg-foreground/[0.03]',
        level && BORDER[level],
      )}
      style={{ height: `${rowHeight}px` }}
    >
      <span className={cn('whitespace-nowrap text-[11px] font-medium leading-none sm:text-xs', label.hasDuty ? 'text-foreground' : 'text-muted-foreground')}>
        {label.label}
      </span>
      {peak != null && rc && level && (
        <span
          className={cn('inline-flex items-center gap-1 font-mono text-[11px] font-medium leading-none tabular sm:text-xs', rc.text)}
          title={`Duty peak KSS ${peak.toFixed(1)} (${RISK_LEVEL_LABELS[level]})`}
        >
          <span aria-hidden="true" className={cn('h-[7px] w-[7px] shrink-0 rounded-[1px]', rc.fill)} />
          {peak.toFixed(1)}
          <span className="sr-only"> peak KSS, {RISK_LEVEL_LABELS[level]}</span>
        </span>
      )}
      {label.circadianAnnotation && (
        <span className="truncate text-[11px] text-muted-foreground">{label.circadianAnnotation}</span>
      )}
    </div>
  );
}
