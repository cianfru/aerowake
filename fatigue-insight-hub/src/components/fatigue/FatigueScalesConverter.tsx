import { Gauge, Brain, Users, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { getKSSLabel } from '@/lib/fatigue-calculations';
import { resolveKss } from '@/lib/risk-scale';
import { cn } from '@/lib/utils';

interface FatigueScalesConverterProps {
  /** The 20–100 index (= 110 − 10·KSS). */
  performance: number;
  /** Backend-predicted KSS, preferred over the index when available. */
  kss?: number;
  /** Backend KSS for the 90th-percentile pilot. */
  kss90?: number;
  /** Backend P(KSS ≥ 7), 0–1. */
  pSevere?: number;
  /** Which point this represents. */
  label?: string;
  /** Compact layout for inline display in DutyDetails. */
  variant?: 'card' | 'inline';
}

type Variant = 'success' | 'warning' | 'critical';

const fillClass = (v: Variant) => (v === 'success' ? 'bg-success' : v === 'warning' ? 'bg-warning' : 'bg-critical');
const textClass = (v: Variant) => (v === 'success' ? 'text-success' : v === 'warning' ? 'text-warning' : 'text-critical');

/**
 * Shows the model output on the Karolinska Sleepiness Scale.
 *
 * The index is a linear re-expression of predicted KSS, so KSS is shown
 * directly. Samn-Perelli and reaction time were removed: there is no
 * validated mapping from predicted KSS to either.
 */
export function FatigueScalesConverter({
  performance,
  kss: kssProp,
  kss90,
  pSevere,
  label,
  variant = 'card',
}: FatigueScalesConverterProps) {
  const kss = resolveKss(kssProp, performance) ?? 5;
  const kssInfo = getKSSLabel(kss);
  const kss90Info = kss90 != null ? getKSSLabel(kss90) : null;
  const pVariant: Variant | null = pSevere == null ? null : pSevere < 0.1 ? 'success' : pSevere < 0.3 ? 'warning' : 'critical';

  if (variant === 'inline') {
    return (
      <div className="grid grid-cols-3 gap-2">
        <ScaleChip label="KSS" value={kss.toFixed(1)} sublabel={kssInfo.label} variant={kssInfo.variant} infoKey="kss" />
        {kss90Info && kss90 != null && (
          <ScaleChip label="KSS 90th" value={kss90.toFixed(1)} sublabel={kss90Info.label} variant={kss90Info.variant} infoKey="kss90" />
        )}
        {pVariant && pSevere != null && (
          <ScaleChip label="P(KSS ≥ 7)" value={`${(pSevere * 100).toFixed(0)}%`} sublabel="Sleepy or worse" variant={pVariant} infoKey="pSevere" />
        )}
      </div>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Brain className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          Predicted Sleepiness
          {label && <span className="text-xs text-muted-foreground font-normal">— {label}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ScaleCard
            icon={<Gauge className="h-3.5 w-3.5 text-muted-foreground" />}
            title="KSS"
            infoKey="kss"
            badge={`${kss.toFixed(1)} / 9`}
            variant={kssInfo.variant}
            fill={(kss - 1) / 8}
            caption={`${kssInfo.label} · index ${performance.toFixed(0)}`}
          />
          {kss90Info && kss90 != null && (
            <ScaleCard
              icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
              title="KSS, 90th-pct pilot"
              infoKey="kss90"
              badge={`${kss90.toFixed(1)} / 9`}
              variant={kss90Info.variant}
              fill={(kss90 - 1) / 8}
              caption={kss90Info.label}
            />
          )}
          {pVariant && pSevere != null && (
            <ScaleCard
              icon={<Percent className="h-3.5 w-3.5 text-muted-foreground" />}
              title="P(KSS ≥ 7)"
              infoKey="pSevere"
              badge={`${(pSevere * 100).toFixed(0)}%`}
              variant={pVariant}
              fill={pSevere}
              caption="Probability of rating sleepy or worse"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScaleCard({
  icon,
  title,
  infoKey,
  badge,
  variant,
  fill,
  caption,
}: {
  icon: React.ReactNode;
  title: string;
  infoKey: string;
  badge: string;
  variant: Variant;
  fill: number;
  caption: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium">{title}</span>
          {info && <InfoTooltip entry={info} />}
        </div>
        <Badge variant={variant} className="text-[10px]">
          {badge}
        </Badge>
      </div>
      <div className="relative h-1.5 rounded-[2px] bg-secondary overflow-hidden">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-[2px] transition-all', fillClass(variant))}
          style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{caption}</p>
    </div>
  );
}

/** Compact scale chip for inline variant. */
function ScaleChip({
  label,
  value,
  sublabel,
  variant,
  infoKey,
}: {
  label: string;
  value: string;
  sublabel: string;
  variant: Variant;
  infoKey: string;
}) {
  const info = FATIGUE_INFO[infoKey];
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/30 border border-border/50 px-2.5 py-1.5 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
          {info && <InfoTooltip entry={info} size="sm" />}
        </div>
        <div className={cn('text-sm font-mono font-semibold leading-tight', textClass(variant))}>{value}</div>
        <p className="text-[9px] text-muted-foreground truncate">{sublabel}</p>
      </div>
    </div>
  );
}
