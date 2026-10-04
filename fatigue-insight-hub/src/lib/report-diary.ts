import { localInputToUtcIso, utcIsoToLocalInput, type ReportDuty, type ReportSleep } from './fatigue-report-api';

const HOUR = 3600000;
export const diaryDate = (iso: string, tz: string) => utcIsoToLocalInput(iso, tz).slice(0, 10);
export function shiftDay(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
}
export function formatHours(hours: number): string {
  const minutes = Math.round(Math.max(0, hours) * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
export function overlaps(start: string, end: string, from: string, to: string): boolean {
  return Date.parse(start) < Date.parse(to) && Date.parse(end) > Date.parse(from);
}
/** Union of elapsed intervals: overlaps never inflate sleep or duty totals. */
export function recordedHours(intervals: { start: string; end: string }[], from: string, to: string): number {
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return 0;
  const spans = intervals.map(i => [Math.max(a, Date.parse(i.start)), Math.min(b, Date.parse(i.end))])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s).sort((x, y) => x[0] - y[0]);
  let total = 0, lastEnd = a;
  for (const [start, end] of spans) { total += Math.max(0, end - Math.max(start, lastEnd)); lastEnd = Math.max(lastEnd, end); }
  return total / HOUR;
}

export interface DiaryDay {
  date: string; start: string; end: string; label: string; event: boolean;
  duties: ReportDuty[]; sleeps: ReportSleep[]; dutyHours: number; plannedHours: number;
  reportedSleep: number; estimatedSleep: number;
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
/** "Mon, 7 Sept" for a YYYY-MM-DD day, spelled out so it reads the same in every browser and ICU version. */
function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** Calendar boundaries use the chosen zone, so DST days can contain 23 or 25 hours. */
export function buildDiaryDays(from: string, to: string, event: string, tz: string, duties: ReportDuty[], sleeps: ReportSleep[]): DiaryDay[] {
  if (![from, to, event].every(s => Number.isFinite(Date.parse(s))) || Date.parse(to) <= Date.parse(from)) return [];
  const startDay = diaryDate(from, tz), lastDay = diaryDate(to, tz);
  const out: DiaryDay[] = [];
  for (let day = startDay; day <= lastDay && out.length < 33; day = shiftDay(day, 1)) {
    const start = localInputToUtcIso(`${day}T00:00`, tz), end = localInputToUtcIso(`${shiftDay(day, 1)}T00:00`, tz);
    // Rare midnight transitions cannot be represented by this input; UTC remains available.
    if (!start || !end) continue;
    const ds = duties.filter(d => overlaps(d.report_utc, d.release_utc, start, end));
    const ss = sleeps.filter(s => overlaps(s.start_utc, s.end_utc, start, end));
    const dutyHours = (status: string) => recordedHours(ds.filter(d => d.status === status).map(d => ({ start: d.report_utc, end: d.release_utc })), start, end);
    const sleepHours = (source: string) => recordedHours(ss.filter(s => s.source === source).map(s => ({ start: s.start_utc, end: s.end_utc })), start, end);
    out.push({ date: day, start, end, label: dayLabel(day),
      event: diaryDate(event, tz) === day, duties: ds, sleeps: ss, dutyHours: dutyHours('operated'), plannedHours: dutyHours('planned'), reportedSleep: sleepHours('reported'), estimatedSleep: sleepHours('estimated') });
  }
  return out;
}

export function priorSleepHours(sleeps: ReportSleep[], event: string, hours: number): number {
  return recordedHours(sleeps.filter(s => s.source === 'reported').map(s => ({ start: s.start_utc, end: s.end_utc })), new Date(Date.parse(event) - hours * HOUR).toISOString(), event);
}
