import { useMemo } from 'react';
import { addDays, format, getDaysInMonth, isWeekend, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, classifyKss, riskCssColor } from '@/lib/risk-scale';
import { homeDayKey } from '@/lib/home-time';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { dutyPeakKss, dutyRoute } from './roster-utils';

interface MonthStripProps {
  results: AnalysisResults;
  /** Personal watch level (KSS), drawn as a hairline only. */
  reference: number;
  onDetails: (duty: DutyAnalysis) => void;
}

interface DayCell {
  key: string;
  date: Date;
  duty: DutyAnalysis | null;
  peak: number | null;
  dutyCount: number;
  sleepHours: number | null;
}

const PLOT_H = 128;
const SLEEP_H = 20;
/** KSS 1–9 → bar height; KSS 1 still shows a stub so a duty day is never invisible. */
const barHeight = (kss: number) => Math.max(4, ((Math.min(9, Math.max(1, kss)) - 1) / 8) * PLOT_H);
const SLEEP_MAX = 10;

function dayKey(duty: DutyAnalysis): string {
  if (duty.dateString && /^\d{4}-\d{2}-\d{2}/.test(duty.dateString)) return duty.dateString.slice(0, 10);
  try { return format(duty.date, 'yyyy-MM-dd'); } catch { return ''; }
}

/** Estimated sleep (every modelled block, naps included) by the home-base day it ends on. */
function sleepByDay(results: AnalysisResults, tz: string): Map<string, number> {
  const seen = new Set<string>();
  const out = new Map<string, number>();
  const add = (start?: string, end?: string, hours?: number) => {
    if (!start || !end || hours == null || !Number.isFinite(hours)) return;
    const id = `${start}|${end}`;
    if (seen.has(id)) return;
    seen.add(id);
    const key = homeDayKey(end, tz);
    if (key) out.set(key, (out.get(key) ?? 0) + hours);
  };
  for (const duty of results.duties) {
    for (const b of duty.sleepEstimate?.sleepBlocks ?? []) add(b.sleepStartUtc, b.sleepEndUtc, b.durationHours);
  }
  for (const day of results.restDaysSleep ?? []) {
    for (const b of day.sleepBlocks) add(b.sleepStartIso, b.sleepEndIso, b.durationHours);
  }
  return out;
}

/**
 * Month strip: one column per day. Duty days carry a bar whose height is the
 * model's duty peak KSS, in its band colour; underneath, the estimated sleep
 * that ended that day. The dashed line is the pilot's own watch level — a
 * marker only, the bands never move.
 */
export function MonthStrip({ results, reference, onDetails }: MonthStripProps) {
  const tz = results.homeBaseTimezone || 'UTC';

  const days = useMemo<DayCell[]>(() => {
    const first = startOfMonth(results.month);
    const sleep = sleepByDay(results, tz);
    const byDay = new Map<string, DutyAnalysis[]>();
    for (const d of results.duties) {
      const k = dayKey(d);
      if (!k) continue;
      byDay.set(k, [...(byDay.get(k) ?? []), d]);
    }
    return Array.from({ length: getDaysInMonth(first) }, (_, i) => {
      const date = addDays(first, i);
      const key = format(date, 'yyyy-MM-dd');
      const duties = byDay.get(key) ?? [];
      // The day's most demanding duty speaks for the day.
      let duty: DutyAnalysis | null = null;
      let peak: number | null = null;
      for (const d of duties) {
        const k = results.legacyModel ? null : dutyPeakKss(d);
        if (duty == null || (k != null && (peak == null || k > peak))) { duty = d; peak = k; }
      }
      const s = sleep.get(key);
      return { key, date, duty, peak, dutyCount: duties.length, sleepHours: s != null ? s : null };
    });
  }, [results, tz]);

  const refTop = PLOT_H - barHeight(reference);

  return (
    <figure className="space-y-2" aria-labelledby="month-strip-caption">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption id="month-strip-caption" className="text-sm font-medium">Month at a glance</figcaption>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-4 border-t border-dashed border-foreground/70" />Your watch level {reference.toFixed(1)}</span>
          <span className="hidden items-center gap-1.5 sm:flex"><span aria-hidden="true" className="h-2 w-3 rounded-[2px] bg-primary/35" />Estimated sleep</span>
        </p>
      </div>

      <div className="relative">
        {/* Watch-level hairline across the plot */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-foreground/60" style={{ top: refTop }} />
        <ol className="grid gap-px" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-label="Duty peaks and estimated sleep by day">
          {days.map((day) => {
            const label = format(day.date, 'EEE d MMM');
            const level = day.peak != null ? classifyKss(day.peak) : null;
            const sleepText = day.sleepHours != null ? `${day.sleepHours.toFixed(1)}h estimated sleep` : 'no estimated sleep ended this day';
            const weekend = isWeekend(day.date);
            const body = (
              <>
                <span className={cn('relative block w-full rounded-t-[3px]', weekend ? 'bg-muted/60' : 'bg-muted/30')} style={{ height: PLOT_H }}>
                  {day.duty && (
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-x-[10%] bottom-0 rounded-t-[2px] transition-[filter] group-hover:brightness-110', level === 'extreme' && 'risk-extreme-hatch')}
                      style={{ height: day.peak != null ? barHeight(day.peak) : 6, background: level ? riskCssColor(level) : 'hsl(var(--muted-foreground) / 0.5)' }}
                    />
                  )}
                </span>
                <span aria-hidden="true" className="relative block w-full" style={{ height: SLEEP_H }}>
                  {day.sleepHours != null && day.sleepHours > 0 && (
                    <span className="absolute inset-x-[10%] top-px rounded-b-[2px] bg-primary/35" style={{ height: Math.max(2, (Math.min(SLEEP_MAX, day.sleepHours) / SLEEP_MAX) * (SLEEP_H - 1)) }} />
                  )}
                </span>
                <span aria-hidden="true" className={cn('block pt-1 text-center font-mono text-[10px] leading-none tabular', day.duty ? 'text-foreground' : 'text-muted-foreground', (day.date.getDate() - 1) % 7 !== 0 && 'max-sm:invisible')}>
                  {day.date.getDate()}
                </span>
              </>
            );
            if (!day.duty) {
              return <li key={day.key} className="min-w-0" title={`${label} · no duty · ${sleepText}`}>{body}<span className="sr-only">{label}: no duty, {sleepText}</span></li>;
            }
            const peakText = day.peak != null && level ? `peak KSS ${day.peak.toFixed(1)}, ${RISK_LEVEL_LABELS[level]}` : 'no prediction';
            const more = day.dutyCount > 1 ? ` (${day.dutyCount} duties)` : '';
            return (
              <li key={day.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onDetails(day.duty!)}
                  title={`${label} · ${dutyRoute(day.duty)} · ${day.peak != null ? day.peak.toFixed(1) : '—'}${more} · ${sleepText}`}
                  aria-label={`${label}: ${dutyRoute(day.duty)}${more}, ${peakText}, ${sleepText}. Open details`}
                  className="group block w-full rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}
