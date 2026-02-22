/**
 * UTC-First Timezone Utility Module
 *
 * All times are stored and transmitted as ISO 8601 UTC ("Z" suffix).
 * This module converts UTC timestamps to any IANA timezone using the
 * browser-native Intl.DateTimeFormat API — no external dependencies.
 *
 * Acclimatization logic follows EASA ORO.FTL.105:
 *   - Pilot remains on home-base body-clock reference if away < 48 h
 *   - After 48 h the pilot is considered adapted to the local timezone
 */

// ---------------------------------------------------------------------------
// Core conversion types
// ---------------------------------------------------------------------------

export interface TimezoneResult {
  /** Full Date object in the target timezone (for further manipulation) */
  date: Date;
  /** Day of month (1-31) in target timezone */
  day: number;
  /** Decimal hour in target timezone (e.g. 14.5 = 14:30) */
  hour: number;
  /** "HH:mm" formatted string */
  hhMm: string;
  /** Year in target timezone */
  year: number;
  /** Month (1-12) in target timezone */
  month: number;
}

// Formatter cache — one per IANA timezone
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

// ---------------------------------------------------------------------------
// Primary conversion functions
// ---------------------------------------------------------------------------

/**
 * Convert a UTC ISO timestamp to a specific IANA timezone.
 *
 * @param isoUtc  ISO 8601 string ending in "Z" (e.g. "2025-03-15T02:00:00Z")
 * @param ianaTz  IANA timezone identifier (e.g. "Asia/Qatar")
 * @returns       Broken-down time in the target timezone
 */
export function utcToTimezone(isoUtc: string, ianaTz: string): TimezoneResult {
  const d = new Date(isoUtc);
  const fmt = getFormatter(ianaTz);
  const parts = fmt.formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hourInt = get('hour');
  const minute = get('minute');
  const hour = hourInt + minute / 60;
  const hhMm = `${String(hourInt).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { date: d, day, hour, hhMm, year, month };
}

/**
 * Convenience wrapper: convert UTC to home-base timezone.
 */
export function utcToHomeBase(isoUtc: string, homeBaseTz: string): TimezoneResult {
  return utcToTimezone(isoUtc, homeBaseTz);
}

/**
 * Extract Zulu time as "HH:mmZ" from an ISO UTC timestamp.
 */
export function utcToZulu(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

/**
 * Get the UTC day-of-month (1-31) and decimal hour for grid positioning.
 * Deterministic — no heuristics needed for midnight crossing.
 */
export function utcDayHour(isoUtc: string): { day: number; hour: number } {
  const d = new Date(isoUtc);
  return {
    day: d.getUTCDate(),
    hour: d.getUTCHours() + d.getUTCMinutes() / 60,
  };
}

// ---------------------------------------------------------------------------
// Acclimatization (EASA ORO.FTL.105)
// ---------------------------------------------------------------------------

export type AcclimatizationState = 'acclimatized' | 'unknown' | 'departed';

export interface AcclimatizationContext {
  /** How long the pilot has been away from home base (hours) */
  hoursAwayFromBase: number;
  /** Backend-provided acclimatization state, if available */
  backendState?: AcclimatizationState;
  /** IANA timezone of current location */
  locationTimezone: string;
  /** IANA timezone of home base */
  homeBaseTimezone: string;
}

/**
 * Determine the "body-clock reference" timezone for a pilot.
 *
 * EASA ORO.FTL.105 rule:
 *   - If the pilot has been away from home base for < 48 hours,
 *     they are still acclimatized to home base TZ.
 *   - After 48 h (or if backend explicitly says "acclimatized"),
 *     use the location timezone.
 *
 * @returns IANA timezone string representing the pilot's body-clock reference
 */
export function getAcclimatizedTimezone(ctx: AcclimatizationContext): string {
  // If backend explicitly says acclimatized to destination
  if (ctx.backendState === 'acclimatized' && ctx.hoursAwayFromBase >= 48) {
    return ctx.locationTimezone;
  }

  // EASA < 48 h rule: pilot remains on home base reference
  if (ctx.hoursAwayFromBase < 48) {
    return ctx.homeBaseTimezone;
  }

  // > 48 h and not explicitly marked: assume adapted to location
  return ctx.locationTimezone;
}

/**
 * Check whether "Local" label should show home-base reference
 * (for tooltip display purposes).
 */
export function isOnHomeBaseReference(ctx: AcclimatizationContext): boolean {
  return getAcclimatizedTimezone(ctx) === ctx.homeBaseTimezone;
}

// ---------------------------------------------------------------------------
// Triple-format tooltip helpers
// ---------------------------------------------------------------------------

export interface TripleTimeFormat {
  /** "HH:mmZ - HH:mmZ" */
  zulu: string;
  /** "HH:mm DEP - HH:mm ARR" (acclimatization-aware) */
  local: string;
  /** "HH:mm BASE - HH:mm BASE" */
  home: string;
  /** Whether the "local" line uses home-base reference (< 48 h) */
  localIsHomeRef: boolean;
}

/**
 * Build the three time-format strings for a flight segment tooltip.
 *
 * @param departureUtc   ISO UTC departure
 * @param arrivalUtc     ISO UTC arrival
 * @param depTz          IANA timezone of departure airport
 * @param arrTz          IANA timezone of arrival airport
 * @param homeBaseTz     IANA timezone of pilot's home base
 * @param depCode        Airport IATA code for departure (e.g. "DOH")
 * @param arrCode        Airport IATA code for arrival (e.g. "DEL")
 * @param acclimCtx      Optional acclimatization context
 */
export function buildTripleTime(
  departureUtc: string,
  arrivalUtc: string,
  depTz: string,
  arrTz: string,
  homeBaseTz: string,
  depCode: string,
  arrCode: string,
  acclimCtx?: Partial<AcclimatizationContext>,
): TripleTimeFormat {
  // Zulu
  const zulu = `${utcToZulu(departureUtc)} – ${utcToZulu(arrivalUtc)}`;

  // Home base
  const depHome = utcToHomeBase(departureUtc, homeBaseTz);
  const arrHome = utcToHomeBase(arrivalUtc, homeBaseTz);
  const homeAbbr = homeBaseTz.split('/').pop()?.replace(/_/g, ' ') || homeBaseTz;
  const home = `${depHome.hhMm} – ${arrHome.hhMm} ${homeAbbr}`;

  // Local (acclimatization-aware)
  const ctx: AcclimatizationContext = {
    hoursAwayFromBase: acclimCtx?.hoursAwayFromBase ?? 0,
    backendState: acclimCtx?.backendState,
    locationTimezone: arrTz,
    homeBaseTimezone: homeBaseTz,
  };
  const localIsHomeRef = isOnHomeBaseReference(ctx);

  let local: string;
  if (localIsHomeRef) {
    // < 48 h: show home base times with note
    local = `${depHome.hhMm} – ${arrHome.hhMm} (home ref)`;
  } else {
    // Acclimatized: show airport-local times
    const depLocal = utcToTimezone(departureUtc, depTz);
    const arrLocal = utcToTimezone(arrivalUtc, arrTz);
    local = `${depLocal.hhMm} ${depCode} – ${arrLocal.hhMm} ${arrCode}`;
  }

  return { zulu, local, home, localIsHomeRef };
}

// ---------------------------------------------------------------------------
// Sleep window triple-format
// ---------------------------------------------------------------------------

export interface SleepTripleTime {
  zulu: string;
  local: string;
  home: string;
  localIsHomeRef: boolean;
}

/**
 * Build triple-format for a sleep window.
 */
export function buildSleepTripleTime(
  sleepStartUtc: string,
  sleepEndUtc: string,
  locationTz: string,
  homeBaseTz: string,
  acclimCtx?: Partial<AcclimatizationContext>,
): SleepTripleTime {
  const zulu = `${utcToZulu(sleepStartUtc)} – ${utcToZulu(sleepEndUtc)}`;

  const startHome = utcToHomeBase(sleepStartUtc, homeBaseTz);
  const endHome = utcToHomeBase(sleepEndUtc, homeBaseTz);
  const homeAbbr = homeBaseTz.split('/').pop()?.replace(/_/g, ' ') || homeBaseTz;
  const home = `${startHome.hhMm} – ${endHome.hhMm} ${homeAbbr}`;

  const ctx: AcclimatizationContext = {
    hoursAwayFromBase: acclimCtx?.hoursAwayFromBase ?? 0,
    backendState: acclimCtx?.backendState,
    locationTimezone: locationTz,
    homeBaseTimezone: homeBaseTz,
  };
  const localIsHomeRef = isOnHomeBaseReference(ctx);

  let local: string;
  if (localIsHomeRef) {
    local = `${startHome.hhMm} – ${endHome.hhMm} (home ref)`;
  } else {
    const startLocal = utcToTimezone(sleepStartUtc, locationTz);
    const endLocal = utcToTimezone(sleepEndUtc, locationTz);
    const locAbbr = locationTz.split('/').pop()?.replace(/_/g, ' ') || locationTz;
    local = `${startLocal.hhMm} – ${endLocal.hhMm} ${locAbbr}`;
  }

  return { zulu, local, home, localIsHomeRef };
}
