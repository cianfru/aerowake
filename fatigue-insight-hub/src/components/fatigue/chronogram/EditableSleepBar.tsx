/**
 * EditableSleepBar — Direct-manipulation drag-to-resize sleep bar.
 *
 * Activated by double-clicking a sleep bar on the homebase chronogram.
 * Shows left/right drag handles that the user can grab to adjust bedtime
 * and wake-up times. Snaps to 15-minute increments. Live time tooltip
 * follows the cursor during drag.
 *
 * Deactivated by clicking outside the bar or pressing Escape.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getRecoveryClasses, getStrategyIcon, decimalToHHmm } from '@/lib/fatigue-utils';
import type { TimelineSleepBar } from '@/lib/timeline-types';
import type { SleepEdit } from '@/hooks/useSleepEdits';

interface EditableSleepBarProps {
  bar: TimelineSleepBar;
  widthPercent: number;
  leftPercent: number;
  pendingEdit?: SleepEdit | null;
  onSleepEdit: (edit: SleepEdit) => void;
  onDeactivate: () => void;
  /** Ref to the parent row element (for coordinate math) */
  rowRef: React.RefObject<HTMLDivElement>;
}

// Clamp a number between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Convert mouse X position to a snapped hour (0–24, 15-min increments)
function mouseXToHour(clientX: number, rowEl: HTMLElement): number {
  const rect = rowEl.getBoundingClientRect();
  const relativeX = clamp((clientX - rect.left) / rect.width, 0, 1);
  return Math.round(relativeX * 24 * 4) / 4; // 15-min snap
}

export function EditableSleepBar({
  bar,
  widthPercent,
  leftPercent,
  pendingEdit,
  onSleepEdit,
  onDeactivate,
  rowRef,
}: EditableSleepBarProps) {
  const classes = getRecoveryClasses(bar.recoveryScore);
  const hasEdit = pendingEdit != null;
  const barRef = useRef<HTMLDivElement>(null);

  const originalStart = bar.originalStartHour ?? bar.startHour;
  const originalEnd = bar.originalEndHour ?? bar.endHour;

  // Live drag state — tracks the current dragged hours during interaction
  const [dragState, setDragState] = useState<{
    edge: 'left' | 'right';
    currentHour: number;
  } | null>(null);

  // Compute display hours (pending edit > drag > original)
  const displayStart = dragState?.edge === 'left'
    ? dragState.currentHour
    : hasEdit ? pendingEdit!.newStartHour : originalStart;

  const displayEnd = dragState?.edge === 'right'
    ? dragState.currentHour
    : hasEdit ? pendingEdit!.newEndHour : originalEnd;

  // Live bar position during drag
  const liveLeftPercent = (displayStart / 24) * 100;
  const liveWidthPercent = Math.max(((displayEnd - displayStart) / 24) * 100, (0.5 / 24) * 100);

  // Border radius based on overnight status
  const borderRadius = bar.isOvernightStart
    ? '2px 0 0 2px'
    : bar.isOvernightContinuation
      ? '0 2px 2px 0'
      : '2px';

  // Determine which handles are draggable (overnight bars restrict one edge)
  const canDragLeft = !bar.isOvernightContinuation;
  const canDragRight = !bar.isOvernightStart;

  // ── Drag handlers ──

  const handleMouseDown = useCallback((edge: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!rowRef.current) return;

    const initialHour = mouseXToHour(e.clientX, rowRef.current);
    setDragState({ edge, currentHour: initialHour });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!rowRef.current) return;
      const hour = mouseXToHour(moveEvent.clientX, rowRef.current);

      setDragState((prev) => {
        if (!prev) return null;

        // Enforce minimum duration of 0.5h
        if (prev.edge === 'left') {
          const currentEnd = hasEdit ? pendingEdit!.newEndHour : originalEnd;
          const maxStart = currentEnd - 0.5;
          return { ...prev, currentHour: Math.min(hour, maxStart) };
        } else {
          const currentStart = hasEdit ? pendingEdit!.newStartHour : originalStart;
          const minEnd = currentStart + 0.5;
          return { ...prev, currentHour: Math.max(hour, minEnd) };
        }
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (!rowRef.current || !bar.sleepId || !bar.sleepStartIso || !bar.sleepEndIso) {
        setDragState(null);
        return;
      }

      const finalHour = mouseXToHour(upEvent.clientX, rowRef.current);

      setDragState((prev) => {
        if (!prev) return null;

        let newStart: number;
        let newEnd: number;

        if (prev.edge === 'left') {
          const currentEnd = hasEdit ? pendingEdit!.newEndHour : originalEnd;
          newStart = Math.min(finalHour, currentEnd - 0.5);
          newEnd = currentEnd;
        } else {
          const currentStart = hasEdit ? pendingEdit!.newStartHour : originalStart;
          newStart = currentStart;
          newEnd = Math.max(finalHour, currentStart + 0.5);
        }

        onSleepEdit({
          dutyId: bar.sleepId!,
          originalStartHour: originalStart,
          originalEndHour: originalEnd,
          newStartHour: newStart,
          newEndHour: newEnd,
          originalStartIso: bar.sleepStartIso!,
          originalEndIso: bar.sleepEndIso!,
        });

        return null; // Clear drag state
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowRef, bar, hasEdit, pendingEdit, originalStart, originalEnd, onSleepEdit]);

  // ── Click-outside and Escape deactivation ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDeactivate();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onDeactivate();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Use setTimeout to avoid the double-click that activated this from immediately deactivating
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [onDeactivate]);

  return (
    <div
      ref={barRef}
      className={cn(
        "absolute z-[15] flex items-center border-2 border-warning/80 bg-warning/15 transition-colors",
        dragState && "ring-2 ring-warning/30"
      )}
      style={{
        top: 0,
        height: '100%',
        left: `${liveLeftPercent}%`,
        width: `${Math.max(liveWidthPercent, 1)}%`,
        borderRadius,
        borderRight: bar.isOvernightStart ? 'none' : undefined,
        borderLeft: bar.isOvernightContinuation ? 'none' : undefined,
      }}
    >
      {/* ── Left drag handle (bedtime) ── */}
      {canDragLeft && (
        <div
          className="absolute left-0 top-0 h-full w-[6px] cursor-col-resize z-20 group flex items-center justify-center"
          style={{ transform: 'translateX(-50%)' }}
          onMouseDown={handleMouseDown('left')}
        >
          <div className="w-[3px] h-3/5 rounded-full bg-warning/70 group-hover:bg-warning group-hover:scale-y-110 transition-all" />
        </div>
      )}

      {/* ── Right drag handle (wake-up) ── */}
      {canDragRight && (
        <div
          className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize z-20 group flex items-center justify-center"
          style={{ transform: 'translateX(50%)' }}
          onMouseDown={handleMouseDown('right')}
        >
          <div className="w-[3px] h-3/5 rounded-full bg-warning/70 group-hover:bg-warning group-hover:scale-y-110 transition-all" />
        </div>
      )}

      {/* ── Live time tooltip during drag ── */}
      {dragState && (
        <div
          className="absolute -top-6 bg-warning text-warning-foreground text-[10px] font-mono font-medium px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-30 pointer-events-none"
          style={{
            left: dragState.edge === 'left' ? '0' : 'auto',
            right: dragState.edge === 'right' ? '0' : 'auto',
            transform: dragState.edge === 'left' ? 'translateX(-50%)' : 'translateX(50%)',
          }}
        >
          {decimalToHHmm(dragState.currentHour)}
        </div>
      )}

      {/* ── Bar content (recovery info) ── */}
      <div className="flex items-center justify-end w-full px-1">
        {liveWidthPercent > 6 && (
          <div className="flex items-center gap-0.5 text-[8px] font-medium text-warning">
            <span>{getStrategyIcon(bar.sleepStrategy)}</span>
            <span>{Math.round(bar.recoveryScore)}%</span>
          </div>
        )}
        {liveWidthPercent > 3 && (
          <span className="text-[7px] text-warning font-medium ml-0.5">{'\u270E'}</span>
        )}
      </div>

      {/* ── Time labels at edges (when not dragging) ── */}
      {!dragState && (
        <>
          {canDragLeft && liveWidthPercent > 8 && (
            <span className="absolute left-1 top-0.5 text-[7px] font-mono text-warning/70 pointer-events-none">
              {decimalToHHmm(displayStart)}
            </span>
          )}
          {canDragRight && liveWidthPercent > 8 && (
            <span className="absolute right-1 top-0.5 text-[7px] font-mono text-warning/70 pointer-events-none">
              {decimalToHHmm(displayEnd)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
