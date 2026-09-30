import { useState } from 'react';
import type { RosterPreview } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { dutyTimes } from './import-format';

/**
 * Parsed duties for a line-by-line check against the roster, in home-base
 * time by default with UTC on demand. Inferred releases are marked.
 */
export function PreviewDutyList({ preview }: { preview: RosterPreview }) {
  const [utc, setUtc] = useState(false);
  const zone = utc ? 'UTC' : preview.home_timezone;
  const homeLabel = `${preview.base_city || preview.home_base} time`;
  const anyInferred = preview.duties.some(d => d.release_inferred);

  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>
          {preview.standby_periods ? 'Check duty and standby times' : 'Check duty times'}{' '}
          <span className="font-normal text-muted-foreground">({preview.duties.length})</span>
        </span>
        <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
        <div role="group" aria-label="Show duty times in" className="inline-flex rounded-md border border-border p-0.5 text-xs">
          {[{ key: false, label: homeLabel }, { key: true, label: 'UTC' }].map(option => (
            <button
              key={option.label}
              type="button"
              aria-pressed={utc === option.key}
              onClick={() => setUtc(option.key)}
              className={cn(
                'rounded-[5px] px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                utc === option.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {/* Focusable so the scrolling list can be read with the keyboard. */}
        <ul tabIndex={0} className="max-h-72 divide-y divide-border overflow-auto rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Duties, times in ${utc ? 'UTC' : homeLabel}`}>
          {preview.duties.map(duty => {
            const t = dutyTimes(duty, zone);
            return (
              <li key={duty.id} className="grid grid-cols-[5.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2">
                <span className="text-muted-foreground">{t.day}</span>
                <span className="min-w-0 break-words">{duty.route}</span>
                <span className="whitespace-nowrap font-mono text-xs tabular-nums">
                  {t.report}–{t.release}
                  {t.dayOffset && <sup className="ml-0.5 text-[10px] text-muted-foreground">{t.dayOffset}</sup>}
                  {duty.release_inferred && <span className="text-muted-foreground" title="Release inferred">*</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {anyInferred && <p className="text-xs text-muted-foreground">* Release time inferred (not printed on the roster).</p>}
      </div>
    </details>
  );
}
