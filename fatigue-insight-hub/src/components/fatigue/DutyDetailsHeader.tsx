import { Plane, Monitor, BookOpen, Timer, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';
import { isTrainingDuty, getTrainingDutyLabel, formatAircraftType } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface DutyDetailsHeaderProps {
  duty: DutyAnalysis;
}

/** Compact inline FDP utilization bar for the header. */
function InlineFDP({ duty }: { duty: DutyAnalysis }) {
  const actual = duty.actualFdpHours ?? duty.dutyHours ?? 0;
  const max = duty.maxFdpHours ?? 0;
  if (max <= 0) return null;

  const pct = Math.min((actual / max) * 100, 100);
  const color =
    actual > max ? 'bg-critical' :
    pct > 85 ? 'bg-warning' :
    'bg-success';

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Timer className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">FDP</span>
      <div className="relative flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted-foreground whitespace-nowrap">
        {actual.toFixed(1)}/{max.toFixed(1)}h
      </span>
    </div>
  );
}

/** Risk badge for the top-right corner of the header. */
function RiskBadge({ risk }: { risk: string }) {
  const variant =
    risk === 'LOW' ? 'success' :
    risk === 'MODERATE' ? 'warning' :
    risk === 'HIGH' ? 'high' :
    risk === 'CRITICAL' ? 'critical' : 'outline';
  return <Badge variant={variant as 'success' | 'warning' | 'high' | 'critical' | 'outline'} className="text-[10px] md:text-xs">{risk}</Badge>;
}

/**
 * DutyDetailsHeader — sticky hero area at the top of the full-screen dialog.
 *
 * Shows: date, risk badge, flight segments with aircraft type, stats row, FDP bar.
 * For training duties: shows training session info instead of flights.
 */
export function DutyDetailsHeader({ duty }: DutyDetailsHeaderProps) {
  const isTraining = isTrainingDuty(duty);

  return (
    <div className="space-y-3">
      {/* Row 1: Title + Risk badge */}
      <div className="flex items-center justify-between gap-3">
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
        <RiskBadge risk={duty.overallRisk} />
      </div>

      {/* Row 2: Flight segments or training info */}
      {isTraining ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
            {duty.trainingCode}
          </span>
          <span className="text-xs text-muted-foreground">
            {duty.reportTimeLocal} — {duty.releaseTimeLocal}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(duty.flightSegments ?? []).map((seg, i) => {
            const isDH = seg.activityCode === 'DH';
            const isIR = seg.activityCode === 'IR';
            const depTime = seg.departureTimeAirportLocal || seg.departureTime;
            const arrTime = seg.arrivalTimeAirportLocal || seg.arrivalTime;

            const formatOffset = (offset: number | null | undefined): string => {
              if (offset === null || offset === undefined) return '';
              const sign = offset >= 0 ? '+' : '';
              return `UTC${sign}${offset}`;
            };

            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border',
                  isDH ? 'bg-muted/40 border-border/30 opacity-70' :
                  isIR ? 'bg-blue-500/5 border-blue-500/20' :
                  'bg-secondary/40 border-border/30'
                )}
              >
                {/* Flight number */}
                <span className="font-mono font-semibold text-primary">{seg.flightNumber}</span>

                {/* Activity code badge */}
                {(isDH || isIR) && (
                  <span className={cn(
                    'text-[9px] font-semibold px-1 py-0.5 rounded',
                    isDH ? 'bg-muted text-muted-foreground' : 'bg-blue-500/15 text-blue-400'
                  )}>
                    {isDH ? 'DH' : 'IR'}
                  </span>
                )}

                {/* Route */}
                <span className="font-medium">{seg.departure} → {seg.arrival}</span>

                {/* Aircraft type badge */}
                {seg.aircraftType && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium">
                    {formatAircraftType(seg.aircraftType)}
                  </Badge>
                )}

                {/* Times */}
                <span className="text-muted-foreground hidden sm:inline">
                  {depTime}
                  {seg.departureUtcOffset != null && (
                    <span className="text-[8px] text-muted-foreground/60 ml-0.5">({formatOffset(seg.departureUtcOffset)})</span>
                  )}
                  {' → '}
                  {arrTime}
                  {seg.arrivalUtcOffset != null && (
                    <span className="text-[8px] text-muted-foreground/60 ml-0.5">({formatOffset(seg.arrivalUtcOffset)})</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 3: Stats + FDP bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <Stat label="Duty" value={`${(duty.dutyHours ?? 0).toFixed(1)}h`} />
        <Stat label="Block" value={`${Math.max(0, duty.blockHours ?? 0).toFixed(1)}h`} />
        {!isTraining && <Stat label="Sectors" value={String(duty.sectors)} />}
        <span className="hidden sm:inline text-border">|</span>
        <StatPerf label="Min" value={duty.minPerformance} />
        <StatPerf label="Avg" value={duty.avgPerformance} />
        {!isTraining && <StatPerf label="Landing" value={duty.landingPerformance} />}
        {/* FDP inline bar */}
        {!isTraining && duty.maxFdpHours != null && duty.maxFdpHours > 0 && (
          <>
            <span className="hidden sm:inline text-border">|</span>
            <InlineFDP duty={duty} />
          </>
        )}
      </div>

      {/* SMS Reportable banner */}
      {duty.smsReportable && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium">SMS Reportable — File fatigue report per EASA ORO.FTL.120</span>
        </div>
      )}
    </div>
  );
}

/* ── tiny helper sub-components ─────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-muted-foreground/70">{label}</span>{' '}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function StatPerf({ label, value }: { label: string; value: number }) {
  const v = value ?? 0;
  const color = v < 50 ? 'text-critical' : v < 60 ? 'text-warning' : 'text-foreground';
  return (
    <span>
      <span className="text-muted-foreground/70">{label}</span>{' '}
      <span className={cn('font-medium', color)}>{v.toFixed(0)}%</span>
    </span>
  );
}
