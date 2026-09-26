import { cn } from '@/lib/utils';
import type { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';

interface QuickDutySelectorProps {
  duties: DutyAnalysis[];
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
}

export function QuickDutySelector({ duties, selectedDuty, onDutySelect }: QuickDutySelectorProps) {
  return (
    <div className="space-y-2 pt-4 border-t border-border">
      <h4 className="text-sm font-medium">Quick Duty Selection</h4>
      <div className="flex flex-wrap gap-2">
        {duties.map((duty, index) => (
          <button
            key={index}
            onClick={() => onDutySelect(duty)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border/60 border-l-2 bg-transparent px-3 py-2 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted/40",
              duty.overallRisk === 'LOW' && "border-l-success",
              duty.overallRisk === 'MODERATE' && "border-l-warning",
              duty.overallRisk === 'HIGH' && "border-l-high",
              (duty.overallRisk === 'CRITICAL' || duty.overallRisk === 'EXTREME') && "border-l-critical",
              duty.overallRisk === 'UNKNOWN' && "border-l-muted-foreground/40",
              selectedDuty?.date.getTime() === duty.date.getTime() &&
                'bg-muted/60 ring-1 ring-foreground/40 hover:bg-muted/60'
            )}
          >
            {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
            {duty.isUlr && (
              <span className="rounded-[2px] border border-primary/30 px-1 text-[9px] font-medium uppercase leading-tight tracking-[0.06em] text-primary">ULR</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
