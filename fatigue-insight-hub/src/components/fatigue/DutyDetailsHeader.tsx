import { Plane, Monitor, BookOpen, FileText, FileWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';
import { isTrainingDuty, getTrainingDutyLabel } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';
import {
  classifyPerformance,
  kssLabel,
  normalizeRiskLevel,
  resolveKss,
  riskBadgeVariant,
  riskColorClass,
  type RiskThresholds,
} from '@/lib/risk-scale';

interface DutyDetailsHeaderProps {
  duty: DutyAnalysis;
  onGenerateReport?: () => void;
  onReportFatigue?: () => void;
  reportMode?: boolean;
}

/** Risk badge for the header. */
function RiskBadge({ risk }: { risk: string }) {
  return (
    <Badge variant={riskBadgeVariant(normalizeRiskLevel(risk))} className="text-[10px] md:text-xs">
      {risk}
    </Badge>
  );
}

/**
 * DutyDetailsHeader — compact single-row header for the full-screen dialog.
 *
 * Shows: icon, date, duty/block/sectors, peak/avg/landing predicted KSS, risk badge.
 * Flight segments and FDP bar are now in the left column (DutyInfoColumn).
 */
export function DutyDetailsHeader({ duty, onGenerateReport, onReportFatigue, reportMode }: DutyDetailsHeaderProps) {
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
        <StatKssChip label="Peak KSS" index={duty.minPerformance} kss={duty.maxKss} thresholds={duty.riskThresholds} />
        <StatKssChip label="Avg" index={duty.avgPerformance} thresholds={duty.riskThresholds} />
        {!isTraining && (
          <StatKssChip label="Ldg" index={duty.landingPerformance} kss={duty.landingKss} thresholds={duty.riskThresholds} />
        )}
      </div>

      {/* Right: report button + risk badge */}
      <div className="flex items-center gap-2.5">
        {onReportFatigue && !reportMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReportFatigue}
            className="gap-1.5 text-xs rounded-lg h-8"
            aria-label="Report fatigue for this duty"
          >
            <FileWarning className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Report fatigue</span>
          </Button>
        )}
        {onGenerateReport && !reportMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateReport}
            className="gap-1.5 text-xs rounded-lg h-8"
            aria-label="Full duty report"
            title="Full duty report (PDF)"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Full duty report</span>
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
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[13px] font-medium text-foreground tabular">{value}</span>
    </span>
  );
}

function StatKssChip({
  label,
  index,
  kss,
  thresholds,
}: {
  label: string;
  index: number | null | undefined;
  kss?: number;
  thresholds?: RiskThresholds;
}) {
  const k = resolveKss(kss, index);
  if (k == null) return null;
  const level = classifyPerformance(index, thresholds);
  const color = level === 'low' ? 'text-foreground' : riskColorClass(level);
  return (
    <span
      className="inline-flex items-baseline gap-1.5"
      title={`${kssLabel(k)} · index ${Math.round(index ?? 0)}`}
    >
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('font-mono text-[13px] font-medium tabular', color)}>{k.toFixed(1)}</span>
    </span>
  );
}
