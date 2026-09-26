import { useMemo } from 'react';
import { Moon, Sun, Zap, Activity, Gauge, AlertTriangle, Eye, Users, Percent, Hourglass, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyAnalysis, TimelinePoint } from '@/types/fatigue';
import {
  decomposePerformance,
  calculateFHA,
  getFHASeverity,
  getKSSLabel,
} from '@/lib/fatigue-calculations';
import {
  RISK_LEVEL_KSS_RANGE,
  RISK_LEVEL_LABELS,
  SLEEP_DEFICIT_LABELS,
  classifyPerformance,
  indexToKss,
  kssLabel,
  resolveKss,
  riskCssColor,
  sleepDeficitClass,
  type RiskLevel,
} from '@/lib/risk-scale';
import { cn } from '@/lib/utils';

interface PerformanceSummaryCardProps {
  duty: DutyAnalysis;
}

type Variant = 'success' | 'warning' | 'critical';

const riskVariant = (level: RiskLevel): Variant =>
  level === 'low' ? 'success' : level === 'moderate' ? 'warning' : 'critical';

/**
 * PerformanceSummaryCard — the "at a glance" card: the highest predicted
 * sleepiness (KSS) on the duty and what drove it (sleep pressure vs
 * circadian phase, Three Process Model).
 *
 * Placed immediately after the General Details card in DutyDetails.
 */
export function PerformanceSummaryCard({ duty }: PerformanceSummaryCardProps) {
  // Worst on-deck point in the timeline (bunk rest excluded)
  const worstPoint = useMemo<TimelinePoint | null>(() => {
    const pts = (duty.timelinePoints ?? []).filter(
      (pt) => !pt.is_in_rest && pt.performance != null && Number.isFinite(pt.performance),
    );
    if (pts.length === 0) return null;
    return pts.reduce((min, pt) => ((pt.performance ?? 100) < (min.performance ?? 100) ? pt : min), pts[0]);
  }, [duty.timelinePoints]);

  // FHA — only meaningful with a full timeline (>1 point)
  const fha = useMemo(() => {
    if (!duty.timelinePoints || duty.timelinePoints.length <= 1) return null;
    const validPoints = duty.timelinePoints.filter(pt => pt.performance != null);
    if (validPoints.length <= 1) return null;
    return calculateFHA(
      validPoints.map(pt => ({ performance: pt.performance ?? 0, kss: pt.kss, is_in_rest: pt.is_in_rest })),
      duty.riskThresholds,
    );
  }, [duty.timelinePoints, duty.riskThresholds]);

  // Decompose the worst point's KSS into S and C contributions
  const decomp = useMemo(() => {
    if (!worstPoint) return null;
    return decomposePerformance({
      performance: worstPoint.performance ?? 0,
      sleep_pressure: worstPoint.sleep_pressure,
      circadian: worstPoint.circadian,
      hours_on_duty: worstPoint.hours_on_duty,
      kss: worstPoint.kss,
      kss_90: worstPoint.kss_90,
      p_severe_sleepiness: worstPoint.p_severe_sleepiness,
      hours_awake: worstPoint.hours_awake,
    });
  }, [worstPoint]);

  // Headline: predicted KSS (backend max_kss when available)
  const worstPerf = duty.minPerformance ?? 0;
  const kss = resolveKss(duty.maxKss ?? worstPoint?.kss, worstPerf) ?? indexToKss(worstPerf);
  const kssInfo = getKSSLabel(kss);
  const riskLevel = classifyPerformance(worstPerf, duty.riskThresholds);
  const kss90 = duty.maxKss90 ?? worstPoint?.kss_90;
  const pSevere = duty.maxPSevere ?? worstPoint?.p_severe_sleepiness;
  const hoursAwake = duty.maxHoursAwake ?? worstPoint?.hours_awake;
  const fhaSeverity = fha != null ? getFHASeverity(fha) : null;
  const deficit = duty.sleepDeficit7d;

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

  // Natural language explanation
  const explanation = useMemo(() => {
    if (!decomp || !worstPoint) return null;
    const contributions = [
      { name: 'sleep pressure', value: decomp.sKss, detail: decomp.hoursAwake != null ? `${decomp.hoursAwake.toFixed(1)}h awake, ${(duty.priorSleep ?? 0).toFixed(1)}h prior sleep` : `${(duty.priorSleep ?? 0).toFixed(1)}h prior sleep` },
      { name: 'circadian phase', value: decomp.cKss, detail: bodyClockInfo || 'body clock position' },
    ].filter(c => c.value >= 0.3).sort((a, b) => b.value - a.value);

    const head = `Predicted KSS ${decomp.kss.toFixed(1)} (${kssLabel(decomp.kss).toLowerCase()})`;
    if (contributions.length === 0) return `${head}: well rested and near the circadian peak.`;
    const [primary, secondary] = contributions;
    const drivers = [`${primary.name} (+${primary.value.toFixed(1)} KSS; ${primary.detail})`];
    if (secondary) drivers.push(`${secondary.name} (+${secondary.value.toFixed(1)} KSS; ${secondary.detail})`);
    return `${head}, driven mainly by ${drivers.join(' and ')}. Group-average prediction, typical error \u00b11.4 KSS.`;
  }, [decomp, worstPoint, duty.priorSleep, bodyClockInfo]);

  const ringColor = riskCssColor(riskLevel);

  // If no timeline data, show minimal card with just the scores
  if (!worstPoint || !decomp) {
    return (
      <div className="rounded-2xl glass-strong p-5">
        <div className="flex items-center gap-4">
          <RadialKss kss={kss} color={ringColor} size={64} />
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Highest predicted sleepiness</p>
            <p className="text-xs font-medium">{kssInfo.label}</p>
            <Badge variant={riskVariant(riskLevel)} className="text-[10px]">
              {RISK_LEVEL_LABELS[riskLevel].toUpperCase()} · index {worstPerf.toFixed(0)}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass-strong overflow-hidden">
      {/* Hero section — KSS + status */}
      <div className="relative px-5 pt-5 pb-4">
        <div
          className="absolute top-0 left-0 w-40 h-40 rounded-full blur-[80px] opacity-20 pointer-events-none"
          style={{ background: ringColor }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <RadialKss kss={kss} color={ringColor} size={72} />
            <div className="space-y-1.5">
              <p className="text-sm font-medium leading-tight">{kssInfo.label}</p>
              <Badge variant={riskVariant(riskLevel)} className="text-[10px]">
                {RISK_LEVEL_LABELS[riskLevel].toUpperCase()} · {RISK_LEVEL_KSS_RANGE[riskLevel]}
              </Badge>
              <p className="text-[11px] text-muted-foreground font-mono">
                index {worstPerf.toFixed(0)}/100{worstTimestamp ? ` · worst at ${worstTimestamp}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-medium">Alertness</span>
          </div>
        </div>
      </div>

      {/* Model outputs */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ScaleBadge
            icon={<Gauge className="h-3 w-3" />}
            label="KSS (predicted)"
            value={kss.toFixed(1)}
            sublabel={kssInfo.label}
            variant={kssInfo.variant}
            infoKey="kss"
          />
          {kss90 != null && (
            <ScaleBadge
              icon={<Users className="h-3 w-3" />}
              label="KSS 90th pct"
              value={kss90.toFixed(1)}
              sublabel={getKSSLabel(kss90).label}
              variant={getKSSLabel(kss90).variant}
              infoKey="kss90"
            />
          )}
          {pSevere != null && (
            <ScaleBadge
              icon={<Percent className="h-3 w-3" />}
              label="P(KSS ≥ 7)"
              value={`${(pSevere * 100).toFixed(0)}%`}
              sublabel={pSevere < 0.1 ? 'Low' : pSevere < 0.3 ? 'Elevated' : 'High'}
              variant={pSevere < 0.1 ? 'success' : pSevere < 0.3 ? 'warning' : 'critical'}
              infoKey="pSevere"
            />
          )}
          {hoursAwake != null && (
            <ScaleBadge
              icon={<Hourglass className="h-3 w-3" />}
              label="Hours awake"
              value={`${hoursAwake.toFixed(1)}h`}
              sublabel={hoursAwake <= 16 ? 'Normal day' : hoursAwake <= 20 ? 'Extended' : 'Prolonged'}
              variant={hoursAwake <= 16 ? 'success' : hoursAwake <= 20 ? 'warning' : 'critical'}
              infoKey="hoursAwake"
            />
          )}
        </div>
      </div>

      {/* Contributing processes */}
      <div className="px-5 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">What drives the KSS</span>
          <div className="h-px flex-1 bg-border/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FactorBar
            icon={<Moon className="h-3.5 w-3.5" />}
            label="Sleep Pressure"
            tag="S"
            kssPoints={decomp.sKss}
            maxPoints={5.5}
            barColor="hsl(0, 80%, 60%)"
            detail={
              decomp.hoursAwake != null
                ? `${decomp.hoursAwake.toFixed(1)}h awake · ${(duty.priorSleep ?? 0).toFixed(1)}h prior sleep`
                : `${(duty.priorSleep ?? 0).toFixed(1)}h prior sleep`
            }
            infoKey="sleepPressure"
          />
          <FactorBar
            icon={<Sun className="h-3.5 w-3.5" />}
            label="Circadian Phase"
            tag="C"
            kssPoints={decomp.cKss}
            maxPoints={2.3}
            barColor="hsl(220, 80%, 60%)"
            detail={bodyClockInfo || `${(duty.woclExposure ?? 0).toFixed(1)}h WOCL`}
            infoKey="circadian"
          />
        </div>
        {deficit && (
          <div className="flex items-center justify-between rounded-xl bg-secondary/15 border border-border/25 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">7-day sleep deficit</span>
              <InfoTooltip entry={FATIGUE_INFO.sleepDeficit7d} size="sm" />
            </span>
            <span className={cn('font-mono font-bold', sleepDeficitClass(deficit.band))}>
              {deficit.deficitHours.toFixed(1)}h · {SLEEP_DEFICIT_LABELS[deficit.band] ?? deficit.band}
            </span>
          </div>
        )}
      </div>

      {/* Stacked KSS build-up bar */}
      <div className="px-5 pb-4">
        <KssBuildUpBar decomp={decomp} />
      </div>

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

/** SVG radial gauge showing predicted KSS (fills as sleepiness rises). */
function RadialKss({ kss, color, size }: { kss: number; color: string; size: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, (kss - 1) / 8));
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth={strokeWidth} />
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
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-label={`KSS ${kss.toFixed(1)} of 9`}>
        <span className="text-[9px] text-muted-foreground">KSS</span>
        <span className="text-xl font-bold font-mono leading-none" style={{ color }}>
          {kss.toFixed(1)}
        </span>
        <span className="text-[9px] text-muted-foreground mt-0.5">/ 9</span>
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
  variant: Variant;
  infoKey: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  return (
    <div className="rounded-xl bg-secondary/20 border border-border/30 px-3 py-2.5 min-w-0 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide truncate">{label}</span>
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
  kssPoints,
  maxPoints,
  barColor,
  detail,
  infoKey,
}: {
  icon: React.ReactNode;
  label: string;
  tag: string;
  kssPoints: number;
  maxPoints: number;
  barColor: string;
  detail: string;
  infoKey: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  const barWidth = Math.max(0, Math.min(100, (kssPoints / maxPoints) * 100));

  return (
    <div className="rounded-xl bg-secondary/15 border border-border/25 px-3 py-2.5 space-y-2 hover:bg-secondary/25 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: barColor }}>{icon}</span>
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[9px] font-mono text-muted-foreground/70">({tag})</span>
          {info && <InfoTooltip entry={info} size="sm" />}
        </div>
        <span className="text-xs font-mono font-bold tabular-nums" style={{ color: barColor }}>
          +{kssPoints.toFixed(1)} KSS
        </span>
      </div>
      <div className="h-1.5 rounded-[2px] bg-secondary/60 overflow-hidden">
        <div
          className="h-full rounded-[2px] transition-all duration-500 ease-out"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/80">{detail}</p>
    </div>
  );
}

/** KSS 1 → 9 bar: rested baseline + sleep pressure + circadian + remainder. */
function KssBuildUpBar({ decomp }: { decomp: ReturnType<typeof decomposePerformance> }) {
  const toPct = (k: number) => Math.max(0, (k / 8) * 100);
  const segments = [
    { width: toPct(decomp.referenceKss - 1), color: 'hsl(var(--success))', label: 'Rested baseline' },
    { width: toPct(decomp.sKss), color: 'hsl(0, 80%, 60%)', label: 'S' },
    { width: toPct(decomp.cKss), color: 'hsl(220, 80%, 60%)', label: 'C' },
    { width: toPct(decomp.otherKss), color: 'hsl(var(--muted-foreground))', label: 'U' },
  ].filter(s => s.width > 0.5);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-[2px] h-2.5 rounded-[2px] overflow-hidden bg-secondary/40">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all duration-500"
            style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${((seg.width / 100) * 8).toFixed(1)} KSS`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
        <span className="font-mono">KSS 1</span>
        <div className="flex items-center gap-2.5">
          {segments.map((seg) => (
            <span key={seg.label} className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="font-medium">{seg.label}</span>
            </span>
          ))}
        </div>
        <span className="font-mono">KSS 9</span>
      </div>
    </div>
  );
}
