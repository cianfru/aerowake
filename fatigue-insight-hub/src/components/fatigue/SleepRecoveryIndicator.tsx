import { Moon, Battery, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DutyAnalysis } from '@/types/fatigue';
import { cn } from '@/lib/utils';
import { SleepQualityInfo } from './SleepQualityInfo';

interface SleepRecoveryIndicatorProps {
  duty: DutyAnalysis;
  variant?: 'compact' | 'detailed' | 'inline';
}

const getRecoveryScore = (estimate: NonNullable<DutyAnalysis['sleepEstimate']>): number => {
  // Calculate recovery score based on effective sleep and efficiency
  const baseScore = (estimate.effectiveSleepHours / 8) * 100;
  const efficiencyBonus = estimate.sleepEfficiency * 20;
  const woclPenalty = estimate.woclOverlapHours * 5;
  return Math.min(100, Math.max(0, baseScore + efficiencyBonus - woclPenalty));
};

const getRecoveryStatus = (score: number): { label: string; variant: 'success' | 'warning' | 'high' | 'critical'; color: string } => {
  if (score >= 80) return { label: 'Excellent', variant: 'success', color: 'hsl(120, 70%, 45%)' };
  if (score >= 65) return { label: 'Good', variant: 'success', color: 'hsl(90, 70%, 50%)' };
  if (score >= 50) return { label: 'Moderate', variant: 'warning', color: 'hsl(55, 90%, 55%)' };
  if (score >= 35) return { label: 'Poor', variant: 'high', color: 'hsl(25, 95%, 50%)' };
  return { label: 'Critical', variant: 'critical', color: 'hsl(0, 80%, 50%)' };
};

const getStrategyIcon = (strategy: string) => {
  switch (strategy) {
    case 'anchor': return '⚓';
    case 'split': return '✂️';
    case 'nap': return '💤';
    case 'extended': return '🛏️';
    case 'restricted': return '⏰';
    case 'recovery': return '🔋';
    case 'post_duty_recovery': return '🛏️';
    default: return '😴';
  }
};

const getStrategyLabel = (strategy: string) => {
  switch (strategy) {
    case 'anchor': return 'Anchor Sleep';
    case 'split': return 'Split Sleep';
    case 'nap': return 'Nap Strategy';
    case 'extended': return 'Extended Rest';
    case 'restricted': return 'Restricted Sleep';
    case 'recovery': return 'Recovery Period';
    case 'post_duty_recovery': return 'Post-Duty Recovery';
    default: return 'Normal Sleep';
  }
};

export function SleepRecoveryIndicator({ duty, variant = 'compact' }: SleepRecoveryIndicatorProps) {
  const estimate = duty.sleepEstimate;
  
  // Fallback if no sleep estimate available
  if (!estimate) {
    return null;
  }

  const recoveryScore = getRecoveryScore(estimate);
  const status = getRecoveryStatus(recoveryScore);
  const hasWarnings = estimate.warnings.length > 0;

  if (variant === 'inline') {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Battery 
                className="h-3.5 w-3.5" 
                style={{ color: status.color }}
              />
              <span 
                className="text-xs font-medium"
                style={{ color: status.color }}
              >
                {Math.round(recoveryScore)}%
              </span>
              {hasWarnings && (
                <AlertTriangle className="h-3 w-3 text-warning" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-medium">Recovery Score: {Math.round(recoveryScore)}%</div>
              <div className="text-muted-foreground">
                {estimate.effectiveSleepHours.toFixed(1)}h effective sleep
              </div>
              {hasWarnings && (
                <div className="text-warning">⚠️ {estimate.warnings[0]}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
          status.variant === 'success' && "bg-success/10 text-success",
          status.variant === 'warning' && "bg-warning/10 text-warning",
          status.variant === 'high' && "bg-high/10 text-high",
          status.variant === 'critical' && "bg-critical/10 text-critical",
        )}>
          <Battery className="h-3 w-3" />
          <span className="font-medium">{Math.round(recoveryScore)}%</span>
          <span className="opacity-70">{getStrategyIcon(estimate.sleepStrategy)}</span>
        </div>
        <Badge variant={status.variant} className="text-[10px]">
          {status.label}
        </Badge>
        {hasWarnings && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1 text-xs">
                  {estimate.warnings.map((warning, i) => (
                    <div key={i} className="text-warning">⚠️ {warning}</div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={cn(
      "flex flex-col gap-3 p-3 rounded-lg border",
      status.variant === 'success' && "bg-success/5 border-success/30",
      status.variant === 'warning' && "bg-warning/5 border-warning/30",
      status.variant === 'high' && "bg-high/5 border-high/30",
      status.variant === 'critical' && "bg-critical/5 border-critical/30",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            status.variant === 'success' && "bg-success/10",
            status.variant === 'warning' && "bg-warning/10",
            status.variant === 'high' && "bg-high/10",
            status.variant === 'critical' && "bg-critical/10",
          )}>
            <Battery className={cn(
              "h-5 w-5",
              status.variant === 'success' && "text-success",
              status.variant === 'warning' && "text-warning",
              status.variant === 'high' && "text-high",
              status.variant === 'critical' && "text-critical",
            )} />
          </div>
          <div>
            <span className="text-sm font-medium">Sleep Recovery</span>
            <Badge variant={status.variant} className="ml-2">{status.label}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SleepQualityInfo
            variant="badge"
            explanation={estimate.explanation}
            confidence={estimate.confidence}
            confidenceBasis={estimate.confidenceBasis}
            qualityFactors={estimate.qualityFactors}
            references={estimate.references}
          />
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: status.color }}>
              {Math.round(recoveryScore)}%
            </div>
            <div className="text-[10px] text-muted-foreground">
              Confidence: {Math.round(estimate.confidence * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Sleep Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Total Sleep</div>
            <div className="font-mono font-medium">{estimate.totalSleepHours.toFixed(1)}h</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Effective Sleep</div>
            <div className="font-mono font-medium">{estimate.effectiveSleepHours.toFixed(1)}h</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base">{getStrategyIcon(estimate.sleepStrategy)}</span>
          <div>
            <div className="text-muted-foreground">Strategy</div>
            <div className="font-medium">{getStrategyLabel(estimate.sleepStrategy)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Moon className="h-3.5 w-3.5 text-wocl" />
          <div>
            <div className="text-muted-foreground">WOCL Overlap</div>
            <div className={cn(
              "font-mono font-medium",
              estimate.woclOverlapHours > 2 && "text-warning"
            )}>
              {estimate.woclOverlapHours.toFixed(1)}h
            </div>
          </div>
        </div>
      </div>

      {/* Efficiency Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Sleep Efficiency</span>
          <span className="font-medium">{Math.round(estimate.sleepEfficiency * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-300"
            style={{ 
              width: `${estimate.sleepEfficiency * 100}%`,
              backgroundColor: status.color,
            }}
          />
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1 pt-2 border-t border-border/50">
          <div className="text-xs font-medium text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sleep Quality Warnings
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {estimate.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-warning">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
