import { Plane, Monitor, BookOpen, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';
import { isTrainingDuty, getTrainingDutyLabel } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface DutyDetailsHeaderProps {
  duty: DutyAnalysis;
  onGenerateReport?: () => void;
  reportMode?: boolean;
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
export function DutyDetailsHeader({ duty, onGenerateReport, reportMode }: DutyDetailsHeaderProps) {
  const isTraining = isTrainingDuty(duty);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Left: icon + title + training badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          {isTraining
            ? (duty.dutyType === 'simulator' ? <Monitor className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />)
            : <Plane className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-semibold truncate tracking-tight">
            {duty.dayOfWeek}, {format(duty.date, 'MMM dd')}
          </h2>
        </div>
        {isTraining && (
          <Badge variant="info" className="text-[10px] flex-shrink-0">
            {getTrainingDutyLabel(duty.dutyType!)}
          </Badge>
        )}
      </div>

      {/* Center: stats as subtle chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <StatChip label="Duty" value={`${(duty.dutyHours ?? 0).toFixed(1)}h`} />
        <StatChip label="Block" value={`${Math.max(0, duty.blockHours ?? 0).toFixed(1)}h`} />
        {!isTraining && <StatChip label="Sectors" value={String(duty.sectors)} />}
        <div className="w-px h-4 bg-border/30 mx-1 hidden sm:block" />
        <StatPerfChip label="Min" value={duty.minPerformance} />
        <StatPerfChip label="Avg" value={duty.avgPerformance} />
        {!isTraining && <StatPerfChip label="Ldg" value={duty.landingPerformance} />}
      </div>

      {/* Right: report button + risk badge */}
      <div className="flex items-center gap-2.5">
        {onGenerateReport && !reportMode && (
          <Button variant="outline" size="sm" onClick={onGenerateReport} className="gap-1.5 text-xs rounded-lg h-8">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Report</span>
          </Button>
        )}
        <RiskBadge risk={duty.overallRisk} />
      </div>
    </div>
  );
}

/* ── tiny helper sub-components ─────────────────────────────── */

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/40 px-2 py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium font-mono text-foreground">{value}</span>
    </span>
  );
}

function StatPerfChip({ label, value }: { label: string; value: number }) {
  const v = value ?? 0;
  const color = v < 50 ? 'text-critical' : v < 60 ? 'text-warning' : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/40 px-2 py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('text-[11px] font-medium font-mono', color)}>{v.toFixed(0)}%</span>
    </span>
  );
}
