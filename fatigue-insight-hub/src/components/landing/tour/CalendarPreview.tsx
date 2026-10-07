import { cn } from '@/lib/utils';
import { riskClasses } from '@/lib/risk-scale';
import { formatKssValue, inkOnBandFill, kssBand } from '../landingKss';
import { formatDay, formatRoute } from '../landingFormat';
import { TOUR_DUTIES, TOUR_WEEK } from '../tourData';
import { LegendKey } from './PreviewParts';

const DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(`${TOUR_WEEK.start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});
const WEEK_DUTIES = TOUR_DUTIES.filter((d) => d.date >= DAYS[0] && d.date <= DAYS[6]);

interface Span { from: number; to: number }

/** Split a week-relative span into per-day pieces (hours within each day). */
function piecesForDay(spans: [number, number][], day: number): Span[] {
  const start = day * 24;
  return spans
    .map(([a, b]) => ({ from: Math.max(a, start) - start, to: Math.min(b, start + 24) - start }))
    .filter((s) => s.to > s.from);
}

const pct = (h: number) => `${(h / 24) * 100}%`;

/** Calendar: one week of duties, estimated sleep and the WOCL on a 24-hour home-base clock. */
export function CalendarPreview() {
  return <div className="space-y-4">
    <p className="sr-only">Week of {formatDay(DAYS[0])}, home-base time: {WEEK_DUTIES.map((d) => `${formatRoute(d.route)} on ${formatDay(d.date)}, ${d.report} to ${d.release}, peak KSS ${formatKssValue(d.peakKss)}`).join('; ')}. Estimated sleep falls between duties.</p>
    <div aria-hidden="true" className="rounded-xl border border-[color:var(--lp-dbe7ed)] bg-[color:var(--lp-fcfdfe)] p-3">
      <div className="grid grid-cols-[3.25rem_1fr] gap-2 pb-1.5">
        <span />
        <div className="relative h-3.5 font-mono text-[10px] text-[color:var(--lp-526579)]">
          {[0, 6, 12, 18].map((h) => <span key={h} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: pct(h) }}>{String(h).padStart(2, '0')}</span>)}
        </div>
      </div>
      <ul className="space-y-1">
        {DAYS.map((date, day) => <li key={date} className="grid grid-cols-[3.25rem_1fr] items-center gap-2">
          <span className="text-right text-xs text-[color:var(--lp-304a5f)]">{formatDay(date).split(' ').slice(0, 2).join(' ')}</span>
          <div className="relative h-7 overflow-hidden rounded-md bg-[color:var(--lp-f1f5f8)]">
            <span aria-hidden="true" className="absolute inset-y-0 bg-[color:var(--lp-eee8f6)]" style={{ left: pct(2), width: pct(4) }} />
            {[6, 12, 18].map((h) => <span key={h} aria-hidden="true" className="absolute inset-y-0 w-px bg-[color:var(--lp-e2eaef)]" style={{ left: pct(h) }} />)}
            {piecesForDay(TOUR_WEEK.sleep, day).map((s) => <span key={s.from} className="absolute inset-y-1 rounded-[4px] border border-dashed border-[color:var(--lp-8aa0b2)] bg-[color:var(--lp-dfe7ee8c)]" style={{ left: pct(s.from), width: pct(s.to - s.from) }} />)}
            {TOUR_WEEK.duties.map((span, i) => {
              const duty = WEEK_DUTIES[i];
              const level = kssBand(duty.peakKss);
              return piecesForDay([span], day).map((s) => <span key={`${i}-${s.from}`} className={cn('absolute inset-y-0.5 flex items-center overflow-hidden rounded-[5px] px-1.5 font-mono text-[10px] font-semibold shadow-[0_1px_2px_var(--lp-17384f40)]', riskClasses(level).fill, inkOnBandFill(level))} style={{ left: pct(s.from), width: pct(s.to - s.from) }}>
                {s.to - s.from >= 5 && <span className="truncate">{duty.route.join('–')}</span>}
              </span>);
            })}
          </div>
        </li>)}
      </ul>
    </div>
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--lp-425d73)]">
      <LegendKey swatch={<span className={cn('h-2.5 w-5 rounded-[3px]', riskClasses('high').fill)} />}>Duty, coloured by its peak band</LegendKey>
      <LegendKey swatch={<span className="h-2.5 w-5 rounded-[3px] border border-dashed border-[color:var(--lp-8aa0b2)] bg-[color:var(--lp-dfe7ee)]" />}>Estimated sleep</LegendKey>
      <LegendKey swatch={<span className="h-2.5 w-5 rounded-[3px] bg-[color:var(--lp-eee8f6)]" />}>WOCL 02:00–05:59</LegendKey>
    </ul>
  </div>;
}
