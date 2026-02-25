/**
 * useSleepEdits — manages ephemeral sleep overrides for what-if recalculation.
 *
 * Pilots adjust sleep timing via sliders in SleepBarPopover (homebase view only).
 * Edits accumulate in a Map keyed by dutyId. When the pilot clicks "Apply &
 * Recalculate", all pending edits are converted to UTC ISO timestamps and sent
 * to `POST /api/what-if` as `sleep_modifications[]`. The backend re-runs the
 * full Borbely simulation and returns a new AnalysisResult, which replaces the
 * current analysis in AnalysisContext.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runWhatIf } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SleepEdit {
  dutyId: string;
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
  removeEdit: (dutyId: string) => void;
  clearEdits: () => void;
  applyEdits: () => void;
  isApplying: boolean;
  hasEdits: boolean;
  editCount: number;
  /** ID of the sleep bar currently in drag-edit mode (null when none) */
  activeBarId: string | null;
  /** Enter drag-edit mode for a specific sleep bar */
  activateEdit: (sleepId: string) => void;
  /** Exit drag-edit mode */
  deactivateEdit: () => void;
}

// ---------------------------------------------------------------------------
// Helper: convert homebase decimal hour delta to UTC ISO timestamp
// ---------------------------------------------------------------------------

/**
 * Given an original UTC ISO timestamp and a delta in hours (new hour - original
 * hour in homebase), compute the new UTC ISO string. This avoids needing a
 * timezone library — we just shift the original UTC time by the same delta.
 */
function shiftUtcIso(originalUtcIso: string, deltaHours: number): string {
  const d = new Date(originalUtcIso);
  d.setTime(d.getTime() + deltaHours * 3600_000);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSleepEdits(
  analysisId: string | undefined,
): UseSleepEditsReturn {
  const [pendingEdits, setPendingEdits] = useState<Map<string, SleepEdit>>(new Map());
  const [activeBarId, setActiveBarId] = useState<string | null>(null);
  const { state, setAnalysisResults } = useAnalysis();
  const { toast } = useToast();

  const activateEdit = useCallback((sleepId: string) => {
    setActiveBarId(sleepId);
  }, []);

  const deactivateEdit = useCallback(() => {
    setActiveBarId(null);
  }, []);

  const addEdit = useCallback((edit: SleepEdit) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      // Only store if actually different from original
      if (
        Math.abs(edit.newStartHour - edit.originalStartHour) < 0.01 &&
        Math.abs(edit.newEndHour - edit.originalEndHour) < 0.01
      ) {
        next.delete(edit.dutyId);
      } else {
        next.set(edit.dutyId, edit);
      }
      return next;
    });
  }, []);

  const removeEdit = useCallback((dutyId: string) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(dutyId);
      return next;
    });
  }, []);

  const clearEdits = useCallback(() => {
    setPendingEdits(new Map());
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!analysisId || pendingEdits.size === 0) {
        throw new Error('No edits to apply');
      }

      // Convert each edit to UTC sleep modifications
      const sleepModifications = Array.from(pendingEdits.values()).map((edit) => {
        const startDelta = edit.newStartHour - edit.originalStartHour;
        const endDelta = edit.newEndHour - edit.originalEndHour;
        return {
          duty_id: edit.dutyId,
          sleep_start_utc: shiftUtcIso(edit.originalStartIso, startDelta),
          sleep_end_utc: shiftUtcIso(edit.originalEndIso, endDelta),
        };
      });

      return runWhatIf({
        analysis_id: analysisId,
        sleep_modifications: sleepModifications,
        config_preset: state.settings.configPreset,
      });
    },
    onSuccess: (result) => {
      // Transform API result into frontend AnalysisResults
      const month = state.analysisResults?.month ?? new Date();
      const transformed = transformAnalysisResult(result, month);
      setAnalysisResults(transformed);
      clearEdits();
      toast({
        title: 'Sleep edits applied',
        description: `Fatigue model recalculated with ${pendingEdits.size} sleep modification${pendingEdits.size > 1 ? 's' : ''}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Recalculation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const hasEdits = pendingEdits.size > 0;
  const editCount = pendingEdits.size;

  const applyEdits = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return useMemo(() => ({
    pendingEdits,
    addEdit,
    removeEdit,
    clearEdits,
    applyEdits,
    isApplying: mutation.isPending,
    hasEdits,
    editCount,
    activeBarId,
    activateEdit,
    deactivateEdit,
  }), [pendingEdits, addEdit, removeEdit, clearEdits, applyEdits, mutation.isPending, hasEdits, editCount, activeBarId, activateEdit, deactivateEdit]);
}
