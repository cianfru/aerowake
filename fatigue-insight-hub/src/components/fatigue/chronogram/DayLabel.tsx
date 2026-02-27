import { cn } from '@/lib/utils';
import type { RowLabel } from '@/lib/timeline-types';

interface DayLabelProps {
  label: RowLabel;
  rowHeight: number;
}

export function DayLabel({ label, rowHeight }: DayLabelProps) {
  const riskClass = label.risk === 'CRITICAL' ? 'risk-border-critical'
    : label.risk === 'HIGH' ? 'risk-border-high'
    : label.risk === 'MODERATE' ? 'risk-border-moderate'
    : label.hasDuty ? 'risk-border-low' : '';

  return (
    <div
      className={cn(
        "relative flex items-center gap-1 pr-2 text-[11px]",
        !label.hasDuty && "opacity-60",
        riskClass
      )}
      style={{ height: `${rowHeight}px` }}
    >
      <div className="flex flex-col items-start min-w-[50px] pl-1">
        {label.warnings.length > 0 && (
          <span className={cn(
            "text-[9px] leading-tight truncate max-w-[50px]",
            label.risk === 'CRITICAL' && "text-critical",
            label.risk === 'HIGH' && "text-high",
            label.risk === 'MODERATE' && "text-warning",
            label.risk === 'LOW' && "text-muted-foreground"
          )}>
            {label.warnings[0]}
          </span>
        )}
        {/* Circadian annotation for elapsed view */}
        {label.circadianAnnotation && (
          <span className="text-[8px] text-wocl truncate max-w-[50px]">
            {label.circadianAnnotation}
          </span>
        )}
      </div>
      <span className={cn(
        "ml-auto font-medium text-[11px]",
        label.hasDuty ? "text-foreground" : "text-muted-foreground"
      )}>
        {label.label}
      </span>
    </div>
  );
}
