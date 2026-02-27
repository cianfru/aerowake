import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { PilotSettings, UploadedFile, AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { loadPersistedSettings, savePersistedSettings } from '@/hooks/usePersistedSettings';

// ── State ────────────────────────────────────────────────────

export type ExpandedPanel = 'rosters' | 'settings' | null;

export interface AnalysisState {
  settings: PilotSettings;
  uploadedFile: UploadedFile | null;
  actualFileObject: File | null;
  analysisResults: AnalysisResults | null;
  selectedDuty: DutyAnalysis | null;
  drawerOpen: boolean;
  expandedPanel: ExpandedPanel;
  mobileNavOpen: boolean;
  activeTab: string;
  dutyCrewOverrides: Map<string, 'crew_a' | 'crew_b'>;
  showLanding: boolean;
}

const DEFAULT_SETTINGS: PilotSettings = {
  pilotId: 'P12345',
  homeBase: 'DOH',
  analysisType: 'single',
  selectedMonth: new Date(2026, 1, 1),
  theme: 'dark',
  configPreset: 'default',
  crewSet: 'crew_b',
};

function buildInitialState(): AnalysisState {
  const persisted = loadPersistedSettings();
  return {
    settings: { ...DEFAULT_SETTINGS, ...persisted },
    uploadedFile: null,
    actualFileObject: null,
    analysisResults: null,
    selectedDuty: null,
    drawerOpen: false,
    expandedPanel: null,
    mobileNavOpen: false,
    activeTab: 'analysis',
    dutyCrewOverrides: new Map(),
    showLanding: true,
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
  | { type: 'SET_EXPANDED_PANEL'; payload: ExpandedPanel }
  | { type: 'TOGGLE_PANEL'; payload: 'rosters' | 'settings' }
  | { type: 'SET_MOBILE_NAV_OPEN'; payload: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_CREW_OVERRIDE'; payload: { dutyId: string; crewSet: 'crew_a' | 'crew_b' } }
  | { type: 'REMOVE_FILE' }
  | { type: 'SET_SHOW_LANDING'; payload: boolean }
  | { type: 'LOAD_ANALYSIS'; payload: AnalysisResults }
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

    case 'SET_EXPANDED_PANEL':
      return { ...state, expandedPanel: action.payload };

    case 'TOGGLE_PANEL':
      return {
        ...state,
        expandedPanel: state.expandedPanel === action.payload ? null : action.payload,
      };

    case 'SET_MOBILE_NAV_OPEN':
      return { ...state, mobileNavOpen: action.payload };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload, expandedPanel: null };

    case 'SET_CREW_OVERRIDE': {
      const updated = new Map(state.dutyCrewOverrides);
      if (action.payload.crewSet === state.settings.crewSet) {
        updated.delete(action.payload.dutyId);
      } else {
        updated.set(action.payload.dutyId, action.payload.crewSet);
      }
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
      };

    case 'SET_SHOW_LANDING':
      return { ...state, showLanding: action.payload };

    case 'LOAD_ANALYSIS':
      return {
        ...state,
        analysisResults: action.payload,
        selectedDuty: null,
        drawerOpen: false,
        expandedPanel: null,
        activeTab: 'analysis',
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
  setExpandedPanel: (panel: ExpandedPanel) => void;
  togglePanel: (panel: 'rosters' | 'settings') => void;
  setMobileNavOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setCrewOverride: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
  removeFile: () => void;
  setShowLanding: (show: boolean) => void;
  loadAnalysis: (r: AnalysisResults) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(analysisReducer, undefined, buildInitialState);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    savePersistedSettings(state.settings);
  }, [state.settings]);

  const value: AnalysisContextValue = {
    state,
    dispatch,
    setSettings: (s) => dispatch({ type: 'SET_SETTINGS', payload: s }),
    uploadFile: (meta, file) => dispatch({ type: 'SET_UPLOADED_FILE', payload: { meta, file } }),
    setAnalysisResults: (r) => dispatch({ type: 'SET_ANALYSIS_RESULTS', payload: r }),
    selectDuty: (d) => dispatch({ type: 'SELECT_DUTY', payload: d }),
    clearSelectedDuty: () => dispatch({ type: 'CLEAR_SELECTED_DUTY' }),
    setDrawerOpen: (open) => dispatch({ type: 'TOGGLE_DRAWER', payload: open }),
    setExpandedPanel: (panel) => dispatch({ type: 'SET_EXPANDED_PANEL', payload: panel }),
    togglePanel: (panel) => dispatch({ type: 'TOGGLE_PANEL', payload: panel }),
    setMobileNavOpen: (open) => dispatch({ type: 'SET_MOBILE_NAV_OPEN', payload: open }),
    setActiveTab: (tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
    setCrewOverride: (dutyId, crewSet) =>
      dispatch({ type: 'SET_CREW_OVERRIDE', payload: { dutyId, crewSet } }),
    removeFile: () => dispatch({ type: 'REMOVE_FILE' }),
    setShowLanding: (show) => dispatch({ type: 'SET_SHOW_LANDING', payload: show }),
    loadAnalysis: (r) => dispatch({ type: 'LOAD_ANALYSIS', payload: r }),
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider');
  return ctx;
}
