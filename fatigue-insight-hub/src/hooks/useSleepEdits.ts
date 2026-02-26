/**
 * useSleepEdits — manages ephemeral sleep overrides for what-if recalculation.
 *
 * Pilots adjust sleep timing via drag handles on the homebase chronogram.
 * Edits accumulate in a Map keyed by blockKey (unique per sleep block:
 * "${dutyId}::${blockIndex}"). When the pilot clicks "Apply & Recalculate",
 * edits are grouped by dutyId (last edit per duty wins) and sent to
 * `POST /api/what-if` as `sleep_modifications[]`. The backend re-runs the
 * full Borbely simulation and returns a new AnalysisResult.
 *
 * After recalculation, the original (pre-edit) analysis is preserved in a ref
 * so the user can "Reset to Original" without re-uploading the roster.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runWhatIf } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisResults } from '@/types/fatigue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SleepEdit {
  dutyId: string;
  /** Unique per-block key: "${dutyId}::${blockIndex}" — used as Map key */
  blockKey: string;
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
  /** Whether an original (pre-recalculation) analysis is stored */
  hasOriginal: boolean;
  /** Restore the analysis to the state before any what-if recalculation */
  resetToOriginal: () => void;
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

  // Snapshot of the analysis before any what-if recalculation
  const originalAnalysisRef = useRef<AnalysisResults | null>(null);

  const activateEdit = useCallback((blockKey: string) => {
    setActiveBarId(blockKey);
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

  const clearEdits = useCallback(() => {
    setPendingEdits(new Map());
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!analysisId || pendingEdits.size === 0) {
        throw new Error('No edits to apply');
      }

      // Snapshot original analysis before first recalculation
      if (!originalAnalysisRef.current && state.analysisResults) {
        originalAnalysisRef.current = state.analysisResults;
      }

      // Group edits by dutyId — the backend accepts one modification per duty_id.
      // If multiple blocks of the same duty are edited, last one wins.
      const editsByDuty = new Map<string, SleepEdit>();
      for (const edit of pendingEdits.values()) {
        editsByDuty.set(edit.dutyId, edit);
      }

      // Convert each edit to UTC sleep modifications
      const sleepModifications = Array.from(editsByDuty.values()).map((edit) => {
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
  const hasOriginal = originalAnalysisRef.current != null;

  const applyEdits = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  const resetToOriginal = useCallback(() => {
    if (originalAnalysisRef.current) {
      setAnalysisResults(originalAnalysisRef.current);
      originalAnalysisRef.current = null;
      clearEdits();
      toast({
        title: 'Analysis restored',
        description: 'Reverted to the original analysis before sleep edits.',
      });
    }
  }, [setAnalysisResults, clearEdits, toast]);

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
    hasOriginal,
    resetToOriginal,
  }), [pendingEdits, addEdit, removeEdit, clearEdits, applyEdits, mutation.isPending, hasEdits, editCount, activeBarId, activateEdit, deactivateEdit, hasOriginal, resetToOriginal]);
}
