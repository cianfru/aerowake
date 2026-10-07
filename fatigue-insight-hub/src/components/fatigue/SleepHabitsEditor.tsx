import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normaliseClock } from '@/lib/report-time';
import { nightHours, samePreferences, validateNight, type SleepPreferences } from '@/lib/sleep-preferences';
import { cn } from '@/lib/utils';
import type { NapHabit } from '@/types/fatigue';

const NAP_CHOICES: Array<{ value: NapHabit; label: string; text: string }> = [
  { value: 'usually', label: 'Usually', text: 'You nap before afternoon, evening and night departures: the full nap for the report time is assumed.' },
  { value: 'sometimes', label: 'Sometimes', text: 'The average across crews: about half nap before an evening departure (54 %, Signal et al. 2014), so about half of that nap is assumed. The default.' },
  { value: 'rarely', label: 'Rarely', text: 'No pre-duty nap is assumed.' },
];

/**
 * Usual bedtime, wake-up and nap habit, with what each one changes in the model.
 * `onSave` returns a short message to show (or throws one).
 */
export function SleepHabitsEditor({ value, onSave, busy = false, saveLabel = 'Save' }: {
  value: SleepPreferences;
  onSave: (next: SleepPreferences) => Promise<string>;
  busy?: boolean;
  saveLabel?: string;
}) {
  const id = useId();
  const [bedtime, setBedtime] = useState(value.usualBedtime);
  const [wake, setWake] = useState(value.usualWakeTime);
  const [nap, setNap] = useState<NapHabit>(value.napHabit);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBedtime(value.usualBedtime);
    setWake(value.usualWakeTime);
    setNap(value.napHabit);
  }, [value.usualBedtime, value.usualWakeTime, value.napHabit]);

  const error = validateNight(bedtime, wake);
  const hours = error ? null : nightHours(bedtime, wake);
  const next: SleepPreferences = { usualBedtime: normaliseClock(bedtime) ?? bedtime, usualWakeTime: normaliseClock(wake) ?? wake, napHabit: nap };
  const unchanged = samePreferences(next, value);

  const save = async () => {
    if (error) return;
    setSaving(true);
    setMessage(null);
    try {
      setMessage({ text: await onSave(next), error: false });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Your sleep habits could not be saved.', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <fieldset className="space-y-2">
        <legend className="font-medium">Your usual night at home</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor={`${id}-bed`} className="block text-xs text-muted-foreground">Bedtime (24-hour)</label>
            <Input id={`${id}-bed`} value={bedtime} onChange={(e) => setBedtime(e.target.value)} onBlur={() => setBedtime(normaliseClock(bedtime) ?? bedtime)}
              inputMode="numeric" placeholder="23:00" maxLength={5} aria-invalid={!!error} className="w-24 font-mono tabular-nums" />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-wake`} className="block text-xs text-muted-foreground">Wake-up (24-hour)</label>
            <Input id={`${id}-wake`} value={wake} onChange={(e) => setWake(e.target.value)} onBlur={() => setWake(normaliseClock(wake) ?? wake)}
              inputMode="numeric" placeholder="07:00" maxLength={5} aria-invalid={!!error} className="w-24 font-mono tabular-nums" />
          </div>
          {hours != null && <p className="pb-2 font-mono text-xs text-muted-foreground tabular">{hours.toFixed(1)}h</p>}
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sets the main sleep before duties and on days off. The default 23:00–07:00 is an editable
          modelling assumption. For early reports the model may advance bedtime by up to 1.5h,
          no earlier than 21:30; these bounds are assumptions informed by the evening wake-maintenance
          zone (Dijk &amp; Czeisler 1994). Use your own usual night and review each estimated sleep block.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-medium">Before afternoon, evening and night departures I nap</legend>
        <div role="radiogroup" aria-label="Pre-duty naps" className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {NAP_CHOICES.map((c) => (
            <button key={c.value} type="button" role="radio" aria-checked={nap === c.value} onClick={() => setNap(c.value)}
              className={cn('min-h-[36px] rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                nap === c.value ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{NAP_CHOICES.find((c) => c.value === nap)?.text}</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={!!error || unchanged || saving || busy}>
          {saving || busy ? 'Saving…' : saveLabel}
        </Button>
        {message && (
          <p role={message.error ? 'alert' : 'status'} className={cn('text-xs', message.error ? 'text-destructive' : 'text-muted-foreground')}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
