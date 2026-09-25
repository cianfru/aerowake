import { Activity, Moon, Sun, Hourglass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { decomposePerformance, type PerformanceDecomposition } from '@/lib/fatigue-calculations';
import { classifyKss, kssLabel, riskCssColor } from '@/lib/risk-scale';

interface PerformanceExplainerPanelProps {
  /** A single high-resolution timeline point from the backend. */
  point: {
    performance: number;
    sleep_pressure: number;
    circadian: number;
    hours_on_duty: number;
    kss?: number;
    kss_90?: number;
    p_severe_sleepiness?: number;
    hours_awake?: number;
    flight_phase?: string | null;
    is_critical?: boolean;
    is_in_rest?: boolean;
  };
  /** Timestamp label for display. */
  timestamp?: string;
  /** Optional: compact inline variant (no card wrapper). */
  variant?: 'card' | 'inline';
}

/**
 * Alertness Explainer Panel — predicted KSS at one timeline point and how it
 * builds up from the Three Process Model: KSS = 9.68 − 0.46·(S + C + U)
 * (Ingre et al. 2014). Sleep inertia, time-on-task, workload and hypoxia
 * are not part of the score.
 */
export function PerformanceExplainerPanel({
  point,
  timestamp,
  variant = 'card',
}: PerformanceExplainerPanelProps) {
  const decomp = decomposePerformance(point);
  const color = riskCssColor(classifyKss(decomp.kss));

  const content = (
    <div className="space-y-3">
      {/* KSS headline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold font-mono leading-none" style={{ color }}>
            KSS {decomp.kss.toFixed(1)}
          </span>
          <div className="flex flex-col">
            <span className="text-xs">{kssLabel(decomp.kss)}</span>
            <span className="text-[10px] text-muted-foreground font-mono">index {decomp.performance.toFixed(0)}</span>
          </div>
          <InfoTooltip entry={FATIGUE_INFO.performance} />
        </div>
        <div className="flex items-center gap-1.5">
          {point.flight_phase && (
            <Badge variant={point.is_critical ? 'critical' : 'outline'} className="text-[10px]">
              {formatFlightPhase(point.flight_phase)}
            </Badge>
          )}
          {point.is_in_rest && (
            <Badge variant="info" className="text-[10px]">
              In-Rest
            </Badge>
          )}
          {timestamp && <span className="text-xs text-muted-foreground font-mono">{timestamp}</span>}
        </div>
      </div>

      {/* Formula display */}
      <div className="rounded bg-secondary/50 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
        KSS = 9.68 &minus; 0.46&middot;(S + C + U)
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        <FactorRow
          icon={<Moon className="h-3.5 w-3.5" />}
          label="Sleep Pressure"
          tag="S"
          rawValue={decomp.sleepPressure}
          kssPoints={decomp.sKss}
          color="hsl(0, 80%, 60%)"
          infoKey="sleepPressure"
        />
        <FactorRow
          icon={<Sun className="h-3.5 w-3.5" />}
          label="Circadian Phase"
          tag="C"
          rawValue={decomp.circadian}
          kssPoints={decomp.cKss}
          color="hsl(220, 80%, 60%)"
          infoKey="circadian"
        />
        {decomp.hoursAwake != null && (
          <div className="flex items-center gap-2 text-xs">
            <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">Hours awake</span>
            <span className="font-mono">{decomp.hoursAwake.toFixed(1)}h</span>
          </div>
        )}
        {(decomp.kss90 != null || decomp.pSevere != null) && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            {decomp.kss90 != null && <span>90th-percentile pilot: KSS {decomp.kss90.toFixed(1)}</span>}
            {decomp.pSevere != null && <span>P(KSS ≥ 7): {(decomp.pSevere * 100).toFixed(0)}%</span>}
          </div>
        )}
      </div>

      <KssBar decomp={decomp} />
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          Alertness Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FactorRow({
  icon,
  label,
  tag,
  rawValue,
  kssPoints,
  color,
  infoKey,
}: {
  icon: React.ReactNode;
  label: string;
  tag: string;
  rawValue: number;
  kssPoints: number;
  color: string;
  infoKey: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] font-mono text-muted-foreground">({tag})</span>
          {info && <InfoTooltip entry={info} size="sm" />}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground w-8 text-right">{rawValue.toFixed(2)}</span>
        <span className="text-xs font-mono font-semibold w-16 text-right" style={{ color }}>
          +{kssPoints.toFixed(1)} KSS
        </span>
      </div>
    </div>
  );
}

/** KSS 1 → 9 bar: rested baseline + S + C + remainder (U). */
function KssBar({ decomp }: { decomp: PerformanceDecomposition }) {
  const toPct = (k: number) => Math.max(0, (k / 8) * 100);
  const segments = [
    { width: toPct(decomp.referenceKss - 1), color: 'hsl(var(--success))', label: 'Rested' },
    { width: toPct(decomp.sKss), color: 'hsl(0, 80%, 60%)', label: 'S' },
    { width: toPct(decomp.cKss), color: 'hsl(220, 80%, 60%)', label: 'C' },
    { width: toPct(decomp.otherKss), color: 'hsl(var(--muted-foreground))', label: 'U' },
  ].filter(s => s.width > 0.5);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 h-3 rounded-full overflow-hidden bg-secondary">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all"
            style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${((seg.width / 100) * 8).toFixed(1)} KSS`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>KSS 1</span>
        <div className="flex items-center gap-2">
          {segments.map((seg) => (
            <span key={seg.label} className="flex items-center gap-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
          ))}
        </div>
        <span>KSS 9</span>
      </div>
    </div>
  );
}

function formatFlightPhase(phase: string): string {
  return phase
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
