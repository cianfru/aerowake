/**
 * TimelineGrid -- Pure presentational grid container that renders WOCL bands,
 * 24 hourly grid lines, day rows with duty/sleep/IR bars, and the color legend.
 *
 * Data is already transformed into TimelineData by the time it reaches this
 * component. Used by all three grid-based chronogram views (homebase, utc, elapsed).
 */

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { SleepBarPopover } from './SleepBarPopover';
import { DutyBarTooltip } from './DutyBarTooltip';
import { DayLabel } from './DayLabel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { TimelineData } from '@/lib/timeline-types';
import type { DutyAnalysis } from '@/types/fatigue';
import type { SleepEdit } from '@/hooks/useSleepEdits';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimelineGridProps {
  data: TimelineData;
  rowHeight: number;
  showFlightPhases: boolean;
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  /** Pending sleep edits (Map<dutyId, SleepEdit>) — homebase only */
  pendingEdits?: Map<string, SleepEdit>;
  /** Callback when user adjusts a sleep bar via drag */
  onSleepEdit?: (edit: SleepEdit) => void;
  /** Callback when user resets a single sleep edit */
  onRemoveEdit?: (dutyId: string) => void;
  /** ID of the sleep bar currently in drag-edit mode */
  activeEditBarId?: string | null;
  /** Called on double-click to enter drag-edit mode */
  onActivateEdit?: (sleepId: string) => void;
  /** Called to exit drag-edit mode */
  onDeactivateEdit?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** X-axis labels at 3-hour intervals */
const hours = Array.from({ length: 8 }, (_, i) => i * 3);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimelineGrid({
  data,
  rowHeight,
  showFlightPhases,
  selectedDuty,
  onDutySelect,
  pendingEdits,
  onSleepEdit,
  onRemoveEdit,
  activeEditBarId,
  onActivateEdit,
  onDeactivateEdit,
}: TimelineGridProps) {
  // Store refs to each day row for coordinate math in EditableSleepBar
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const setRowRef = useCallback((rowIndex: number) => (el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(rowIndex, el);
    } else {
      rowRefs.current.delete(rowIndex);
    }
  }, []);

  // Create a stable ref object for a given rowIndex
  const getRowRef = useCallback((rowIndex: number): React.RefObject<HTMLDivElement> => {
    return {
      get current() {
        return rowRefs.current.get(rowIndex) ?? null;
      },
    } as React.RefObject<HTMLDivElement>;
  }, []);

  return (
    <div className="flex">
      {/* ----------------------------------------------------------------- */}
      {/* Y-axis labels                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="w-28 flex-shrink-0">
        {/* Header spacer — matches the X-axis header row */}
        <div style={{ height: `${rowHeight}px` }} />
        {data.rowLabels.map((label) => (
          <DayLabel key={label.rowIndex} label={label} rowHeight={rowHeight} />
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Main chart area                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative flex-1">
        {/* X-axis header */}
        <div
          className="flex border-b border-border"
          style={{ height: `${rowHeight}px` }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex items-end justify-start pb-1 pl-1 text-[10px] text-muted-foreground"
              style={{ width: `${100 / 8}%` }}
            >
              {String(hour).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Grid body: WOCL shading, grid lines, day rows */}
        <div className="relative">
          {/* -------------------------------------------------------------- */}
          {/* Static WOCL bands (rowIndex === -1 spans all rows)             */}
          {/* -------------------------------------------------------------- */}
          {data.woclBands
            .filter((band) => band.rowIndex === -1)
            .map((band, i) => (
              <div
                key={`wocl-static-${i}`}
                className="absolute top-0 bottom-0 wocl-hatch pointer-events-none"
                style={{
                  left: `${(band.startHour / 24) * 100}%`,
                  width: `${((band.endHour - band.startHour) / 24) * 100}%`,
                }}
              />
            ))}

          {/* -------------------------------------------------------------- */}
          {/* Per-row WOCL bands (elapsed view, rowIndex >= 0)               */}
          {/* -------------------------------------------------------------- */}
          {data.woclBands
            .filter((band) => band.rowIndex >= 0)
            .map((band, i) => (
              <div
                key={`wocl-row-${i}`}
                className="absolute wocl-hatch pointer-events-none"
                style={{
                  top: `${band.rowIndex * rowHeight}px`,
                  height: `${rowHeight}px`,
                  left: `${(band.startHour / 24) * 100}%`,
                  width: `${((band.endHour - band.startHour) / 24) * 100}%`,
                }}
              />
            ))}

          {/* -------------------------------------------------------------- */}
          {/* Vertical grid lines (24 columns, every 3rd more prominent)     */}
          {/* -------------------------------------------------------------- */}
          <div className="absolute inset-0 flex pointer-events-none">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className={cn(
                  'flex-1 border-r',
                  hour % 3 === 0 ? 'border-border/50' : 'border-border/20',
                )}
              />
            ))}
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Day rows                                                       */}
          {/* -------------------------------------------------------------- */}
          {data.rowLabels.map((label) => (
            <div
              key={label.rowIndex}
              ref={setRowRef(label.rowIndex)}
              className="relative border-b border-border/20"
              style={{ height: `${rowHeight}px` }}
            >
              {/* Sleep bars */}
              {data.sleepBars
                .filter((bar) => bar.rowIndex === label.rowIndex)
                .map((bar, i) => (
                  <SleepBarPopover
                    key={`sleep-${i}`}
                    bar={bar}
                    widthPercent={((bar.endHour - bar.startHour) / 24) * 100}
                    leftPercent={(bar.startHour / 24) * 100}
                    variant={data.variant}
                    isEditable={data.variant === 'homebase'}
                    pendingEdit={bar.sleepId ? pendingEdits?.get(bar.sleepId) ?? null : null}
                    onSleepEdit={onSleepEdit}
                    onRemoveEdit={onRemoveEdit}
                    isEditing={bar.sleepId === activeEditBarId}
                    onActivateEdit={onActivateEdit}
                    onDeactivateEdit={onDeactivateEdit}
                    rowRef={getRowRef(label.rowIndex)}
                  />
                ))}

              {/* Duty bars */}
              {data.dutyBars
                .filter((bar) => bar.rowIndex === label.rowIndex)
                .map((bar, i) => (
                  <DutyBarTooltip
                    key={`duty-${i}`}
                    bar={bar}
                    widthPercent={((bar.endHour - bar.startHour) / 24) * 100}
                    leftPercent={(bar.startHour / 24) * 100}
                    showFlightPhases={showFlightPhases}
                    selectedDuty={selectedDuty}
                    onDutySelect={onDutySelect}
                    variant={data.variant}
                  />
                ))}

              {/* In-flight rest bars */}
              {data.inflightRestBars
                .filter((bar) => bar.rowIndex === label.rowIndex)
                .map((bar, i) => {
                  const barWidth = ((bar.endHour - bar.startHour) / 24) * 100;
                  return (
                    <TooltipProvider key={`ifr-${i}`} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute pointer-events-auto cursor-help"
                            style={{
                              top: 13,
                              height: 13,
                              left: `${(bar.startHour / 24) * 100}%`,
                              width: `${Math.max(barWidth, 0.5)}%`,
                              background:
                                'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(147, 130, 220, 0.5) 2px, rgba(147, 130, 220, 0.5) 4px)',
                              borderRadius: '2px',
                              zIndex: 25,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-1 text-xs">
                            <div className="font-semibold border-b pb-1">
                              In-Flight Rest
                              {bar.crewSet && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] capitalize"
                                >
                                  {bar.crewSet.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <span className="text-muted-foreground">Duration:</span>
                              <span>
                                {bar.durationHours?.toFixed(1) ?? 'N/A'}h
                              </span>
                              <span className="text-muted-foreground">
                                Effective Sleep:
                              </span>
                              <span>
                                {bar.effectiveSleepHours?.toFixed(1) ?? 'N/A'}h
                              </span>
                              {bar.isDuringWocl && (
                                <>
                                  <span className="text-muted-foreground">WOCL:</span>
                                  <span className="text-warning">Yes</span>
                                </>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}

              {/* FDP Limit markers (vertical dashed lines) */}
              {data.fdpMarkers
                .filter((marker) => marker.rowIndex === label.rowIndex)
                .map((marker, i) => (
                  <div
                    key={`fdp-${i}`}
                    className="absolute top-0 bottom-0 border-r-2 border-dashed border-muted-foreground/50 pointer-events-none z-30"
                    style={{ left: `${(marker.hour / 24) * 100}%` }}
                    title={`Max FDP: ${marker.maxFdp}h`}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Color legend column (right side)                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="ml-3 flex w-10 flex-shrink-0 flex-col">
        {/* Spacer matching the X-axis header */}
        <div style={{ height: `${rowHeight}px` }} />
        <div
          className="flex gap-1"
          style={{ height: `${data.totalRows * rowHeight}px` }}
        >
          <div className="w-2.5 rounded-sm overflow-hidden">
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(to bottom, hsl(120, 70%, 45%), hsl(90, 70%, 50%), hsl(55, 90%, 55%), hsl(40, 95%, 50%), hsl(25, 95%, 50%), hsl(0, 80%, 50%))',
              }}
            />
          </div>
          <div className="flex flex-col justify-between text-[9px] text-muted-foreground">
            <span>100</span>
            <span>60</span>
            <span>0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
