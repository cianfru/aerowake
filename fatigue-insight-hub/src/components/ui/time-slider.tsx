/**
 * TimeSlider — compact time input using Radix Slider, for sleep editing.
 *
 * Shows a label (e.g. "Bedtime"), the current time as HH:MM, a slider
 * with 15-min steps, and an amber diff indicator when value differs
 * from original.
 */

import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface TimeSliderProps {
  /** Label displayed above the slider, e.g. "Bedtime" or "Wake-up" */
  label: string;
  /** Current value as decimal hour (e.g. 22.5 = 22:30) */
  value: number;
  /** Minimum value (decimal hour) */
  min: number;
  /** Maximum value (decimal hour) */
  max: number;
  /** Step size in hours (default 0.25 = 15 min) */
  step?: number;
  /** Original value — when current differs, show amber diff */
  originalValue?: number;
  /** Called when user adjusts the slider */
  onChange: (value: number) => void;
}

/** Convert decimal hour to HH:MM display (handles > 24 with +1d suffix) */
function decimalToDisplay(h: number): { time: string; nextDay: boolean } {
  const wrapped = ((h % 24) + 24) % 24;
  const hh = Math.floor(wrapped);
  const mm = Math.round((wrapped - hh) * 60);
  return {
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    nextDay: h >= 24,
  };
}

export function TimeSlider({
  label,
  value,
  min,
  max,
  step = 0.25,
  originalValue,
  onChange,
}: TimeSliderProps) {
  const display = decimalToDisplay(value);
  const isChanged = originalValue != null && Math.abs(value - originalValue) >= 0.01;
  const originalDisplay = originalValue != null ? decimalToDisplay(originalValue) : null;

  // Delta in minutes for diff label
  const deltaMin = originalValue != null ? Math.round((value - originalValue) * 60) : 0;
  const deltaSign = deltaMin >= 0 ? '+' : '';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-mono text-xs font-medium',
              isChanged ? 'text-warning' : 'text-foreground'
            )}
          >
            {display.time}
            {display.nextDay && (
              <span className="text-[9px] text-muted-foreground ml-0.5">(+1d)</span>
            )}
          </span>
          {isChanged && (
            <span className="text-[10px] text-warning/80 font-mono">
              {deltaSign}{deltaMin}m
            </span>
          )}
        </div>
      </div>

      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className={cn(
          'h-5',
          isChanged && '[&_[data-radix-slider-range]]:bg-warning [&_[data-radix-slider-thumb]]:border-warning'
        )}
      />

      {isChanged && originalDisplay && (
        <div className="text-[10px] text-muted-foreground text-right">
          was {originalDisplay.time}
          {originalDisplay.nextDay && ' (+1d)'}
        </div>
      )}
    </div>
  );
}
