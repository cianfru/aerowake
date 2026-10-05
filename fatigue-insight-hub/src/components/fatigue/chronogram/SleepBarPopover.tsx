import { useState, useRef, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { decimalToHHmm, QUALITY_FACTOR_LABELS } from '@/lib/fatigue-utils';
import { EditableSleepBar } from './EditableSleepBar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ChevronDown, BedDouble, Moon, Microscope, BookOpen } from 'lucide-react';
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
  /** Called when user adjusts a sleep bar edge via drag */
  onSleepEdit?: (edit: SleepEdit) => void;
  /** Called when user resets a single edit */
  onRemoveEdit?: (blockKey: string) => void;
  /** Remove this block (saved with the analysis) */
  onRemoveBlock?: (bar: TimelineSleepBar) => void;
  /** Whether this bar is currently in drag-edit mode */
  isEditing?: boolean;
  /** Called on double-click to enter edit mode (by blockKey) */
  onActivateEdit?: (blockKey: string) => void;
  /** Called to exit edit mode */
  onDeactivateEdit?: () => void;
  /** Stable getter for the parent row element (for drag coordinate math) */
  getRowEl?: () => HTMLDivElement | null;
}

const STRATEGY_LABELS: Record<string, string> = {
  normal: 'Normal night',
  anchor: 'Anchored to home time',
  split: 'Split sleep',
  early_bedtime: 'Early bedtime',
  restricted: 'Restricted by the roster',
  extended: 'Extended recovery',
  recovery: 'Recovery',
  post_duty_recovery: 'Recovery after duty',
  nap: 'Night departure with nap',
  afternoon_nap: 'Afternoon nap',
};

const strategyLabel = (s: string) => STRATEGY_LABELS[s] ?? s.split('_').join(' ');

export function SleepBarPopover({
  bar,
  widthPercent,
  leftPercent,
  isEditable,
  pendingEdit,
  onSleepEdit,
  onRemoveBlock,
  isEditing,
  onActivateEdit,
  onDeactivateEdit,
  getRowEl,
}: SleepBarPopoverProps) {
  const hasEdit = pendingEdit != null;
  const isNap = bar.sleepType === 'nap';

  // Controlled popover — single click opens it, double click enters edit mode.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  const borderRadius = bar.isOvernightStart ? '3px 0 0 3px' : bar.isOvernightContinuation ? '0 3px 3px 0' : '3px';

  const originalStart = bar.originalStartHour ?? bar.startHour;
  const originalEnd = bar.originalEndHour ?? bar.endHour;
  const displayStartHour = hasEdit ? pendingEdit!.newStartHour : originalStart;
  const displayEndHour = hasEdit ? pendingEdit!.newEndHour : originalEnd;
  const windowHours = ((displayEndHour - displayStartHour) % 24 + 24) % 24;

  // Only the primary half of an overnight sleep is editable; the continuation follows.
  const canEdit = isEditable && bar.blockKey && bar.sleepStartIso && bar.sleepEndIso && !bar.isOvernightContinuation;
  const pilot = bar.source === 'pilot';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (e.detail === 0) { setPopoverOpen(true); return; }
    clickTimer.current = setTimeout(() => setPopoverOpen(true), 250);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (canEdit && onActivateEdit && bar.blockKey) onActivateEdit(bar.blockKey);
  }, [canEdit, onActivateEdit, bar.blockKey]);

  if (isEditing && canEdit && onSleepEdit && onDeactivateEdit && getRowEl) {
    return (
      <EditableSleepBar
        bar={bar}
        widthPercent={widthPercent}
        leftPercent={leftPercent}
        pendingEdit={pendingEdit}
        onSleepEdit={onSleepEdit}
        onDeactivate={onDeactivateEdit}
        getRowEl={getRowEl}
      />
    );
  }

  const title = pilot ? (isNap ? 'Nap you set' : 'Sleep you set') : isNap ? 'Nap (estimated)' : 'Sleep (estimated)';

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      {/* Hidden anchor so Radix knows where to position the popover */}
      <PopoverTrigger asChild>
        <span
          className="pointer-events-none absolute"
          style={{ top: 0, height: '100%', left: `${leftPercent}%`, width: `${Math.max(widthPercent, 1)}%` }}
          aria-hidden
        />
      </PopoverTrigger>
      <button
        type="button"
        aria-label={`Inspect estimated ${isNap ? 'nap' : 'sleep'} ${decimalToHHmm(displayStartHour)} to ${decimalToHHmm(displayEndHour)}`}
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
        className={cn(
          'calendar-seg absolute z-[5] flex cursor-pointer items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          hasEdit ? 'border-solid border-primary/70 bg-primary/15' : 'border-dashed border-primary/45 bg-primary/[0.07] hover:bg-primary/[0.12]',
        )}
        style={{
          top: 4,
          bottom: 4,
          left: `${leftPercent}%`,
          width: `${Math.max(widthPercent, 1)}%`,
          borderRadius,
          borderRight: bar.isOvernightStart ? 'none' : undefined,
          borderLeft: bar.isOvernightContinuation ? 'none' : undefined,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {!bar.isOvernightContinuation && windowHours >= 3 && (
          <span className="calendar-seg-label font-mono text-[11px] leading-none text-muted-foreground tabular">
            {hasEdit ? 'edited' : `${windowHours.toFixed(1)}h`}
          </span>
        )}
      </button>
      <PopoverContent align="start" side="top" className="w-80 max-w-[calc(100vw-2rem)] p-4">
        <div className="space-y-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {isNap ? <Moon className="h-4 w-4" aria-hidden="true" /> : <BedDouble className="h-4 w-4" aria-hidden="true" />}
              {title}
            </p>
            {hasEdit && <span className="rounded-[4px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">Edited</span>}
          </div>
          <p className="text-muted-foreground">
            {pilot ? 'Planned sleep you set; the model uses your times. Not a record of sleep taken.' : 'Estimated sleep from the roster, not a record of sleep taken.'}
          </p>
          {bar.basis && <p className="leading-relaxed text-foreground/90">{bar.basis}</p>}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted-foreground">Window (home base)</dt>
            <dd className="font-mono tabular">
              {decimalToHHmm(displayStartHour)}–{decimalToHHmm(displayEndHour)}
              {bar.sleepStartZulu && bar.sleepEndZulu && (
                <span className="ml-2 text-muted-foreground">{bar.sleepStartZulu}–{bar.sleepEndZulu}</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Effective sleep</dt>
            <dd className="font-mono tabular">{bar.effectiveSleep.toFixed(1)}h</dd>
            <dt className="text-muted-foreground">Efficiency</dt>
            <dd className="font-mono tabular">{Math.round(bar.sleepEfficiency * 100)}%</dd>
            {(bar.woclOverlapHours ?? 0) > 0 && (
              <><dt className="text-muted-foreground">In body-clock low</dt><dd className="font-mono tabular">{bar.woclOverlapHours!.toFixed(1)}h</dd></>
            )}
            <dt className="text-muted-foreground">Pattern</dt>
            <dd>{strategyLabel(bar.sleepStrategy)}</dd>
            {bar.confidence != null && (
              <><dt className="text-muted-foreground">Confidence</dt><dd className="font-mono tabular">{Math.round(bar.confidence * 100)}%</dd></>
            )}
          </dl>

          {(bar.explanation || bar.confidenceBasis) && (
            <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-2.5 leading-relaxed text-muted-foreground">
              {bar.explanation && <p>{bar.explanation}</p>}
              {bar.confidenceBasis && <p>{bar.confidenceBasis}</p>}
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-border px-3 py-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setPopoverOpen(false); onActivateEdit?.(bar.blockKey!); }}>
                Adjust sleep times
              </button>
              {onRemoveBlock && (
                <button type="button" className="rounded-md border border-border px-3 py-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setPopoverOpen(false); onRemoveBlock(bar); }}>
                  {isNap && !pilot ? 'I don’t nap here' : 'Remove'}
                </button>
              )}
            </div>
          )}

          {bar.qualityFactors && (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                <Microscope className="h-3 w-3" aria-hidden="true" /> Sleep quality factors
              </CollapsibleTrigger>
              <CollapsibleContent>
                <dl className="mt-1.5 space-y-1 rounded-lg bg-muted/40 p-2">
                  {Object.entries(bar.qualityFactors).map(([key, value]) => {
                    const n = value as number;
                    const isHours = key === 'pre_duty_awake_hours';
                    return (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <dt className="text-muted-foreground">{QUALITY_FACTOR_LABELS[key] || key}</dt>
                        <dd className="font-mono tabular">{isHours ? `${n.toFixed(1)}h` : `×${n.toFixed(2)}`}</dd>
                      </div>
                    );
                  })}
                </dl>
              </CollapsibleContent>
            </Collapsible>
          )}

          {bar.references?.length ? (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                <BookOpen className="h-3 w-3" aria-hidden="true" /> References ({bar.references.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <TooltipProvider delayDuration={200}>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {bar.references.map((ref, i) => (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help items-center rounded-[4px] border border-border px-1.5 py-0.5 text-[11px] font-medium">
                            {ref.short}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[280px] text-[11px] leading-snug">{ref.full}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
            {bar.relatedDuty.dutyId
              ? `Before the duty on ${format(bar.relatedDuty.date, 'EEE d MMM')}`
              : `Rest day · ${format(bar.relatedDuty.date, 'EEE d MMM')}`}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
