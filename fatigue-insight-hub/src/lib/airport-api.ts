// Airport API client — fetches all airport data from the backend
// No static data; the backend's 7,800+ airport repository is the single source of truth.

import { AirportData } from '@/data/airportCoordinates';
import { getAirportsBatch } from '@/lib/api-client';

// In-memory cache for fetched airport data
const airportCache = new Map<string, AirportData>();
// Track codes we already attempted (including misses) to avoid repeated lookups
const attemptedCodes = new Set<string>();

/**
 * Map backend response to our AirportData interface
 */
function mapBackendAirport(raw: {
  code: string;
  timezone: string;
  utc_offset_hours: number | null;
  latitude: number;
  longitude: number;
  name?: string;
  city?: string;
  country?: string;
}): AirportData {
  return {
    code: raw.code,
    name: raw.name || `${raw.code} Airport`,
    city: raw.city || raw.code,
    country: raw.country || 'Unknown',
    lat: raw.latitude,
    lng: raw.longitude,
    timezone: raw.timezone,
  };
}

/**
 * Fetch airports from the backend batch endpoint, updating the cache.
 * Only fetches codes not already cached or attempted.
 */
async function fetchAndCache(codes: string[]): Promise<void> {
  const toFetch = codes.filter(c => !attemptedCodes.has(c));
  if (toFetch.length === 0) return;

  // Mark as attempted immediately to prevent parallel duplicate fetches
  toFetch.forEach(c => attemptedCodes.add(c));

  try {
    const results = await getAirportsBatch(toFetch);
    for (const raw of results) {
      const airport = mapBackendAirport(raw);
      airportCache.set(airport.code, airport);
    }

    const found = new Set(results.map(r => r.code));
    const missing = toFetch.filter(c => !found.has(c));
    if (missing.length > 0) {
      console.warn('[AirportAPI] Backend has no data for:', missing);
    }
  } catch (error) {
    // Un-mark so a retry is possible later
    toFetch.forEach(c => attemptedCodes.delete(c));
    console.error('[AirportAPI] Backend fetch failed:', error);
  }
}

/**
 * Get a single airport's data (async, backend-backed).
 */
export async function getAirportCoordinatesAsync(code: string): Promise<AirportData | null> {
  if (airportCache.has(code)) return airportCache.get(code)!;

  await fetchAndCache([code]);
  return airportCache.get(code) || null;
}

/**
 * Batch fetch multiple airports at once (preferred for performance).
 */
export async function getMultipleAirportsAsync(codes: string[]): Promise<Map<string, AirportData>> {
  // Determine which codes are missing from cache
  const missing = codes.filter(c => !airportCache.has(c));
  if (missing.length > 0) {
    await fetchAndCache(missing);
  }

  const results = new Map<string, AirportData>();
  for (const code of codes) {
    const data = airportCache.get(code);
    if (data) results.set(code, data);
  }
  return results;
}

/**
 * Synchronous cache-only lookup (returns null if not yet fetched).
 * Use after an async fetch to read from cache.
 */
export function getAirportFromCache(code: string): AirportData | null {
  return airportCache.get(code) || null;
}

/**
 * Check if an airport is in the cache
 */
export function isAirportKnown(code: string): boolean {
  return airportCache.has(code);
}

/**
 * Get all cached airports
 */
export function getCachedAirports(): AirportData[] {
  return Array.from(airportCache.values());
}
