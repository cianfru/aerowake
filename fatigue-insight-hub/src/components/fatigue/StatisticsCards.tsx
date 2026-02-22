import { Plane, Timer, Zap, TrendingDown, AlertTriangle, AlertCircle, Clock, Globe, Users, Moon } from 'lucide-react';
import { DutyStatistics } from '@/types/fatigue';
import { InfoTooltip, FATIGUE_INFO, type InfoTooltipEntry } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';

interface StatisticsCardsProps {
  statistics: DutyStatistics;
}

export function StatisticsCards({ statistics }: StatisticsCardsProps) {
  const formatHoursMinutes = (hours: number): string => {
    if (!Number.isFinite(hours) || hours < 0) return '0:00';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      {/* Flight Activity Ribbon */}
      <div className="flex items-stretch gap-px rounded-lg overflow-hidden border border-border/50 bg-border/20">
        <RibbonStat label="Duties" value={statistics.totalDuties.toString()} icon={<Plane className="h-3.5 w-3.5" />} />
        <RibbonStat label="Sectors" value={statistics.totalSectors.toString()} icon={<Plane className="h-3.5 w-3.5" />} />
        <RibbonStat label="Duty Hrs" value={formatHoursMinutes(statistics.totalDutyHours)} icon={<Timer className="h-3.5 w-3.5" />} />
        <RibbonStat label="Block Hrs" value={formatHoursMinutes(statistics.totalBlockHours)} icon={<Timer className="h-3.5 w-3.5" />} />
      </div>

      {/* Fatigue Metrics Ribbon */}
      <div className="flex items-stretch gap-px rounded-lg overflow-hidden border border-border/50 bg-border/20">
        <RibbonStat
          label="Pinch Events"
          value={statistics.totalPinchEvents.toString()}
          icon={<Zap className="h-3.5 w-3.5" />}
          variant={statistics.totalPinchEvents === 0 ? 'success' : statistics.totalPinchEvents <= 3 ? 'warning' : 'critical'}
          info={FATIGUE_INFO.pinchEvent}
        />
        <RibbonStat
          label="Worst Score"
          value={`${Math.round(statistics.worstPerformance)}%`}
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          variant={statistics.worstPerformance >= 70 ? 'success' : statistics.worstPerformance >= 60 ? 'warning' : 'critical'}
          info={FATIGUE_INFO.performance}
        />
        <RibbonStat
          label="High Risk"
          value={statistics.highRiskDuties.toString()}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          variant={statistics.highRiskDuties === 0 ? 'success' : 'warning'}
        />
        <RibbonStat
          label="Critical"
          value={statistics.criticalRiskDuties.toString()}
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          variant={statistics.criticalRiskDuties === 0 ? 'success' : 'critical'}
        />
        <RibbonStat
          label="Avg Sleep"
          value={`${statistics.avgSleepPerNight.toFixed(1)}h`}
          icon={<Moon className="h-3.5 w-3.5" />}
          variant={statistics.avgSleepPerNight >= 7 ? 'success' : statistics.avgSleepPerNight >= 6 ? 'warning' : 'critical'}
          info={FATIGUE_INFO.avgSleep}
        />
        <RibbonStat
          label="Sleep Debt"
          value={`${statistics.maxSleepDebt.toFixed(1)}h`}
          icon={<Clock className="h-3.5 w-3.5" />}
          variant={statistics.maxSleepDebt <= 2 ? 'success' : statistics.maxSleepDebt <= 4 ? 'warning' : 'critical'}
          info={FATIGUE_INFO.sleepDebt}
        />
      </div>

      {/* ULR/Augmented Stats Ribbon - only when relevant */}
      {(statistics.totalUlrDuties > 0 || statistics.totalAugmentedDuties > 0) && (
        <div className="flex items-stretch gap-px rounded-lg overflow-hidden border border-border/50 bg-border/20">
          <RibbonStat
            label="ULR Duties"
            value={statistics.totalUlrDuties.toString()}
            icon={<Globe className="h-3.5 w-3.5" />}
          />
          <RibbonStat
            label="Augmented"
            value={statistics.totalAugmentedDuties.toString()}
            icon={<Users className="h-3.5 w-3.5" />}
          />
          {statistics.ulrViolations.length > 0 && (
            <RibbonStat
              label="ULR Violations"
              value={statistics.ulrViolations.length.toString()}
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              variant="critical"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface RibbonStatProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'critical';
  /** Optional info tooltip entry — shows (i) icon on hover/click. */
  info?: InfoTooltipEntry;
}

function RibbonStat({ label, value, icon, variant = 'neutral', info }: RibbonStatProps) {
  const variantStyles = {
    neutral: { value: 'text-foreground', icon: 'text-muted-foreground' },
    success: { value: 'text-success', icon: 'text-success' },
    warning: { value: 'text-warning', icon: 'text-warning' },
    critical: { value: 'text-critical', icon: 'text-critical' },
  };
  const styles = variantStyles[variant];

  return (
    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-card/60 min-w-0">
      <span className={cn("flex-shrink-0", styles.icon)}>{icon}</span>
      <div className="min-w-0">
        <div className={cn("text-base font-semibold tabular-nums leading-tight", styles.value)}>{value}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
          <span className="truncate">{label}</span>
          {info && <InfoTooltip entry={info} size="sm" />}
        </div>
      </div>
    </div>
  );
}
