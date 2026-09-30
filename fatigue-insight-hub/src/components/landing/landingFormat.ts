const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });

function atNoonUtc(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** '2026-10-07' → 'Wed 7 Oct' (calendar date as written, no timezone shift). */
export function formatDay(isoDate: string): string {
  return DAY.format(atNoonUtc(isoDate)).replace(',', '');
}

/** '2026-10-07' → 'Wednesday'. */
export function formatWeekday(isoDate: string): string {
  return WEEKDAY.format(atNoonUtc(isoDate));
}

/** ['DOH', 'MCT', 'DOH'] → 'DOH → MCT → DOH'. */
export function formatRoute(route: string[]): string {
  return route.join(' → ');
}
