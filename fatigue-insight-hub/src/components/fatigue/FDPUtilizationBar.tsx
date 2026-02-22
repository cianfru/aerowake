import { Timer, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';

interface FDPUtilizationBarProps {
  actualFdpHours: number;
  maxFdpHours: number;
  extendedFdpHours?: number;
  usedDiscretion?: boolean;
}

export function FDPUtilizationBar({
  actualFdpHours,
  maxFdpHours,
  extendedFdpHours,
  usedDiscretion,
}: FDPUtilizationBarProps) {
  // The bar spans from 0 to the upper bound (extended or max + 2h buffer for exceedance)
  const effectiveExtended = extendedFdpHours ?? maxFdpHours;
  const upperBound = Math.max(effectiveExtended + 1, actualFdpHours + 0.5);
  const utilization = maxFdpHours > 0 ? (actualFdpHours / maxFdpHours) * 100 : 0;

  // Positions as percentages
  const actualPos = Math.min((actualFdpHours / upperBound) * 100, 100);
  const basePos = (maxFdpHours / upperBound) * 100;
  const extendedPos = extendedFdpHours ? (extendedFdpHours / upperBound) * 100 : basePos;

  // Color based on utilization
  const getColor = () => {
    if (actualFdpHours > effectiveExtended) return { bar: 'bg-critical', text: 'text-critical', label: 'EXCEEDANCE' };
    if (actualFdpHours > maxFdpHours) return { bar: 'bg-warning', text: 'text-warning', label: 'DISCRETION' };
    if (utilization > 85) return { bar: 'bg-warning', text: 'text-warning', label: 'HIGH' };
    return { bar: 'bg-success', text: 'text-success', label: 'NORMAL' };
  };

  const color = getColor();

  return (
    <Card variant="glass">
      <CardContent className="py-3 px-4 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">FDP Utilization</span>
            {FATIGUE_INFO.fdpUtilization && <InfoTooltip entry={FATIGUE_INFO.fdpUtilization} size="sm" />}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-sm font-semibold tabular-nums', color.text)}>
              {actualFdpHours.toFixed(1)}h / {maxFdpHours.toFixed(1)}h
            </span>
            <Badge variant={color.label === 'NORMAL' ? 'success' : color.label === 'HIGH' ? 'warning' : color.label === 'DISCRETION' ? 'warning' : 'critical'} className="text-[10px]">
              {Math.round(utilization)}%
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 rounded-full overflow-hidden bg-secondary/50">
          {/* Green zone: 0 → base limit */}
          <div
            className="absolute inset-y-0 left-0 bg-success/20 rounded-l-full"
            style={{ width: `${basePos}%` }}
          />

          {/* Amber zone: base limit → extended limit (commander discretion) */}
          {extendedFdpHours && extendedFdpHours > maxFdpHours && (
            <div
              className="absolute inset-y-0 bg-warning/20"
              style={{ left: `${basePos}%`, width: `${extendedPos - basePos}%` }}
            />
          )}

          {/* Red zone: beyond extended */}
          {actualFdpHours > effectiveExtended && (
            <div
              className="absolute inset-y-0 bg-critical/20 rounded-r-full"
              style={{ left: `${extendedPos}%`, right: 0 }}
            />
          )}

          {/* Filled bar (actual FDP) */}
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all', color.bar)}
            style={{ width: `${actualPos}%`, opacity: 0.7 }}
          />

          {/* Base limit marker */}
          <div
            className="absolute inset-y-0 w-px bg-success"
            style={{ left: `${basePos}%` }}
          />

          {/* Extended limit marker */}
          {extendedFdpHours && extendedFdpHours > maxFdpHours && (
            <div
              className="absolute inset-y-0 w-px bg-warning"
              style={{ left: `${extendedPos}%` }}
            />
          )}
        </div>

        {/* Labels row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>0h</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              Base: {maxFdpHours.toFixed(1)}h
            </span>
            {extendedFdpHours && extendedFdpHours > maxFdpHours && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                Extended: {extendedFdpHours.toFixed(1)}h
              </span>
            )}
          </div>
        </div>

        {/* Discretion warning */}
        {usedDiscretion && (
          <div className="flex items-center gap-1.5 text-[10px] text-warning">
            <AlertTriangle className="h-3 w-3" />
            <span>Commander discretion applied (ORO.FTL.205(f))</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
