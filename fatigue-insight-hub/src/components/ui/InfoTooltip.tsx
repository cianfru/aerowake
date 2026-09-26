import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface InfoTooltipEntry {
  /** Short human-readable description (1-2 sentences). */
  description: string;
  /** Optional scientific reference, e.g. "Borbely, 1982". */
  reference?: string;
  /** Optional EASA regulation, e.g. "ORO.FTL.120". */
  regulation?: string;
  /** Optional formula or equation string. */
  formula?: string;
  /** Threshold description, e.g. "KSS <5.5 low, ≥8.5 extreme". */
  threshold?: string;
  /** Practical action tip for the pilot. */
  actionTip?: string;
}

interface InfoTooltipProps {
  /** Primary content displayed in the popover. */
  entry: InfoTooltipEntry;
  /** Additional className for the trigger icon. */
  className?: string;
  /** Icon size variant. */
  size?: 'sm' | 'md';
  /** Popover alignment. */
  align?: 'start' | 'center' | 'end';
  /** Popover side. */
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Reusable information tooltip that shows scientific context on hover/click.
 *
 * Usage:
 * ```tsx
 * <InfoTooltip entry={{
 *   description: "The homeostatic sleep drive accumulates during wakefulness.",
 *   reference: "Borbely, 1982",
 *   regulation: "ORO.FTL.120",
 * }} />
 * ```
 */
export function InfoTooltip({
  entry,
  className,
  size = 'sm',
  align = 'center',
  side = 'top',
}: InfoTooltipProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full text-muted-foreground/80 hover:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
          aria-label="More information"
        >
          <Info className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-72 rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm space-y-2"
      >
        <p className="text-foreground leading-relaxed">{entry.description}</p>

        {entry.threshold && (
          <div className="flex items-start gap-1.5 text-[11px]">
            <span className="text-muted-foreground font-medium shrink-0">Threshold:</span>
            <span className="text-foreground/80">{entry.threshold}</span>
          </div>
        )}

        {entry.formula && (
          <div className="rounded bg-secondary/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            {entry.formula}
          </div>
        )}

        {entry.actionTip && (
          <div className="flex items-start gap-1.5 text-[11px] border-t border-border/50 pt-1.5">
            <span className="text-primary font-medium shrink-0">Tip:</span>
            <span className="text-muted-foreground">{entry.actionTip}</span>
          </div>
        )}

        {(entry.reference || entry.regulation) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {entry.reference && (
              <span className="inline-flex items-center rounded-[4px] border border-primary/30 bg-primary/[0.04] px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-primary">
                {entry.reference}
              </span>
            )}
            {entry.regulation && (
              <span className="inline-flex items-center rounded-[4px] border border-warning/30 bg-warning/[0.04] px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-warning">
                {entry.regulation}
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Pre-defined scientific info entries for common fatigue metrics.
 * Import this dictionary wherever InfoTooltip is used for consistency.
 */
export const FATIGUE_INFO: Record<string, InfoTooltipEntry> = {
  performance: {
    description:
      'Predicted sleepiness on the Karolinska Sleepiness Scale (KSS 1\u20139) from the Three Process Model (sleep pressure S, circadian C, ultradian U), validated on airline crew. The 20\u2013100 index is a linear re-expression of KSS; it is not a percentage.',
    reference: 'Ingre et al., 2014 (PLoS ONE e108679)',
    formula: 'KSS = 9.68 \u2212 0.46\u00b7(S + C + U);  index = 110 \u2212 10\u00b7KSS',
    threshold: 'KSS <5.5 low \u00b7 5.5\u20136.5 moderate \u00b7 6.5\u20137.5 high \u00b7 7.5\u20138.5 critical \u00b7 \u22658.5 extreme',
    actionTip: 'Group-average prediction (typical error \u00b11.4 KSS). Your own assessment of fitness to fly always takes precedence.',
  },
  sleepPressure: {
    description:
      'Process S \u2014 homeostatic sleep pressure. Builds during wakefulness and recovers during sleep (with a "brake" near full recovery). Shown normalised 0\u20131 (1 = depleted). Up to ~5.5 KSS points at full depletion.',
    reference: 'Ingre et al., 2014; \u00c5kerstedt & Folkard, 1997',
    actionTip: 'Prioritize 7-8h sleep before duty. A nap before a late or night duty reduces sleep pressure.',
  },
  circadian: {
    description:
      'Process C \u2014 the body clock. Shown normalised 0\u20131 (1 = circadian peak). Worth up to ~2.3 KSS points between peak and trough; lowest in the early morning body-clock hours (WOCL). The body clock re-adapts to a new time zone at ~30% of the remaining difference per day.',
    reference: 'Ingre et al., 2014',
    regulation: 'AMC1 ORO.FTL.105(10)',
    threshold: 'Body clock low: 02:00-05:59 home base time',
    actionTip: 'Use strategic light exposure and meal timing to support circadian alignment on layovers.',
  },
  hoursAwake: {
    description:
      'Continuous hours awake at this point, from the model\u2019s sleep inputs. Sleep pressure (S) rises with time awake; the KSS prediction already accounts for it.',
    reference: 'Ingre et al., 2014',
    actionTip: 'Verify the assumed sleep and naps \u2014 hours awake are only as good as the sleep inputs.',
  },
  kss90: {
    description:
      'Predicted KSS for a more fatigue-sensitive pilot (90th percentile of individual differences in the validation data). Nine in ten pilots are expected to rate at or below this value.',
    reference: 'Ingre et al., 2014 (eq. 1.16)',
  },
  pSevere: {
    description:
      'Model probability that a pilot rates KSS 7 or higher ("sleepy") at this point, from the published ordinal model. KSS \u2265 7 is associated with physiological signs of sleepiness.',
    reference: 'Ingre et al., 2014 (eq. 1.17); \u00c5kerstedt et al., 2014',
    threshold: '<10% low, 10\u201330% elevated, >30% high',
  },
  sleepDeficit7d: {
    description:
      'Rolling 7-day sleep ledger against an 8 h/day need. Reported separately because subjective sleepiness (KSS) plateaus under chronic restriction while objective performance keeps worsening.',
    reference: 'Van Dongen et al., 2003; Belenky et al., 2003',
    threshold: '<5h none \u00b7 5\u201310h mild \u00b7 10\u201315h moderate \u00b7 \u226515h severe',
    actionTip: 'Recovery usually needs more than one long sleep; plan several nights of full sleep.',
  },
  sleepInertia: {
    description:
      'Grogginess just after waking. Not included in the alertness score: the default inertia function worsened fit in the airline validation study. Allow time after waking before critical tasks.',
    reference: 'Ingre et al., 2014; Tassi & Muzet, 2000',
    actionTip: 'Allow 15-30 min after waking before critical tasks. Bright light and caffeine help.',
  },
  timeOnTask: {
    description:
      'Duty length and sectors are reported as separate contributing factors. They are not added to the alertness score, which is not validated for a time-on-task term.',
    reference: 'Ingre et al., 2014',
    actionTip: 'Take micro-breaks during cruise. Verbal crosschecks help maintain vigilance.',
  },
  sleepDebt: {
    description:
      'Cumulative deficit between sleep obtained and the 8h baseline need (model estimate). Not added to the KSS score; see the 7-day sleep deficit for the restriction ledger.',
    reference: 'Van Dongen et al., 2003',
    threshold: '\u22642h low risk, 2-4h moderate, >4h high risk',
    actionTip: 'Recovery requires 2-3 nights of extended sleep. One long sleep cannot fully repay large debt.',
  },
  wocl: {
    description:
      'Window of Circadian Low — the period of lowest alertness between 02:00-05:59 in home base time. Duties during WOCL carry elevated fatigue risk.',
    regulation: 'AMC1 ORO.FTL.105(10)',
    threshold: '02:00-05:59 home base time',
    actionTip: 'Request controlled rest if operating during WOCL with augmented crew.',
  },
  priorSleep: {
    description:
      'Total sleep obtained in the 48 hours before duty report. Less than 12h of prior sleep indicates elevated risk of in-duty fatigue.',
    reference: 'Belenky et al., 2003',
    regulation: 'ORO.FTL.120',
    threshold: '\u226512h adequate, <12h elevated risk',
    actionTip: 'Plan sleep strategically in the 48h before early-morning or long-haul duties.',
  },
  avgSleep: {
    description:
      'Average nightly sleep across the roster period. Adults need 7-9h for full cognitive recovery. Below 6h indicates chronic sleep restriction.',
    reference: 'Banks & Dinges, 2007',
    threshold: '\u22657h good, 6-7h marginal, <6h chronic restriction',
    actionTip: 'Maintain consistent sleep schedule on days off to build reserves for demanding periods.',
  },
  pinchEvent: {
    description:
      'A moment during a critical flight phase (takeoff, approach, landing) where predicted sleepiness enters an elevated risk band. Each event warrants mitigation.',
    reference: 'Ingre et al., 2014',
    threshold: 'Any occurrence during takeoff, approach, or landing',
    actionTip: 'Consider enhanced crew monitoring and verbal callouts during critical phases.',
  },
  fha: {
    description:
      'Fatigue Hazard Area \u2014 cumulative time spent above the low-risk boundary (KSS 5.5), weighted by how far above. Integrates depth and duration of predicted sleepiness.',
    reference: 'Dawson & McCulloch, 2005 (concept)',
    formula: 'FHA = \u03A3 max(0, KSS(t) \u2212 5.5) \u00D7 \u0394t',
    threshold: '\u22640.5 low, 0.5\u20132 moderate, >2 high (KSS-hours)',
    actionTip: 'High FHA may warrant fatigue report filing under EASA ORO.FTL.120.',
  },
  kss: {
    description:
      'Karolinska Sleepiness Scale \u2014 1 (extremely alert) to 9 (very sleepy, fighting sleep). Predicted directly by the Three Process Model for a group-average pilot.',
    reference: '\u00c5kerstedt & Gillberg, 1990; Ingre et al., 2014',
    threshold: '<5.5 low \u00b7 5.5\u20136.5 moderate \u00b7 6.5\u20137.5 high \u00b7 7.5\u20138.5 critical \u00b7 \u22658.5 extreme',
    actionTip: 'KSS \u2265 7 is associated with physiological signs of sleepiness; 8\u20139 with sharply more lapses.',
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
    description:
      'How much of the maximum Flight Duty Period limit is consumed by this duty. Exceeding 100% requires Commander Discretion reporting.',
    regulation: 'ORO.FTL.205',
    threshold: '\u226475% normal, 75-100% high utilization, >100% exceedance',
    actionTip: 'Monitor for delays that could push FDP beyond limits. Report any Commander Discretion use.',
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
    threshold: '>80% good, 65-80% moderate, <65% depleted',
    actionTip: 'Sleep reservoir replenishes slowly. Multiple nights of good sleep are needed to rebuild.',
  },
  wmz: {
    description:
      'Wake Maintenance Zone — a paradoxical period of elevated alertness from ~18:00-21:00 home base time, driven by the second harmonic of the circadian rhythm.',
    reference: 'Dijk & Czeisler, 1994',
    threshold: '~18:00-21:00 home base time',
  },
  pvtLapses: {
    description:
      'Legacy heuristic estimate of Psychomotor Vigilance Task lapses per 10-minute trial from sleep debt and time awake. Not part of the validated KSS model; indicative only.',
    reference: 'Van Dongen et al., 2003 (heuristic)',
  },
  microsleepProbability: {
    description:
      'Model probability of a KSS 9 rating ("very sleepy, fighting sleep") at this point, from the published ordinal model. A marker of severe sleepiness, not a measured microsleep rate.',
    reference: 'Ingre et al., 2014 (eq. 1.17)',
    threshold: '<2% low, 2-5% moderate, >5% high',
    actionTip: 'Any meaningful probability of KSS 9 warrants enhanced crew monitoring.',
  },
  cabinAltitude: {
    description:
      'Cabin altitude (6,000-8,000 ft equivalent) is shown for context. Mild hypoxia is not included in the KSS prediction.',
    reference: 'Nesthus et al., 2007; Muhm et al., 2007',
  },
};
