import { X, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SettingsSidebar } from '@/components/fatigue/SettingsSidebar';
import { Chronogram } from '@/components/fatigue/Chronogram';
import { PinchEventAlerts } from '@/components/fatigue/PinchEventAlerts';
import { DutyDetailsDialog } from '@/components/fatigue/DutyDetailsDialog';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { useTheme } from '@/hooks/useTheme';
import { PilotSettings } from '@/types/fatigue';

export function DashboardContent() {
  const {
    state,
    setSettings,
    uploadFile,
    removeFile,
    selectDuty,
    setDrawerOpen,
    setSidebarOpen,
    setCrewOverride,
  } = useAnalysis();
  const { runAnalysis, isAnalyzing } = useAnalyzeRoster();
  const { setTheme } = useTheme();

  const {
    settings,
    uploadedFile,
    analysisResults,
    selectedDuty,
    drawerOpen,
    sidebarOpen,
    dutyCrewOverrides,
  } = state;

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    if (newSettings.theme) {
      setTheme(newSettings.theme);
    }
    setSettings(newSettings);
  };

  return (
    <div className="flex flex-1 relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Settings Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 md:hidden z-10"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="h-full overflow-y-auto glass-strong border-r border-border/30">
          <SettingsSidebar
            settings={settings}
            onSettingsChange={handleSettingsChange}
            uploadedFile={uploadedFile}
            onFileUpload={uploadFile}
            onRemoveFile={removeFile}
            onRunAnalysis={() => runAnalysis()}
            isAnalyzing={isAnalyzing}
            hasResults={!!analysisResults}
            pilotInfo={analysisResults ? {
              name: analysisResults.pilotName,
              id: analysisResults.pilotId,
              base: analysisResults.pilotBase || settings.homeBase,
              aircraft: analysisResults.pilotAircraft,
            } : undefined}
          />
        </div>
      </div>

      {/* Main Content - Analysis focused */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
                  Click "Run Analysis" in the sidebar to generate your fatigue analysis.
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
                  Upload a roster file using the sidebar to get started.
                </p>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Duty Details Dialog (full-screen, tabbed) */}
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
