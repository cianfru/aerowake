/** Hours as h:mm (12.25 -> '12:15'). */
export function hhmm(hours: number): string {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
