/**
 * TimelineGrid — presentational month grid: WOCL band, hourly grid lines and
 * one row per day with duty, sleep, standby, in-flight rest, FDP limit and
 * duty-peak marks. Data arrives already transformed into TimelineData.
 */

import { useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SleepBarPopover } from './SleepBarPopover';
import { DutyBarTooltip } from './DutyBarTooltip';
import { DayLabel } from './DayLabel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import type { TimelineData, TimelinePeakMarker, TimelineSleepBar } from '@/lib/timeline-types';
import type { DutyAnalysis } from '@/types/fatigue';
import type { SleepEdit } from '@/hooks/useSleepEdits';

interface TimelineGridProps {
  data: TimelineData;
  rowHeight: number;
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  /** Pending sleep edits (Map<blockKey, SleepEdit>) — homebase only */
  pendingEdits?: Map<string, SleepEdit>;
  /** Callback when user adjusts a sleep bar via drag */
  onSleepEdit?: (edit: SleepEdit) => void;
  /** Callback when user resets a single sleep edit */
  onRemoveEdit?: (blockKey: string) => void;
  /** Remove a sleep block (saved with the analysis). */
  onRemoveBlock?: (bar: TimelineSleepBar) => void;
  /** ID (blockKey) of the sleep bar currently in drag-edit mode */
  activeEditBarId?: string | null;
  /** Called on double-click to enter drag-edit mode (by blockKey) */
  onActivateEdit?: (blockKey: string) => void;
  /** Called to exit drag-edit mode */
  onDeactivateEdit?: () => void;
}

/** X-axis labels at 3-hour intervals */
const hours = Array.from({ length: 8 }, (_, i) => i * 3);
const pct = (h: number) => `${(h / 24) * 100}%`;

/** Thin vertical tick with a diamond head at the duty's model peak. */
function PeakMark({ marker }: { marker: TimelinePeakMarker }) {
  const ring = { boxShadow: '0 0 0 1px hsl(var(--card))' };
  return (
    <span aria-hidden="true" className="pointer-events-none absolute bottom-[3px] top-[3px] z-20 w-0" style={{ left: pct(marker.hour) }}>
      <span className="absolute inset-y-0 left-[-1px] w-[2px] rounded-full bg-foreground" style={ring} />
      <span className="absolute left-[-3.5px] top-[-1px] h-[7px] w-[7px] rotate-45 bg-foreground" style={ring} />
    </span>
  );
}

export function TimelineGrid({
  data,
  rowHeight,
  selectedDuty,
  onDutySelect,
  pendingEdits,
  onSleepEdit,
  onRemoveEdit,
  onRemoveBlock,
  activeEditBarId,
  onActivateEdit,
  onDeactivateEdit,
}: TimelineGridProps) {
  // Refs to each day row for coordinate math in EditableSleepBar
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const setRowRef = useCallback((rowIndex: number) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(rowIndex, el);
    else rowRefs.current.delete(rowIndex);
  }, []);

  // One stable getter per row so downstream memoisation holds.
  const rowElGetters = useRef(new Map<number, () => HTMLDivElement | null>());
  const getRowEl = useCallback((rowIndex: number) => {
    let getter = rowElGetters.current.get(rowIndex);
    if (!getter) {
      getter = () => rowRefs.current.get(rowIndex) ?? null;
      rowElGetters.current.set(rowIndex, getter);
    }
    return getter;
  }, []);

  const peakByDuty = useMemo(() => {
    const map = new Map<DutyAnalysis, TimelinePeakMarker>();
    for (const m of data.peakMarkers ?? []) map.set(m.duty, m);
    return map;
  }, [data.peakMarkers]);

  return (
    <div className="calendar-grid flex">
      {/* Y-axis: day labels with the day's duty peak */}
      <div className="w-[52px] flex-shrink-0 sm:w-[104px]">
        <div style={{ height: `${rowHeight}px` }} />
        {data.rowLabels.map((label) => (
          <DayLabel key={label.rowIndex} label={label} rowHeight={rowHeight} />
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        {/* X-axis header */}
        <div className="flex border-b border-border" style={{ height: `${rowHeight}px` }} aria-hidden="true">
          {hours.map((hour) => (
            <div key={hour} className="flex items-end justify-start pb-1 pl-0.5 font-mono text-[11px] text-muted-foreground" style={{ width: `${100 / 8}%` }}>
              {String(hour).padStart(2, '0')}
            </div>
          ))}
        </div>

        <div className="relative">
          {/* WOCL band (static bands span all rows; per-row bands follow their row) */}
          {data.woclBands.filter((band) => band.rowIndex === -1 || data.rowLabels.some((row) => row.rowIndex === band.rowIndex)).map((band, i) => (
            <div
              key={`wocl-${i}`}
              className={cn('wocl-hatch pointer-events-none absolute', band.rowIndex === -1 && 'bottom-0 top-0')}
              style={{
                left: pct(band.startHour),
                width: pct(band.endHour - band.startHour),
                ...(band.rowIndex >= 0 ? { top: `${data.rowLabels.findIndex((row) => row.rowIndex === band.rowIndex) * rowHeight}px`, height: `${rowHeight}px` } : {}),
              }}
            />
          ))}

          {/* Vertical grid lines (24 columns, every 3rd stronger) */}
          <div className="pointer-events-none absolute inset-0 flex">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className={cn('flex-1 border-r', hour % 3 === 2 ? 'border-border/80' : 'border-border/30')} />
            ))}
          </div>

          {/* Day rows */}
          {data.rowLabels.map((label) => (
            <div
              key={label.rowIndex}
              ref={setRowRef(label.rowIndex)}
              className="relative border-b border-border/50 transition-colors hover:bg-primary/[0.04]"
              style={{ height: `${rowHeight}px` }}
            >
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
                    pendingEdit={bar.blockKey ? pendingEdits?.get(bar.blockKey) ?? null : null}
                    onSleepEdit={onSleepEdit}
                    onRemoveEdit={onRemoveEdit}
                    onRemoveBlock={onRemoveBlock}
                    isEditing={bar.blockKey === activeEditBarId}
                    onActivateEdit={onActivateEdit}
                    onDeactivateEdit={onDeactivateEdit}
                    getRowEl={getRowEl(label.rowIndex)}
                  />
                ))}

              {/* Standby (hatched; no predicted KSS) */}
              {(data.standbyBars ?? [])
                .filter((bar) => bar.rowIndex === label.rowIndex)
                .map((bar, i) => {
                  const kind = bar.period.type === 'airport_standby' ? 'Airport standby' : 'Home standby';
                  return (
                    <Popover key={`standby-${i}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="pointer-events-auto absolute rounded-[3px] border border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            top: 7,
                            bottom: 7,
                            left: pct(bar.startHour),
                            width: `${Math.max(((bar.endHour - bar.startHour) / 24) * 100, 0.5)}%`,
                            background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, hsl(var(--muted-foreground) / 0.35) 3px, hsl(var(--muted-foreground) / 0.35) 5px)',
                            zIndex: 5,
                          }}
                          title={`${kind} ${bar.period.startHome}–${bar.period.endHome}`}
                          aria-label={`${kind} ${bar.period.startHome} to ${bar.period.endHome}`}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="space-y-2 text-sm">
                        <h3 className="font-semibold">{kind}</h3>
                        <p>{bar.period.date} · {bar.period.startHome}–{bar.period.endHome} home-base time</p>
                        <p className="text-muted-foreground">Included as a standby period from the roster. It has no predicted duty KSS score.</p>
                        <p className="text-xs text-muted-foreground">Counted duty time: {bar.period.countedDutyHours.toFixed(1)}h. Review the FTL checks for coverage and assumptions.</p>
                      </PopoverContent>
                    </Popover>
                  );
                })}

              {/* Duty bars */}
              {data.dutyBars
                .filter((bar) => bar.rowIndex === label.rowIndex)
                .map((bar, i) => (
                  <DutyBarTooltip
                    key={`duty-${i}`}
                    bar={bar}
                    widthPercent={((bar.endHour - bar.startHour) / 24) * 100}
                    leftPercent={(bar.startHour / 24) * 100}
                    selectedDuty={selectedDuty}
                    onDutySelect={onDutySelect}
                    variant={data.variant}
                    peak={peakByDuty.get(bar.duty)}
                  />
                ))}

              {/* Duty peak (model peak time) */}
              {(data.peakMarkers ?? [])
                .filter((m) => m.rowIndex === label.rowIndex)
                .map((m, i) => <PeakMark key={`peak-${i}`} marker={m} />)}

              {/* In-flight rest */}
              {data.inflightRestBars
                .filter((bar) => bar.rowIndex === label.rowIndex)
                .map((bar, i) => (
                  <Popover key={`ifr-${i}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Inspect in-flight rest: ${bar.durationHours.toFixed(1)} hours`}
                          className="pointer-events-auto absolute cursor-pointer rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            top: 10,
                            bottom: 10,
                            left: pct(bar.startHour),
                            width: `${Math.max(((bar.endHour - bar.startHour) / 24) * 100, 0.5)}%`,
                            background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, hsl(var(--wocl) / 0.6) 2px, hsl(var(--wocl) / 0.6) 4px)',
                            zIndex: 25,
                          }}
                        />
                      </PopoverTrigger>
                      <PopoverContent side="top" className="max-w-[calc(100vw-2rem)] space-y-2 p-3">
                        <div className="space-y-1 text-xs">
                          <p className="border-b border-border pb-1 font-semibold">
                            In-flight rest{bar.crewSet ? ` · ${bar.crewSet.replace('_', ' ')}` : ''}
                          </p>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <dt className="text-muted-foreground">Duration</dt>
                            <dd className="font-mono tabular">{bar.durationHours?.toFixed(1) ?? '—'}h</dd>
                            <dt className="text-muted-foreground">Effective sleep</dt>
                            <dd className="font-mono tabular">{bar.effectiveSleepHours?.toFixed(1) ?? '—'}h</dd>
                            {bar.isDuringWocl && <><dt className="text-muted-foreground">During WOCL</dt><dd>Yes</dd></>}
                          </dl>
                        </div>
                        <p className="text-xs text-muted-foreground">A modelled rest allocation, not recorded sleep. Effective sleep includes the estimated reduction for the rest facility and timing.</p>
                      </PopoverContent>
                  </Popover>
                ))}

              {/* FDP limit markers (dashed lines) */}
              {data.fdpMarkers
                .filter((marker) => marker.rowIndex === label.rowIndex)
                .map((marker, i) => (
                  <button
                    key={`fdp-${i}`}
                    type="button"
                    className="absolute bottom-0 top-0 z-30 w-4 -translate-x-1/2 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ left: pct(marker.hour) }}
                    title={`Calculated FDP limit: ${marker.maxFdp}h. Select to review this duty and its assumptions.`}
                    aria-label={`FDP limit for ${format(marker.duty.date, 'EEE d MMM')}: ${marker.maxFdp} hours — open duty details`}
                    onClick={() => onDutySelect(marker.duty)}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-1/2 border-r-2 border-dashed border-muted-foreground/70" />
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
