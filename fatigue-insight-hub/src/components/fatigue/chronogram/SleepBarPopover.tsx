import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getRecoveryClasses, getStrategyIcon, decimalToHHmm, QUALITY_FACTOR_LABELS } from '@/lib/fatigue-utils';
import { SleepQualityBadge } from '../SleepQualityBadge';
import { TimeSlider } from '@/components/ui/time-slider';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ChevronDown } from 'lucide-react';
import type { TimelineSleepBar } from '@/lib/timeline-types';
import type { SleepEdit } from '@/hooks/useSleepEdits';
import { format } from 'date-fns';

interface SleepBarPopoverProps {
  bar: TimelineSleepBar;
  /** Width as % of the row (0-100) */
  widthPercent: number;
  /** Left offset as % of the row (0-100) */
  leftPercent: number;
  variant: 'homebase' | 'utc' | 'elapsed';
  /** Whether sleep editing is enabled (homebase only) */
  isEditable?: boolean;
  /** Current pending edit for this sleep bar (if any) */
  pendingEdit?: SleepEdit | null;
  /** Called when user adjusts a sleep slider */
  onSleepEdit?: (edit: SleepEdit) => void;
  /** Called when user resets a single edit */
  onRemoveEdit?: (dutyId: string) => void;
}

export function SleepBarPopover({
  bar,
  widthPercent,
  leftPercent,
  variant,
  isEditable,
  pendingEdit,
  onSleepEdit,
  onRemoveEdit,
}: SleepBarPopoverProps) {
  const classes = getRecoveryClasses(bar.recoveryScore);
  const hasEdit = pendingEdit != null;

  // Determine border radius based on overnight status
  const borderRadius = bar.isOvernightStart
    ? '2px 0 0 2px'
    : bar.isOvernightContinuation
      ? '0 2px 2px 0'
      : '2px';

  // Current display times (use edited values if available)
  const displayStartHour = hasEdit ? pendingEdit!.newStartHour : (bar.originalStartHour ?? bar.startHour);
  const displayEndHour = hasEdit ? pendingEdit!.newEndHour : (bar.originalEndHour ?? bar.endHour);

  // Can edit: must be homebase, have a sleepId, and have UTC ISOs for conversion
  const canEdit = isEditable && bar.sleepId && bar.sleepStartIso && bar.sleepEndIso;

  // Slider range for bedtime/wake-up
  const originalStart = bar.originalStartHour ?? bar.startHour;
  const originalEnd = bar.originalEndHour ?? bar.endHour;

  // Handle slider changes
  const handleStartChange = (newStart: number) => {
    if (!canEdit || !onSleepEdit) return;
    onSleepEdit({
      dutyId: bar.sleepId!,
      originalStartHour: originalStart,
      originalEndHour: originalEnd,
      newStartHour: newStart,
      newEndHour: hasEdit ? pendingEdit!.newEndHour : originalEnd,
      originalStartIso: bar.sleepStartIso!,
      originalEndIso: bar.sleepEndIso!,
    });
  };

  const handleEndChange = (newEnd: number) => {
    if (!canEdit || !onSleepEdit) return;
    onSleepEdit({
      dutyId: bar.sleepId!,
      originalStartHour: originalStart,
      originalEndHour: originalEnd,
      newStartHour: hasEdit ? pendingEdit!.newStartHour : originalStart,
      newEndHour: newEnd,
      originalStartIso: bar.sleepStartIso!,
      originalEndIso: bar.sleepEndIso!,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute z-[5] flex items-center justify-end px-1 border cursor-pointer hover:brightness-110 transition-all",
            hasEdit
              ? "border-warning/60 bg-warning/10 border-solid"
              : "border-dashed border-primary/20 bg-primary/5"
          )}
          style={{
            top: 0,
            height: '100%',
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, 1)}%`,
            borderRadius,
            borderRight: bar.isOvernightStart ? 'none' : undefined,
            borderLeft: bar.isOvernightContinuation ? 'none' : undefined,
          }}
        >
          {/* Show recovery info if bar is wide enough */}
          {widthPercent > 6 && (
            <div className={cn("flex items-center gap-0.5 text-[8px] font-medium", hasEdit ? "text-warning" : classes.text)}>
              <span>{getStrategyIcon(bar.sleepStrategy)}</span>
              <span>{Math.round(bar.recoveryScore)}%</span>
            </div>
          )}
          {/* Sleep quality badge */}
          {widthPercent > 4 && !hasEdit && (
            <SleepQualityBadge qualityFactors={bar.qualityFactors} />
          )}
          {/* Modified indicator */}
          {hasEdit && widthPercent > 3 && (
            <span className="text-[7px] text-warning font-medium ml-0.5">{'\u270E'}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="max-w-xs p-3">
        <div className="space-y-2 text-xs">
          {/* ── HEADER: Type + Score + Confidence + References ── */}
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-1.5">
              <span className="text-base">{bar.isPreDuty ? '\u{1F6CF}\uFE0F' : '\u{1F50B}'}</span>
              <span>{bar.isPreDuty ? 'Pre-Duty Sleep' : 'Recovery Sleep'}</span>
              {hasEdit && (
                <span className="text-[9px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                  Modified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Confidence badge (inline) */}
              {bar.confidence != null && (
                <span className={cn(
                  "text-[9px] font-mono font-medium px-1 py-0.5 rounded",
                  bar.confidence >= 0.7 ? "bg-success/10 text-success" :
                  bar.confidence >= 0.5 ? "bg-warning/10 text-warning" : "bg-high/10 text-high"
                )}>
                  {Math.round(bar.confidence * 100)}%
                </span>
              )}
              {/* Score */}
              <div className={cn("text-lg font-bold", hasEdit ? "text-warning" : classes.text)}>
                {Math.round(bar.recoveryScore)}%
              </div>
            </div>
          </div>

          {/* ── EXPLANATION ── */}
          {bar.explanation && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-2 text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-primary font-medium">{'\u{1F4A1}'} </span>
              {bar.explanation}
            </div>
          )}

          {/* ── SLEEP WINDOW + ZULU (combined row) ── */}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Sleep Window</span>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono font-medium", hasEdit ? "text-warning" : "text-foreground")}>
                {decimalToHHmm(displayStartHour)} {'\u2192'} {decimalToHHmm(displayEndHour)}
                {(bar.isOvernightStart || bar.isOvernightContinuation) &&
                 displayStartHour > displayEndHour && ' (+1d)'}
              </span>
              {bar.sleepStartZulu && bar.sleepEndZulu && (
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  {bar.sleepStartZulu}{'\u2192'}{bar.sleepEndZulu}
                </span>
              )}
            </div>
          </div>

          {/* ── COMPACT RECOVERY SUMMARY ── */}
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">{'\u23F1\uFE0F'}</span>
              <span className={cn(
                "font-mono font-medium",
                bar.effectiveSleep >= 7 ? "text-success" :
                bar.effectiveSleep >= 5 ? "text-warning" : "text-critical"
              )}>
                {bar.effectiveSleep.toFixed(1)}h
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">{'\u2728'}</span>
              <span className={cn(
                "font-mono font-medium",
                bar.sleepEfficiency >= 0.9 ? "text-success" :
                bar.sleepEfficiency >= 0.7 ? "text-warning" : "text-high"
              )}>
                {Math.round(bar.sleepEfficiency * 100)}%
              </span>
            </div>
            {(bar.woclOverlapHours ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u{1F319}'}</span>
                <span className="font-mono font-medium text-critical">
                  {bar.woclOverlapHours!.toFixed(1)}h
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <span>{getStrategyIcon(bar.sleepStrategy)}</span>
              <span className="capitalize text-muted-foreground">{bar.sleepStrategy.split('_').join(' ')}</span>
            </div>
          </div>

          {/* ── COLLAPSIBLE: Score Breakdown ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
              <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
              <span>Score Breakdown</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-secondary/30 rounded-lg p-2 space-y-1.5 mt-1.5">
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

                <div className="border-t border-border/50 pt-1.5 flex items-center justify-between font-medium">
                  <span>Total Score</span>
                  <span className={cn("font-mono", classes.text)}>
                    = {Math.round(bar.recoveryScore)}%
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── COLLAPSIBLE: Adjust Sleep Times (homebase only) ── */}
          {canEdit && (
            <Collapsible defaultOpen={hasEdit}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                <span>{'\u270E'} Adjust Sleep Times</span>
                {hasEdit && (
                  <span className="text-[9px] text-warning bg-warning/10 px-1 py-0.5 rounded ml-auto">
                    edited
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-secondary/20 rounded-lg p-2.5 space-y-3 border border-border/30 mt-1.5">
                  <TimeSlider
                    label="Bedtime"
                    value={hasEdit ? pendingEdit!.newStartHour : originalStart}
                    min={Math.max(originalStart - 4, 14)}
                    max={Math.min(originalStart + 4, 30)}
                    step={0.25}
                    originalValue={originalStart}
                    onChange={handleStartChange}
                  />

                  <TimeSlider
                    label="Wake-up"
                    value={hasEdit ? pendingEdit!.newEndHour : originalEnd}
                    min={Math.max(originalEnd - 4, 2)}
                    max={Math.min(originalEnd + 4, 18)}
                    step={0.25}
                    originalValue={originalEnd}
                    onChange={handleEndChange}
                  />

                  {hasEdit && (
                    <button
                      type="button"
                      onClick={() => bar.sleepId && onRemoveEdit?.(bar.sleepId)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      Reset to original
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── COLLAPSIBLE: Model Calculation Factors ── */}
          {bar.qualityFactors && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                <span>{'\u{1F52C}'} Model Factors</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-secondary/20 rounded-lg p-2 space-y-1.5 mt-1.5">
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
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── COLLAPSIBLE: References + Confidence ── */}
          {(bar.references?.length || bar.confidenceBasis) && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                <span>{'\u{1F4DA}'} References</span>
                {bar.references?.length ? (
                  <span className="text-[9px] text-muted-foreground/50 ml-auto">{bar.references.length}</span>
                ) : null}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-secondary/20 rounded-lg p-2 space-y-2 mt-1.5">
                  {bar.confidenceBasis && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {bar.confidenceBasis}
                    </p>
                  )}
                  {bar.references && bar.references.length > 0 && (
                    <TooltipProvider delayDuration={200}>
                      <div className="flex flex-wrap gap-1">
                        {bar.references.map((ref, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary cursor-help">
                                {ref.short}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[280px] text-[11px] leading-snug">
                              {ref.full}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── FOOTER: Duty context ── */}
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
