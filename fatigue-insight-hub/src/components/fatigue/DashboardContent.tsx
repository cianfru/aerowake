import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chronogram } from '@/components/fatigue/Chronogram';
import { PinchEventAlerts } from '@/components/fatigue/PinchEventAlerts';
import { DutyDetailsDialog } from '@/components/fatigue/DutyDetailsDialog';
import { useAnalysis } from '@/contexts/AnalysisContext';

export function DashboardContent() {
  const {
    state,
    selectDuty,
    setDrawerOpen,
    setCrewOverride,
    togglePanel,
  } = useAnalysis();

  const {
    settings,
    uploadedFile,
    analysisResults,
    selectedDuty,
    drawerOpen,
    dutyCrewOverrides,
  } = state;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
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

            {/* Monthly Chronogram */}
            <Chronogram
              duties={analysisResults.duties}
              statistics={analysisResults.statistics}
              month={analysisResults.month}
              pilotId={settings.pilotId}
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
                Click "Run Analysis" in the Rosters panel to generate your fatigue analysis.
              </p>
            </div>
          </Card>
        )}

        {!uploadedFile && (
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <span className="text-5xl md:text-6xl">📄</span>
              <h3 className="text-lg md:text-xl font-semibold">No Roster Uploaded</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Open the{' '}
                <button
                  onClick={() => togglePanel('rosters')}
                  className="text-primary hover:underline font-medium"
                >
                  Rosters panel
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
