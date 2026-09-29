import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { useAnalysis } from '@/contexts/AnalysisContext';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { DutyDetailsDialog } from '../DutyDetailsDialog';
import { RosterUploadCard } from './RosterUploadCard';
import { RosterWorkspace } from './RosterWorkspace';
import { AirlineDetectionPrompt } from './AirlineDetectionPrompt';

function monthLabel(results: AnalysisResults): string {
  try {
    return format(results.month, 'MMMM yyyy');
  } catch {
    return '';
  }
}

/** The roster identity stays above the navigable views. */
function RosterHeader({ results, onNewRoster }: { results: AnalysisResults; onNewRoster: () => void }) {
  const pilotLine = [results.pilotName, results.pilotBase, results.pilotAircraft].filter(Boolean).join(' · ');
  return <header className="flex items-start justify-between gap-4">
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium text-primary">Your roster</p>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{monthLabel(results)}</h1>
      <p className="text-sm text-muted-foreground">{results.duties.length} {results.duties.length === 1 ? 'duty' : 'duties'}{pilotLine ? ` · ${pilotLine}` : ''}</p>
    </div>
    <button type="button" onClick={onNewRoster} className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <RotateCcw className="h-4 w-4" aria-hidden="true" />New roster
    </button>
  </header>;
}

/**
 * Roster: upload and review, then five focused views of the same analysis.
 */
export function RosterPage() {
  const {
    state, selectDuty, setDrawerOpen, setCrewOverride, clearCrewOverride,
    removeFile, openFatigueReportForDuty,
  } = useAnalysis();
  const { analysisResults: results, selectedDuty, drawerOpen, dutyCrewOverrides, settings } = state;

  const reportFatigue = (duty: DutyAnalysis) => {
    if (duty.dutyId) openFatigueReportForDuty(duty.dutyId);
  };

  if (!results) {
    return (
      <div className="flex-1 px-4 py-10 md:py-16">
        <div className="mx-auto max-w-xl space-y-4 animate-fade-in">
          <RosterUploadCard />
          <AirlineDetectionPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl min-w-0 space-y-8 animate-fade-in">
        <RosterHeader results={results} onNewRoster={removeFile} />
        <RosterWorkspace
          results={results}
          pilotId={settings.pilotId}
          homeBase={settings.homeBase}
          selectedDuty={selectedDuty}
          onDutySelect={selectDuty}
          onReportFatigue={reportFatigue}
          onConcern={(duty, watchReference) => {
            if (duty.dutyId) openFatigueReportForDuty(duty.dutyId, { purpose: 'roster_concern', watchReference });
          }}
        />
      </div>

      <DutyDetailsDialog
        duty={selectedDuty}
        analysisId={results.analysisId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        dutyCrewOverride={dutyCrewOverrides.get(selectedDuty?.dutyId || '')}
        onCrewChange={setCrewOverride}
        onCrewReset={clearCrewOverride}
        onReportFatigue={reportFatigue}
      />
      <AirlineDetectionPrompt />
    </div>
  );
}
