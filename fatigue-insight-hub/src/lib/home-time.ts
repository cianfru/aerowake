/**
 * Home-base clock formatting: every time a pilot reads is 24-hour, in the
 * home-base zone, with the zone named. Never the device's zone or locale.
 */

function parts(iso: string, tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).formatToParts(new Date(t));
  } catch {
    return null;
  }
}

/** "00:40" in the given zone (24-hour), or '' when the instant or zone is invalid. */
export function formatHomeTime(iso: string | null | undefined, tz: string | null | undefined): string {
  if (!iso || !tz) return '';
  const p = parts(iso, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (!p) return '';
  const hh = p.find((x) => x.type === 'hour')?.value ?? '';
  const mm = p.find((x) => x.type === 'minute')?.value ?? '';
  return hh && mm ? `${hh}:${mm}` : '';
}

/** "Fri 30 Oct" in the given zone. */
export function formatHomeDate(iso: string | null | undefined, tz: string | null | undefined): string {
  if (!iso || !tz) return '';
  const p = parts(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' });
  if (!p) return '';
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`.trim();
}

/** "UTC+3" for the zone at the given instant (defaults to now). */
export function zoneOffsetLabel(tz: string | null | undefined, at?: string): string {
  if (!tz) return '';
  const p = parts(at ?? new Date().toISOString(), tz, { timeZoneName: 'shortOffset' });
  const name = p?.find((x) => x.type === 'timeZoneName')?.value ?? '';
  if (!name) return '';
  return name === 'GMT' ? 'UTC' : name.replace(/^GMT/, 'UTC');
}

/** "2026-10-16": the calendar day of an instant in the given zone. */
export function homeDayKey(iso: string | null | undefined, tz: string | null | undefined): string {
  if (!iso || !tz) return '';
  const p = parts(iso, tz, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (!p) return '';
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? '';
  const y = get('year'), m = get('month'), d = get('day');
  return y && m && d ? `${y}-${m}-${d}` : '';
}
