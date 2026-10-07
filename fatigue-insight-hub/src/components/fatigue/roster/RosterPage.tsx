import { useAnalyzeRoster, type RunAnalysisOptions } from '@/hooks/useAnalyzeRoster';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { useAnalysis } from '@/contexts/AnalysisContext';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { DutyDetailsDialog } from '../DutyDetailsDialog';
import { RosterUploadCard } from './RosterUploadCard';
import { RosterWorkspace } from './RosterWorkspace';
import { AirlineDetectionPrompt } from './AirlineDetectionPrompt';
import { DEFAULT_WATCH_KSS } from '@/lib/roster-forecast';
import { RISK_LEVEL_LABELS, classifyKss, riskClasses } from '@/lib/risk-scale';
import { cn } from '@/lib/utils';
import { selectDutiesToWatch } from './roster-utils';

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
 * duty count are enough to recognise the roster. Beside it, the month in
 * numbers: only figures the model and the scoped checks already report.
 */
function RosterHeader({ results, onNewRoster }: { results: AnalysisResults; onNewRoster: () => void }) {
  const facts = [
    results.pilotBase ? `${results.pilotBase} base` : null,
    results.pilotAircraft || null,
    'times in home-base time',
  ].filter(Boolean).join(' · ');
  const peaks = results.duties.map((d) => d.maxKss).filter((k): k is number => typeof k === 'number' && Number.isFinite(k));
  const peak = peaks.length ? Math.max(...peaks) : null;
  const peakLevel = peak != null ? classifyKss(peak) : null;
  const watch = selectDutiesToWatch(results).length;
  const sectors = results.duties.reduce((n, d) => n + d.flightSegments.length, 0);
  const block = results.statistics?.totalBlockHours ?? results.duties.reduce((h, d) => h + (d.blockHours || 0), 0);
  const ftlWarnings = (results.easaFindings ?? []).filter((f) => f.severity === 'warning').length;
  const ftlKnown = !!results.easaSummary && results.easaSummary.status !== 'unavailable';
  const rc = peakLevel ? riskClasses(peakLevel) : null;
  const kpis: Array<{ label: string; value: string; unit?: string; tone?: string; note?: string }> = [
    { label: 'Duties', value: String(results.duties.length), note: `${sectors} ${sectors === 1 ? 'sector' : 'sectors'}` },
    { label: 'Block time', value: formatHours(block) },
    { label: 'Highest peak', value: peak != null ? peak.toFixed(1) : '–', unit: peak != null ? 'KSS' : undefined, tone: rc?.text, note: peakLevel ? RISK_LEVEL_LABELS[peakLevel] : 'No prediction' },
    { label: 'Duties to watch', value: String(watch), tone: watch ? 'text-risk-high-ink' : undefined, note: `peak KSS ${DEFAULT_WATCH_KSS} or higher` },
    { label: 'FTL checks', value: !ftlKnown ? '–' : ftlWarnings ? String(ftlWarnings) : 'Clear', tone: ftlKnown ? (ftlWarnings ? 'text-risk-critical-ink' : 'text-success') : undefined, note: !ftlKnown ? 'Unavailable' : ftlWarnings ? (ftlWarnings === 1 ? 'exceedance' : 'exceedances') : 'in the supplied activities' },
  ];
  return <header className="roster-bridge">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Your roster</p>
        <h1 data-analysis-heading tabIndex={-1} className="text-3xl font-semibold tracking-tight focus:outline-none md:text-[2.5rem] md:leading-tight">{monthLabel(results)}</h1>
        {facts && <p className="text-sm text-muted-foreground">{facts}</p>}
      </div>
      <button type="button" onClick={onNewRoster} className="flex shrink-0 items-center gap-2 rounded-[4px] border border-border bg-secondary/60 px-4 py-2 text-sm text-foreground transition-[background-color,transform] hover:bg-secondary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />New roster
      </button>
    </div>
    <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" aria-label="This month in numbers">
      {kpis.map((k) => <div key={k.label} className="roster-kpi">
        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{k.label}</dt>
        <dd className={cn('mt-1 font-mono text-2xl font-semibold tabular text-foreground', k.tone)}>
          {k.value}{k.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{k.unit}</span>}
        </dd>
        {k.note && <dd className="mt-0.5 text-xs leading-snug text-muted-foreground">{k.note}</dd>}
      </div>)}
    </dl>
  </header>;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '–';
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
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
      <div className="mx-auto max-w-6xl min-w-0 space-y-6 animate-fade-in">
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
        onCrewChange={(id, crewSet) => {
          setCrewComposition(id, 'augmented_4'); setCrewOverride(id, crewSet);
          rerun({ dutyId: id, composition: 'augmented_4', crewSet });
        }}
        onCrewReset={(id) => {
          clearCrewOverride(id); setCrewComposition(id, null);
          rerun({ dutyId: id, composition: null, crewSet: null });
        }}
        crewCompositionOverride={dutyCrewComposition.get(selectedDuty?.dutyId || '') ?? null}
        onCrewCompositionChange={(id, composition) => { setCrewComposition(id, composition); rerun({ dutyId: id, composition }); }}
        onReportFatigue={reportFatigue}
      />
      <AirlineDetectionPrompt />
    </div>
  );
}
