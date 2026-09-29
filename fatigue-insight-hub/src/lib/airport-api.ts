import type { AirportData } from '@/data/airportCoordinates';
import { getAirportsBatch } from '@/lib/api-client';

const cache = new Map<string, AirportData>();
const pending = new Map<string, Promise<void>>();
const normalize = (code: string) => code.trim().toUpperCase();

async function fetchAirports(codes: string[]) {
  const fresh = codes.filter(code => !cache.has(code) && !pending.has(code));
  for (let i = 0; i < fresh.length; i += 50) {
    const batch = fresh.slice(i, i + 50);
    const job = getAirportsBatch(batch).then(results => {
      for (const raw of results) cache.set(raw.code, {
        code: raw.code, name: `${raw.code} Airport`, city: raw.code,
        country: '', lat: raw.latitude, lng: raw.longitude, timezone: raw.timezone,
      });
    }).finally(() => { for (const code of batch) pending.delete(code); });
    for (const code of batch) pending.set(code, job);
  }
  // Every caller waits for the shared request, including callers arriving while it is in flight.
  await Promise.all([...new Set(codes.map(code => pending.get(code)).filter(Boolean))]);
}

export async function getMultipleAirportsAsync(input: string[]): Promise<Map<string, AirportData>> {
  const codes = [...new Set(input.map(normalize))];
  await fetchAirports(codes);
  return new Map(codes.flatMap(code => cache.has(code) ? [[code, cache.get(code)!]] : []));
}
export async function getAirportCoordinatesAsync(code: string): Promise<AirportData | null> {
  return (await getMultipleAirportsAsync([code])).get(normalize(code)) ?? null;
}
export const getAirportFromCache = (code: string) => cache.get(normalize(code)) ?? null;
export const isAirportKnown = (code: string) => cache.has(normalize(code));
export const getCachedAirports = () => [...cache.values()];
