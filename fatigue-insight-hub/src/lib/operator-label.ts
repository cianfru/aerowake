/** Keep product presentation neutral without renaming a pilot’s stored company. */
export function operatorLabel(name?: string | null, icao?: string | null): string {
  if (icao?.toUpperCase() === 'QTR' || /^qatar(?:\s+airways)?$/i.test(name?.trim() ?? '')) return 'Operator QTR';
  return name?.trim() ?? '';
}
