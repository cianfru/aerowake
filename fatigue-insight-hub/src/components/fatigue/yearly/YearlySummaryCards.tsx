import { Plane, Clock, Activity, Moon, AlertTriangle, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { YearlySummary } from '@/lib/api-client';

interface YearlySummaryCardsProps {
  summary: YearlySummary;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <Card variant="glass" className="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-xl md:text-2xl font-bold font-mono ${color}`}>{value}</p>
          {subValue && (
            <p className="text-[11px] text-muted-foreground">{subValue}</p>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </Card>
  );
}

function getPerformanceColor(value: number): string {
  if (value >= 77) return 'text-[hsl(var(--success))]';
  if (value >= 55) return 'text-[hsl(var(--warning))]';
  return 'text-[hsl(var(--critical))]';
}

function getSleepColor(value: number): string {
  if (value >= 7) return 'text-[hsl(var(--success))]';
  if (value >= 6) return 'text-[hsl(var(--warning))]';
  return 'text-[hsl(var(--critical))]';
}

export function YearlySummaryCards({ summary }: YearlySummaryCardsProps) {
  const totalRiskDuties = summary.total_high_risk_duties + summary.total_critical_risk_duties;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
      <StatCard
        icon={Plane}
        label="Total Duties"
        value={summary.total_duties}
        subValue={`${summary.total_sectors} sectors`}
        color="text-foreground"
      />
      <StatCard
        icon={Clock}
        label="Duty Hours"
        value={summary.total_duty_hours.toFixed(0)}
        subValue={`${summary.total_block_hours.toFixed(0)}h block`}
        color="text-foreground"
      />
      <StatCard
        icon={Activity}
        label="Avg Performance"
        value={`${summary.avg_performance}%`}
        subValue={`Worst: ${summary.worst_performance}%`}
        color={getPerformanceColor(summary.avg_performance)}
      />
      <StatCard
        icon={Moon}
        label="Avg Sleep"
        value={`${summary.avg_sleep_per_night}h`}
        subValue={`Max debt: ${summary.max_sleep_debt}h`}
        color={getSleepColor(summary.avg_sleep_per_night)}
      />
      <StatCard
        icon={AlertTriangle}
        label="Risk Duties"
        value={totalRiskDuties}
        subValue={`${summary.total_critical_risk_duties} critical`}
        color={totalRiskDuties > 0 ? 'text-[hsl(var(--critical))]' : 'text-[hsl(var(--success))]'}
      />
      <StatCard
        icon={Zap}
        label="Pinch Events"
        value={summary.total_pinch_events}
        subValue={`${summary.total_wocl_hours.toFixed(1)}h WOCL`}
        color={summary.total_pinch_events > 0 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'}
      />
    </div>
  );
}
