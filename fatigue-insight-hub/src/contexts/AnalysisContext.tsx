import type { CrewCompositionValue } from '@/lib/api-client';
import { createContext, useContext, useReducer, useEffect, useRef, useState, type ReactNode } from 'react';
import { offlineStore } from '@/lib/offline-store';
import { DEFAULT_NAP_HABIT, PilotSettings, UploadedFile, AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { loadPersistedSettings, savePersistedSettings } from '@/hooks/usePersistedSettings';
import { applyTab, type HubId, type SubTab } from '@/lib/navigation';

// ── State ────────────────────────────────────────────────────

export interface AnalysisState {
  settings: PilotSettings;
  uploadedFile: UploadedFile | null;
  actualFileObject: File | null;
  analysisResults: AnalysisResults | null;
  selectedDuty: DutyAnalysis | null;
  drawerOpen: boolean;
  /** Active hub: 'roster' | 'fatigue-report' | 'history' | 'learn'. */
  activeTab: HubId;
  /** Sub-tab inside the History / Learn hubs. */
  activeSubTab: SubTab | null;
  /** One-shot prefill for the fatigue-report wizard ("Report fatigue" on a duty). */
  fatigueReportPrefill: { dutyId: string; purpose?: 'roster_concern'; watchReference?: number } | null;
  dutyCrewOverrides: Map<string, 'crew_a' | 'crew_b'>;
  /** Pilot-stated crew per duty (the roster only marks 4-pilot crews reliably). */
  dutyCrewComposition: Map<string, CrewCompositionValue>;
  showLanding: boolean;
}

const DEFAULT_SETTINGS: PilotSettings = {
  pilotId: 'P12345',
  homeBase: '', // never assume a base — the pilot confirms it before analysis
  napHabit: DEFAULT_NAP_HABIT,
  analysisType: 'single',
  selectedMonth: new Date(2026, 1, 1),
  theme: 'light',
};

function buildInitialState(initial: Partial<PilotSettings> = {}): AnalysisState {
  // Account preferences (signed in) win over what this device remembered.
  const persisted = { ...loadPersistedSettings(), ...initial };
  // Once the user has dismissed the landing page, remember it
  const landingDismissed = localStorage.getItem('aerowake_landing_dismissed') === 'true';
  return {
    settings: { ...DEFAULT_SETTINGS, ...persisted, theme: localStorage.getItem('fatigue-theme') === 'dark' ? 'dark' : 'light' },
    uploadedFile: null,
    actualFileObject: null,
    analysisResults: null,
    selectedDuty: null,
    drawerOpen: false,
    activeTab: 'roster',
    activeSubTab: null,
    fatigueReportPrefill: null,
    dutyCrewOverrides: new Map(),
    dutyCrewComposition: new Map(),
    showLanding: !landingDismissed,
  };
}

// ── Actions ──────────────────────────────────────────────────

type AnalysisAction =
  | { type: 'SET_SETTINGS'; payload: Partial<PilotSettings> }
  | { type: 'SET_UPLOADED_FILE'; payload: { meta: UploadedFile; file: File } }
  | { type: 'SET_ANALYSIS_RESULTS'; payload: AnalysisResults }
  | { type: 'SELECT_DUTY'; payload: DutyAnalysis }
  | { type: 'CLEAR_SELECTED_DUTY' }
  | { type: 'TOGGLE_DRAWER'; payload?: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_SUB_TAB'; payload: SubTab }
  | { type: 'SET_FATIGUE_REPORT_PREFILL'; payload: AnalysisState['fatigueReportPrefill'] }
  | { type: 'SET_CREW_OVERRIDE'; payload: { dutyId: string; crewSet: 'crew_a' | 'crew_b' } }
  | { type: 'CLEAR_CREW_OVERRIDE'; payload: { dutyId: string } }
  | { type: 'SET_CREW_COMPOSITION'; payload: { dutyId: string; composition: CrewCompositionValue | null } }
  | { type: 'REMOVE_FILE' }
  | { type: 'SET_SHOW_LANDING'; payload: boolean }
  | { type: 'LOAD_ANALYSIS'; payload: AnalysisResults }
  | { type: 'LOAD_ANALYSIS_TO_SUMMARY'; payload: AnalysisResults }
  | { type: 'RESET' };

// ── Reducer ──────────────────────────────────────────────────

function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'SET_UPLOADED_FILE':
      return {
        ...state,
        uploadedFile: action.payload.meta,
        actualFileObject: action.payload.file,
        analysisResults: null,
        selectedDuty: null,
      };

    case 'SET_ANALYSIS_RESULTS':
      return { ...state, analysisResults: action.payload };

    case 'SELECT_DUTY':
      return { ...state, selectedDuty: action.payload, drawerOpen: true };

    case 'CLEAR_SELECTED_DUTY':
      return { ...state, selectedDuty: null, drawerOpen: false };

    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: action.payload ?? !state.drawerOpen };

    case 'SET_ACTIVE_TAB':
      return { ...state, ...applyTab(state, action.payload) };

    case 'SET_SUB_TAB':
      return { ...state, activeSubTab: action.payload };

    case 'SET_FATIGUE_REPORT_PREFILL':
      return { ...state, fatigueReportPrefill: action.payload };

    case 'SET_CREW_OVERRIDE': {
      const updated = new Map(state.dutyCrewOverrides);
      updated.set(action.payload.dutyId, action.payload.crewSet);
      return { ...state, dutyCrewOverrides: updated };
    }

    case 'SET_CREW_COMPOSITION': {
      const updated = new Map(state.dutyCrewComposition);
      if (action.payload.composition) updated.set(action.payload.dutyId, action.payload.composition);
      else updated.delete(action.payload.dutyId);
      return { ...state, dutyCrewComposition: updated };
    }

    case 'CLEAR_CREW_OVERRIDE': {
      const updated = new Map(state.dutyCrewOverrides);
      updated.delete(action.payload.dutyId);
      return { ...state, dutyCrewOverrides: updated };
    }

    case 'REMOVE_FILE':
      return {
        ...state,
        uploadedFile: null,
        actualFileObject: null,
        analysisResults: null,
        selectedDuty: null,
        dutyCrewOverrides: new Map(),
        dutyCrewComposition: new Map(),
      };

    case 'SET_SHOW_LANDING':
      if (!action.payload) {
        localStorage.setItem('aerowake_landing_dismissed', 'true');
      }
      return { ...state, showLanding: action.payload };

    case 'LOAD_ANALYSIS':
      localStorage.setItem('aerowake_landing_dismissed', 'true');
      return {
        ...state,
        analysisResults: action.payload,
        selectedDuty: null,
        drawerOpen: false,
        activeTab: 'roster',
        showLanding: false,
      };

    case 'LOAD_ANALYSIS_TO_SUMMARY':
      localStorage.setItem('aerowake_landing_dismissed', 'true');
      return {
        ...state,
        analysisResults: action.payload,
        selectedDuty: null,
        drawerOpen: false,
        activeTab: 'roster',
        showLanding: false,
      };

    case 'RESET':
      return { ...buildInitialState(), settings: state.settings };

    default:
      return state;
  }
}

// ── Context + Hook ───────────────────────────────────────────

interface AnalysisContextValue {
  state: AnalysisState;
  dispatch: React.Dispatch<AnalysisAction>;
  // Convenience action creators
  setSettings: (s: Partial<PilotSettings>) => void;
  uploadFile: (meta: UploadedFile, file: File) => void;
  setAnalysisResults: (r: AnalysisResults) => void;
  selectDuty: (d: DutyAnalysis) => void;
  clearSelectedDuty: () => void;
  setDrawerOpen: (open: boolean) => void;
  /** Accepts hub ids and legacy tab ids ('analysis', 'rosters', 'about', …). */
  setActiveTab: (tab: string) => void;
  setSubTab: (sub: SubTab) => void;
  /** Open the fatigue-report wizard pre-filled for a duty. */
  openFatigueReportForDuty: (dutyId: string, options?: { purpose: 'roster_concern'; watchReference: number }) => void;
  clearFatigueReportPrefill: () => void;
  setCrewOverride: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
  clearCrewOverride: (dutyId: string) => void;
  /** null returns the duty to the crew read from the roster. */
  setCrewComposition: (dutyId: string, composition: CrewCompositionValue | null) => void;
  removeFile: () => void;
  setShowLanding: (show: boolean) => void;
  loadAnalysis: (r: AnalysisResults) => void;
  loadAnalysisToSummary: (r: AnalysisResults) => void;
  /** When the roster on screen was reopened from this device (offline copy), its save time. */
  restoredFromDeviceAt: string | null;
  /** Remove the offline copy of the roster from this device. */
  forgetDeviceCopy: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children, initialSettings, owner = 'guest' }: {
  children: ReactNode; initialSettings?: Partial<PilotSettings>;
  /** Whose device copy to keep and reopen: the user id, or 'guest'. */
  owner?: string;
}) {
  const [state, dispatch] = useReducer(analysisReducer, initialSettings, buildInitialState);
  const [restoredFromDeviceAt, setRestoredAt] = useState<string | null>(null);
  const restored = useRef<AnalysisResults | null>(null);
  const loaded = useRef(false);
  const latest = useRef(state.analysisResults);
  latest.current = state.analysisResults;

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    savePersistedSettings(state.settings);
  }, [state.settings]);

  // Offline use: reopen the last roster saved on this device, then keep the copy current.
  useEffect(() => {
    let live = true;
    void offlineStore.loadAnalysis(owner).then((saved) => {
      if (!live) return;
      loaded.current = true;
      if (saved?.results && !latest.current) {
        restored.current = saved.results;
        setRestoredAt(saved.savedAt);
        dispatch({ type: 'SET_ANALYSIS_RESULTS', payload: saved.results });
      } else if (latest.current) {
        void offlineStore.saveAnalysis(owner, latest.current);
      }
    });
    return () => { live = false; };
  }, [owner]);

  useEffect(() => {
    if (!state.analysisResults || !loaded.current) return;
    if (state.analysisResults !== restored.current) {
      setRestoredAt(null);
      void offlineStore.saveAnalysis(owner, state.analysisResults);
    }
  }, [state.analysisResults, owner]);

  const value: AnalysisContextValue = {
    state,
    dispatch,
    setSettings: (s) => dispatch({ type: 'SET_SETTINGS', payload: s }),
    uploadFile: (meta, file) => dispatch({ type: 'SET_UPLOADED_FILE', payload: { meta, file } }),
    setAnalysisResults: (r) => dispatch({ type: 'SET_ANALYSIS_RESULTS', payload: r }),
    selectDuty: (d) => dispatch({ type: 'SELECT_DUTY', payload: d }),
    clearSelectedDuty: () => dispatch({ type: 'CLEAR_SELECTED_DUTY' }),
    setDrawerOpen: (open) => dispatch({ type: 'TOGGLE_DRAWER', payload: open }),
    setActiveTab: (tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
    setSubTab: (sub) => dispatch({ type: 'SET_SUB_TAB', payload: sub }),
    openFatigueReportForDuty: (dutyId, options) => {
      dispatch({ type: 'SET_FATIGUE_REPORT_PREFILL', payload: { dutyId, ...options } });
      dispatch({ type: 'CLEAR_SELECTED_DUTY' });
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'fatigue-report' });
    },
    clearFatigueReportPrefill: () => dispatch({ type: 'SET_FATIGUE_REPORT_PREFILL', payload: null }),
    setCrewOverride: (dutyId, crewSet) =>
      dispatch({ type: 'SET_CREW_OVERRIDE', payload: { dutyId, crewSet } }),
    clearCrewOverride: (dutyId) =>
      dispatch({ type: 'CLEAR_CREW_OVERRIDE', payload: { dutyId } }),
    setCrewComposition: (dutyId, composition) =>
      dispatch({ type: 'SET_CREW_COMPOSITION', payload: { dutyId, composition } }),
    removeFile: () => { dispatch({ type: 'REMOVE_FILE' }); setRestoredAt(null); void offlineStore.removeAnalysis(owner); },
    setShowLanding: (show) => dispatch({ type: 'SET_SHOW_LANDING', payload: show }),
    loadAnalysis: (r) => dispatch({ type: 'LOAD_ANALYSIS', payload: r }),
    loadAnalysisToSummary: (r) => dispatch({ type: 'LOAD_ANALYSIS_TO_SUMMARY', payload: r }),
    restoredFromDeviceAt,
    forgetDeviceCopy: () => { setRestoredAt(null); void offlineStore.removeAnalysis(owner); },
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider');
  return ctx;
}
