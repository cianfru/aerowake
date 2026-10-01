import { useAnalyzeRoster, type RunAnalysisOptions } from '@/hooks/useAnalyzeRoster';
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

/**
 * The roster identity stays above the navigable views. The pilot's name is
 * deliberately left out so screenshots can be shared: base, fleet, month and
 * duty count are enough to recognise the roster.
 */
function RosterHeader({ results, onNewRoster }: { results: AnalysisResults; onNewRoster: () => void }) {
  const facts = [
    `${results.duties.length} ${results.duties.length === 1 ? 'duty' : 'duties'}`,
    results.pilotBase ? `${results.pilotBase} base` : null,
    results.pilotAircraft || null,
  ].filter(Boolean).join(' · ');
  return <header className="roster-identity flex flex-wrap items-start justify-between gap-5">
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium text-hero-muted">Your roster</p>
      <h1 data-analysis-heading tabIndex={-1} className="text-3xl font-semibold tracking-tight focus:outline-none md:text-[2.75rem] md:leading-tight">{monthLabel(results)}</h1>
      <p className="text-sm text-hero-muted">{facts}</p>
    </div>
    <button type="button" onClick={onNewRoster} className="flex shrink-0 items-center gap-2 rounded-full border border-hero-on/30 bg-hero-on/10 px-4 py-2.5 text-sm transition-colors hover:bg-hero-on/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hero-on">
      <RotateCcw className="h-4 w-4" aria-hidden="true" />New roster
    </button>
  </header>;
}

/**
 * Roster: upload and review, then five focused views of the same analysis.
 */
export function RosterPage() {
  const {
    state, selectDuty, setDrawerOpen, setCrewOverride, clearCrewOverride, setCrewComposition,
    removeFile, openFatigueReportForDuty,
  } = useAnalysis();
  const { analysisResults: results, selectedDuty, drawerOpen, dutyCrewOverrides, dutyCrewComposition, settings } = state;
  const { runAnalysis, canReanalyse } = useAnalyzeRoster();
  // Crew changes re-run the analysis in place when the roster file is loaded.
  const rerun = (crew: RunAnalysisOptions['crew']) => { if (canReanalyse) runAnalysis({ crew, reveal: false }); };
  // After a re-run, show the same duty from the new results.
  const liveDuty = (selectedDuty && results?.duties.find((d) => d.dutyId && d.dutyId === selectedDuty.dutyId)) || selectedDuty;

  const reportFatigue = (duty: DutyAnalysis) => {
    if (duty.dutyId) openFatigueReportForDuty(duty.dutyId);
  };

  if (!results) {
    return (
      <div className="flex-1 px-4 py-10 md:py-16">
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
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
        duty={liveDuty}
        analysisId={results.analysisId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        homeTz={results.homeBaseTimezone}
        homeBase={results.pilotBase || settings.homeBase}
        dutyCrewOverride={dutyCrewOverrides.get(selectedDuty?.dutyId || '')}
        onCrewChange={(id, crewSet) => { setCrewOverride(id, crewSet); rerun({ dutyId: id, crewSet }); }}
        onCrewReset={(id) => { clearCrewOverride(id); rerun({ dutyId: id, crewSet: null }); }}
        crewCompositionOverride={dutyCrewComposition.get(selectedDuty?.dutyId || '') ?? null}
        onCrewCompositionChange={(id, composition) => { setCrewComposition(id, composition); rerun({ dutyId: id, composition }); }}
        onReportFatigue={reportFatigue}
      />
      <AirlineDetectionPrompt />
    </div>
  );
}
