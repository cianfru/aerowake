import { Gauge, Activity, Timer, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import {
  performanceToKSS,
  getKSSLabel,
  performanceToSamnPerelli,
  getSamnPerelliLabel,
  performanceToReactionTime,
  getReactionTimeLabel,
} from '@/lib/fatigue-calculations';
import { cn } from '@/lib/utils';

interface FatigueScalesConverterProps {
  /** The model performance score (20-100) to convert. */
  performance: number;
  /** Which performance point this represents. */
  label?: string;
  /** Compact layout for inline display in DutyDetails. */
  variant?: 'card' | 'inline';
}

/**
 * Converts the biomathematical model performance score into three
 * validated fatigue scales used in aviation and sleep research.
 */
export function FatigueScalesConverter({
  performance,
  label,
  variant = 'card',
}: FatigueScalesConverterProps) {
  const kss = performanceToKSS(performance);
  const kssInfo = getKSSLabel(kss);
  const sp = performanceToSamnPerelli(performance);
  const spInfo = getSamnPerelliLabel(sp);
  const rt = performanceToReactionTime(performance);
  const rtInfo = getReactionTimeLabel(rt);

  if (variant === 'inline') {
    return (
      <div className="grid grid-cols-3 gap-2">
        <ScaleChip
          label="KSS"
          value={kss.toFixed(1)}
          sublabel={kssInfo.label}
          variant={kssInfo.variant}
          infoKey="kss"
        />
        <ScaleChip
          label="S-P"
          value={sp.toFixed(1)}
          sublabel={spInfo.label}
          variant={spInfo.variant}
          infoKey="samnPerelli"
        />
        <ScaleChip
          label="PVT"
          value={`${rt}ms`}
          sublabel={rtInfo.label}
          variant={rtInfo.variant}
          infoKey="reactionTime"
        />
      </div>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Brain className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
          Fatigue Scales
          {label && (
            <span className="text-xs text-muted-foreground font-normal">
              — {label}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* KSS */}
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">KSS</span>
                <InfoTooltip entry={FATIGUE_INFO.kss} />
              </div>
              <Badge variant={kssInfo.variant} className="text-[10px]">
                {kss.toFixed(1)} / 9
              </Badge>
            </div>
            <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all',
                  kssInfo.variant === 'success' ? 'bg-success' :
                  kssInfo.variant === 'warning' ? 'bg-warning' : 'bg-critical',
                )}
                style={{ width: `${(kss / 9) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{kssInfo.label}</p>
          </div>

          {/* Samn-Perelli */}
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Samn-Perelli</span>
                <InfoTooltip entry={FATIGUE_INFO.samnPerelli} />
              </div>
              <Badge variant={spInfo.variant} className="text-[10px]">
                {sp.toFixed(1)} / 7
              </Badge>
            </div>
            <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all',
                  spInfo.variant === 'success' ? 'bg-success' :
                  spInfo.variant === 'warning' ? 'bg-warning' : 'bg-critical',
                )}
                style={{ width: `${(sp / 7) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{spInfo.label}</p>
          </div>

          {/* PVT Reaction Time */}
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">PVT RT</span>
                <InfoTooltip entry={FATIGUE_INFO.reactionTime} />
              </div>
              <Badge variant={rtInfo.variant} className="text-[10px]">
                {rt}ms
              </Badge>
            </div>
            <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all',
                  rtInfo.variant === 'success' ? 'bg-success' :
                  rtInfo.variant === 'warning' ? 'bg-warning' : 'bg-critical',
                )}
                style={{ width: `${Math.min(100, ((rt - 200) / 300) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{rtInfo.label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
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
  variant: 'success' | 'warning' | 'critical';
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
        <div className={cn(
          'text-sm font-mono font-semibold leading-tight',
          variant === 'success' ? 'text-success' :
          variant === 'warning' ? 'text-warning' : 'text-critical',
        )}>
          {value}
        </div>
        <p className="text-[9px] text-muted-foreground truncate">{sublabel}</p>
      </div>
    </div>
  );
}
