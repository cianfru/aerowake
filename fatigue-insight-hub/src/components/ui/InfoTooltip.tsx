import { ArrowUpRight, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { riskClasses, RISK_LEVELS } from '@/lib/risk-scale';
import { cn } from '@/lib/utils';

export interface InfoTooltipEntry {
  title?: string;
  description: string;
  reference?: string;
  regulation?: string;
  formula?: string;
  threshold?: string;
  actionTip?: string;
  /** Stable key in the evidence library. */
  sourceId?: string;
  /** Schematic explanation, never a second prediction or a measured value. */
  visual?: 'sleepiness' | 'sleep' | 'body-clock' | 'fdp' | 'provenance';
}

interface InfoTooltipProps {
  entry: InfoTooltipEntry;
  className?: string;
  size?: 'sm' | 'md';
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
}

function ExplanationGraphic({ kind }: { kind: NonNullable<InfoTooltipEntry['visual']> }) {
  if (kind === 'sleepiness') return <figure className="space-y-2 rounded-lg bg-secondary/50 p-3">
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
      {RISK_LEVELS.map((level, i) => <span key={level} className={riskClasses(level).fill} style={{ flex: i === 0 ? 4.5 : i === 4 ? 0.5 : 1 }} />)}
    </div>
    <div className="flex justify-between text-xs"><span>1 · Alert</span><span>9 · Fighting sleep</span></div>
    <figcaption className="text-xs text-muted-foreground">KSS describes sleepiness. Colour bands are Aerowake planning thresholds.</figcaption>
  </figure>;
  if (kind === 'body-clock') return <figure className="space-y-2 rounded-lg bg-secondary/50 p-3">
    <div className="relative h-3 rounded-full bg-muted" aria-hidden="true"><span className="absolute inset-y-0 rounded-sm bg-wocl" style={{ left: '8.333%', width: '16.667%' }} /></div>
    <div className="flex justify-between text-xs"><span>00:00</span><span>02:00–05:59 WOCL</span><span>24:00</span></div>
    <figcaption className="text-xs text-muted-foreground">The calendar shades a home-base reference window. An adapting body clock can differ.</figcaption>
  </figure>;
  const steps = kind === 'sleep' ? ['Sleep opportunity', 'Sleep estimate', 'Forecast']
    : kind === 'fdp' ? ['Roster times', 'Scheme + approvals', 'Scoped check']
    : ['Roster', 'Assumptions', 'Model estimate'];
  return <figure className="rounded-lg bg-secondary/50 p-3">
    <ol className="grid grid-cols-3 gap-3 text-xs">
      {steps.map((step, i) => <li key={step}><span className="mb-1 block font-mono text-primary" aria-hidden="true">0{i + 1}</span>{step}</li>)}
    </ol>
    <figcaption className="mt-2 text-xs text-muted-foreground">{kind === 'fdp' ? 'Incomplete inputs or unconfirmed approvals limit the result.' : 'Changing the inputs can change the forecast.'}</figcaption>
  </figure>;
}

/** Tap or keyboard-open explanation; stays open while its sources are inspected. */
export function InfoTooltip({ entry, className, size = 'sm', align = 'center', side = 'top' }: InfoTooltipProps) {
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button"
        className={cn('inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11', className)}
        aria-label={entry.title ? `About ${entry.title.toLowerCase()}` : 'More information'}>
        <Info aria-hidden="true" className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </button>
    </PopoverTrigger>
    <PopoverContent aria-label={entry.title ?? 'Metric explanation'} align={align} side={side} collisionPadding={16}
      className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(80dvh,var(--radix-popover-content-available-height))] overflow-y-auto space-y-3 rounded-xl border border-border bg-popover p-4 text-sm leading-relaxed shadow-xl">
      {entry.title && <h3 className="font-semibold">{entry.title}</h3>}
      {entry.visual && <ExplanationGraphic kind={entry.visual} />}
      <p>{entry.description}</p>
      {entry.threshold && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Interpretation: </span>{entry.threshold}</p>}
      {entry.formula && <p className="break-words rounded bg-secondary/50 px-2.5 py-2 font-mono text-xs text-muted-foreground">{entry.formula}</p>}
      {entry.actionTip && <p className="border-t border-border pt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">For your review: </span>{entry.actionTip}</p>}
      {(entry.reference || entry.regulation) && <p className="text-xs text-muted-foreground">{[entry.reference, entry.regulation].filter(Boolean).join(' · ')}</p>}
      {entry.sourceId && <a className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary underline underline-offset-4" href={`/learn?section=references&source=${encodeURIComponent(entry.sourceId)}`} target="_blank" rel="noreferrer">Evidence & limitations <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
    </PopoverContent>
  </Popover>;
}

/**
 * Pre-defined scientific info entries for common fatigue metrics.
 * Import this dictionary wherever InfoTooltip is used for consistency.
 */
export const FATIGUE_INFO: Record<string, InfoTooltipEntry> = {
  performance: {
    title: "Predicted sleepiness",
    sourceId: "akerstedt_2014",
    visual: "sleepiness",
    description: "The Three Process Model combines sleep pressure and body-clock rhythms to estimate group-average KSS (1–9). The published model was evaluated on airline crew; the complete Aerowake forecast still requires independent validation. Its 20–100 index is a linear re-expression of KSS, never a cognitive performance percentage.",
    formula: 'KSS = 9.68 − 0.46 × (S_B + C + U); index = 110 − 10 × KSS',
    actionTip: 'The source study’s residual error is about 1.42 KSS units; it is not an accuracy claim for Aerowake. Your assessment takes precedence.',
  },
  sleepPressure: {
    title: "Sleep pressure",
    sourceId: "akerstedt_2014",
    visual: "sleep",
    description: "Time awake increases sleep pressure; sleep reduces it. Process S is shown normalised from 0 to 1 (1 means most depleted). Its contribution depends on the sleep inputs, which are estimated from the roster unless you change them.",
  },
  circadian: {
    title: "Body clock",
    sourceId: "akerstedt_2014",
    visual: "body-clock",
    description: "The body clock changes sleepiness across the day. This model closes 30% of the remaining timezone gap per day, an adaptation assumption rather than a measurement of your body clock. The fixed home-base WOCL overlay is a separate reference.",
  },
  hoursAwake: {
    title: "Time awake",
    sourceId: "akerstedt_2014",
    visual: "sleep",
    description: "Continuous time awake calculated from the model’s sleep inputs. A planned sleep block or nap resets this estimate even if you have not actually slept. Check the inputs before interpreting the number.",
  },
  kss90: {
    title: "Sleepier pilots",
    sourceId: "akerstedt_2014",
    visual: "sleepiness",
    description: "A 90th-percentile reference from individual differences in the published model’s study sample. It illustrates variability; it is not a confidence bound for this forecast or a guarantee that nine in ten pilots in a new population fall below it.",
  },
  pSevere: {
    title: "Probability of KSS 7 or higher",
    sourceId: "akerstedt_2014",
    visual: "sleepiness",
    description: "The published ordinal model estimates the probability of a KSS rating of 7 or higher. This describes subjective sleepiness in the source model, not accident probability or your personal likelihood of falling asleep.",
  },
  sleepDeficit7d: {
    title: "Seven-day sleep shortfall",
    sourceId: "van_dongen_2003",
    visual: "sleep",
    description: "Estimated sleep over a rolling seven-day window compared with the model’s 8-hour daily baseline. Actual sleep need varies and missing history limits this estimate. The ledger is shown separately from KSS because sleepiness ratings do not fully capture impairment under repeated restriction.",
  },
  sleepInertia: {
    title: "Sleep inertia",
    reference: 'Ingre et al. (2014), model 5c; Tassi & Muzet (2000), sleep inertia review',
    sourceId: "akerstedt_2014",
    visual: "sleep",
    description: "Grogginess after waking can affect performance. It is not included in the current KSS score: the tested inertia term did not improve the airline study’s model fit. The duration and severity vary with prior sleep loss and timing.",
    actionTip: 'Allow recovery after waking and follow your operator’s procedures before safety-critical tasks.',
  },
  timeOnTask: {
    description:
      'Duty length and sectors are reported as separate contributing factors. They are not added to the alertness score, which is not validated for a time-on-task term.',
    reference: 'Ingre et al., 2014',
    actionTip: 'Take micro-breaks during cruise. Verbal crosschecks help maintain vigilance.',
  },
  sleepDebt: {
    title: "Accumulated sleep shortfall",
    sourceId: "van_dongen_2003",
    visual: "sleep",
    description: "A running estimate of missed sleep against an 8-hour daily baseline, based on available sleep inputs. It is a separate contextual ledger, not an additional penalty in the KSS score. It cannot measure your personal sleep need.",
  },
  wocl: {
    title: "Window of circadian low",
    sourceId: "easa_oro_ftl",
    visual: "body-clock",
    description: "The calendar shades 02:00–05:59 in home-base time as a reference for the window of circadian low. Biological low points can shift after timezone travel. Formal FTL acclimatisation and your actual body-clock phase must be considered separately.",
    regulation: 'ORO.FTL.105(28)',
    actionTip: 'Review the sleep plan and your operator’s permitted fatigue mitigations before duties in this window.',
  },
  priorSleep: {
    title: "Sleep before report",
    sourceId: "dawson_mcculloch_2005",
    visual: "sleep",
    description: "Total modelled sleep in the 24 hours before duty report. This includes naps and is an estimate of sleep, not a record of actual sleep obtained. The separate prior sleep/wake check also considers a 48-hour window and time awake.",
  },
  avgSleep: {
    title: "Average modelled sleep",
    sourceId: "banks_dinges_2007",
    visual: "sleep",
    description: "Mean daily sleep over the days covered by the model’s sleep estimates. Uncovered days are not treated as zero sleep or as full nights. Sleep opportunity, planned sleep and reported actual sleep are different inputs.",
  },
  pinchEvent: {
    title: "Critical-phase exposure",
    sourceId: "akerstedt_2014",
    visual: "provenance",
    description: "A takeoff, approach or landing sample where predicted sleepiness enters an elevated Aerowake band. The threshold and phase flag are product review rules; the source model predicts KSS rather than an operational event or accident.",
  },
  fha: {
    title: "Cumulative sleepiness exposure",
    sourceId: "akerstedt_2014",
    visual: "provenance",
    description: "Aerowake’s summary of time above KSS 5.5, weighted by how far above it. This combines depth and duration of predicted sleepiness. The metric and its display bands are product assumptions, not validated accident or reporting thresholds.",
    formula: 'Σ max(0, KSS(t) − 5.5) × elapsed hours',
  },
  kss: {
    title: "Karolinska Sleepiness Scale",
    sourceId: "akerstedt_gillberg_1990",
    visual: "sleepiness",
    description: "The KSS is a subjective scale from 1 (extremely alert) to 9 (very sleepy, fighting sleep). Aerowake predicts a group-average rating from sleep and timing inputs. A pilot’s own reported rating is a separate observation.",
    threshold: 'Aerowake bands: <5.5 low · 5.5–<6.5 moderate · 6.5–<7.5 high · 7.5–<8.5 critical · ≥8.5 extreme.',
    actionTip: 'These bands organise review; they are not regulatory limits or a fitness decision.',
  },
  samnPerelli: {
    description:
      'Samn-Perelli Fatigue Scale \u2014 a 7-point self-rating used in aviation (1 = fully alert, 7 = completely exhausted). There is no validated mapping from the model\u2019s KSS prediction, so it is not estimated here; use it for self-rating.',
    reference: 'Samn & Perelli, 1982',
  },
  reactionTime: {
    description:
      'Reaction time is not estimated: the KSS model has no validated mapping to reaction time.',
    reference: 'Ingre et al., 2014',
  },
  fdpUtilization: {
    title: "Flight duty period",
    sourceId: "easa_oro_ftl",
    visual: "fdp",
    description: "Planned FDP divided by the configured maximum for this duty. The applicable limit depends on the approved operator scheme, acclimatisation, sectors, crew and rest facilities. Confirm these assumptions and any FRM, extension or ULR approval before interpreting the result.",
    regulation: 'ORO.FTL.205 and the approved operator scheme',
    threshold: 'Above 100% means the configured basic limit is exceeded; it does not establish that an extension is available.',
    actionTip: 'Commander’s discretion addresses unforeseen circumstances and must never be treated as a planning allowance.',
  },
  workloadPhase: {
    description:
      'Cognitive workload varies by flight phase; takeoff and landing are the most demanding. Workload is shown for context only and does not change the KSS prediction.',
    reference: 'Wickens, 2008',
  },
  sleepReservoir: {
    description:
      'Display-only view of the cumulative sleep debt estimate (100% = no debt, 50% = 16h debt). Not an input to the KSS prediction.',
    reference: 'Display transform of the model sleep ledger',
    threshold: 'Display bands only; no independently validated safety threshold.',
    actionTip: 'Review the actual sleep assumptions behind the ledger.',
  },
  wmz: {
    title: "Wake maintenance zone",
    sourceId: "dijk_czeisler_1994",
    description: "An evening interval of stronger circadian wake drive can make sleep difficult despite earlier time awake. Timing depends on your body clock. The model’s home-time evening window is an assumption, not a measured individual phase.",
  },
  pvtLapses: {
    description:
      'This legacy heuristic is not a measured PVT result. There is no validated conversion from Aerowake’s predicted KSS to reaction-time lapses; it must not be interpreted as a performance forecast.',
    reference: 'Legacy application heuristic; no validated KSS-to-PVT conversion',
  },
  microsleepProbability: {
    title: "Probability of KSS 9",
    sourceId: "akerstedt_2014",
    visual: "sleepiness",
    description: "The published ordinal model’s probability of a KSS 9 rating (very sleepy, fighting sleep). It does not measure microsleeps or predict their frequency.",
  },
  cabinAltitude: {
    description:
      'Cabin altitude (6,000-8,000 ft equivalent) is shown for context. Mild hypoxia is not included in the KSS prediction.',
    reference: 'Nesthus et al., 2007; Muhm et al., 2007',
  },
};
