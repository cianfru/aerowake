import { useState } from 'react';
import { AlertTriangle, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chronogram } from '@/components/fatigue/Chronogram';
import { PinchEventAlerts } from '@/components/fatigue/PinchEventAlerts';
import { DutyDetailsDialog } from '@/components/fatigue/DutyDetailsDialog';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { getRoster } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import type { RosterSummary } from '@/lib/api-client';

// ── Helpers ──────────────────────────────────────────────────

function formatMonth(month: string) {
  try {
    const [year, m] = month.split('-');
    return new Date(Number(year), Number(m) - 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return month;
  }
}

// ── Main Component ───────────────────────────────────────────

export function DashboardContent() {
  const {
    state,
    selectDuty,
    setDrawerOpen,
    setCrewOverride,
    setActiveTab,
    loadAnalysis,
  } = useAnalysis();

  const { isAuthenticated } = useAuth();
  const { rosters } = useRosterHistory();

  const [rosterDropdownOpen, setRosterDropdownOpen] = useState(false);
  const [loadingRosterId, setLoadingRosterId] = useState<string | null>(null);

  const {
    settings,
    uploadedFile,
    analysisResults,
    selectedDuty,
    drawerOpen,
    dutyCrewOverrides,
  } = state;

  const handleSelectRoster = async (roster: RosterSummary) => {
    if (!roster.analysis_id) return;
    setLoadingRosterId(roster.id);
    setRosterDropdownOpen(false);
    try {
      const detail = await getRoster(roster.id);
      if (detail.analysis) {
        const [year, month] = (roster.month || '2026-01').split('-');
        const fallbackMonth = new Date(Number(year), Number(month) - 1, 1);
        const transformed = transformAnalysisResult(detail.analysis, fallbackMonth);
        loadAnalysis(transformed);
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoadingRosterId(null);
    }
  };

  // Figure out which roster matches the current analysis
  const currentAnalysisId = analysisResults?.analysisId;
  const currentRoster = rosters.find(r => r.analysis_id === currentAnalysisId);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">

        {/* Roster selector dropdown (only for auth users with stored rosters) */}
        {isAuthenticated && rosters.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setRosterDropdownOpen(!rosterDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 border border-border/50 transition-colors text-sm w-full md:w-auto"
            >
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">
                {loadingRosterId ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </span>
                ) : currentRoster ? (
                  <span>
                    {formatMonth(currentRoster.month)}
                    <span className="text-muted-foreground ml-2 text-xs">{currentRoster.filename}</span>
                  </span>
                ) : analysisResults ? (
                  <span>
                    {analysisResults.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    <span className="text-muted-foreground ml-2 text-xs">Current upload</span>
                  </span>
                ) : (
                  'Select a roster...'
                )}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${rosterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {rosterDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setRosterDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 z-50 w-full md:w-80 rounded-lg border border-border/50 glass-strong shadow-lg overflow-hidden">
                  {rosters.map((roster) => {
                    const isActive = roster.analysis_id === currentAnalysisId;
                    return (
                      <button
                        key={roster.id}
                        onClick={() => handleSelectRoster(roster)}
                        disabled={!roster.analysis_id}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-secondary/50 text-foreground'
                        } ${!roster.analysis_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{formatMonth(roster.month)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{roster.filename}</p>
                        </div>
                        {roster.total_duties != null && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {roster.total_duties} duties
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {analysisResults && (
          <div className="space-y-4 md:space-y-6 animate-fade-in">
            {/* ULR Violations Warning */}
            {analysisResults.statistics.ulrViolations.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-critical/50 bg-critical/10 p-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-critical" />
                <div>
                  <p className="font-medium text-critical">
                    ULR COMPLIANCE: {analysisResults.statistics.ulrViolations.length} violation(s) detected
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {analysisResults.statistics.ulrViolations.map((v, i) => (
                      <li key={i}>- {v}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Pinch Event Alerts */}
            <PinchEventAlerts duties={analysisResults.duties} />

            {/* Monthly Chronogram — now with pilot details */}
            <Chronogram
              duties={analysisResults.duties}
              statistics={analysisResults.statistics}
              month={analysisResults.month}
              pilotId={settings.pilotId}
              pilotName={analysisResults.pilotName}
              pilotBase={analysisResults.pilotBase}
              pilotAircraft={analysisResults.pilotAircraft}
              onDutySelect={selectDuty}
              selectedDuty={selectedDuty}
              restDaysSleep={analysisResults.restDaysSleep}
              analysisId={analysisResults.analysisId}
            />
          </div>
        )}

        {!analysisResults && uploadedFile && (
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <span className="text-5xl md:text-6xl">📊</span>
              <h3 className="text-lg md:text-xl font-semibold">Ready to Analyze</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Click "Run Analysis" on the Rosters page to generate your fatigue analysis.
              </p>
            </div>
          </Card>
        )}

        {!analysisResults && !uploadedFile && (
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <span className="text-5xl md:text-6xl">📄</span>
              <h3 className="text-lg md:text-xl font-semibold">No Roster Uploaded</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Go to the{' '}
                <button
                  onClick={() => setActiveTab('rosters')}
                  className="text-primary hover:underline font-medium"
                >
                  Rosters page
                </button>
                {' '}to upload a roster file and get started.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Duty Details Dialog (full-screen, two-column) */}
      <DutyDetailsDialog
        duty={selectedDuty}
        analysisId={analysisResults?.analysisId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        globalCrewSet={settings.crewSet}
        dutyCrewOverride={dutyCrewOverrides.get(selectedDuty?.dutyId || '')}
        onCrewChange={setCrewOverride}
      />
    </div>
  );
}
