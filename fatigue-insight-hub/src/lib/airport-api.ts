import type { AirportData } from '@/data/airportCoordinates';
import { getAirportsBatch } from '@/lib/api-client';
import { apiFetch } from '@/lib/auth-session';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

type BatchAirport = Awaited<ReturnType<typeof getAirportsBatch>>[number] & { name?: string | null; city?: string | null; country?: string | null };

const cache = new Map<string, AirportData>();
const pending = new Map<string, Promise<void>>();
const normalize = (code: string) => code.trim().toUpperCase();

async function fetchAirports(codes: string[]) {
  const fresh = codes.filter(code => !cache.has(code) && !pending.has(code));
  for (let i = 0; i < fresh.length; i += 50) {
    const batch = fresh.slice(i, i + 50);
    const job = getAirportsBatch(batch).then(results => {
      for (const raw of results as BatchAirport[]) cache.set(raw.code, {
        // Names are optional: the batch endpoint may not carry them; never invent one.
        code: raw.code, name: raw.name ?? '', city: raw.city ?? '',
        country: raw.country ?? '', lat: raw.latitude, lng: raw.longitude, timezone: raw.timezone,
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

export interface AirportName { name: string; city: string; country: string }
const names = new Map<string, AirportName | null>();
const namePending = new Map<string, Promise<void>>();

async function fetchName(code: string): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/airports/search?q=${encodeURIComponent(code)}`);
    if (!res.ok) return; // leave uncached so a later call can retry
    const body = await res.json() as { results?: Array<{ code?: string; name?: string; city?: string; country?: string }> };
    const hit = body.results?.find(r => normalize(r.code ?? '') === code);
    names.set(code, hit ? { name: hit.name ?? '', city: hit.city ?? '', country: hit.country ?? '' } : null);
  } catch {
    // Offline: codes still identify every airport.
  }
}

/**
 * Airport and city names for display (e.g. NJF → Najaf). Uses names from the
 * batch lookup when present, otherwise the exact-code search endpoint, four
 * requests at a time. Unknown or unreachable names are simply absent.
 */
export async function getAirportNamesAsync(input: string[]): Promise<Map<string, AirportName>> {
  const codes = [...new Set(input.map(normalize))];
  for (const code of codes) {
    const known = cache.get(code);
    if (!names.has(code) && known && (known.city || known.name)) names.set(code, { name: known.name, city: known.city, country: known.country });
  }
  const todo = codes.filter(code => !names.has(code) && !namePending.has(code));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const code = todo[next++];
      const job = fetchName(code).finally(() => namePending.delete(code));
      namePending.set(code, job);
      await job;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
  await Promise.all(codes.map(code => namePending.get(code)).filter(Boolean));
  return new Map(codes.flatMap(code => {
    const n = names.get(code);
    return n ? [[code, n] as [string, AirportName]] : [];
  }));
}
