import { useState } from 'react';
import { SleepHabitsEditor } from '@/components/fatigue/SleepHabitsEditor';
import { useSleepPreferences } from '@/hooks/useSleepPreferences';
import { samePreferences } from '@/lib/sleep-preferences';

const NAP_WORDS = { usually: 'usually nap', sometimes: 'nap sometimes', rarely: 'rarely nap' } as const;

/**
 * "Your sleep" in the roster outlook: the usual night and nap habit the analysis
 * uses, with an editor. Saved to the account when signed in, on this device
 * otherwise, and applied to the roster on screen.
 */
export function SleepHabitsPanel() {
  const { preferences, used, apply, isApplying, isAuthenticated } = useSleepPreferences();
  const [open, setOpen] = useState(false);
  const shown = used ?? preferences;
  const pending = used && !samePreferences(used, preferences);

  return (
    <div className="min-w-0 max-w-md space-y-1.5">
      <p className="text-xs font-medium">Your sleep</p>
      <p className="text-sm">
        <span className="font-mono tabular">{shown.usualBedtime}–{shown.usualWakeTime}</span>
        <span className="text-muted-foreground"> · {NAP_WORDS[shown.napHabit]} before late reports</span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline">
          {open ? 'Close' : 'Change'}
        </button>
      </p>
      {pending && !open && (
        <p className="text-xs text-muted-foreground">Your new habits apply the next time you analyse this roster.</p>
      )}
      {open && (
        <div className="rounded-xl border border-border bg-card p-4">
          <SleepHabitsEditor value={preferences} busy={isApplying} saveLabel="Save and recalculate"
            onSave={async (next) => {
              const outcome = await apply(next);
              const where = isAuthenticated ? 'Saved to your account' : 'Saved on this device';
              return outcome === 'recalculated' ? `${where}. Recalculating your roster…`
                : outcome === 'next-time' ? `${where}. Applies the next time you analyse this roster.`
                : `${where}.`;
            }} />
        </div>
      )}
    </div>
  );
}
