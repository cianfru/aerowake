import { Plane, Monitor, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';
import { isTrainingDuty, getTrainingDutyLabel } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface DutyDetailsHeaderProps {
  duty: DutyAnalysis;
}

/** Risk badge for the header. */
function RiskBadge({ risk }: { risk: string }) {
  const variant =
    risk === 'LOW' ? 'success' :
    risk === 'MODERATE' ? 'warning' :
    risk === 'HIGH' ? 'high' :
    risk === 'CRITICAL' ? 'critical' : 'outline';
  return <Badge variant={variant as 'success' | 'warning' | 'high' | 'critical' | 'outline'} className="text-[10px] md:text-xs">{risk}</Badge>;
}

/**
 * DutyDetailsHeader — compact single-row header for the full-screen dialog.
 *
 * Shows: icon, date, duty/block/sectors, min/avg/landing performance, risk badge.
 * Flight segments and FDP bar are now in the left column (DutyInfoColumn).
 */
export function DutyDetailsHeader({ duty }: DutyDetailsHeaderProps) {
  const isTraining = isTrainingDuty(duty);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Left: icon + title + training badge */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-primary flex-shrink-0">
          {isTraining
            ? (duty.dutyType === 'simulator' ? <Monitor className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />)
            : <Plane className="h-4 w-4" />}
        </span>
        <h2 className="text-sm md:text-base font-semibold truncate">
          Duty — {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
        </h2>
        {isTraining && (
          <Badge variant="info" className="text-[10px] flex-shrink-0">
            {getTrainingDutyLabel(duty.dutyType!)}
          </Badge>
        )}
      </div>

      {/* Center: stats */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Stat label="Duty" value={`${(duty.dutyHours ?? 0).toFixed(1)}h`} />
        <Stat label="Block" value={`${Math.max(0, duty.blockHours ?? 0).toFixed(1)}h`} />
        {!isTraining && <Stat label="Sectors" value={String(duty.sectors)} />}
        <span className="text-border hidden sm:inline">|</span>
        <StatPerf label="Min" value={duty.minPerformance} />
        <StatPerf label="Avg" value={duty.avgPerformance} />
        {!isTraining && <StatPerf label="Ldg" value={duty.landingPerformance} />}
      </div>

      {/* Right: risk badge */}
      <RiskBadge risk={duty.overallRisk} />
    </div>
  );
}

/* ── tiny helper sub-components ─────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function StatPerf({ label, value }: { label: string; value: number }) {
  const v = value ?? 0;
  const color = v < 50 ? 'text-critical' : v < 60 ? 'text-warning' : 'text-foreground';
  return (
    <span>
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className={cn('font-medium', color)}>{v.toFixed(0)}%</span>
    </span>
  );
}
