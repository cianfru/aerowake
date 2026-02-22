import { BedDouble, Home, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DutyAnalysis } from '@/types/fatigue';
import { cn } from '@/lib/utils';

interface PriorSleepIndicatorProps {
  duty: DutyAnalysis;
  variant?: 'compact' | 'detailed';
}

// Prior sleep quality based on hours of prior rest opportunity
// Thresholds based on EASA ORO.FTL rest requirements (min 10h rest = ~7-8h sleep opportunity)
const getSleepQuality = (hours: number): { label: string; variant: 'success' | 'warning' | 'high' | 'critical' } => {
  // priorSleep from backend is hours of sleep opportunity in prior rest period
  if (hours >= 8) return { label: 'Excellent', variant: 'success' };
  if (hours >= 7) return { label: 'Good', variant: 'success' };
  if (hours >= 6) return { label: 'Fair', variant: 'warning' };
  if (hours >= 5) return { label: 'Poor', variant: 'high' };
  return { label: 'Critical', variant: 'critical' };
};

export function PriorSleepIndicator({ duty, variant = 'compact' }: PriorSleepIndicatorProps) {
  const quality = duty.sleepQuality 
    ? { 
        label: duty.sleepQuality.charAt(0).toUpperCase() + duty.sleepQuality.slice(1),
        variant: duty.sleepQuality === 'excellent' || duty.sleepQuality === 'good' ? 'success' as const :
                 duty.sleepQuality === 'fair' ? 'warning' as const : 'critical' as const
      }
    : getSleepQuality(duty.priorSleep);
  
  // sleepEnvironment from backend, or infer from sleep estimate if available
  // Default to 'home' if not specified (most common case for long rest)
  const isHome = duty.sleepEnvironment === 'home' || 
                 (!duty.sleepEnvironment && (duty.sleepEstimate?.sleepStrategy === 'recovery' || duty.priorSleep >= 8));

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
          quality.variant === 'success' && "bg-success/10 text-success",
          quality.variant === 'warning' && "bg-warning/10 text-warning",
          quality.variant === 'high' && "bg-high/10 text-high",
          quality.variant === 'critical' && "bg-critical/10 text-critical",
        )}>
          <BedDouble className="h-3 w-3" />
          <span className="font-medium">{duty.priorSleep.toFixed(0)}h</span>
          {isHome ? (
            <Home className="h-3 w-3 opacity-70" />
          ) : (
            <Building2 className="h-3 w-3 opacity-70" />
          )}
        </div>
        <Badge variant={quality.variant} className="text-[10px]">
          {quality.label}
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      quality.variant === 'success' && "bg-success/5 border-success/30",
      quality.variant === 'warning' && "bg-warning/5 border-warning/30",
      quality.variant === 'high' && "bg-high/5 border-high/30",
      quality.variant === 'critical' && "bg-critical/5 border-critical/30",
    )}>
      <div className={cn(
        "p-2 rounded-lg",
        quality.variant === 'success' && "bg-success/10",
        quality.variant === 'warning' && "bg-warning/10",
        quality.variant === 'high' && "bg-high/10",
        quality.variant === 'critical' && "bg-critical/10",
      )}>
        <BedDouble className={cn(
          "h-5 w-5",
          quality.variant === 'success' && "text-success",
          quality.variant === 'warning' && "text-warning",
          quality.variant === 'high' && "text-high",
          quality.variant === 'critical' && "text-critical",
        )} />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Prior Sleep</span>
          <Badge variant={quality.variant}>{quality.label}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="font-mono font-medium">{duty.priorSleep.toFixed(1)}h</span>
          <span className="flex items-center gap-1">
            {isHome ? (
              <>
                <Home className="h-3 w-3" />
                Home Base
              </>
            ) : (
              <>
                <Building2 className="h-3 w-3" />
                Layover
              </>
            )}
          </span>
          {duty.sleepDebt > 3 && (
            <span className="text-warning">
              ⚠️ {duty.sleepDebt.toFixed(1)}h debt
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
