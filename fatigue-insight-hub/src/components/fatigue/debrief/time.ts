/** Home-zone display with UTC alongside; the zone comes from the analysed roster. */
export function formatInZone(iso: string | null | undefined, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(date);
  }
}

export const hhmm = (iso: string | null | undefined, timeZone: string) =>
  formatInZone(iso, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "15:15 DOH time (12:15Z)" or "12:15Z" when the zone is UTC. */
export function localWithUtc(iso: string, timeZone: string, zoneLabel: string): string {
  const utc = `${hhmm(iso, 'UTC')}Z`;
  return timeZone === 'UTC' ? utc : `${hhmm(iso, timeZone)} ${zoneLabel} (${utc})`;
}

export function dutyDateLabel(iso: string | null | undefined, timeZone: string): string {
  return formatInZone(iso, timeZone, { weekday: 'short', day: 'numeric', month: 'short' });
}
