import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnalysisResults } from '@/types/fatigue';

interface DeltaSummaryCardsProps {
  original: AnalysisResults;
  whatIf: AnalysisResults;
}

interface DeltaCardProps {
  label: string;
  originalValue: number;
  whatIfValue: number;
  format?: (v: number) => string;
  /** true = higher is better (e.g. performance), false = lower is better (e.g. risk count) */
  higherIsBetter?: boolean;
}

function DeltaCard({
  label,
  originalValue,
  whatIfValue,
  format = (v) => String(v),
  higherIsBetter = true,
}: DeltaCardProps) {
  const delta = whatIfValue - originalValue;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const worsened = higherIsBetter ? delta < 0 : delta > 0;
  const unchanged = delta === 0;

  const deltaColor = unchanged
    ? 'text-muted-foreground'
    : improved
      ? 'text-green-400'
      : 'text-red-400';

  const DeltaIcon = unchanged ? Minus : improved ? TrendingUp : TrendingDown;

  return (
    <Card variant="glass" className="p-3 md:p-4">
      <p className="text-[10px] text-muted-foreground mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-mono font-semibold text-foreground">
          {format(whatIfValue)}
        </span>
        <div className={`flex items-center gap-0.5 ${deltaColor}`}>
          <DeltaIcon className="h-3 w-3" />
          <span className="text-[10px] font-mono">
            {delta > 0 ? '+' : ''}
            {format(delta)}
          </span>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono">
        was {format(originalValue)}
      </p>
    </Card>
  );
}

export function DeltaSummaryCards({ original, whatIf }: DeltaSummaryCardsProps) {
  const origStats = original.statistics;
  const whatIfStats = whatIf.statistics;

  const pctFormat = (v: number) => `${v.toFixed(1)}%`;
  const intFormat = (v: number) => String(Math.round(v));
  const hoursFormat = (v: number) => `${v.toFixed(1)}h`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
      <DeltaCard
        label="Worst Performance"
        originalValue={origStats.worstPerformance}
        whatIfValue={whatIfStats.worstPerformance}
        format={pctFormat}
        higherIsBetter={true}
      />
      <DeltaCard
        label="High Risk Duties"
        originalValue={origStats.highRiskDuties}
        whatIfValue={whatIfStats.highRiskDuties}
        format={intFormat}
        higherIsBetter={false}
      />
      <DeltaCard
        label="Critical Risk"
        originalValue={origStats.criticalRiskDuties}
        whatIfValue={whatIfStats.criticalRiskDuties}
        format={intFormat}
        higherIsBetter={false}
      />
      <DeltaCard
        label="Avg Sleep"
        originalValue={origStats.avgSleepPerNight}
        whatIfValue={whatIfStats.avgSleepPerNight}
        format={hoursFormat}
        higherIsBetter={true}
      />
      <DeltaCard
        label="Max Sleep Debt"
        originalValue={origStats.maxSleepDebt}
        whatIfValue={whatIfStats.maxSleepDebt}
        format={hoursFormat}
        higherIsBetter={false}
      />
      <DeltaCard
        label="Pinch Events"
        originalValue={origStats.totalPinchEvents ?? 0}
        whatIfValue={whatIfStats.totalPinchEvents ?? 0}
        format={intFormat}
        higherIsBetter={false}
      />
    </div>
  );
}
