/**
 * Chronogram UTC-normalisation utilities.
 *
 * The Chronogram grid uses a UTC X-axis (00Z–24Z per day-row).
 * All duties, sleep blocks and in-flight rest periods must be
 * expressed in UTC coordinates before rendering.
 *
 * `splitByUtcDay` fragments any interval that crosses a UTC midnight
 * boundary into separate per-day segments so that each segment fits
 * within a single 24-hour row.
 *
 * `utcOffsetForTimezone` computes the UTC offset (in hours) for an
 * IANA timezone on a given date — used for the dynamic circadian
 * overlay (Home Base Night, WOCL).
 */

// ── Types ────────────────────────────────────────────────────────

/** Fields appended to every fragment after splitting. */
export interface UtcFragment {
  /** Render-unique id: `${original-index}-${utcDay}` */
  renderId: string;
  /** UTC day-of-month for this fragment (1-31). */
  utcDay: number;
  /** Decimal UTC hour where fragment starts (0-24). */
  utcStartHour: number;
  /** Decimal UTC hour where fragment ends (0-24). */
  utcEndHour: number;
}

/**
 * Minimum contract for an interval that can be split.
 * Consumers pass in objects that extend this (DutyAnalysis,
 * SleepBlock, etc.).
 */
export interface HasUtcRange {
  startUtc: string; // ISO 8601 UTC
  endUtc: string;   // ISO 8601 UTC
}

// ── Helpers ──────────────────────────────────────────────────────

/** Parse an ISO 8601 string into a Date, returning null on failure. */
function safeParseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Decimal UTC hour from a Date (0 – 23.9̅). */
function decimalUtcHour(d: Date): number {
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

// ── Core: splitByUtcDay ──────────────────────────────────────────

/**
 * Fragment a list of intervals at UTC midnight boundaries.
 *
 * Each input must carry `startUtc` and `endUtc` as ISO strings.
 * The function returns a flat array where every item is the original
 * interval *plus* a {@link UtcFragment} mixin giving the UTC day,
 * start hour, and end hour for that fragment.
 *
 * A single-day interval produces one fragment.
 * An interval crossing midnight(s) produces N+1 fragments.
 *
 * @example
 *   splitByUtcDay([{ startUtc: '2026-02-01T22:00Z', endUtc: '2026-02-02T06:00Z', ...rest }])
 *   // → [
 *   //   { ...rest, renderId: '0-1', utcDay: 1, utcStartHour: 22, utcEndHour: 24 },
 *   //   { ...rest, renderId: '0-2', utcDay: 2, utcStartHour: 0,  utcEndHour: 6  },
 *   // ]
 */
export function splitByUtcDay<T extends HasUtcRange>(
  intervals: T[],
): (T & UtcFragment)[] {
  const fragments: (T & UtcFragment)[] = [];

  intervals.forEach((interval, idx) => {
    const start = safeParseDate(interval.startUtc);
    const end = safeParseDate(interval.endUtc);
    if (!start || !end || end <= start) return;

    let cursor = new Date(start);

    while (cursor < end) {
      // End of the current UTC day: midnight of the next day
      const dayEnd = new Date(Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
        0, 0, 0, 0,
      ));

      const segEnd = dayEnd < end ? dayEnd : end;

      const utcDay = cursor.getUTCDate();
      const utcStartHour = decimalUtcHour(cursor);
      // If segEnd is exactly midnight of the *next* day, represent it
      // as 24.0 so the bar extends to the right edge of the row.
      const utcEndHour = segEnd.getTime() === dayEnd.getTime()
        ? 24
        : decimalUtcHour(segEnd);

      fragments.push({
        ...interval,
        renderId: `${idx}-${utcDay}`,
        utcDay,
        utcStartHour,
        utcEndHour,
      });

      cursor = dayEnd; // advance to start of next UTC day
    }
  });

  return fragments;
}

// ── UTC offset for IANA timezone ─────────────────────────────────

/**
 * Compute the UTC offset (in hours, e.g. 3 for UTC+3, −5 for UTC−5)
 * of an IANA timezone on a given date.
 *
 * Uses the browser-native `Intl` API — no third-party library needed.
 * Handles DST transitions automatically.
 *
 * @param ianaZone  e.g. "Asia/Qatar", "Europe/London"
 * @param date      The date for which to compute the offset (DST-aware)
 * @returns         Offset in fractional hours (positive = east of UTC)
 */
export function utcOffsetForTimezone(ianaZone: string, date: Date): number {
  try {
    // Format the date in UTC and in the target timezone, then diff.
    const utcParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);

    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);

    const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
      Number(parts.find(p => p.type === type)?.value ?? 0);

    const utcTotal =
      get(utcParts, 'day') * 24 * 60 +
      get(utcParts, 'hour') * 60 +
      get(utcParts, 'minute');

    const localTotal =
      get(localParts, 'day') * 24 * 60 +
      get(localParts, 'hour') * 60 +
      get(localParts, 'minute');

    let diffMin = localTotal - utcTotal;
    // Normalise around month boundaries (e.g. day 1 vs day 31)
    if (diffMin > 12 * 60) diffMin -= 24 * 60;
    if (diffMin < -12 * 60) diffMin += 24 * 60;

    return diffMin / 60;
  } catch {
    // Unknown timezone — fall back to 0
    return 0;
  }
}
