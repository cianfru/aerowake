import { Activity, Brain, Clock, Hourglass, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TimelinePoint } from '@/types/fatigue';
import { cn } from '@/lib/utils';
import { classifyPerformance, kssLabel, resolveKss, riskBadgeVariant } from '@/lib/risk-scale';

interface PerformanceDegradationProps {
  timelinePoint: TimelinePoint;
  variant?: 'compact' | 'detailed';
}

const getProcessColor = (value: number, isInverse: boolean = false): string => {
  const adjusted = isInverse ? 1 - value : value;
  if (adjusted >= 0.7) return 'text-success';
  if (adjusted >= 0.5) return 'text-warning';
  return 'text-critical';
};

const getProgressColor = (value: number): string => {
  if (value >= 0.7) return 'bg-success';
  if (value >= 0.5) return 'bg-warning';
  return 'bg-critical';
};

export function PerformanceDegradation({ 
  timelinePoint, 
  variant = 'detailed' 
}: PerformanceDegradationProps) {
  const {
    hours_on_duty,
    sleep_pressure,
    circadian,
    performance,
    hours_awake,
  } = timelinePoint;
  const kss = resolveKss(timelinePoint.kss, performance);

  // Normalised model components (0–100 for display; not additive percentages)
  const processSPercent = Math.round((1 - sleep_pressure) * 100); // Lower is better
  const processCPercent = Math.round(circadian * 100);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-mono">{hours_on_duty.toFixed(1)}h</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("font-medium", getProcessColor(circadian))}>
            C: {processCPercent}%
          </span>
          <span className={cn("font-medium", getProcessColor(1 - sleep_pressure))}>
            S: {processSPercent}%
          </span>
          {kss != null && (
            <Badge variant={riskBadgeVariant(classifyPerformance(performance))} className="text-[10px]">
              KSS {kss.toFixed(1)}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Predicted Alertness
          </div>
          {performance !== undefined && kss != null && (
            <Badge
              variant={riskBadgeVariant(classifyPerformance(performance))}
              className="font-mono"
              title={`${kssLabel(kss)} · index ${performance.toFixed(0)}`}
            >
              KSS {kss.toFixed(1)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hours on Duty (Hours Since Report) */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Hours on Duty</span>
              <span className="text-[10px] text-muted-foreground">Hours since report</span>
            </div>
          </div>
          <span className="text-lg font-mono font-bold">{hours_on_duty.toFixed(1)}h</span>
        </div>

        {/* In-rest indicator — crew member is in bunk */}
        {timelinePoint.is_in_rest && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-chart-2/10 border border-chart-2/30">
            <Moon className="h-4 w-4 text-chart-2" />
            <span className="text-sm font-medium text-chart-2">Crew member in bunk rest</span>
          </div>
        )}

        {/* Process Breakdown */}
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-muted-foreground">Fatigue Components</h5>
          
          {/* Process C - Circadian */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Moon className="h-3.5 w-3.5 text-chart-2" />
                <span>Process C (Circadian)</span>
              </div>
              <span className={cn("font-mono font-semibold", getProcessColor(circadian))}>
                {processCPercent}%
              </span>
            </div>
            <Progress 
              value={processCPercent} 
              className="h-1.5"
            />
            <p className="text-[10px] text-muted-foreground">
              Circadian phase (1 = peak) — Ingre et al. (2014), up to ~2.3 KSS
            </p>
          </div>

          {/* Process S - Sleep Pressure */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span>Process S (Sleep Pressure)</span>
              </div>
              <span className={cn("font-mono font-semibold", getProcessColor(1 - sleep_pressure))}>
                {(100 - Math.round(sleep_pressure * 100))}%
              </span>
            </div>
            <Progress 
              value={100 - Math.round(sleep_pressure * 100)} 
              className="h-1.5"
            />
            <p className="text-[10px] text-muted-foreground">
              Sleep reserve (100% = fully rested) — Ingre et al. (2014), up to ~5.5 KSS
            </p>
          </div>

          {hours_awake != null && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Hours awake</span>
              </div>
              <span className="font-mono font-semibold">{hours_awake.toFixed(1)}h</span>
            </div>
          )}
        </div>

        {/* Summary */}
        <Separator />
        <div className="text-xs text-muted-foreground text-center">
          Three Process Model: KSS = 9.68 − 0.46·(S + C + U) · index = 110 − 10·KSS
        </div>
      </CardContent>
    </Card>
  );
}
