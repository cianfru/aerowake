import { useState } from 'react';
import { Building2, ChevronDown, Home, Users } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyAnalysis } from '@/types/fatigue';
import { isTrainingDuty } from '@/lib/fatigue-utils';
import { FDPUtilizationBar } from './FDPUtilizationBar';
import { CrewRestTimeline } from './CrewRestTimeline';
import { cn } from '@/lib/utils';
import { SLEEP_DEFICIT_LABELS, sleepDeficitClass } from '@/lib/risk-scale';
import { formatHomeTime } from '@/lib/home-time';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { SleepBlockList } from './sleep/SleepBlockList';
import type { CrewCompositionValue, RestFacilityClass } from '@/lib/api-client';
import { crewLabel, inflightSleepHours, isAugmented } from '@/lib/crew';

const STRATEGY_LABELS: Record<string, string> = {
  normal: 'Normal night',
  anchor: 'Anchored to home time',
  split: 'Split sleep',
  early_bedtime: 'Early bedtime',
  restricted: 'Restricted by the roster',
  extended: 'Extended recovery',
  recovery: 'Recovery',
  nap: 'Night departure with a nap',
  afternoon_nap: 'Afternoon nap',
  augmented_4_sleep: 'Ultra-long range (4 pilots)',
  augmented_3: 'Augmented crew (3 pilots)',
  wocl_duty: 'Duty through the body-clock low',
  inter_duty_recovery: 'Recovery between duties',
  post_duty_recovery: 'Recovery after duty',
};

/** Why the model chose each sleep pattern (with the published basis). */
const STRATEGY_RATIONALE: Record<string, string> = {
  normal: 'Uses your selected usual night. Any advance before early reports is a modelling assumption, limited by the evening wake-maintenance zone (Roach et al. 2012; Dijk & Czeisler 1994).',
  anchor: 'Used when the local time is 3h or more from home base. Keeping sleep anchored to home-base time preserves circadian alignment on transmeridian trips (Minors & Waterhouse 1981, 1983).',
  split: 'When the schedule divides sleep into separate opportunities, their timing and duration remain estimates (Jackson et al. 2014; Kosmadopoulos et al. 2014).',
  early_bedtime: 'Used for reports before 06:00. Early starts restrict prior sleep (Roach et al. 2012); bedtime is not earlier than 21:30 because of the wake-maintenance zone (Arsintescu et al. 2022).',
  restricted: 'Used when rest is under 9h: sleep is physically limited by the schedule. Repeated restriction degrades performance even with partial recovery (Van Dongen et al. 2003; Belenky et al. 2003).',
  extended: 'Used when rest exceeds 14h. Longer sleep after restriction supports partial recovery, with diminishing returns beyond about 9h (Banks et al. 2010; Kitamura et al. 2016).',
  recovery: 'Recovery at home with no duty constraint. Recovery from sleep loss builds over several nights, most in the first (Banks et al. 2010).',
  nap: 'Used for afternoon, evening and night reports: a normal previous night plus a pre-duty nap. About half of crew nap before evening departures; the assumed nap grows from 14:00 reports to its full length at 20:00 and follows your nap setting (Dinges et al. 1987; Signal et al. 2014).',
  afternoon_nap: 'Used for late reports (14:00–20:00). About half of crew nap before evening departures (Signal et al. 2014); the nap follows the post-lunch dip (Dinges et al. 1987).',
  augmented_4_sleep: 'Ultra-long-range four-pilot operations: two normal nights before departure (Signal et al. 2014).',
  augmented_3: 'Three-pilot augmented operations: a 22:00 bedtime plus an optional pre-duty nap for night departures (Signal et al. 2014; Gander et al. 2013).',
  wocl_duty: 'Duties over 6h through the body-clock low: consolidated sleep is placed before the duty (Dijk & Czeisler 1995).',
  inter_duty_recovery: 'Recovery sleep between duties is informed by Banks et al. (2010) and layover timing in Rempe et al. (2025). Placement, duration and sleep quality remain model assumptions.',
  post_duty_recovery: 'Recovery after duty is informed by Banks et al. (2010) and layover timing in Rempe et al. (2025). Wake timing, duration and sleep quality remain model assumptions.',
};

interface DutyInfoColumnProps {
  duty: DutyAnalysis;
  /** Home-base IANA zone for sleep times. */
  homeTz?: string;
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
  onCrewReset?: (dutyId: string) => void;
  hasCrewContent: boolean;
  /** Pilot-stated crew for this duty (null = as read from the roster). */
  crewCompositionOverride?: CrewCompositionValue | null;
  onCrewCompositionChange?: (dutyId: string, composition: CrewCompositionValue | null) => void;
  onRestFacilityChange?: (dutyId: string, facility: RestFacilityClass) => void;
  restFacilityBusy?: boolean;
}

const isIso = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));

function SleepBlocks({ duty, homeTz }: { duty: DutyAnalysis; homeTz?: string }) {
  const { state } = useAnalysis();
  const est = duty.sleepEstimate;
  const blocks = est?.sleepBlocks ?? [];
  if (!homeTz || !isIso(duty.reportTimeUtc)) return null;
  const report = duty.reportTimeUtc!;
  // Removed estimates are listed from the previous release to this report.
  const previous = (state.analysisResults?.duties ?? [])
    .map((d) => d.releaseTimeUtc).filter((r): r is string => isIso(r) && Date.parse(r!) <= Date.parse(report))
    .sort((x, y) => Date.parse(x) - Date.parse(y)).pop();
  const napEnd = new Date(Date.parse(report) - 2 * 3600000).toISOString();
  const napStart = new Date(Date.parse(report) - 3 * 3600000).toISOString();
  return (
    <SleepBlockList
      blocks={blocks}
      homeTz={homeTz}
      rationale={est ? STRATEGY_RATIONALE[est.sleepStrategy] : undefined}
      confidence={est?.confidence}
      confidenceBasis={est?.confidenceBasis}
      references={est?.references}
      window={{ from: previous, to: report }}
      addDefault={{ startUtc: napStart, endUtc: napEnd }}
      ariaLabel="Estimated sleep before this duty"
    />
  );
}

/** Sleep before the duty, the 7-day shortfall, FDP and crew context. */
export function DutyInfoColumn({ duty, homeTz, dutyCrewOverride, onCrewChange, onCrewReset, hasCrewContent, crewCompositionOverride, onCrewCompositionChange, onRestFacilityChange, restFacilityBusy }: DutyInfoColumnProps) {
  const isTraining = isTrainingDuty(duty);
  const [crewOpen, setCrewOpen] = useState(isAugmented(duty) || !!duty.augmentationSuggested);
  const est = duty.sleepEstimate;
  const deficit = duty.sleepDeficit7d;
  const away = duty.sleepEnvironment === 'hotel' || duty.sleepEnvironment === 'layover';

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="sleep-before-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="sleep-before-heading" className="text-[15px] font-semibold">Sleep before this duty</h3>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {away ? <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Home className="h-3.5 w-3.5" aria-hidden="true" />}
            {away ? 'Layover' : 'Home'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">In the 24h before (est.)</p>
            <p className="font-mono text-xl font-medium tabular">{duty.priorSleep.toFixed(1)}h</p>
          </div>
          {(duty.preDutyAwakeHours ?? 0) > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Awake at report</p>
              <p className="font-mono text-xl font-medium tabular">{duty.preDutyAwakeHours.toFixed(1)}h</p>
            </div>
          )}
          {deficit && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">7-day shortfall <InfoTooltip entry={FATIGUE_INFO.sleepDeficit7d} size="sm" /></p>
              <p className="font-mono text-xl font-medium tabular">{deficit.deficitHours.toFixed(1)}h</p>
              {deficit.band !== 'none' && <p className={cn('text-xs font-medium', sleepDeficitClass(deficit.band))}>{SLEEP_DEFICIT_LABELS[deficit.band]}</p>}
            </div>
          )}
        </div>

        <SleepBlocks duty={duty} homeTz={homeTz} />

        {est && (
          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <p>
              <span className="font-medium">{STRATEGY_LABELS[est.sleepStrategy] ?? est.sleepStrategy.split('_').join(' ')}</span>
              {est.explanation && <span className="text-muted-foreground"> — {est.explanation}</span>}
            </p>
            {STRATEGY_RATIONALE[est.sleepStrategy] && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground/80">Why this sleep pattern</summary>
                <p className="mt-2 leading-relaxed">{STRATEGY_RATIONALE[est.sleepStrategy]}</p>
              </details>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {est?.isUserOverride
            ? 'Includes sleep you changed; the rest is estimated from the roster. None of it is sleep you recorded. '
            : 'Estimated from the roster, not sleep you recorded. '}
          Tap ⓘ to see why each sleep is there and to change it. The shortfall compares the last 7 days with 8h a day.
          {duty.woclExposure > 0 ? ` This duty spends ${duty.woclExposure.toFixed(1)}h in the body-clock low.` : ''}
        </p>
      </section>

      {!isTraining && duty.maxFdpHours != null && duty.maxFdpHours > 0 && (
        <FDPUtilizationBar
          actualFdpHours={duty.actualFdpHours ?? duty.dutyHours ?? 0}
          maxFdpHours={duty.maxFdpHours}
          extendedFdpHours={duty.extendedFdpHours}
          plannedExtensionFdpHours={duty.plannedExtensionFdpHours}
          fdpLimitReference={duty.fdpLimitReference}
          usedDiscretion={duty.usedDiscretion}
        />
      )}

      {!isTraining && duty.flightSegments?.length > 0 && duty.maxFdpHours == null && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-[15px] font-semibold">Flight duty period · not assessed</h3>
          <p className="mt-2 text-sm text-muted-foreground">{duty.fdpLimitReference ?? 'The supplied roster does not establish the acclimatisation or operational inputs needed for an FDP comparison.'}</p>
        </section>
      )}

      {hasCrewContent && (
        <Collapsible open={crewOpen} onOpenChange={setCrewOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-secondary/60">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Crew and in-flight rest
              <span className="text-xs font-normal text-muted-foreground">{crewLabel(duty) ?? (duty.augmentationSuggested ? 'not on roster' : '2 pilots')}</span>
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', crewOpen && 'rotate-180')} aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {isAugmented(duty) && (
              <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
                <label htmlFor={`rest-facility-${duty.dutyId}`} className="block font-medium">Rest facility for this duty</label>
                <select id={`rest-facility-${duty.dutyId}`} value={duty.restFacilityClass ?? 'class_1'}
                  disabled={!onRestFacilityChange || restFacilityBusy}
                  onChange={(event) => onRestFacilityChange?.(duty.dutyId || '', event.target.value as RestFacilityClass)}
                  className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
                  <option value="class_1">Class 1 · bunk</option>
                  <option value="class_2">Class 2 · near-flat seat</option>
                  <option value="class_3">Class 3 · reclining seat</option>
                </select>
                <p className="text-xs text-muted-foreground">{duty.restFacilitySource === 'pilot' ? 'You selected this facility. ' : 'Class 1 is assumed when the roster does not state a facility. '}Changing it updates the FDP comparison and estimated sleep benefit. Confirm the facility classification with your operator.</p>
                <p className="text-xs text-muted-foreground">Sleep efficiency is modelled at 70% / 55% / 45% for classes 1 / 2 / 3; these are modelling assumptions, not measured sleep.</p>
                {restFacilityBusy && <p role="status" className="text-xs text-primary">Updating the prediction…</p>}
                {!onRestFacilityChange && <p className="text-xs text-muted-foreground">Open the original roster file to change this saved estimate.</p>}
              </div>
            )}
            {onCrewCompositionChange && (
              <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-muted-foreground">Crew on this duty</span>
                  <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Crew on this duty">
                    {([['standard', '2 pilots'], ['augmented_3', '3 pilots'], ['augmented_4', '4 pilots']] as const).map(([value, label]) => (
                      <button key={value} type="button" role="radio" disabled={restFacilityBusy} aria-checked={duty.crewComposition === value}
                        onClick={() => { if (duty.crewComposition !== value) onCrewCompositionChange(duty.dutyId || '', value); }}
                        className={cn('min-h-[44px] rounded-md px-3 text-xs font-medium transition-colors', duty.crewComposition === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {crewCompositionOverride
                    ? <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onCrewCompositionChange(duty.dutyId || '', null)}>Use roster</button>
                    : <span className="text-xs text-muted-foreground">{duty.crewSource === 'fdp' ? 'Estimated from the FDP' : 'From roster'}</span>}
                </div>
                {duty.augmentationSuggested && !crewCompositionOverride && (
                  <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground/90">
                    This FDP is above the 2-pilot maximum and your roster does not show the crew. If you fly it with 3 or 4 pilots, set it here so in-flight rest and the augmented FDP limit are applied.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {duty.crewSource === 'fdp' && !crewCompositionOverride
                    ? 'No IR (in-flight rest) on this duty, so the crew is estimated from the planned FDP: the smallest augmented crew the in-flight rest limit (CS FTL.1.205(c)) allows for a bunk (the configured ULR route rules and an FDP over 18 h assume 4 pilots). Confirm it or choose the crew you flew. '
                    : 'IR (in-flight rest) on the roster marks an augmented crew, whatever your rank. Without IR the crew is estimated from the planned FDP and you can choose it here. '}
                  Changing the crew re-runs the analysis with the matching in-flight rest and FDP limits.
                </p>
              </div>
            )}
            {onCrewChange && (() => {
              // Always offered: a last-minute change overrides the roster. Crew A/B need 4 pilots,
              // so choosing one sets a 4-pilot crew.
              const effective = dutyCrewOverride || (duty.crewComposition === 'augmented_4' ? duty.ulrCrewSet : null);
              return (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                  <span className="text-muted-foreground">Crew set</span>
                  <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="Crew set">
                    {(['crew_a', 'crew_b'] as const).map((cs) => (
                      <button
                        key={cs}
                        type="button"
                        disabled={restFacilityBusy}
                        aria-pressed={effective === cs}
                        onClick={() => { if (effective !== cs) onCrewChange(duty.dutyId || '', cs); }}
                        className={cn('min-h-[44px] rounded-md px-3 text-xs font-medium transition-colors', effective === cs ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                      >
                        {cs === 'crew_a' ? 'A' : 'B'}
                      </button>
                    ))}
                  </div>
                  {dutyCrewOverride ? (
                    onCrewReset && <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onCrewReset(duty.dutyId || '')}>Use roster</button>
                  ) : <span className="text-xs text-muted-foreground">{effective ? 'From roster' : 'Not set'}</span>}
                  <p className="basis-full text-xs text-muted-foreground">Crew A and B exist with 4 pilots: choosing one sets a 4-pilot crew and overrides the roster.</p>
                </div>
              );
            })()}

            {duty.isUlr && duty.ulrCompliance && (
              <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
                <p className="font-medium">Ultra-long range: {duty.ulrCompliance.violations.length > 0 ? 'issues found' : duty.maxFdpHours == null ? 'partly assessed' : 'no threshold exceedances found'}</p>
                <p className="font-mono text-xs text-muted-foreground tabular">{duty.maxFdpHours == null ? 'FDP not assessed' : `Reference FDP ${duty.ulrCompliance.maxPlannedFdp?.toFixed(1) ?? '—'}h`} · {duty.ulrCompliance.monthlyUlrCount ?? '—'}/{duty.ulrCompliance.monthlyLimit ?? '—'} this month</p>
                <p className="text-xs text-muted-foreground">Configured scheme comparison. A route match does not establish operator approval or complete rest history.</p>
                {duty.ulrCompliance.warnings.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground" aria-label="ULR assumptions and coverage">
                    {duty.ulrCompliance.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
                  </ul>
                )}
                {duty.ulrCompliance.violations.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-risk-critical-ink">
                    {duty.ulrCompliance.violations.map((v, i) => <li key={i}>{v}</li>)}
                  </ul>
                )}
              </div>
            )}

            {duty.inflightRestBlocks && duty.inflightRestBlocks.length > 0 && (
              <>
                <CrewRestTimeline duty={duty} />
                <p className="text-xs text-muted-foreground">
                  Estimated in-flight sleep: <span className="font-mono tabular text-foreground">{inflightSleepHours(duty).toFixed(1)}h</span>
                  {duty.inflightRestBlocks[0]?.approvedPlan
                    ? ` · times from the configured ULR rest plan for this city pair; confirm current operator approval, Crew ${duty.ulrCrewSet === 'crew_a' ? 'A' : 'B'}`
                    : duty.inflightRestBlocks.some((b) => b.source === 'planned') ? ' · from the standard rest rotation (the roster shows no IR sector) — adjust the crew above if yours differs' : ' · estimated from IR sectors on your roster; confirm the rest plan'}
                </p>
                <ul className="space-y-1 rounded-xl border border-border bg-card p-3 text-xs" aria-label="In-flight rest">
                  {duty.inflightRestBlocks.map((block, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="font-mono text-muted-foreground tabular">
                        {homeTz ? `${formatHomeTime(block.startUtc, homeTz)}–${formatHomeTime(block.endUtc, homeTz)}` : `${block.startUtc.slice(11, 16)}Z–${block.endUtc.slice(11, 16)}Z`}
                      </span>
                      <span className="font-mono tabular">
                        {(block.effectiveSleepHours ?? 0).toFixed(1)}h modelled sleep of {(block.durationHours ?? 0).toFixed(1)}h{block.isDuringWocl ? ' · in WOCL' : ''}{block.source === 'planned' ? ' · planned' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
