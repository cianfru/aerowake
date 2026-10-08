import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toPayload } from '@/lib/sleep-edits';
import { analyzeRoster, type CrewCompositionValue, type CrewOverride, type RestFacilityClass, type ULRCrewSet } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { toast } from 'sonner';
import type { NapHabit } from '@/types/fatigue';

export interface RunAnalysisOptions {
  /** The base confirmed in the review. Omit to let the backend read the roster header. */
  homeBase?: string | null;
  /** Replace the roster-header base with `homeBase` on purpose. */
  override?: boolean;
  /** Pre-duty nap habit; defaults to the pilot's setting. */
  napHabit?: NapHabit;
  /** Usual night ('HH:MM'); defaults to the pilot's setting. */
  usualBedtime?: string;
  usualWakeTime?: string;
  /** Scroll to and focus the workspace heading when done (default true). */
  reveal?: boolean;
  /** A crew change made in this same interaction (React state is not updated yet). */
  crew?: { dutyId: string; composition?: CrewCompositionValue | null; crewSet?: ULRCrewSet | null; restFacility?: RestFacilityClass | null };
}

/** Per-duty crew overrides for the request: crew sets and pilot-stated compositions. */
export function mergeCrewOverrides(
  sets: Map<string, ULRCrewSet>, compositions: Map<string, CrewCompositionValue>, patch?: RunAnalysisOptions['crew'],
  facilities: Map<string, RestFacilityClass> = new Map(),
): Map<string, CrewOverride> {
  const s = new Map(sets);
  const c = new Map(compositions);
  const f = new Map(facilities);
  if (patch) {
    if (patch.restFacility !== undefined) { if (patch.restFacility) f.set(patch.dutyId, patch.restFacility); else f.delete(patch.dutyId); }
    if (patch.composition !== undefined) { if (patch.composition) c.set(patch.dutyId, patch.composition); else c.delete(patch.dutyId); }
    if (patch.crewSet !== undefined) { if (patch.crewSet) s.set(patch.dutyId, patch.crewSet); else s.delete(patch.dutyId); }
  }
  const out = new Map<string, CrewOverride>();
  for (const id of new Set([...s.keys(), ...c.keys(), ...f.keys()])) {
    const composition = c.get(id);
    const crewSet = s.get(id);
    const facility = composition === 'standard' ? undefined : f.get(id);
    out.set(id, !composition && !facility ? crewSet! : {
      ...(composition ? { composition } : {}),
      ...(crewSet ? { crew_set: crewSet } : {}),
      ...(facility ? { rest_facility_class: facility } : {}),
    });
  }
  return out;
}

interface AnalyzeVariables extends RunAnalysisOptions {
  file: File;
}

/**
 * Bring the new workspace into view: scroll to the top and move focus to its
 * heading, so keyboard and screen-reader users start at the roster summary.
 */
export function revealAnalysis() {
  const run = () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const heading = document.querySelector<HTMLElement>('[data-analysis-heading]')
      ?? document.querySelector<HTMLElement>('main h1')
      ?? document.querySelector<HTMLElement>('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  };
  // Two frames: React commits the workspace, then the browser lays it out.
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * TanStack Query mutation for roster analysis.
 *
 * Reads file + settings from AnalysisContext, calls the backend,
 * transforms the response, and dispatches the result back into context.
 * A result for a file that is no longer selected is dropped.
 *
 * `inlineErrors`: the caller renders `error` itself, so no error toast.
 */
export function useAnalyzeRoster({ inlineErrors = false }: { inlineErrors?: boolean } = {}) {
  const { state, setAnalysisResults } = useAnalysis();
  const currentFile = useRef<File | null>(state.actualFileObject);
  currentFile.current = state.actualFileObject;

  const mutation = useMutation({
    mutationFn: async ({ file, homeBase, override, napHabit, usualBedtime, usualWakeTime, crew }: AnalyzeVariables) => {
      const base = (homeBase || '').trim().toUpperCase() || null;
      const crewOverrides = mergeCrewOverrides(state.dutyCrewOverrides, state.dutyCrewComposition, crew, state.dutyRestFacilities);
      // A re-run of the roster on screen keeps the pilot's sleep changes.
      const sleepEdits = toPayload(state.analysisResults?.sleepEdits ?? []);
      return analyzeRoster(file, state.settings.pilotId, base, crewOverrides, {
        override: !!override && !!base, napHabit: napHabit ?? state.settings.napHabit, sleepEdits,
        usualBedtime: usualBedtime ?? state.settings.usualBedtime, usualWakeTime: usualWakeTime ?? state.settings.usualWakeTime,
      });
    },
    onSuccess: (result, variables) => {
      if (variables.file !== currentFile.current) return;
      const transformed = transformAnalysisResult(result, state.settings.selectedMonth);
      setAnalysisResults(transformed);
      if (variables.reveal === false) return;
      toast.success('Analysis complete!');
      revealAnalysis();
    },
    onError: (error: Error, variables) => {
      if (inlineErrors || variables.file !== currentFile.current) return;
      toast.error('Analysis failed: ' + error.message);
    },
  });

  const runAnalysis = (options: RunAnalysisOptions = {}) => {
    const file = state.actualFileObject;
    if (!state.uploadedFile || !file) {
      if (!inlineErrors) toast.error('Please upload a roster file first');
      return;
    }
    // Without an explicit base, reuse the last confirmed one only as a
    // fallback; a roster header still wins on the server.
    const homeBase = options.homeBase ?? (state.settings.homeBase || null);
    mutation.mutate({ file, homeBase, override: options.override, napHabit: options.napHabit, usualBedtime: options.usualBedtime, usualWakeTime: options.usualWakeTime, reveal: options.reveal, crew: options.crew });
  };

  return {
    runAnalysis,
    canReanalyse: !!(state.uploadedFile && state.actualFileObject),
    isAnalyzing: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
