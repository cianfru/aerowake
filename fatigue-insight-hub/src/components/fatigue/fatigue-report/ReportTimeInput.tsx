import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { localInputToUtcIso, utcIsoToLocalInput } from '@/lib/fatigue-report-api';
import { formatLocal, formatZ, isCompleteClock, normaliseClock } from '@/lib/report-time';
import { cn } from '@/lib/utils';

/**
 * Date + 24-hour time bound to a UTC instant and displayed in `tz`.
 * Locked until the time zone is known, so no value is ever captured in an
 * implicit zone. The zone is part of the label and the other reference (Z,
 * or local when entering in UTC) is echoed underneath.
 */
export function ReportTimeInput({ value, onChange, tz, zone, echoTz, label, error, hint, compact }: {
  value: string; onChange: (iso: string) => void; tz: string; zone: string; echoTz?: string;
  label: string; error?: string | null; hint?: string; compact?: boolean;
}) {
  const id = useId();
  const locked = !tz;
  const wall = value && tz ? utcIsoToLocalInput(value, tz) : '';
  const [date, setDate] = useState(wall.slice(0, 10));
  const [time, setTime] = useState(wall.slice(11, 16));
  const [local, setLocal] = useState('');

  // Follow external changes (zone switch, quick buttons) unless they already match what is typed.
  useEffect(() => {
    setDate(wall.slice(0, 10));
    setTime(wall.slice(11, 16));
    setLocal('');
  }, [wall]);

  const commit = (d: string, t: string) => {
    const clock = normaliseClock(t);
    if (!d || !clock) { setLocal(t.trim() ? 'Enter a 24-hour time, e.g. 04:30.' : ''); return; }
    const iso = localInputToUtcIso(`${d}T${clock}`, tz);
    if (!iso) { setLocal('This local time does not exist or occurs twice (clock change). Enter it in UTC instead.'); return; }
    setLocal('');
    onChange(iso);
  };

  const message = local || error || '';
  const echo = !locked && value
    ? tz === 'UTC'
      ? echoTz ? `= ${formatLocal(value, echoTz)} local` : ''
      : `= ${formatZ(value)}`
    : '';

  return (
    <div className={cn('min-w-0 space-y-1.5 text-sm', compact && 'space-y-1')}>
      <label htmlFor={`${id}-d`} className="block text-muted-foreground">
        {label} <span className="whitespace-nowrap text-xs">({locked ? 'enter your home base first' : zone})</span>
      </label>
      <div className="flex min-w-0 gap-2">
        <Input id={`${id}-d`} type="date" value={date} disabled={locked} aria-invalid={!!message}
          aria-describedby={`${id}-m`} className="min-w-0 flex-[3] scroll-mb-28"
          onChange={(e) => { setDate(e.target.value); commit(e.target.value, time); }} />
        <Input aria-label={`${label}, time (24-hour)`} inputMode="numeric" placeholder="HH:MM" maxLength={5} value={time}
          disabled={locked} aria-invalid={!!message} aria-describedby={`${id}-m`} className="min-w-[4.75rem] flex-[2] scroll-mb-28 font-mono tabular-nums"
          onChange={(e) => { setTime(e.target.value); if (isCompleteClock(e.target.value) && normaliseClock(e.target.value)) commit(date, e.target.value); }}
          onBlur={(e) => { const c = normaliseClock(e.target.value); if (c) setTime(c); commit(date, e.target.value); }} />
      </div>
      <p id={`${id}-m`} className="min-h-[1rem] text-xs">
        {message
          ? <span role="alert" data-report-error className="text-destructive">{message}</span>
          : <span className="font-mono text-muted-foreground tabular-nums">{echo}{hint ? <span className="font-sans"> {hint}</span> : null}</span>}
      </p>
    </div>
  );
}
