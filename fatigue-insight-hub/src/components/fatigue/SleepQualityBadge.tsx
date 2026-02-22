import { cn } from '@/lib/utils';
import { SleepQualityFactors } from '@/types/fatigue';

interface SleepQualityBadgeProps {
  qualityFactors?: SleepQualityFactors;
  /** Compact inline badge showing net quality multiplier */
  className?: string;
}

/**
 * SleepQualityBadge — compact inline badge showing the net sleep quality
 * multiplier directly on chronogram sleep bars.
 *
 * Only displays when quality is notably poor (<0.85) or notably good (>1.05),
 * avoiding visual clutter for normal sleep periods.
 *
 * On the bar itself: shows "×0.68" in red or "×1.05" in green.
 */
export function SleepQualityBadge({ qualityFactors, className }: SleepQualityBadgeProps) {
  if (!qualityFactors) return null;

  // Calculate net quality multiplier from all factors
  const factors = [
    qualityFactors.base_efficiency ?? 1,
    qualityFactors.wocl_boost ?? 1,
    qualityFactors.late_onset_penalty ?? 1,
    qualityFactors.recovery_boost ?? 1,
    qualityFactors.time_pressure_factor ?? 1,
    qualityFactors.insufficient_penalty ?? 1,
  ];

  const netQuality = factors.reduce((product, f) => product * f, 1);

  // Only show if quality is notably bad or notably good
  if (netQuality >= 0.85 && netQuality <= 1.05) return null;

  const isPoor = netQuality < 0.85;
  const isGood = netQuality > 1.05;

  // Find the dominant factor (furthest from 1.0)
  const factorLabels: Record<string, string> = {
    base_efficiency: 'Base',
    wocl_boost: 'WOCL',
    late_onset_penalty: 'Late',
    recovery_boost: 'Recovery',
    time_pressure_factor: 'Pressure',
    insufficient_penalty: 'Short',
  };

  let dominantLabel = '';
  let dominantDeviation = 0;
  const entries: [string, number][] = [
    ['base_efficiency', qualityFactors.base_efficiency ?? 1],
    ['wocl_boost', qualityFactors.wocl_boost ?? 1],
    ['late_onset_penalty', qualityFactors.late_onset_penalty ?? 1],
    ['recovery_boost', qualityFactors.recovery_boost ?? 1],
    ['time_pressure_factor', qualityFactors.time_pressure_factor ?? 1],
    ['insufficient_penalty', qualityFactors.insufficient_penalty ?? 1],
  ];
  for (const [key, val] of entries) {
    const deviation = Math.abs(val - 1);
    if (deviation > dominantDeviation) {
      dominantDeviation = deviation;
      dominantLabel = factorLabels[key] || key;
    }
  }

  return (
    <span
      className={cn(
        'absolute right-0.5 top-0.5 px-1 py-px rounded text-[8px] font-mono font-bold leading-tight z-20 pointer-events-none',
        isPoor && 'bg-critical/80 text-white',
        isGood && 'bg-success/80 text-white',
        className,
      )}
      title={`Quality: ×${netQuality.toFixed(2)} (${dominantLabel}: ×${entries.find(e => factorLabels[e[0]] === dominantLabel)?.[1]?.toFixed(2) ?? '?'})`}
    >
      ×{netQuality.toFixed(2)}
    </span>
  );
}
