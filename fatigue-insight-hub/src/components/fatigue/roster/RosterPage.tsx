import { useMemo } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Eye, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/contexts/AnalysisContext';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { DutyDetailsDialog } from '../DutyDetailsDialog';
import { ExportOptions } from '../ExportOptions';
import { RosterUploadCard } from './RosterUploadCard';
import { DutyWatchCard } from './DutyWatchCard';
import { EasaChecksCard } from './EasaChecksCard';
import { AllDutiesList } from './AllDutiesList';
import { TimelineSection } from './TimelineSection';
import { AirlineDetectionPrompt } from './AirlineDetectionPrompt';
import { selectDutiesToWatch } from './roster-utils';

function monthLabel(results: AnalysisResults): string {
  try {
    return format(results.month, 'MMMM yyyy');
  } catch {
    return '';
  }
}

/** Verdict: month · duties · how many to watch; pilot details underneath. */
function VerdictLine({ results, watchCount, onNewRoster }: {
  results: AnalysisResults; watchCount: number; onNewRoster: () => void;
}) {
  const n = results.duties.length;
  const pilotLine = [results.pilotName, results.pilotBase, results.pilotAircraft].filter(Boolean).join(' · ');
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-lg md:text-2xl font-semibold leading-snug">
          {monthLabel(results)}
          <span className="text-muted-foreground font-normal"> · {n} {n === 1 ? 'duty' : 'duties'}</span>
          {watchCount > 0 && (
            <>
              <span className="text-muted-foreground font-normal"> · </span>
              <span className="text-high">{watchCount} to watch</span>
            </>
          )}
        </h1>
        {watchCount === 0 && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            No duties need special attention this month
          </p>
        )}
        {pilotLine && <p className="text-xs text-muted-foreground">{pilotLine}</p>}
      </div>
      <Button variant="ghost" size="sm" className="flex-shrink-0 text-xs text-muted-foreground" onClick={onNewRoster}>
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
        New roster
      </Button>
    </div>
  );
}

/**
 * Roster (home): upload → verdict, duties to watch, EASA checks,
 * all duties (collapsed) and the timeline (collapsed on mobile).
 */
export function RosterPage() {
  const {
    state, selectDuty, setDrawerOpen, setCrewOverride, clearCrewOverride,
    removeFile, openFatigueReportForDuty,
  } = useAnalysis();
  const { analysisResults: results, selectedDuty, drawerOpen, dutyCrewOverrides, settings } = state;

  const watch = useMemo(() => (results ? selectDutiesToWatch(results) : []), [results]);

  const reportFatigue = (duty: DutyAnalysis) => {
    if (duty.dutyId) openFatigueReportForDuty(duty.dutyId);
  };

  if (!results) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-xl space-y-4 animate-fade-in">
          <RosterUploadCard />
          <AirlineDetectionPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-in min-w-0">
        <VerdictLine results={results} watchCount={watch.length} onNewRoster={removeFile} />

        {/* Duties to watch */}
        <section aria-labelledby="watch-heading" className="space-y-2">
          <h2 id="watch-heading" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Duties to watch
          </h2>
          {watch.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2" data-testid="duties-to-watch">
              {watch.map((d, i) => (
                <DutyWatchCard
                  key={d.dutyId ?? i}
                  duty={d}
                  onDetails={selectDuty}
                  onReportFatigue={reportFatigue}
                />
              ))}
            </div>
          ) : (
            <Card variant="glass" data-testid="duties-to-watch-empty">
              <CardContent className="p-4 text-sm text-muted-foreground">
                The model predicts no duty this month reaching high sleepiness (KSS 6.5 or more).
                You can still report fatigue whenever you feel it — how you feel always comes first.
              </CardContent>
            </Card>
          )}
        </section>

        <EasaChecksCard findings={results.easaFindings} summary={results.easaSummary} />

        <AllDutiesList duties={results.duties} standbyPeriods={results.standbyPeriods} onSelect={selectDuty} />

        <TimelineSection
          results={results}
          pilotId={settings.pilotId}
          homeBase={settings.homeBase}
          theme={settings.theme}
          selectedDuty={selectedDuty}
          onDutySelect={selectDuty}
        />

        <ExportOptions duties={results.duties} />
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
