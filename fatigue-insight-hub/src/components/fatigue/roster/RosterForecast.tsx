import { useId, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildRosterForecast, DEFAULT_WATCH_KSS } from '@/lib/roster-forecast';
import { RISK_LEVEL_LABELS, classifyKss, riskClasses } from '@/lib/risk-scale';
import type { AnalysisResults, DutyAnalysis, NapHabit } from '@/types/fatigue';
import { dutyDateLabel, dutyRoute } from './roster-utils';
import { MonthStrip } from './MonthStrip';
import { TextAction } from './primitives';

const hours = (n: number | undefined | null) => n != null && Number.isFinite(n) ? `${n.toFixed(1)}h` : '—';

/** Watch levels offered: the useful part of the scale, where the bands sit. */
export const WATCH_LEVELS = Array.from({ length: 8 }, (_, i) => 5 + i * 0.5);

export const NAP_HABIT_LABELS: Record<NapHabit, string> = {
  usually: 'Usually',
  sometimes: 'Sometimes',
  rarely: 'Rarely',
};

/** One short line: what the numbers on this page assume. */
export function assumptionsLine(results: Pick<AnalysisResults, 'assumptions'>): string {
  const naps = results.assumptions?.napHabit;
  const window = results.assumptions?.headlineRiskWindow;
  const rating = window === 'fdp'
    ? 'rates each duty by its peak from report to the last on-blocks'
    : 'rates each duty by its peak on duty';
  return `Assumes the estimated sleep shown in the calendar${naps ? `, a pre-duty nap ${naps === 'usually' ? 'usually' : naps === 'rarely' ? 'rarely' : 'sometimes'} taken before late duties` : ''}, and ${rating}.`;
}

interface ForecastProps {
  results: AnalysisResults;
  onDetails: (duty: DutyAnalysis) => void;
  onConcern: (duty: DutyAnalysis, reference: number) => void;
  reference: number;
  onReferenceChange: (reference: number) => void;
  /** Pre-duty nap assumption for the next analysis. */
  napHabit: NapHabit;
  onNapHabitChange: (habit: NapHabit) => void;
}

function NapHabitControl({ value, onChange, pendingNote }: { value: NapHabit; onChange: (v: NapHabit) => void; pendingNote?: string }) {
  const hintId = useId();
  return (
    <fieldset className="min-w-0 space-y-1.5" aria-describedby={hintId}>
      <legend className="text-xs font-medium">Pre-duty naps</legend>
      <div role="radiogroup" aria-label="Pre-duty naps" className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {(Object.keys(NAP_HABIT_LABELS) as NapHabit[]).map((habit) => (
          <button
            key={habit}
            type="button"
            role="radio"
            aria-checked={value === habit}
            onClick={() => onChange(habit)}
            className={cn(
              'min-h-[36px] rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === habit ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/40' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {NAP_HABIT_LABELS[habit]}
          </button>
        ))}
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">Before late reports.{pendingNote ? ` ${pendingNote}` : ''}</p>
    </fieldset>
  );
}

export function RosterForecast({ results, reference, onReferenceChange, onDetails, napHabit, onNapHabitChange }: ForecastProps) {
  const rows = useMemo(() => buildRosterForecast(results, reference), [results, reference]);
  const watchHintId = useId();
  const first = rows.find(row => row.reachesWatch);
  const assessed = rows.filter(row => row.peak != null);
  const highest = assessed.reduce<typeof first>((best, row) => !best || row.peak! > best.peak! ? row : best, undefined);
  const highestLevel = highest?.peak != null ? classifyKss(highest.peak) : null;
  const napsUsed = results.assumptions?.napHabit;
  const pendingNote = napsUsed !== napHabit ? 'Applies from your next analysis.' : undefined;

  return <section id="fatigue-outlook" aria-labelledby="forecast-heading" className="instrument-surface scroll-mt-24 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
      <div className="max-w-xl space-y-2">
        <h2 id="forecast-heading" className="text-title font-semibold">Your fatigue outlook</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Predicted peak sleepiness for each duty, so you can plan rest around the demanding ones.</p>
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="space-y-1.5">
          <label htmlFor="watch-level" className="block text-xs font-medium">My watch level (KSS)</label>
          <select id="watch-level" aria-describedby={watchHintId} value={reference} onChange={e => onReferenceChange(Number(e.target.value))}
            className="min-h-[38px] rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {WATCH_LEVELS.map(kss => <option key={kss} value={kss}>{kss.toFixed(1)}{kss === DEFAULT_WATCH_KSS ? ' (default)' : ''}</option>)}
          </select>
          <p id={watchHintId} className="max-w-[15rem] text-xs text-muted-foreground">Your own marker on the strip below; the model bands don&apos;t change.</p>
        </div>
        <NapHabitControl value={napHabit} onChange={onNapHabitChange} pendingNote={pendingNote} />
      </div>
    </div>

    <div className="forecast-facts" aria-live="polite">
      <div><p className="text-xs text-muted-foreground">First duty at or above your watch level</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{first ? dutyDateLabel(first.duty) : assessed.length ? 'None this month' : 'Prediction unavailable'}</p>
        <p className="mt-1 text-sm text-muted-foreground">{first ? `${dutyRoute(first.duty)} · peak KSS ${first.peak!.toFixed(1)}` : `${assessed.length} of ${rows.length} duties have a prediction.`}</p>
      </div>
      <div className="border-t border-border pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><p className="text-xs text-muted-foreground">Highest predicted sleepiness</p>
        {highest && highestLevel ? <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn('text-[40px] font-semibold leading-none tracking-tight tabular', riskClasses(highestLevel).text)}>{highest.peak!.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">KSS · {dutyDateLabel(highest.duty)}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{RISK_LEVEL_LABELS[highestLevel]} band · KSS runs from 1 (extremely alert) to 9 (fighting sleep).</p>
        </> : <p className="mt-2 text-sm text-muted-foreground">Unavailable</p>}
      </div>
    </div>

    <MonthStrip results={results} reference={reference} onDetails={onDetails} />

    <div className="space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
      <p data-testid="forecast-assumptions">{assumptionsLine(results)}</p>
      <details>
        <summary className="cursor-pointer font-medium text-foreground/80">What this forecast assumes</summary>
        <div className="mt-3 max-w-3xl space-y-2">
          <p>Duty times come from the roster. Sleep is an estimate: a gap between duties is not all available for sleep, and commutes, meals, disturbances and personal sleep need change the outcome. A lower peak on a later duty does not mean full recovery.</p>
          <p>The <a className="underline" href="https://doi.org/10.1371/journal.pone.0108679" target="_blank" rel="noreferrer">Three Process Model (Ingre et al., 2014)</a> gives a group-average prediction. It is a planning aid alongside your operator&apos;s fatigue risk management, not a measure of fitness for duty or a legal limit. The complete roster forecast still needs independent validation.</p>
          <p>Plan and use your rest (ORO.FTL.115), and report fatigue whenever you experience it, whatever the prediction.</p>
        </div>
      </details>
    </div>
  </section>;
}

export function RosterRecovery({ results, reference, onDetails, onConcern }: Pick<ForecastProps, 'results' | 'reference' | 'onDetails' | 'onConcern'>) {
  const rows = useMemo(() => buildRosterForecast(results, reference), [results, reference]);
  return (
    <details className="instrument-surface group" open={rows.length <= 7}>
      <summary className="cursor-pointer text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Recovery by duty <span className="font-normal text-muted-foreground">({rows.length})</span></summary>
      <ol className="mt-4 divide-y divide-border" aria-label="Recovery by duty, in date order">
        {rows.map(({ duty, peak, gapHours, standbyInGap, peakChange, deficitChange }, i) => {
          const ChangeIcon = peakChange == null || Math.abs(peakChange) < 0.05 ? Minus : peakChange > 0 ? ArrowUpRight : ArrowDownRight;
          const level = peak != null ? classifyKss(peak) : null;
          return <li key={duty.dutyId ?? i} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-sm font-semibold">{dutyDateLabel(duty)} <span className="ml-1.5 font-normal text-muted-foreground">{dutyRoute(duty)}</span></h3>
              {peak != null && level && (
                <p className={cn('inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular', riskClasses(level).text)}>
                  <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-[1px]', riskClasses(level).fill)} />
                  KSS {peak.toFixed(1)}<span className="sr-only">, {RISK_LEVEL_LABELS[level]}</span>
                </p>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-4">
              <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">Sleep 24h before</dt><dd className="font-mono tabular">{hours(duty.priorSleep)}</dd></div>
              <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">Longest awake</dt><dd className="font-mono tabular">{hours(duty.maxHoursAwake)}</dd></div>
              <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">Gap before</dt><dd className="font-mono tabular">{standbyInGap ? <span className="font-sans">Standby in gap</span> : hours(gapHours)}</dd></div>
              <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">7-day shortfall</dt><dd className="font-mono tabular">{hours(duty.sleepDeficit7d?.deficitHours)}</dd></div>
            </dl>
            {peakChange != null && <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><ChangeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />{Math.abs(peakChange) < 0.05 ? 'Peak unchanged from the previous duty.' : `Peak ${Math.abs(peakChange).toFixed(1)} KSS ${peakChange > 0 ? 'higher' : 'lower'} than the previous duty.`}{deficitChange != null && Math.abs(deficitChange) >= 0.1 ? ` 7-day shortfall ${Math.abs(deficitChange).toFixed(1)}h ${deficitChange > 0 ? 'higher' : 'lower'}.` : ''}</p>}
            <div className="-ml-2 mt-2 flex flex-wrap gap-1">
              <TextAction onClick={() => onDetails(duty)} ariaLabel={`Review duty on ${dutyDateLabel(duty)}`}>Review</TextAction>
              {duty.dutyId && !results.legacyModel && (
                <TextAction onClick={() => onConcern(duty, reference)} ariaLabel={`Raise roster concern for ${dutyDateLabel(duty)}`}>Raise a roster concern</TextAction>
              )}
            </div>
          </li>;
        })}
      </ol>
    </details>
  );
}
