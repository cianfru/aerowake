/**
 * Time formatting for the fatigue report: home-base local time with its UTC
 * offset, and the matching Z time. 24-hour clock, British date order.
 */
import { tzOffsetMinutes, utcIsoToLocalInput } from './fatigue-report-api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function valid(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'UTC+3', 'UTC+5:30', 'UTC-1', 'UTC' for the zone at that instant. */
export function formatUtcOffset(tz: string, iso?: string | null): string {
  if (!tz || tz === 'UTC') return 'UTC';
  const minutes = tzOffsetMinutes(valid(iso) ?? new Date(), tz);
  if (!minutes) return 'UTC+0';
  const sign = minutes > 0 ? '+' : '-';
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** 'DOH local, UTC+3' (or 'Asia/Qatar, UTC+3' without a base code). */
export function zoneLabel(base: string | null | undefined, tz: string, iso?: string | null): string {
  if (!tz) return 'time zone not set';
  if (tz === 'UTC') return 'UTC (Z)';
  return `${base ? `${base.toUpperCase()} local` : tz}, ${formatUtcOffset(tz, iso)}`;
}

function parts(iso: string, tz: string) {
  const wall = utcIsoToLocalInput(iso, tz || 'UTC');
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return null;
  const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return { y: m[1], mon: MONTHS[+m[2] - 1], d: m[3], wd: WEEKDAYS[day.getUTCDay()], hm: `${m[4]}:${m[5]}` };
}

/** 'Tue 29 Sep 2026 04:00' (year optional) in the given zone. */
export function formatLocal(iso: string | null | undefined, tz: string, opts: { year?: boolean; weekday?: boolean } = {}): string {
  const p = iso ? parts(iso, tz) : null;
  if (!p) return '—';
  const { year = true, weekday = true } = opts;
  return `${weekday ? `${p.wd} ` : ''}${p.d} ${p.mon}${year ? ` ${p.y}` : ''} ${p.hm}`;
}

/** 'HH:MM' local. */
export function formatClock(iso: string | null | undefined, tz: string): string {
  const p = iso ? parts(iso, tz) : null;
  return p ? p.hm : '—';
}

/** '29 Sep 01:00Z'. */
export function formatZ(iso: string | null | undefined, opts: { year?: boolean } = {}): string {
  const p = iso ? parts(iso, 'UTC') : null;
  if (!p) return '—';
  return `${p.d} ${p.mon}${opts.year ? ` ${p.y}` : ''} ${p.hm}Z`;
}

/** Operator-ready instant: 'Tue 29 Sep 2026 04:00 DOH (UTC+3) / 01:00Z'. */
export function formatInstant(iso: string | null | undefined, tz: string, base?: string | null): string {
  if (!valid(iso)) return '—';
  const local = formatLocal(iso, tz);
  const zone = `${base ? `${base.toUpperCase()} ` : ''}(${formatUtcOffset(tz, iso)})`;
  const zSameDay = parts(iso!, tz)?.d === parts(iso!, 'UTC')?.d;
  return `${local} ${zone} / ${zSameDay ? formatClock(iso, 'UTC') + 'Z' : formatZ(iso)}`;
}

const HHMM = /^([01]?\d|2[0-3]):?([0-5]\d)$/;

/** Normalise '0430', '4:30' or '04:30' to '04:30'; null when not a 24-hour time. */
export function normaliseClock(text: string): string | null {
  const m = HHMM.exec(text.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Hours as '7h05'. */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  const minutes = Math.round(Math.max(0, hours) * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/** Hour of day (0–24, fractional) of an instant in the zone. */
export function localHour(iso: string, tz: string): number {
  const d = valid(iso);
  if (!d) return NaN;
  const shifted = new Date(d.getTime() + tzOffsetMinutes(d, tz || 'UTC') * 60000);
  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60 + shifted.getUTCSeconds() / 3600;
}

/**
 * True when typed clock text can only mean one time: 'HH:MM', 'H:MM' or four
 * digits. '043' could still become '0430', so it waits for blur.
 */
export function isCompleteClock(text: string): boolean {
  const t = text.trim();
  return /^\d{1,2}:\d{2}$/.test(t) || /^\d{4}$/.test(t);
}
