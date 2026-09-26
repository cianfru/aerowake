import { useMemo } from 'react';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { riskClasses } from '@/lib/risk-scale';
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
import { dutyPeakKss, dutyRiskLevel, formatLimit, selectDutiesToWatch } from './roster-utils';
import { Eyebrow, Figure, SectionHeading } from './primitives';

function monthLabel(results: AnalysisResults): string {
  try {
    return format(results.month, 'MMMM yyyy');
  } catch {
    return '';
  }
}

/** Verdict: the month's headline, then the facts that support it. */
function VerdictHeader({ results, watch, onNewRoster }: {
  results: AnalysisResults; watch: DutyAnalysis[]; onNewRoster: () => void;
}) {
  const n = results.duties.length;
  const pilotLine = [results.pilotName, results.pilotBase, results.pilotAircraft].filter(Boolean).join(' · ');
  const peak = results.duties.reduce<DutyAnalysis | null>(
    (a, d) => ((dutyPeakKss(d) ?? 0) > (a ? dutyPeakKss(a) ?? 0 : -1) ? d : a), null);
  const peakKss = peak ? dutyPeakKss(peak) : null;
  const summary = results.easaSummary;

  return (
    <header className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Eyebrow>Roster · {monthLabel(results)}</Eyebrow>
          <h1 className="text-3xl md:text-[2.5rem] font-semibold leading-[1.1] tracking-[-0.025em]">
            {watch.length > 0 ? (
              <span className="text-foreground">{watch.length} to watch</span>
            ) : (
              <span>No duties need special attention this month</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {n} {n === 1 ? 'duty' : 'duties'}{pilotLine ? ` · ${pilotLine}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewRoster}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-[5px] px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          New roster
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-5 md:grid-cols-4 md:divide-x md:divide-border md:gap-0">
        <Figure className="md:px-5 md:first:pl-0" label="Duties" value={n} />
        <Figure
          className="md:px-5"
          label="To watch"
          value={watch.length}
          valueClassName={watch.length ? riskClasses('high').text : undefined}
        />
        <Figure
          className="md:px-5"
          label="Peak sleepiness"
          value={peakKss != null ? peakKss.toFixed(1) : '—'}
          valueClassName={peak ? riskClasses(dutyRiskLevel(peak)).text : undefined}
          sub="KSS, worst duty"
        />
        <Figure
          className="md:px-5"
          label="Duty · 28 days"
          value={summary ? formatLimit(summary.duty28dMax, summary.limits.duty28d) : '—'}
          sub="EASA limit 190h"
        />
      </div>
    </header>
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
      <div className="mx-auto max-w-5xl min-w-0 space-y-12 animate-fade-in">
        <VerdictHeader results={results} watch={watch} onNewRoster={removeFile} />

        <section aria-labelledby="watch-heading" className="space-y-1">
          <SectionHeading
            id="watch-heading"
            title="Duties to watch"
            aside={watch.length ? 'Predicted KSS 6.5 or higher, worst first' : undefined}
          />
          {watch.length > 0 ? (
            <div className="divide-y divide-border/70" data-testid="duties-to-watch">
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
            <p className="max-w-2xl py-4 text-sm text-muted-foreground" data-testid="duties-to-watch-empty">
              The model predicts no duty this month reaching high sleepiness (KSS 6.5 or more).
              You can still report fatigue whenever you feel it — how you feel always comes first.
            </p>
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
