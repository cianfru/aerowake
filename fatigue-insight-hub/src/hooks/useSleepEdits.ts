/**
 * useSleepEdits — drag edits of sleep bars on the home-base chronogram.
 *
 * Pilots adjust a bar's edges; edits gather in a Map keyed by blockKey. "Apply
 * and recalculate" turns each into a change of that block's times, adds them to
 * the changes already stored with the analysis and saves the full list
 * (PUT /api/analysis/{id}/sleep-edits). The analysis keeps its id and the
 * changes stay with the roster. "Restore all estimates" saves an empty list.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSaveSleepEdits } from '@/hooks/useSaveSleepEdits';
import { removeBlock, retimeBlock } from '@/lib/sleep-edits';
import type { TimelineSleepBar } from '@/lib/timeline-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SleepEdit {
  dutyId: string;
  /** Unique per-block key: "${dutyId}::${blockIndex}" — used as Map key */
  blockKey: string;
  /** 'main' or 'nap' */
  sleepType?: string;
  /** 'pilot' when the block is already one the pilot set */
  source?: 'estimated' | 'pilot';
  /** Original bedtime as decimal hour in homebase TZ (for display / reset) */
  originalStartHour: number;
  /** Original wake-up as decimal hour in homebase TZ */
  originalEndHour: number;
  /** User-adjusted bedtime (from slider) — decimal hour in homebase TZ */
  newStartHour: number;
  /** User-adjusted wake-up (from slider) — decimal hour in homebase TZ */
  newEndHour: number;
  /** Original UTC ISO start — used for conversion baseline */
  originalStartIso: string;
  /** Original UTC ISO end — used for conversion baseline */
  originalEndIso: string;
}

export interface UseSleepEditsReturn {
  pendingEdits: Map<string, SleepEdit>;
  addEdit: (edit: SleepEdit) => void;
  removeEdit: (blockKey: string) => void;
  clearEdits: () => void;
  applyEdits: () => void;
  isApplying: boolean;
  hasEdits: boolean;
  editCount: number;
  /** ID of the sleep bar currently in drag-edit mode (null when none) */
  activeBarId: string | null;
  /** Enter drag-edit mode for a specific sleep bar (by blockKey) */
  activateEdit: (blockKey: string) => void;
  /** Exit drag-edit mode */
  deactivateEdit: () => void;
  /** Whether the analysis holds any sleep changes of the pilot's */
  hasOriginal: boolean;
  /** Put every model estimate back (clears the stored changes) */
  resetToOriginal: () => void;
  /** Remove one block (saved straight away) */
  removeBar: (bar: TimelineSleepBar) => void;
}

/** Shift a UTC instant by the same number of hours as the drag moved it. */
function shiftUtcIso(originalUtcIso: string, deltaHours: number): string {
  const d = new Date(originalUtcIso);
  d.setTime(d.getTime() + deltaHours * 3600_000);
  return d.toISOString();
}

export function useSleepEdits(
  // Kept for the call sites; the saved changes belong to the analysis on screen.
  _analysisId?: string,
): UseSleepEditsReturn {
  const [pendingEdits, setPendingEdits] = useState<Map<string, SleepEdit>>(new Map());
  const [activeBarId, setActiveBarId] = useState<string | null>(null);
  const { edits, save, isSaving } = useSaveSleepEdits();

  const activateEdit = useCallback((blockKey: string) => setActiveBarId(blockKey), []);
  const deactivateEdit = useCallback(() => setActiveBarId(null), []);

  const addEdit = useCallback((edit: SleepEdit) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      // Only store if actually different from original
      if (
        Math.abs(edit.newStartHour - edit.originalStartHour) < 0.01 &&
        Math.abs(edit.newEndHour - edit.originalEndHour) < 0.01
      ) {
        next.delete(edit.blockKey);
      } else {
        next.set(edit.blockKey, edit);
      }
      return next;
    });
  }, []);

  const removeEdit = useCallback((blockKey: string) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(blockKey);
      return next;
    });
  }, []);

  const clearEdits = useCallback(() => setPendingEdits(new Map()), []);

  const applyEdits = useCallback(() => {
    let next = edits;
    for (const e of pendingEdits.values()) {
      const block = { sleepStartUtc: e.originalStartIso, sleepEndUtc: e.originalEndIso, sleepType: e.sleepType, source: e.source };
      next = retimeBlock(next, block,
        shiftUtcIso(e.originalStartIso, e.newStartHour - e.originalStartHour),
        shiftUtcIso(e.originalEndIso, e.newEndHour - e.originalEndHour));
    }
    const n = pendingEdits.size;
    save(next, `${n} sleep change${n > 1 ? 's' : ''} saved and fatigue recalculated`);
    setPendingEdits(new Map());
    setActiveBarId(null);
  }, [edits, pendingEdits, save]);

  const resetToOriginal = useCallback(() => {
    save([], 'All sleep estimates restored');
    setPendingEdits(new Map());
  }, [save]);

  const removeBar = useCallback((bar: TimelineSleepBar) => {
    if (!bar.sleepStartIso || !bar.sleepEndIso) return;
    save(removeBlock(edits, { sleepStartUtc: bar.sleepStartIso, sleepEndUtc: bar.sleepEndIso, sleepType: bar.sleepType, source: bar.source }),
      bar.sleepType === 'nap' ? 'Nap removed and fatigue recalculated' : 'Sleep removed and fatigue recalculated');
  }, [edits, save]);

  const hasEdits = pendingEdits.size > 0;
  const editCount = pendingEdits.size;
  const hasOriginal = edits.length > 0;

  return useMemo(() => ({
    pendingEdits,
    addEdit,
    removeEdit,
    clearEdits,
    applyEdits,
    isApplying: isSaving,
    hasEdits,
    editCount,
    activeBarId,
    activateEdit,
    deactivateEdit,
    hasOriginal,
    resetToOriginal,
    removeBar,
  }), [pendingEdits, addEdit, removeEdit, clearEdits, applyEdits, isSaving, hasEdits, editCount, activeBarId, activateEdit, deactivateEdit, hasOriginal, resetToOriginal, removeBar]);
}
