import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewRoster } from '@/lib/api-client';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

describe('roster preview failures', () => {
  it.each([
    [404, '{"detail":"Not Found"}'],
    [404, '<html>Not Found</html>'],
    [502, '<html>Bad Gateway</html>'],
    [503, '{"detail":"Unavailable"}'],
  ])('explains service failure %s without blaming the roster', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
    await expect(previewRoster(new File(['roster'], 'roster.csv'), 'DOH'))
      .rejects.toThrow('Roster import is temporarily unavailable. Please try again shortly.');
  });

  it('preserves a useful parser validation message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"detail":"No duty dates found in this file."}', { status: 400 })));
    await expect(previewRoster(new File(['roster'], 'roster.csv'), 'DOH'))
      .rejects.toThrow('No duty dates found in this file.');
  });
});
