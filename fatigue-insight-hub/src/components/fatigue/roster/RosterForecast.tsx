import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildRosterForecast, DEFAULT_WATCH_KSS } from '@/lib/roster-forecast';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { dutyDateLabel, dutyRoute } from './roster-utils';

const hours = (n: number | undefined | null) => n != null && Number.isFinite(n) ? `${n.toFixed(1)}h` : 'Unknown';

interface ForecastProps {
  results: AnalysisResults;
  onDetails: (duty: DutyAnalysis) => void;
  onConcern: (duty: DutyAnalysis, reference: number) => void;
  reference: number;
  onReferenceChange: (reference: number) => void;
}

export function RosterForecast({ results, reference, onReferenceChange }: ForecastProps) {
  const rows = useMemo(() => buildRosterForecast(results, reference), [results, reference]);
  const first = rows.find(row => row.reachesWatch);
  const assessed = rows.filter(row => row.peak != null);
  const highest = assessed.reduce<typeof first>((best, row) => !best || row.peak! > best.peak! ? row : best, undefined);

  return <section id="fatigue-outlook" aria-labelledby="forecast-heading" className="instrument-surface scroll-mt-24 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="max-w-xl space-y-2">
        <h2 id="forecast-heading" className="text-2xl font-semibold tracking-tight">Your fatigue outlook</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">If you follow this roster and the estimated sleep pattern, these are the duty peaks the model projects. Review the assumed sleep before deciding how the outlook applies to you.</p>
      </div>
      <label className="instrument-inset flex items-center gap-3 px-3 py-2 text-xs sm:block sm:space-y-2 sm:px-4 sm:py-3">
        <span className="block font-medium">My watch level (KSS)</span>
        <select aria-label="My watch level (KSS)" value={reference} onChange={e => onReferenceChange(Number(e.target.value))}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {Array.from({ length: 17 }, (_, i) => 1 + i * 0.5).map(kss => <option key={kss} value={kss}>{kss.toFixed(1)}{kss === DEFAULT_WATCH_KSS ? ' · default' : ''}</option>)}
        </select>
      </label>
    </div>
    <div className="forecast-facts" aria-live="polite">
      <div><p className="text-xs text-muted-foreground">First duty reaching your watch level</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{first ? dutyDateLabel(first.duty) : assessed.length ? 'No crossing in assessed duties' : 'Prediction unavailable'}</p>
        <p className="mt-1 text-sm text-muted-foreground">{first ? `${dutyRoute(first.duty)} · predicted peak KSS ${first.peak!.toFixed(1)}` : `${assessed.length} of ${rows.length} duties have an interpretable prediction.`}</p>
      </div>
      <div className="border-t border-border/80 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><p className="text-xs text-muted-foreground">Highest predicted sleepiness</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">{highest ? <><span className="text-4xl font-semibold tracking-tight tabular">{highest.peak!.toFixed(1)}</span><span className="text-sm text-muted-foreground">KSS · {dutyDateLabel(highest.duty)}</span></> : 'Unavailable'}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">KSS runs from 1 (extremely alert) to 9 (fighting sleep).</p>
      </div>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">Your watch level is a personal review prompt. The model bands and duties-to-watch list below remain unchanged. Neither reference establishes fitness for duty or a legal limit.</p>

    <details className="border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
      <summary className="cursor-pointer font-medium">What this forecast assumes</summary>
      <div className="mt-3 max-w-3xl space-y-2">
        <p>Duty times come from the roster. Sleep is an estimate; a gap between duties is not all available for sleep. Commutes, meals, disturbances and personal sleep needs can change the outcome. A lower peak on a later duty does not establish full recovery.</p>
        <p>The shortfall is a separate ledger against an 8-hour daily reference. Changes between duty peaks also reflect time of day and duty timing; they do not isolate the effect of recovery.</p>
        <p>The published <a className="underline" href="https://doi.org/10.1371/journal.pone.0108679" target="_blank" rel="noreferrer">Three Process Model (Ingre et al., 2014)</a> provides the sleepiness reference. AeroWake's complete roster forecast still needs independent validation. Report fatigue whenever you experience it, including below either watch level.</p>
      </div>
    </details>
  </section>;
}

export function RosterRecovery({ results, reference, onDetails, onConcern }: Omit<ForecastProps, "onReferenceChange">) {
  const rows = useMemo(() => buildRosterForecast(results, reference), [results, reference]);
  return (
    <details className="instrument-surface group" open={rows.length <= 7}>
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Recovery by duty ({rows.length})</summary>
      <ol className="mt-4 divide-y divide-border" aria-label="Chronological fatigue outlook">
        {rows.map(({ duty, peak, reachesWatch, gapHours, peakChange, deficitChange }, i) => {
          const ChangeIcon = peakChange == null || Math.abs(peakChange) < 0.05 ? Minus : peakChange > 0 ? ArrowUpRight : ArrowDownRight;
          return <li key={duty.dutyId ?? i} className="py-5">
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold">{dutyDateLabel(duty)} <span className="ml-2 font-normal">{dutyRoute(duty)}</span></h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Estimated prior sleep / 24h</dt><dd className="mt-1 text-lg font-semibold tabular">{hours(duty.priorSleep)}</dd></div>
                <div><dt className="text-muted-foreground">Longest time awake</dt><dd className="mt-1 text-lg font-semibold tabular">{hours(duty.maxHoursAwake)}</dd></div>
                <div><dt className="text-muted-foreground">Gap before duty</dt><dd className="mt-1 text-lg font-semibold tabular">{hours(gapHours)}</dd></div>
                <div><dt className="text-muted-foreground">7-day sleep shortfall</dt><dd className="mt-1 text-lg font-semibold tabular">{hours(duty.sleepDeficit7d?.deficitHours)}</dd></div>
              </dl>
              {peakChange != null && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ChangeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />Peak {Math.abs(peakChange) < 0.05 ? 'unchanged' : `${Math.abs(peakChange).toFixed(1)} KSS ${peakChange > 0 ? 'higher' : 'lower'}`} than the previous duty.{deficitChange != null && Math.abs(deficitChange) >= 0.1 ? ` Estimated sleep shortfall ${Math.abs(deficitChange).toFixed(1)}h ${deficitChange > 0 ? 'higher' : 'lower'}.` : ''}</p>}
              {(duty.riskReasons ?? []).length > 0 && <p className="text-sm text-muted-foreground">{duty.riskReasons!.join('. ')}.</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onDetails(duty)}>Review sleep assumptions</Button>
                <Button size="sm" variant="ghost" disabled={!duty.dutyId || results.legacyModel} onClick={() => onConcern(duty, reference)} aria-label={`Raise roster concern for ${dutyDateLabel(duty)}`}>Raise a roster concern</Button>
              </div>
            </div>
          </li>;
        })}
      </ol>
    </details>
  );
}
