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
              "rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 text-foreground relative",
              duty.overallRisk === 'LOW' && "bg-success hover:bg-success/80",
              duty.overallRisk === 'MODERATE' && "bg-warning hover:bg-warning/80",
              duty.overallRisk === 'HIGH' && "bg-high hover:bg-high/80",
              duty.overallRisk === 'CRITICAL' && "bg-critical hover:bg-critical/80",
              selectedDuty?.date.getTime() === duty.date.getTime()
                ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                : 'hover:scale-105'
            )}
          >
            {duty.isUlr && (
              <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded-full px-1 leading-tight">ULR</span>
            )}
            {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
          </button>
        ))}
      </div>
    </div>
  );
}
