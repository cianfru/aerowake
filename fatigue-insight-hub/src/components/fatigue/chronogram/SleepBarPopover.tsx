import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getRecoveryClasses, getStrategyIcon, decimalToHHmm, QUALITY_FACTOR_LABELS } from '@/lib/fatigue-utils';
import { SleepQualityBadge } from '../SleepQualityBadge';
import type { TimelineSleepBar } from '@/lib/timeline-types';
import { format } from 'date-fns';

interface SleepBarPopoverProps {
  bar: TimelineSleepBar;
  /** Width as % of the row (0-100) */
  widthPercent: number;
  /** Left offset as % of the row (0-100) */
  leftPercent: number;
  variant: 'homebase' | 'utc' | 'elapsed';
}

export function SleepBarPopover({ bar, widthPercent, leftPercent, variant }: SleepBarPopoverProps) {
  const classes = getRecoveryClasses(bar.recoveryScore);

  // Determine border radius based on overnight status
  // Start bars: rounded left, flat right; Continuation bars: flat left, rounded right
  const borderRadius = bar.isOvernightStart
    ? '2px 0 0 2px'
    : bar.isOvernightContinuation
      ? '0 2px 2px 0'
      : '2px';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute z-[5] flex items-center justify-end px-1 border border-dashed cursor-pointer hover:brightness-110 transition-all border-primary/20 bg-primary/5"
          style={{
            top: 0,
            height: '100%',
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, 1)}%`,
            borderRadius,
            // Remove border on connected edges for visual continuity
            borderRight: bar.isOvernightStart ? 'none' : undefined,
            borderLeft: bar.isOvernightContinuation ? 'none' : undefined,
          }}
        >
          {/* Show recovery info if bar is wide enough */}
          {widthPercent > 6 && (
            <div className={cn("flex items-center gap-0.5 text-[8px] font-medium", classes.text)}>
              <span>{getStrategyIcon(bar.sleepStrategy)}</span>
              <span>{Math.round(bar.recoveryScore)}%</span>
            </div>
          )}
          {/* Sleep quality badge -- only shows for notable quality deviations */}
          {widthPercent > 4 && (
            <SleepQualityBadge qualityFactors={bar.qualityFactors} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="max-w-sm p-3">
        <div className="space-y-2 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="font-semibold flex items-center gap-1.5">
              <span className="text-base">{bar.isPreDuty ? '\u{1F6CF}\uFE0F' : '\u{1F50B}'}</span>
              <span>{bar.isPreDuty ? 'Pre-Duty Sleep' : 'Recovery Sleep'}</span>
            </div>
            <div className={cn("text-lg font-bold", classes.text)}>
              {Math.round(bar.recoveryScore)}%
            </div>
          </div>

          {/* Explanation from backend (if available) */}
          {bar.explanation && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-2 text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-primary font-medium">{'\u{1F4A1}'} </span>
              {bar.explanation}
            </div>
          )}

          {/* Sleep Timing - show full window for overnight sleep */}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Sleep Window</span>
            <span className="font-mono font-medium text-foreground">
              {decimalToHHmm(bar.originalStartHour ?? bar.startHour)} {'\u2192'} {decimalToHHmm(bar.originalEndHour ?? bar.endHour)}
              {/* Show +1d only when sleep truly crosses midnight */}
              {(bar.isOvernightStart || bar.isOvernightContinuation) &&
               (bar.originalStartHour ?? bar.startHour) > (bar.originalEndHour ?? bar.endHour) && ' (+1d)'}
            </span>
          </div>
          {bar.sleepStartZulu && bar.sleepEndZulu && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Zulu</span>
              <span className="font-mono font-medium text-foreground">
                {bar.sleepStartZulu} {'\u2192'} {bar.sleepEndZulu}
              </span>
            </div>
          )}

          {/* Recovery Score Breakdown */}
          <div className="bg-secondary/30 rounded-lg p-2 space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Recovery Score Breakdown
            </div>

            {/* Base Score from Sleep */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{'\u23F1\uFE0F'}</span>
                <span>Effective Sleep</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{bar.effectiveSleep.toFixed(1)}h / 8h</span>
                <span className={cn(
                  "font-mono font-medium min-w-[40px] text-right",
                  bar.effectiveSleep >= 7 ? "text-success" :
                  bar.effectiveSleep >= 5 ? "text-warning" : "text-critical"
                )}>
                  +{Math.round((bar.effectiveSleep / 8) * 100)}
                </span>
              </div>
            </div>

            {/* Efficiency Bonus */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{'\u2728'}</span>
                <span>Sleep Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{Math.round(bar.sleepEfficiency * 100)}% efficiency</span>
                <span className={cn(
                  "font-mono font-medium min-w-[40px] text-right",
                  bar.sleepEfficiency >= 0.9 ? "text-success" :
                  bar.sleepEfficiency >= 0.7 ? "text-warning" : "text-high"
                )}>
                  +{Math.round(bar.sleepEfficiency * 20)}
                </span>
              </div>
            </div>

            {/* WOCL Penalty */}
            {(bar.woclOverlapHours ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{'\u{1F319}'}</span>
                  <span>WOCL Overlap</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{bar.woclOverlapHours!.toFixed(1)}h</span>
                  <span className="font-mono font-medium text-critical min-w-[40px] text-right">
                    -{Math.round(bar.woclOverlapHours! * 5)}
                  </span>
                </div>
              </div>
            )}

            {/* Divider & Total */}
            <div className="border-t border-border/50 pt-1.5 flex items-center justify-between font-medium">
              <span>Total Score</span>
              <span className={cn("font-mono", classes.text)}>
                = {Math.round(bar.recoveryScore)}%
              </span>
            </div>
          </div>

          {/* Quality Factors from backend (if available) */}
          {bar.qualityFactors && (
            <div className="bg-secondary/20 rounded-lg p-2 space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                {'\u{1F52C}'} Model Calculation Factors
              </div>
              {Object.entries(bar.qualityFactors).map(([key, value]) => {
                const label = QUALITY_FACTOR_LABELS[key] || key;
                const numValue = value as number;
                const isHours = key === 'pre_duty_awake_hours';
                const isBoost = numValue >= 1;
                return (
                  <div key={key} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn(
                      "font-mono font-medium",
                      isHours
                        ? (numValue <= 2 ? "text-success" : numValue <= 4 ? "text-muted-foreground" : numValue <= 8 ? "text-warning" : "text-critical")
                        : (numValue >= 1.05 ? "text-success" : numValue >= 0.98 ? "text-muted-foreground" : numValue >= 0.90 ? "text-warning" : "text-critical")
                    )}>
                      {isHours ? `${numValue.toFixed(1)}h` : `${isBoost ? '+' : ''}${((numValue - 1) * 100).toFixed(0)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confidence & Basis (if available) */}
          {bar.confidence != null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Model Confidence</span>
              <span className={cn(
                "font-mono font-medium px-1.5 py-0.5 rounded",
                bar.confidence >= 0.7 ? "bg-success/10 text-success" :
                bar.confidence >= 0.5 ? "bg-warning/10 text-warning" : "bg-high/10 text-high"
              )}>
                {Math.round(bar.confidence * 100)}%
              </span>
            </div>
          )}
          {bar.confidenceBasis && (
            <div className="text-[10px] text-muted-foreground/70 italic leading-relaxed">
              {bar.confidenceBasis}
            </div>
          )}

          {/* References (if available) */}
          {bar.references && bar.references.length > 0 && (
            <div className="border-t border-border/30 pt-2 space-y-1">
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                {'\u{1F4DA}'} Sources
              </div>
              <div className="flex flex-wrap gap-1">
                {bar.references.map((ref, i) => (
                  <span key={ref.key || i} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground" title={ref.full}>
                    {ref.short}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Badge */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Strategy</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50">
              <span>{getStrategyIcon(bar.sleepStrategy)}</span>
              <span className="capitalize font-medium">{bar.sleepStrategy.split('_').join(' ')}</span>
            </div>
          </div>

          {/* Footer Context */}
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
            {bar.isPreDuty
              ? `Rest before ${format(bar.relatedDuty.date, 'EEEE, MMM d')} duty`
              : `Rest day recovery \u2022 ${format(bar.relatedDuty.date, 'EEEE, MMM d')}`
            }
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
