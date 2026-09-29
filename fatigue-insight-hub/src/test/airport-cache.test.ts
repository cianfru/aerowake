import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/api-client',()=>({getAirportsBatch:vi.fn()}));
import { getAirportsBatch } from '@/lib/api-client';
import { getMultipleAirportsAsync } from '@/lib/airport-api';

describe('airport resolution',()=>{
  it('shares in-flight lookups without returning incomplete maps',async()=>{
    let finish!: (v:Awaited<ReturnType<typeof getAirportsBatch>>)=>void;
    vi.mocked(getAirportsBatch).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const first=getMultipleAirportsAsync(['doh']);
    const second=getMultipleAirportsAsync(['DOH']);
    finish([{code:'DOH',latitude:25.27,longitude:51.61,timezone:'Asia/Qatar',utc_offset_hours:3}]);
    expect((await first).has('DOH')).toBe(true);
    expect((await second).has('DOH')).toBe(true);
    expect(getAirportsBatch).toHaveBeenCalledTimes(1);
  });
  it('allows retry after a failed lookup',async()=>{
    vi.mocked(getAirportsBatch).mockRejectedValueOnce(new Error('offline'));
    await expect(getMultipleAirportsAsync(['LHR'])).rejects.toThrow('offline');
    vi.mocked(getAirportsBatch).mockResolvedValueOnce([{code:'LHR',latitude:51.47,longitude:-.45,timezone:'Europe/London',utc_offset_hours:1}]);
    expect((await getMultipleAirportsAsync(['LHR'])).has('LHR')).toBe(true);
  });
});
