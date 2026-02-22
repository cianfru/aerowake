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
            'inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
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

        {entry.formula && (
          <div className="rounded bg-secondary/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            {entry.formula}
          </div>
        )}

        {(entry.reference || entry.regulation) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {entry.reference && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {entry.reference}
              </span>
            )}
            {entry.regulation && (
              <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
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
      'Integrated alertness score (20-100%) combining three biological processes: homeostatic sleep drive, circadian rhythm, and sleep inertia, minus time-on-task degradation.',
    reference: 'Hursh et al., 2004 (SAFTE)',
    formula: 'P = 20 + 80 \u00d7 [S\u00b7C \u00d7 (1\u2212W) \u2212 ToT]',
  },
  sleepPressure: {
    description:
      'Process S — the homeostatic sleep drive that accumulates exponentially during wakefulness and dissipates during sleep. Higher values indicate greater sleep need.',
    reference: 'Borb\u00e9ly, 1982',
    formula: 'S(t) = S\u2080 \u00d7 e^(-t/\u03c4_d) during sleep',
  },
  circadian: {
    description:
      'Process C — the endogenous ~24h biological clock that modulates alertness independently of sleep history. Lowest between 02:00-05:59 (WOCL).',
    reference: 'Dijk & Czeisler, 1995',
    regulation: 'AMC1 ORO.FTL.105(10)',
  },
  sleepInertia: {
    description:
      'Process W — the transient grogginess after awakening that impairs cognitive performance. Dissipates within 15-30 minutes but can be severe during WOCL.',
    reference: 'Tassi & Muzet, 2000',
  },
  timeOnTask: {
    description:
      'Linear degradation of alertness with increasing time on duty, approximately 0.8% per hour. Compounds with other fatigue factors during long duties.',
    reference: 'Folkard & \u00c5kerstedt, 1999',
  },
  sleepDebt: {
    description:
      'Cumulative deficit between actual sleep obtained and the 8h baseline need. Debt above 4h significantly impairs cognitive performance and reaction time.',
    reference: 'Van Dongen et al., 2003',
  },
  wocl: {
    description:
      'Window of Circadian Low — the period of lowest alertness between 02:00-05:59 in home base time. Duties during WOCL carry elevated fatigue risk.',
    regulation: 'AMC1 ORO.FTL.105(10)',
  },
  priorSleep: {
    description:
      'Total sleep obtained in the 48 hours before duty report. Less than 12h of prior sleep indicates elevated risk of in-duty fatigue.',
    reference: 'Belenky et al., 2003',
    regulation: 'ORO.FTL.120',
  },
  avgSleep: {
    description:
      'Average nightly sleep across the roster period. Adults need 7-9h for full cognitive recovery. Below 6h indicates chronic sleep restriction.',
    reference: 'Banks & Dinges, 2007',
  },
  pinchEvent: {
    description:
      'A moment during a critical flight phase (takeoff, approach, landing) where performance drops below the safety threshold. Each event requires mitigation.',
    reference: 'Hursh et al., 2004',
  },
  fha: {
    description:
      'Fatigue Hazard Area — cumulative area (in %-minutes) where performance falls below the 77% moderate-risk threshold. Higher FHA indicates greater total fatigue exposure.',
    reference: 'Dawson & McCulloch, 2005',
    formula: 'FHA = \u222b max(0, 77 \u2212 P(t)) dt',
  },
  kss: {
    description:
      'Karolinska Sleepiness Scale — a validated subjective sleepiness measure from 1 (extremely alert) to 9 (extremely sleepy). Mapped from model performance.',
    reference: '\u00c5kerstedt & Gillberg, 1990',
  },
  samnPerelli: {
    description:
      'Samn-Perelli Fatigue Scale — a 7-point scale developed for aviation (1 = fully alert, 7 = completely exhausted). Widely used in military and civil fatigue studies.',
    reference: 'Samn & Perelli, 1982',
  },
  reactionTime: {
    description:
      'Psychomotor Vigilance Task (PVT) mean reaction time estimate. Derived from the performance model. Values above 350ms indicate significant impairment.',
    reference: 'Basner & Dinges, 2011',
  },
  fdpUtilization: {
    description:
      'How much of the maximum Flight Duty Period limit is consumed by this duty. Exceeding 100% requires Commander Discretion reporting.',
    regulation: 'ORO.FTL.205',
  },
  workloadPhase: {
    description:
      'Cognitive workload varies by flight phase. Takeoff (1.8\u00d7) and landing (2.0\u00d7) are the most demanding; cruise (0.8\u00d7) is the least.',
    reference: 'Wickens, 2008',
  },
  sleepReservoir: {
    description:
      'A normalized measure of available sleep reserves (50-100%). Derived from cumulative sleep debt — lower values indicate greater fatigue vulnerability.',
    reference: 'Hursh et al., 2004 (SAFTE)',
  },
};
