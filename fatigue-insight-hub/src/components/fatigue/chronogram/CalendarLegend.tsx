import { RISK_LEVELS, RISK_LEVEL_LABELS, riskCssColor } from '@/lib/risk-scale';

const BAND_KEY: Record<(typeof RISK_LEVELS)[number], string> = {
  low: '< 5.5',
  moderate: '5.5',
  high: '6.5',
  critical: '7.5',
  extreme: '8.5+',
};

/** The one calendar key: symbols, then the KSS bands, all drawn from the theme tokens. */
export function CalendarLegend({ showDiscretion, showStandby }: { showDiscretion?: boolean; showStandby?: boolean }) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground" aria-label="Calendar key" role="group">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-3 w-9 overflow-hidden rounded-[3px]">
            <span className="w-2" style={{ background: 'hsl(var(--muted-foreground) / 0.3)' }} />
            <span className="flex-1" style={{ background: riskCssColor('low') }} />
            <span className="flex-1" style={{ background: riskCssColor('high') }} />
          </span>
          Flight, coloured by its predicted KSS band as it changes
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="relative h-3 w-2">
            <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-foreground" />
            <span className="absolute left-1/2 top-0 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground" />
          </span>
          Duty peak
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-7 rounded-[3px] border border-dashed border-primary/60 bg-primary/10" />
          Estimated sleep
        </li>
        {showStandby && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-7 rounded-[3px] border border-muted-foreground/40"
              style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, hsl(var(--muted-foreground) / 0.35) 3px, hsl(var(--muted-foreground) / 0.35) 5px)' }} />
            Standby
          </li>
        )}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="wocl-hatch h-3 w-7 rounded-[3px]" />
          Body-clock low (WOCL 02:00–05:59)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-2 border-r-2 border-dashed border-muted-foreground" />
          FDP limit
        </li>
        {showDiscretion && (
          <li className="flex items-center gap-2 text-risk-critical-ink">
            <span aria-hidden="true" className="h-3 w-7 rounded-[3px] ring-2 ring-inset ring-risk-critical" />
            Commander&apos;s discretion
          </li>
        )}
      </ul>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Predicted sleepiness bands (KSS)">
        <li className="font-medium text-foreground">KSS bands</li>
        {RISK_LEVELS.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={level === 'extreme' ? 'risk-extreme-hatch h-3 w-3 rounded-[2px]' : 'h-3 w-3 rounded-[2px]'}
              style={{ backgroundColor: riskCssColor(level) }} />
            <span>{RISK_LEVEL_LABELS[level]}</span>
            <span className="font-mono tabular text-foreground/80">{BAND_KEY[level]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
