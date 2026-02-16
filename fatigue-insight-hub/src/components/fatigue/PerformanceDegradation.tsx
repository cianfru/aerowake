import { Activity, Brain, Clock, Moon, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TimelinePoint } from '@/types/fatigue';
import { cn } from '@/lib/utils';

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
    time_on_task_penalty,
    sleep_inertia,
    sleep_pressure,
    circadian,
    performance,
  } = timelinePoint;

  // Calculate display values
  const totPenaltyPercent = Math.round((1 - time_on_task_penalty) * 100);
  const sleepInertiaPercent = Math.round((1 - sleep_inertia) * 100);
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
          {sleep_inertia < 1 && (
            <Badge variant="warning" className="text-[10px]">
              Inertia: -{sleepInertiaPercent}%
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
            Performance Degradation
          </div>
          {performance !== undefined && (
            <Badge 
              variant={performance >= 70 ? 'success' : performance >= 50 ? 'warning' : 'critical'}
              className="font-mono"
            >
              {performance.toFixed(0)}%
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
              Dijk & Czeisler (1995) — 24-hour alertness rhythm
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
              Borbély (1982) — Homeostatic sleep drive
            </p>
          </div>

        {/* Time on Task Penalty */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-warning" />
              <span>Time on Task</span>
            </div>
            <span className={cn(
              "font-mono font-semibold",
              totPenaltyPercent > 5 ? "text-warning" : "text-muted-foreground"
            )}>
              -{totPenaltyPercent}%
            </span>
          </div>
          <Progress 
            value={Math.max(0, 100 - totPenaltyPercent)} 
            className="h-1.5"
          />
          <p className="text-[10px] text-muted-foreground">
            Folkard & Åkerstedt (1999) — Linear TOT decrement (~0.8%/h)
          </p>
        </div>

          {/* Sleep Inertia (Process W) - only show if present */}
          {sleep_inertia < 1 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-critical" />
                  <span>Sleep Inertia (Process W)</span>
                </div>
                <Badge variant="critical" className="font-mono text-xs">
                  -{sleepInertiaPercent}%
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tassi & Muzet (2000) — Post-awakening cognitive impairment
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        <Separator />
        <div className="text-xs text-muted-foreground text-center">
          Two-Process Model: Performance = 0.6×S + 0.4×C × TOT × Inertia
        </div>
      </CardContent>
    </Card>
  );
}
