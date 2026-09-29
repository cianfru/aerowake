import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RISK_LEVEL_KSS_RANGE, riskCssColor } from '@/lib/risk-scale';

export function TimelineLegend({ showDiscretion, variant = 'homebase' }: { showDiscretion?: boolean; variant?: 'homebase' | 'elapsed' }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
    <div className="flex flex-wrap gap-x-5 gap-y-3" aria-label="Calendar key">
      <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-7 rounded-sm bg-primary" />Solid bars: flights and duties</span>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-7 rounded-sm border border-dashed border-primary/60 bg-primary/10" />Dashed blocks: estimated sleep</span>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-2 border-r-2 border-dashed border-muted-foreground" />Dashed line: calculated FDP limit</span>
    </div>
    <p className="text-muted-foreground">Select a bar for details, a sleep block for its assumptions, or an FDP line to review the linked duty.</p>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      More chart symbols <ChevronDown className={`h-3 w-3 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    {expanded && <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-sm wocl-hatch" />Body-clock low (WOCL)</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-sm bg-warning/10 border border-warning/30" />Evening wake-maintenance zone</span>
        <span>Hatched bars: standby or in-flight rest; select standby for its times</span>
        {showDiscretion && <span className="text-critical">Outlined duties: commander’s discretion</span>}
        {variant === 'elapsed' && <span>Vertical circadian marker: predicted body-clock nadir</span>}
      </div>
      <div className="flex flex-wrap gap-3" aria-label="Predicted sleepiness bands">
        {(['low', 'moderate', 'high', 'critical', 'extreme'] as const).map(level => <span key={level} className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ backgroundColor: riskCssColor(level) }} />{RISK_LEVEL_KSS_RANGE[level]}</span>)}
      </div>
      <p className="text-muted-foreground">Flight colors show predicted sleepiness, not a percentage of performance or a fitness-for-duty decision.</p>
    </div>}
  </div>;
}
