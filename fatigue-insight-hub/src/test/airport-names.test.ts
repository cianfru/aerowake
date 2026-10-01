import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/api-client', () => ({ getAirportsBatch: vi.fn() }));
vi.mock('@/lib/auth-session', () => ({ apiFetch: vi.fn() }));
import { getAirportsBatch } from '@/lib/api-client';
import { apiFetch } from '@/lib/auth-session';
import { getAirportNamesAsync, getMultipleAirportsAsync } from '@/lib/airport-api';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('airport names', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('never invents a name when the batch lookup has none', async () => {
    vi.mocked(getAirportsBatch).mockResolvedValueOnce([{ code: 'NJF', latitude: 31.99, longitude: 44.4, timezone: 'Asia/Baghdad', utc_offset_hours: 3 }]);
    const m = await getMultipleAirportsAsync(['NJF']);
    expect(m.get('NJF')!.name).toBe('');
    expect(m.get('NJF')!.city).toBe('');
  });

  it('uses names from the batch lookup without extra requests', async () => {
    vi.mocked(getAirportsBatch).mockResolvedValueOnce([{ code: 'TRV', latitude: 8.48, longitude: 76.92, timezone: 'Asia/Kolkata', utc_offset_hours: 5.5, name: 'Trivandrum International', city: 'Thiruvananthapuram', country: 'IN' } as never]);
    await getMultipleAirportsAsync(['TRV']);
    const names = await getAirportNamesAsync(['TRV']);
    expect(names.get('TRV')?.city).toBe('Thiruvananthapuram');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('falls back to the exact-code search, once per code', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      const q = /[?&]q=([A-Z]+)/.exec(String(url))?.[1];
      return json({ results: [{ code: `${q}X`, name: 'Prefix only' }, { code: q, name: `${q} Intl`, city: `${q} City`, country: 'QA' }] });
    });
    const first = await getAirportNamesAsync(['DOH', 'doh', 'AUH']);
    expect(first.get('DOH')).toEqual({ name: 'DOH Intl', city: 'DOH City', country: 'QA' });
    expect(first.get('AUH')?.city).toBe('AUH City');
    await getAirportNamesAsync(['DOH']);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('leaves names out when the lookup fails, and retries later', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
    expect((await getAirportNamesAsync(['BKK'])).has('BKK')).toBe(false);
    vi.mocked(apiFetch).mockResolvedValueOnce(json({ results: [{ code: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'TH' }] }));
    expect((await getAirportNamesAsync(['BKK'])).get('BKK')?.city).toBe('Bangkok');
  });
});
