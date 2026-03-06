import { useMemo } from 'react';
import { Moon, Sun, Clock, Zap, Activity, Gauge, Timer, AlertTriangle, TrendingDown, Mountain, Eye } from 'lucide-react';
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
  const bodyClockInfo = useMemo(() => {
    if (!worstPoint) return null;
    const circadianLevel = worstPoint.circadian;
    if (circadianLevel >= 0.5) return null;

    if (duty.reportTimeUtc && worstPoint.hours_on_duty != null) {
      try {
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

  // Determine risk color for the radial gauge ring
  const ringColor = worstPerf >= 77
    ? 'hsl(var(--success))'
    : worstPerf >= 55
      ? 'hsl(var(--warning))'
      : 'hsl(var(--critical))';

  // If no timeline data, show minimal card with just the scores
  if (!worstPoint || !decomp) {
    return (
      <div className="rounded-2xl glass-strong p-5">
        <div className="flex items-center gap-4">
          <RadialScore value={worstPerf} color={ringColor} size={64} />
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Worst Performance</p>
            <Badge variant={kssInfo.variant} className="text-[10px]">
              KSS {kss.toFixed(1)}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass-strong overflow-hidden">
      {/* Hero section — score + status */}
      <div className="relative px-5 pt-5 pb-4">
        {/* Subtle glow behind the score based on risk */}
        <div
          className="absolute top-0 left-0 w-40 h-40 rounded-full blur-[80px] opacity-20 pointer-events-none"
          style={{ background: ringColor }}
        />

        <div className="relative flex items-start justify-between gap-4">
          {/* Left: Radial gauge + labels */}
          <div className="flex items-center gap-4">
            <RadialScore value={worstPerf} color={ringColor} size={72} />
            <div className="space-y-1.5">
              <Badge
                variant={worstPerf >= 70 ? 'success' : worstPerf >= 50 ? 'warning' : 'critical'}
                className="text-[10px]"
              >
                {worstPerf >= 77 ? 'ADEQUATE' : worstPerf >= 55 ? 'REDUCED' : 'IMPAIRED'}
              </Badge>
              {worstTimestamp && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  worst at {worstTimestamp}
                </p>
              )}
            </div>
          </div>

          {/* Right: Section label */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-medium">Performance</span>
          </div>
        </div>
      </div>

      {/* Fatigue scale instruments */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            label="Samn-Perelli"
            value={sp.toFixed(1)}
            sublabel={spInfo.label}
            variant={spInfo.variant}
            infoKey="samnPerelli"
          />
          <ScaleBadge
            icon={<Timer className="h-3 w-3" />}
            label="Reaction"
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
          {worstPoint?.pvt_lapses != null && (
            <ScaleBadge
              icon={<Eye className="h-3 w-3" />}
              label="PVT Lapses"
              value={worstPoint.pvt_lapses.toFixed(1)}
              sublabel={worstPoint.pvt_lapses <= 2 ? 'Normal' : worstPoint.pvt_lapses <= 5 ? 'Impaired' : 'Severe'}
              variant={worstPoint.pvt_lapses <= 2 ? 'success' : worstPoint.pvt_lapses <= 5 ? 'warning' : 'critical'}
              infoKey="pvtLapses"
            />
          )}
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

      {/* Contributing factors */}
      <div className="px-5 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Contributing Factors</span>
          <div className="h-px flex-1 bg-border/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FactorBar
            icon={<Moon className="h-3.5 w-3.5" />}
            label="Sleep Pressure"
            tag="S"
            rawValue={decomp.sleepPressure}
            contribution={decomp.sContribution}
            barColor="hsl(0, 80%, 60%)"
            detail={`${(duty.priorSleep ?? 0).toFixed(1)}h prior sleep`}
            infoKey="sleepPressure"
          />
          <FactorBar
            icon={<Sun className="h-3.5 w-3.5" />}
            label="Circadian"
            tag="C"
            rawValue={decomp.circadian}
            contribution={decomp.cContribution}
            barColor="hsl(220, 80%, 60%)"
            detail={bodyClockInfo || `${(duty.woclExposure ?? 0).toFixed(1)}h WOCL`}
            infoKey="circadian"
          />
          <FactorBar
            icon={<Clock className="h-3.5 w-3.5" />}
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
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Sleep Inertia"
              tag="W"
              rawValue={decomp.sleepInertia}
              contribution={decomp.wContribution}
              barColor="hsl(30, 90%, 55%)"
              detail="Post-awakening"
              infoKey="sleepInertia"
            />
          )}
          {worstPoint?.debt_penalty != null && worstPoint.debt_penalty < 0.99 && (
            <FactorBar
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              label="Chronic Debt"
              tag="D"
              rawValue={worstPoint.debt_penalty}
              contribution={Number(((1 - worstPoint.debt_penalty) * 100).toFixed(1))}
              barColor="hsl(var(--warning))"
              detail={`${duty.sleepDebt.toFixed(1)}h cumulative debt`}
              infoKey="sleepDebt"
            />
          )}
          {worstPoint?.hypoxia_factor != null && worstPoint.hypoxia_factor < 0.99 && (
            <FactorBar
              icon={<Mountain className="h-3.5 w-3.5" />}
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
      <div className="px-5 pb-4">
        <ContributionBar
          decomp={decomp}
          debtPenalty={worstPoint?.debt_penalty}
          hypoxiaFactor={worstPoint?.hypoxia_factor}
        />
      </div>

      {/* Natural language explanation */}
      {explanation && (
        <div className="px-5 pb-5">
          <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** SVG radial gauge — the hero element. */
function RadialScore({ value, color, size }: { value: number; color: string; size: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border) / 0.3)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold font-mono leading-none"
          style={{ color }}
        >
          {value.toFixed(0)}
        </span>
        <span className="text-[9px] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

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
    <div className="rounded-xl bg-secondary/20 border border-border/30 px-3 py-2.5 min-w-0 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide">{label}</span>
        {info && <InfoTooltip entry={info} size="sm" />}
      </div>
      <span className={cn(
        'text-sm font-mono font-bold leading-tight',
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
  const barWidth = Math.min(100, (contribution / 40) * 100);

  return (
    <div className="rounded-xl bg-secondary/15 border border-border/25 px-3 py-2.5 space-y-2 hover:bg-secondary/25 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: barColor }}>{icon}</span>
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[9px] font-mono text-muted-foreground/70">({tag})</span>
          {info && <InfoTooltip entry={info} size="sm" />}
        </div>
        <span
          className="text-xs font-mono font-bold tabular-nums"
          style={{ color: barColor }}
        >
          -{contribution.toFixed(1)}%
        </span>
      </div>
      {/* Progress bar with rounded track */}
      <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/80">{detail}</p>
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
    <div className="space-y-1.5">
      <div className="flex items-center gap-[2px] h-2.5 rounded-full overflow-hidden bg-secondary/40">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
            style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.width.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
        <span className="font-mono">0%</span>
        <div className="flex items-center gap-2.5">
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-medium">{seg.label}</span>
            </span>
          ))}
        </div>
        <span className="font-mono">100%</span>
      </div>
    </div>
  );
}
