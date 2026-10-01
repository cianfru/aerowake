/** Small accessible inputs shared by the debrief sheet and the pilot diary. */
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Vertical rating list (KSS 1–9 or Samn-Perelli 1–7) with verbal anchors. */
export function RatingScale({ legend, hint, options, value, onChange, name }: {
  legend: ReactNode; hint?: ReactNode; options: string[]; value: number | null;
  onChange: (value: number) => void; name: string;
}) {
  const hintId = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      <div className="overflow-hidden rounded-lg border border-border">
        {options.map((label, i) => {
          const score = i + 1;
          const selected = value === score;
          return (
            <label
              key={label}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0 transition-colors',
                'focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ring',
                selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60',
              )}
            >
              <input type="radio" name={name} value={score} checked={selected} onChange={() => onChange(score)} className="sr-only" aria-label={`${score}: ${label}`} />
              <span
                aria-hidden="true"
                className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm tabular',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}
              >
                {score}
              </span>
              <span className={cn(selected && 'font-medium')}>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Single or multiple choice chips. Single choice uses radio semantics. */
export function ChoiceChips<T extends string>({ legend, options, value, onChange, multiple, disabled }: {
  legend: ReactNode; options: Array<{ value: T; label: string }>; value: T | T[] | null;
  onChange: (value: T) => void; multiple?: boolean; disabled?: (value: T) => boolean;
}) {
  const name = useId();
  const isOn = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = isOn(option.value);
          const off = disabled?.(option.value) ?? false;
          const classes = cn(
            'inline-flex min-h-10 items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors',
            'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
            on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted/60',
            off && 'cursor-not-allowed opacity-50',
          );
          return (
            <label key={option.value} className={cn(classes, !off && 'cursor-pointer')}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                className="sr-only"
                checked={on}
                disabled={off}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
