import { Info, BookOpen, FlaskConical, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SleepQualityFactors, SleepReference } from '@/types/fatigue';

interface SleepQualityInfoProps {
  explanation?: string;
  confidence: number;
  confidenceBasis?: string;
  qualityFactors?: SleepQualityFactors;
  references?: SleepReference[];
  variant?: 'icon' | 'badge';
}

const factorLabels: Record<keyof SleepQualityFactors, { label: string; description: string }> = {
  base_efficiency: { 
    label: 'Base Efficiency', 
    description: 'Starting sleep efficiency based on environment (home vs hotel)' 
  },
  wocl_boost: { 
    label: 'WOCL Alignment', 
    description: 'Circadian misalignment penalty (0.85–1.0) for sleep timing (Dijk & Czeisler, 1994)' 
  },
  late_onset_penalty: { 
    label: 'Late Onset', 
    description: 'Penalty for delayed bedtime reducing sleep opportunity' 
  },
  recovery_boost: { 
    label: 'Recovery Boost', 
    description: 'Graded boost (1.0/1.03/1.05) for recovery days (Borbély, 1982)' 
  },
  time_pressure_factor: { 
    label: 'Time Pressure', 
    description: 'Penalty (0.88–1.0) for early reports (Kecklund & Åkerstedt, 2004)' 
  },
  insufficient_penalty: { 
    label: 'Duration Penalty', 
    description: 'Penalty for total sleep below recommended threshold' 
  },
  pre_duty_awake_hours: {
    label: 'Pre-Duty Awake',
    description: 'Hours awake before report time (Dawson & Reid, 1997)'
  },
};

const getFactorStyle = (key: string, value: number): { color: string; label: string } => {
  // pre_duty_awake_hours is in hours, not a multiplier
  if (key === 'pre_duty_awake_hours') {
    if (value <= 2) return { color: 'text-success', label: 'optimal' };
    if (value <= 4) return { color: 'text-muted-foreground', label: 'normal' };
    if (value <= 8) return { color: 'text-warning', label: 'extended' };
    return { color: 'text-critical', label: 'fatiguing' };
  }
  // Standard multiplier factors
  if (value >= 1.05) return { color: 'text-success', label: 'boost' };
  if (value >= 0.98) return { color: 'text-muted-foreground', label: 'neutral' };
  if (value >= 0.90) return { color: 'text-warning', label: 'minor penalty' };
  return { color: 'text-critical', label: 'penalty' };
};

export function SleepQualityInfo({
  explanation,
  confidence,
  confidenceBasis,
  qualityFactors,
  references,
  variant = 'icon',
}: SleepQualityInfoProps) {
  // Always show the info icon if we have a confidence score (the minimum data from backend)
  // The popover will show whatever detailed info is available
  const hasAnyData = confidence !== undefined;

  if (!hasAnyData) {
    return null;
  }

  const confidencePercent = Math.round((confidence || 0) * 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center",
              "h-5 w-5 rounded-full",
              "bg-primary/10 hover:bg-primary/20",
              "text-primary hover:text-primary/80",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
              "cursor-help"
            )}
          >
            <Info className="h-3 w-3" />
          </button>
        ) : (
          // IMPORTANT: Radix PopoverTrigger needs a focusable/clickable element.
          // Badge is a styled component and may not be interactive by default.
          <button type="button" className="inline-flex" aria-label="How it's calculated">
            <Badge
              variant="outline"
              className="cursor-help gap-1 hover:bg-secondary/50 transition-colors"
            >
              <Info className="h-3 w-3" />
              <span>How it's calculated</span>
            </Badge>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="start" 
        className="w-[380px] p-0 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl"
      >
        <ScrollArea className="max-h-[70vh]">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <FlaskConical className="h-4 w-4 text-primary" />
                </div>
                <h4 className="font-semibold text-sm">Sleep Quality Analysis</h4>
              </div>
              {explanation && (
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                  {explanation}
                </p>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* Confidence Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Model Confidence</span>
                <Badge 
                  variant={confidencePercent >= 70 ? 'success' : confidencePercent >= 50 ? 'warning' : 'high'}
                  className="text-[10px] font-mono"
                >
                  {confidencePercent}%
                </Badge>
              </div>
              {/* Confidence bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    confidencePercent >= 70 && "bg-success",
                    confidencePercent >= 50 && confidencePercent < 70 && "bg-warning",
                    confidencePercent < 50 && "bg-high"
                  )}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              {confidenceBasis && (
                <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                  {confidenceBasis}
                </p>
              )}
            </div>

            {/* Quality Factors Breakdown */}
            {qualityFactors && (
              <>
                <Separator className="bg-border/50" />
                <div className="space-y-3">
                  <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3" />
                    Calculation Factors
                  </h5>
                  <div className="space-y-2">
                    {Object.entries(qualityFactors).map(([key, value]) => {
                      const factorKey = key as keyof SleepQualityFactors;
                      const factor = factorLabels[factorKey];
                      const style = getFactorStyle(key, value);
                      
                      if (!factor || value === undefined) return null;
                      
                      const isHoursField = key === 'pre_duty_awake_hours';
                      
                      return (
                        <div 
                          key={key}
                          className="group flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium">{factor.label}</div>
                            <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              {factor.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-mono text-xs font-semibold",
                              style.color
                            )}>
                              {isHoursField 
                                ? `${value.toFixed(1)}h` 
                                : `${value >= 1 ? '+' : ''}${((value - 1) * 100).toFixed(0)}%`
                              }
                            </span>
                            <div className={cn(
                              "h-2 w-2 rounded-full",
                              isHoursField 
                                ? (value <= 2 ? "bg-success" : value <= 4 ? "bg-muted-foreground/30" : value <= 8 ? "bg-warning" : "bg-critical")
                                : (value >= 1.05 ? "bg-success" : value >= 0.98 ? "bg-muted-foreground/30" : value >= 0.90 ? "bg-warning" : "bg-critical")
                            )} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Net effect - exclude pre_duty_awake_hours from calculation */}
                  {(() => {
                    const multiplierFactors = Object.entries(qualityFactors)
                      .filter(([key]) => key !== 'pre_duty_awake_hours')
                      .map(([, value]) => value);
                    const netEffect = multiplierFactors.reduce((a, b) => a * b, 1);
                    return (
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-xs font-medium">Net Effect</span>
                        <span className={cn(
                          "font-mono text-sm font-bold",
                          netEffect >= 1 ? "text-success" : "text-warning"
                        )}>
                          ×{netEffect.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

            {/* References */}
            {references && references.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" />
                    Peer-Reviewed Sources
                  </h5>
                  <div className="space-y-1.5">
                    {references.map((ref, index) => (
                      <div 
                        key={ref.key || index}
                        className="group p-2 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="text-xs font-medium text-primary/90">
                          {ref.short}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2 group-hover:line-clamp-none transition-all">
                          {ref.full}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="pt-2 text-center">
              <p className="text-[10px] text-muted-foreground/80">
                Based on biomathematical fatigue modeling
              </p>
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
