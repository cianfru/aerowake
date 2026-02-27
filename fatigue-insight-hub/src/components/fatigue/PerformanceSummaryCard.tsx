import { useMemo } from 'react';
import { Moon, Sun, Clock, Zap, Brain, Activity, Gauge, Timer, AlertTriangle, TrendingDown, Mountain, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyAnalysis, TimelinePoint } from '@/types/fatigue';
import {
  decomposePerformance,
  calculateFHA,
  getFHASeverity,
  performanceToKSS,
  getKSSLabel,
  performanceToSamnPerelli,
  getSamnPerelliLabel,
  performanceToReactionTime,
  getReactionTimeLabel,
} from '@/lib/fatigue-calculations';
import { getPerformanceColor } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface PerformanceSummaryCardProps {
  duty: DutyAnalysis;
}

/**
 * PerformanceSummaryCard — the "at a glance" card that tells pilots
 * exactly how fatigued they were and WHY, replacing the old buried
 * PerformanceDegradation + FatigueScalesConverter + FHA inline card.
 *
 * Placed immediately after the General Details card in DutyDetails.
 */
export function PerformanceSummaryCard({ duty }: PerformanceSummaryCardProps) {
  // Find the worst performance point in the timeline
  const worstPoint = useMemo<TimelinePoint | null>(() => {
    if (!duty.timelinePoints || duty.timelinePoints.length === 0) return null;
    return duty.timelinePoints.reduce((min, pt) =>
      (pt.performance ?? 100) < (min.performance ?? 100) ? pt : min,
      duty.timelinePoints[0],
    );
  }, [duty.timelinePoints]);

  // Calculate FHA — only meaningful with a full timeline (>1 point)
  const fha = useMemo(() => {
    if (!duty.timelinePoints || duty.timelinePoints.length <= 1) return null;
    const validPoints = duty.timelinePoints.filter(pt => pt.performance != null);
    if (validPoints.length <= 1) return null;
    return calculateFHA(validPoints.map(pt => ({ performance: pt.performance ?? 0 })));
  }, [duty.timelinePoints]);

  // Decompose the worst point into S/C/W/ToT contributions
  const decomp = useMemo(() => {
    if (!worstPoint) return null;
    return decomposePerformance({
      performance: worstPoint.performance ?? 0,
      sleep_pressure: worstPoint.sleep_pressure,
      circadian: worstPoint.circadian,
      sleep_inertia: worstPoint.sleep_inertia,
      time_on_task_penalty: worstPoint.time_on_task_penalty,
      hours_on_duty: worstPoint.hours_on_duty,
    });
  }, [worstPoint]);

  // Derived fatigue scales
  const worstPerf = duty.minPerformance ?? 0;
  const kss = performanceToKSS(worstPerf);
  const kssInfo = getKSSLabel(kss);
  const sp = performanceToSamnPerelli(worstPerf);
  const spInfo = getSamnPerelliLabel(sp);
  const rt = performanceToReactionTime(worstPerf);
  const rtInfo = getReactionTimeLabel(rt);
  const fhaSeverity = fha != null ? getFHASeverity(fha) : null;

  // Timestamp of worst point
  const worstTimestamp = worstPoint?.timestamp_local
    ? new Date(worstPoint.timestamp_local).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : worstPoint
      ? `${worstPoint.hours_on_duty.toFixed(1)}h on duty`
      : null;

  // Body clock time at worst point — estimate from circadian phase
  // circadian is 0-1 where low = circadian trough. We don't have the exact body clock time
  // from the frontend, so we use hours_on_duty + report time to approximate
  const bodyClockInfo = useMemo(() => {
    if (!worstPoint) return null;
    // If circadian < 0.3, pilot is near their circadian trough (02:00-06:00 body clock)
    const circadianLevel = worstPoint.circadian;
    if (circadianLevel >= 0.5) return null; // Don't highlight if not a major factor

    // Try to compute approximate body clock time from report time
    if (duty.reportTimeUtc && worstPoint.hours_on_duty != null) {
      try {
        // Parse report UTC and add hours_on_duty to get approximate time
        const reportDate = duty.reportTimeLocal
          ? new Date(`2000-01-01T${duty.reportTimeLocal}:00`)
          : null;
        if (reportDate && !isNaN(reportDate.getTime())) {
          const worstMinutes = reportDate.getMinutes() + worstPoint.hours_on_duty * 60;
          const worstHour = Math.floor((reportDate.getHours() * 60 + worstMinutes) / 60) % 24;
          const worstMin = Math.round(worstMinutes % 60);
          return `${String(worstHour).padStart(2, '0')}:${String(worstMin).padStart(2, '0')} body clock`;
        }
      } catch {
        // Fallback
      }
    }
    return 'Near circadian trough';
  }, [worstPoint, duty.reportTimeUtc, duty.reportTimeLocal]);

  // Build natural language explanation
  const explanation = useMemo(() => {
    if (!decomp || !worstPoint) return null;

    const perf = worstPoint.performance ?? 0;
    const factors: string[] = [];

    // Sort contributing factors by size
    const contributions = [
      { name: 'sleep pressure', value: decomp.sContribution, detail: `you slept ${(duty.priorSleep ?? 0).toFixed(1)}h prior` },
      { name: 'circadian phase', value: decomp.cContribution, detail: bodyClockInfo || 'near your body clock low point' },
      { name: 'time on duty', value: decomp.totContribution, detail: `${decomp.hoursOnDuty.toFixed(1)}h on duty` },
      { name: 'sleep inertia', value: decomp.wContribution, detail: 'post-awakening grogginess' },
    ].filter(c => c.value > 2).sort((a, b) => b.value - a.value);

    if (contributions.length === 0) {
      return `Performance remained at ${perf.toFixed(0)}% throughout this duty.`;
    }

    const primary = contributions[0];
    const secondary = contributions.length > 1 ? contributions[1] : null;

    factors.push(`high ${primary.name} (${primary.detail})`);
    if (secondary && secondary.value > primary.value * 0.4) {
      factors.push(`${secondary.name} (${secondary.detail})`);
    }

    const connector = factors.length > 1 ? ' combined with ' : '';
    return `Performance dropped to ${perf.toFixed(0)}% primarily due to ${factors.join(connector)}.`;
  }, [decomp, worstPoint, duty.priorSleep, bodyClockInfo]);

  // If no timeline data, show minimal card with just the scores
  if (!worstPoint || !decomp) {
    return (
      <Card variant="glass">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="text-3xl font-bold font-mono leading-none"
                style={{ color: getPerformanceColor(worstPerf) }}
              >
                {worstPerf.toFixed(0)}%
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Worst Performance</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={kssInfo.variant} className="text-[10px]">
                    KSS {kss.toFixed(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          Performance Summary
          {worstTimestamp && (
            <span className="text-xs text-muted-foreground font-normal font-mono">
              worst at {worstTimestamp}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top row: Big score + fatigue scale badges */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left: Large score */}
          <div className="flex items-center gap-3 sm:min-w-[140px]">
            <span
              className="text-4xl font-bold font-mono leading-none"
              style={{ color: getPerformanceColor(worstPerf) }}
            >
              {worstPerf.toFixed(0)}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground leading-none">/ 100</span>
              <Badge
                variant={worstPerf >= 70 ? 'success' : worstPerf >= 50 ? 'warning' : 'critical'}
                className="text-[10px] w-fit"
              >
                {worstPerf >= 77 ? 'ADEQUATE' : worstPerf >= 55 ? 'REDUCED' : 'IMPAIRED'}
              </Badge>
            </div>
          </div>

          {/* Right: Fatigue scale badges in a compact grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ScaleBadge
              icon={<Gauge className="h-3 w-3" />}
              label="KSS"
              value={kss.toFixed(1)}
              sublabel={kssInfo.label}
              variant={kssInfo.variant}
              infoKey="kss"
            />
            <ScaleBadge
              icon={<Activity className="h-3 w-3" />}
              label="S-P"
              value={sp.toFixed(1)}
              sublabel={spInfo.label}
              variant={spInfo.variant}
              infoKey="samnPerelli"
            />
            <ScaleBadge
              icon={<Timer className="h-3 w-3" />}
              label="PVT"
              value={`${rt}ms`}
              sublabel={rtInfo.label}
              variant={rtInfo.variant}
              infoKey="reactionTime"
            />
            {fha != null && fha > 0 && fhaSeverity && (
              <ScaleBadge
                icon={<AlertTriangle className="h-3 w-3" />}
                label="FHA"
                value={`${fha}`}
                sublabel={`${fhaSeverity.label} (%-hrs)`}
                variant={fhaSeverity.variant}
                infoKey="fha"
              />
            )}
            {/* PVT Lapses badge — from model deepening (Van Dongen 2003) */}
            {worstPoint?.pvt_lapses != null && (
              <ScaleBadge
                icon={<Eye className="h-3 w-3" />}
                label="PVT"
                value={worstPoint.pvt_lapses.toFixed(1)}
                sublabel={worstPoint.pvt_lapses <= 2 ? 'Normal' : worstPoint.pvt_lapses <= 5 ? 'Impaired' : 'Severe'}
                variant={worstPoint.pvt_lapses <= 2 ? 'success' : worstPoint.pvt_lapses <= 5 ? 'warning' : 'critical'}
                infoKey="pvtLapses"
              />
            )}
            {/* Microsleep probability badge — from model deepening (Åkerstedt 2010) */}
            {worstPoint?.microsleep_probability != null && worstPoint.microsleep_probability > 0.01 && (
              <ScaleBadge
                icon={<Zap className="h-3 w-3" />}
                label="Microsleep"
                value={`${(worstPoint.microsleep_probability * 100).toFixed(1)}%`}
                sublabel={worstPoint.microsleep_probability < 0.02 ? 'Low risk' : worstPoint.microsleep_probability < 0.05 ? 'Moderate' : 'High risk'}
                variant={worstPoint.microsleep_probability < 0.02 ? 'success' : worstPoint.microsleep_probability < 0.05 ? 'warning' : 'critical'}
                infoKey="microsleepProbability"
              />
            )}
          </div>
        </div>

        {/* Contributing factors — horizontal mini-bars */}
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Contributing Factors</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FactorBar
              icon={<Moon className="h-3.5 w-3.5 text-red-400" />}
              label="Sleep Pressure"
              tag="S"
              rawValue={decomp.sleepPressure}
              contribution={decomp.sContribution}
              barColor="hsl(0, 80%, 60%)"
              detail={`${(duty.priorSleep ?? 0).toFixed(1)}h prior sleep`}
              infoKey="sleepPressure"
            />
            <FactorBar
              icon={<Sun className="h-3.5 w-3.5 text-blue-400" />}
              label="Circadian"
              tag="C"
              rawValue={decomp.circadian}
              contribution={decomp.cContribution}
              barColor="hsl(220, 80%, 60%)"
              detail={bodyClockInfo || `${(duty.woclExposure ?? 0).toFixed(1)}h WOCL`}
              infoKey="circadian"
            />
            <FactorBar
              icon={<Clock className="h-3.5 w-3.5 text-amber-400" />}
              label="Time on Duty"
              tag="ToT"
              rawValue={decomp.timeOnTaskPenalty}
              contribution={decomp.totContribution}
              barColor="hsl(40, 90%, 55%)"
              detail={`${decomp.hoursOnDuty.toFixed(1)}h on duty`}
              infoKey="timeOnTask"
            />
            {decomp.wContribution > 0.5 && (
              <FactorBar
                icon={<Zap className="h-3.5 w-3.5 text-orange-400" />}
                label="Sleep Inertia"
                tag="W"
                rawValue={decomp.sleepInertia}
                contribution={decomp.wContribution}
                barColor="hsl(30, 90%, 55%)"
                detail="Post-awakening"
                infoKey="sleepInertia"
              />
            )}
            {/* Chronic Debt factor — Van Dongen (2003) */}
            {worstPoint?.debt_penalty != null && worstPoint.debt_penalty < 0.99 && (
              <FactorBar
                icon={<TrendingDown className="h-3.5 w-3.5 text-amber-500" />}
                label="Chronic Debt"
                tag="D"
                rawValue={worstPoint.debt_penalty}
                contribution={Number(((1 - worstPoint.debt_penalty) * 100).toFixed(1))}
                barColor="hsl(var(--warning))"
                detail={`${duty.sleepDebt.toFixed(1)}h cumulative debt`}
                infoKey="sleepDebt"
              />
            )}
            {/* Cabin altitude hypoxia — Nesthus (2007) */}
            {worstPoint?.hypoxia_factor != null && worstPoint.hypoxia_factor < 0.99 && (
              <FactorBar
                icon={<Mountain className="h-3.5 w-3.5 text-blue-400" />}
                label="Cabin Altitude"
                tag="Hx"
                rawValue={worstPoint.hypoxia_factor}
                contribution={Number(((1 - worstPoint.hypoxia_factor) * 100).toFixed(1))}
                barColor="hsl(220, 70%, 60%)"
                detail={duty.cabinAltitudeFt ? `${duty.cabinAltitudeFt.toLocaleString()} ft cabin` : 'Mild hypoxia'}
                infoKey="cabinAltitude"
              />
            )}
          </div>
        </div>

        {/* Stacked contribution bar */}
        <ContributionBar
          decomp={decomp}
          debtPenalty={worstPoint?.debt_penalty}
          hypoxiaFactor={worstPoint?.hypoxia_factor}
        />

        {/* Natural language explanation */}
        {explanation && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
            {explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScaleBadge({
  icon,
  label,
  value,
  sublabel,
  variant,
  infoKey,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  variant: 'success' | 'warning' | 'critical';
  infoKey: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/50 px-2.5 py-2 min-w-0">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        {info && <InfoTooltip entry={info} size="sm" />}
      </div>
      <span className={cn(
        'text-sm font-mono font-semibold leading-tight',
        variant === 'success' ? 'text-success' :
        variant === 'warning' ? 'text-warning' : 'text-critical',
      )}>
        {value}
      </span>
      <p className="text-[9px] text-muted-foreground truncate mt-0.5">{sublabel}</p>
    </div>
  );
}

function FactorBar({
  icon,
  label,
  tag,
  rawValue,
  contribution,
  barColor,
  detail,
  infoKey,
}: {
  icon: React.ReactNode;
  label: string;
  tag: string;
  rawValue: number;
  contribution: number;
  barColor: string;
  detail: string;
  infoKey: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  // Bar width: contribution as % of 80 (max theoretical deficit)
  const barWidth = Math.min(100, (contribution / 40) * 100);

  return (
    <div className="rounded-lg bg-secondary/20 border border-border/50 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] font-mono text-muted-foreground">({tag})</span>
          {info && <InfoTooltip entry={info} size="sm" />}
        </div>
        <span
          className="text-xs font-mono font-semibold"
          style={{ color: barColor }}
        >
          -{contribution.toFixed(1)}%
        </span>
      </div>
      {/* Mini progress bar */}
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ContributionBar({ decomp, debtPenalty, hypoxiaFactor }: {
  decomp: ReturnType<typeof decomposePerformance>;
  debtPenalty?: number;
  hypoxiaFactor?: number;
}) {
  const debtContribution = debtPenalty != null && debtPenalty < 0.99 ? (1 - debtPenalty) * 100 : 0;
  const hypoxiaContribution = hypoxiaFactor != null && hypoxiaFactor < 0.99 ? (1 - hypoxiaFactor) * 100 : 0;
  const totalDeficit = decomp.sContribution + decomp.cContribution + decomp.wContribution + decomp.totContribution + debtContribution + hypoxiaContribution;
  const remaining = Math.max(0, 100 - totalDeficit);

  const segments = [
    { width: remaining, color: 'hsl(var(--success))', label: 'Alert' },
    { width: decomp.sContribution, color: 'hsl(0, 80%, 60%)', label: 'S' },
    { width: decomp.cContribution, color: 'hsl(220, 80%, 60%)', label: 'C' },
    { width: decomp.wContribution, color: 'hsl(30, 90%, 55%)', label: 'W' },
    { width: decomp.totContribution, color: 'hsl(var(--muted-foreground))', label: 'ToT' },
    { width: debtContribution, color: 'hsl(var(--warning))', label: 'Debt' },
    { width: hypoxiaContribution, color: 'hsl(220, 70%, 60%)', label: 'Hx' },
  ].filter(s => s.width > 0.5);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 h-2.5 rounded-full overflow-hidden bg-secondary">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full transition-all"
            style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.width.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <div className="flex items-center gap-2">
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              {seg.label}
            </span>
          ))}
        </div>
        <span>100%</span>
      </div>
    </div>
  );
}
