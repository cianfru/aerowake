/** Calendar-day boundaries on a UTC chart, including clock changes at midnight. */
export interface CalendarAxisDay {
  date: string;
  start: number;
  end: number;
  /** No tick when a timezone change skipped the entire civil date. */
  tick: number | null;
}

export interface MonthAxis {
  days: CalendarAxisDay[];
  boundaries: number[];
  domain: [number, number];
  weekends: Array<[number, number]>;
}

const DAY_MS = 86_400_000;

/**
 * Resolve the first instant of each civil date, not a wall-clock 00:00 input.
 * Midnight can be absent or repeated. The first instant on/after the requested
 * local date handles both, and a wholly skipped date has a zero-length interval.
 * Keep every calendar-day index; weekly pagination must never shift after DST.
 */
export function buildMonthAxis(month: Date, timezone: string): MonthAxis | null {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  if (!Number.isFinite(year) || !timezone) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, calendar: 'iso8601', numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const localDate = (instant: number) => {
      const parts = formatter.formatToParts(instant);
      const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
      return Date.UTC(value('year'), value('month') - 1, value('day'));
    };
    const boundary = (date: number) => {
      // Every IANA offset/date-line change fits within this bracket.
      let before = date - 2 * DAY_MS;
      let after = date + 2 * DAY_MS;
      while (after - before > 1) {
        const middle = Math.floor((before + after) / 2);
        if (localDate(middle) < date) before = middle;
        else after = middle;
      }
      return after;
    };
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const boundaries = Array.from({ length: count + 1 }, (_, index) => boundary(Date.UTC(year, monthIndex, index + 1)));
    const days = Array.from({ length: count }, (_, index): CalendarAxisDay => ({
      date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
      start: boundaries[index],
      end: boundaries[index + 1],
      tick: boundaries[index + 1] > boundaries[index] ? (boundaries[index] + boundaries[index + 1]) / 2 : null,
    }));
    const weekends: Array<[number, number]> = [];
    days.forEach((day, index) => {
      const weekday = new Date(Date.UTC(year, monthIndex, index + 1)).getUTCDay();
      if ((weekday === 0 || weekday === 6) && day.end > day.start) weekends.push([day.start, day.end]);
    });
    return { days, boundaries, domain: [boundaries[0], boundaries[count]], weekends };
  } catch {
    return null;
  }
}
