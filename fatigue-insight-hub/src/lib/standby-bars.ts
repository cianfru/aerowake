/**
 * Standby periods → chronogram bars (home-base view).
 *
 * Standby is not a scored duty; it is drawn as a muted hatched bar so the
 * pilot sees when they were on call. Periods crossing midnight are split.
 */
import { getDaysInMonth, getMonth, getYear } from 'date-fns';
import type { StandbyPeriod } from '@/types/fatigue';
import type { TimelineStandbyBar } from '@/lib/timeline-types';

function hhmmToHours(v: string | undefined): number | undefined {
  const m = /^(\d{1,2}):(\d{2})/.exec(v ?? '');
  if (!m) return undefined;
  return Number(m[1]) + Number(m[2]) / 60;
}

export function standbyBarsForMonth(
  periods: StandbyPeriod[] | undefined,
  month: Date,
): TimelineStandbyBar[] {
  if (!periods?.length) return [];
  const dim = getDaysInMonth(month);
  const y = getYear(month);
  const mo = getMonth(month) + 1;
  const bars: TimelineStandbyBar[] = [];

  for (const p of periods) {
    const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.date ?? '');
    if (!dm || Number(dm[1]) !== y || Number(dm[2]) !== mo) continue;
    const day = Number(dm[3]);
    const start = hhmmToHours(p.startHome);
    let end = hhmmToHours(p.endHome);
    if (start === undefined || end === undefined) continue;
    if (end === 0) end = 24;

    if (end > start) {
      bars.push({ rowIndex: day, startHour: start, endHour: end, period: p });
    } else {
      // Crosses midnight (home base)
      bars.push({ rowIndex: day, startHour: start, endHour: 24, period: p });
      if (day + 1 <= dim && end > 0) {
        bars.push({ rowIndex: day + 1, startHour: 0, endHour: end, period: p });
      }
    }
  }
  return bars;
}
