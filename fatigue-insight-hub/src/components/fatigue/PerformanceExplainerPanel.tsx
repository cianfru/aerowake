import { Activity, Moon, Sun, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { decomposePerformance, type PerformanceDecomposition } from '@/lib/fatigue-calculations';
import { getPerformanceColor } from '@/lib/fatigue-utils';
import { cn } from '@/lib/utils';

interface PerformanceExplainerPanelProps {
  /** A single high-resolution timeline point from the backend. */
  point: {
    performance: number;
    sleep_pressure: number;
    circadian: number;
    sleep_inertia: number;
    time_on_task_penalty: number;
    hours_on_duty: number;
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
 * Performance Explainer Panel — shows P = 20 + 80 × [S·C × (1−W) − ToT]
 * decomposition with live values and a stacked contribution bar.
 */
export function PerformanceExplainerPanel({
  point,
  timestamp,
  variant = 'card',
}: PerformanceExplainerPanelProps) {
  const decomp = decomposePerformance(point);

  const content = (
    <div className="space-y-3">
      {/* Performance headline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-2xl font-bold font-mono leading-none"
            style={{ color: getPerformanceColor(decomp.performance) }}
          >
            {decomp.performance.toFixed(1)}%
          </span>
          <InfoTooltip entry={FATIGUE_INFO.performance} />
        </div>
        <div className="flex items-center gap-1.5">
          {point.flight_phase && (
            <Badge
              variant={point.is_critical ? 'critical' : 'outline'}
              className="text-[10px]"
            >
              {formatFlightPhase(point.flight_phase)}
            </Badge>
          )}
          {point.is_in_rest && (
            <Badge variant="info" className="text-[10px]">
              In-Rest
            </Badge>
          )}
          {timestamp && (
            <span className="text-xs text-muted-foreground font-mono">
              {timestamp}
            </span>
          )}
        </div>
      </div>

      {/* Formula display */}
      <div className="rounded bg-secondary/50 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
        P = 20 + 80 &times; [S&middot;C &times; (1&minus;W) &minus; ToT]
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        <FactorRow
          icon={<Moon className="h-3.5 w-3.5" />}
          label="Sleep Pressure"
          tag="S"
          rawValue={decomp.sleepPressure}
          contribution={decomp.sContribution}
          color="hsl(0, 80%, 60%)"
          infoKey="sleepPressure"
        />
        <FactorRow
          icon={<Sun className="h-3.5 w-3.5" />}
          label="Circadian"
          tag="C"
          rawValue={decomp.circadian}
          contribution={decomp.cContribution}
          color="hsl(220, 80%, 60%)"
          infoKey="circadian"
        />
        <FactorRow
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Sleep Inertia"
          tag="W"
          rawValue={decomp.sleepInertia}
          contribution={decomp.wContribution}
          color="hsl(30, 90%, 55%)"
          infoKey="sleepInertia"
        />
        <FactorRow
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Time-on-Task"
          tag="ToT"
          rawValue={decomp.timeOnTaskPenalty}
          contribution={decomp.totContribution}
          color="hsl(var(--muted-foreground))"
          infoKey="timeOnTask"
          suffix={`${decomp.hoursOnDuty.toFixed(1)}h on duty`}
        />
      </div>

      {/* Stacked contribution bar */}
      <ContributionBar decomp={decomp} />
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
          Performance Breakdown
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
  contribution,
  color,
  infoKey,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  tag: string;
  rawValue: number;
  contribution: number;
  color: string;
  infoKey: string;
  suffix?: string;
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
        {suffix && (
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground w-8 text-right">
          {rawValue.toFixed(2)}
        </span>
        <span
          className="text-xs font-mono font-semibold w-12 text-right"
          style={{ color }}
        >
          -{contribution.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function ContributionBar({ decomp }: { decomp: PerformanceDecomposition }) {
  const totalDeficit = decomp.sContribution + decomp.cContribution + decomp.wContribution + decomp.totContribution;
  const remaining = Math.max(0, 100 - totalDeficit);

  // Segment widths as percentages
  const segments = [
    { width: remaining, color: 'hsl(var(--success))', label: 'Alert' },
    { width: decomp.sContribution, color: 'hsl(0, 80%, 60%)', label: 'S' },
    { width: decomp.cContribution, color: 'hsl(220, 80%, 60%)', label: 'C' },
    { width: decomp.wContribution, color: 'hsl(30, 90%, 55%)', label: 'W' },
    { width: decomp.totContribution, color: 'hsl(var(--muted-foreground))', label: 'ToT' },
  ].filter(s => s.width > 0.5); // hide negligible segments

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 h-3 rounded-full overflow-hidden bg-secondary">
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

function formatFlightPhase(phase: string): string {
  return phase
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
