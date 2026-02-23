import { useReducer, useCallback, useMemo } from 'react';
import { GitCompareArrows, LogIn, Upload, RotateCcw, Play, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useWhatIfAnalysis } from '@/hooks/useWhatIfAnalysis';
import { DutyModification, AnalysisResults } from '@/types/fatigue';
import { DutyEditorList } from './whatif/DutyEditorList';
import { DeltaSummaryCards } from './whatif/DeltaSummaryCards';
import { ComparisonChart } from './whatif/ComparisonChart';
import { DutyComparisonTable } from './whatif/DutyComparisonTable';
import { WhatIfEmptyComparison } from './whatif/WhatIfEmptyComparison';
import { toast } from 'sonner';

// --- Local state management ---

interface WhatIfState {
  modifications: Map<string, DutyModification>;
  expandedDutyId: string | null;
}

type WhatIfAction =
  | { type: 'SET_MODIFICATION'; payload: DutyModification }
  | { type: 'REMOVE_MODIFICATION'; dutyId: string }
  | { type: 'RESET_ALL' }
  | { type: 'SET_EXPANDED'; dutyId: string | null };

function whatIfReducer(state: WhatIfState, action: WhatIfAction): WhatIfState {
  switch (action.type) {
    case 'SET_MODIFICATION': {
      const next = new Map(state.modifications);
      next.set(action.payload.dutyId, action.payload);
      return { ...state, modifications: next };
    }
    case 'REMOVE_MODIFICATION': {
      const next = new Map(state.modifications);
      next.delete(action.dutyId);
      return { ...state, modifications: next };
    }
    case 'RESET_ALL':
      return { modifications: new Map(), expandedDutyId: null };
    case 'SET_EXPANDED':
      return { ...state, expandedDutyId: action.dutyId };
    default:
      return state;
  }
}

const initialState: WhatIfState = {
  modifications: new Map(),
  expandedDutyId: null,
};

// --- Component ---

export function WhatIfPage() {
  const { isAuthenticated } = useAuth();
  const { state: analysisState, setActiveTab } = useAnalysis();
  const { runScenario, isRunning, whatIfResults, error, reset } = useWhatIfAnalysis();
  const [state, dispatch] = useReducer(whatIfReducer, initialState);

  const original = analysisState.analysisResults;
  const modCount = state.modifications.size;

  const handleModification = useCallback((mod: DutyModification) => {
    // If all values are default, remove the modification
    const isDefault =
      mod.reportShiftMinutes === 0 &&
      mod.releaseShiftMinutes === 0 &&
      !mod.crewComposition &&
      !mod.crewSet &&
      !mod.excluded;

    if (isDefault) {
      dispatch({ type: 'REMOVE_MODIFICATION', dutyId: mod.dutyId });
    } else {
      dispatch({ type: 'SET_MODIFICATION', payload: mod });
    }
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET_ALL' });
    reset();
  }, [reset]);

  const handleRun = useCallback(() => {
    const mods = Array.from(state.modifications.values());
    if (mods.length === 0) {
      toast.info('Make some modifications first');
      return;
    }
    runScenario(mods, {
      onSuccess: () => toast.success('Scenario complete!'),
      onError: (err: Error) => toast.error(err.message),
    });
  }, [state.modifications, runScenario]);

  const handleExpand = useCallback((dutyId: string | null) => {
    dispatch({ type: 'SET_EXPANDED', dutyId });
  }, []);

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to use the What-If scenario editor.
            </p>
            <a href="/login">
              <Button variant="glow" size="sm">Sign In</Button>
            </a>
          </Card>
        </div>
      </div>
    );
  }

  // No analysis loaded
  if (!original) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">What-If Scenario Editor</h2>
          </div>
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Analysis Required</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Upload and analyze a roster first to use the What-If scenario editor.
              Modify duty times, crew composition, or exclude duties to see how fatigue predictions change.
            </p>
            <Button variant="glow" size="sm" onClick={() => setActiveTab('analysis')}>
              Go to Analysis
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">What-If Scenario Editor</h2>
            {modCount > 0 && (
              <Badge variant="warning" className="text-xs">
                {modCount} modification{modCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={modCount === 0 && !whatIfResults}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset All
            </Button>
            <Button
              variant="glow"
              size="sm"
              onClick={handleRun}
              disabled={modCount === 0 || isRunning}
              className="text-xs"
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              Run Scenario
            </Button>
          </div>
        </div>

        {/* Main layout: editor + comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left panel: Duty Editor */}
          <div className="lg:col-span-4">
            <DutyEditorList
              duties={original.duties}
              modifications={state.modifications}
              expandedDutyId={state.expandedDutyId}
              onModification={handleModification}
              onExpand={handleExpand}
            />
          </div>

          {/* Right panel: Comparison View */}
          <div className="lg:col-span-8 space-y-4 md:space-y-6">
            {whatIfResults ? (
              <>
                <DeltaSummaryCards original={original} whatIf={whatIfResults} />
                <ComparisonChart original={original} whatIf={whatIfResults} />
                <DutyComparisonTable
                  original={original}
                  whatIf={whatIfResults}
                  modifications={state.modifications}
                />
              </>
            ) : (
              <WhatIfEmptyComparison hasModifications={modCount > 0} />
            )}

            {error && (
              <Card variant="glass" className="p-4 border-destructive/30">
                <p className="text-sm text-destructive">{error.message}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
