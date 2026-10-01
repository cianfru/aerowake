import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeRoster, previewRoster, RosterRequestError } from '@/lib/api-client';
import {
  checkRosterFile, dutyTimes, hhmm, monthInWords, needsConfirmation, offsetsLabel, TEMPLATE_CSV, TEMPLATE_HREF, utcLabel,
} from '@/components/fatigue/roster/upload/import-format';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const file = () => new File(['roster'], 'roster.csv');
const sentForm = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls[0][1].body as FormData;

describe('roster import requests', () => {
  it('lets the backend detect the base unless one is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"month":"2026-10"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await previewRoster(file());
    expect(sentForm(fetchMock).has('home_base')).toBe(false);
    expect(sentForm(fetchMock).has('home_base_override')).toBe(false);

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response('{"month":"2026-10"}', { status: 200 }));
    await previewRoster(file(), 'LGW', { override: true });
    expect(sentForm(fetchMock).get('home_base')).toBe('LGW');
    expect(sentForm(fetchMock).get('home_base_override')).toBe('true');
  });

  it('keeps the backend code for a missing base', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      '{"detail":"This roster does not state a home base.","code":"home_base_required"}', { status: 422 })));
    const error = await previewRoster(file()).catch(e => e);
    expect(error).toBeInstanceOf(RosterRequestError);
    expect(error.code).toBe('home_base_required');
    expect(error.message).toBe('This roster does not state a home base.');
  });

  it.each([
    [502, '<html>Bad gateway</html>', 'Analysis is temporarily unavailable. Please try again shortly.'],
    [404, '{"detail":"Not Found"}', 'Analysis is temporarily unavailable. Please try again shortly.'],
    [422, '{"detail":[{"loc":["body","file"],"msg":"Field required"}]}', 'The roster could not be analysed.'],
    [400, '<html>oops</html>', 'The roster service returned an unreadable response. Please try again.'],
  ])('explains an analysis failure %s without raw JSON errors', async (status, body, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
    const error = await analyzeRoster(file(), 'P1', 'DOH').catch(e => e);
    expect(error.message).toContain(message);
    expect(error.message).not.toMatch(/Unexpected token|object Object/);
  });

  it('sends an override only with a base', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await analyzeRoster(file(), 'P1', null, undefined, { override: true });
    expect(sentForm(fetchMock).has('home_base')).toBe(false);
    expect(sentForm(fetchMock).has('home_base_override')).toBe(false);
  });

  it('explains a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(previewRoster(file())).rejects.toThrow("Can't reach Aerowake. Check your connection and try again.");
  });
});

describe('import summary formatting', () => {
  it('uses pilot-readable units', () => {
    expect(hhmm(37.25)).toBe('37:15');
    expect(hhmm(69.25)).toBe('69:15');
    expect(hhmm(0.5)).toBe('0:30');
    expect(monthInWords('2026-10')).toBe('October 2026');
    expect(utcLabel('+03:00')).toBe('UTC+3');
    expect(utcLabel('+05:30')).toBe('UTC+5:30');
    expect(utcLabel('-04:00')).toBe('UTC-4');
    expect(offsetsLabel(['+01:00', '+00:00'])).toBe('UTC+1, then UTC+0 (clock change)');
  });

  it('offers a complete synthetic CSV template', () => {
    const [header, ...rows] = TEMPLATE_CSV.trim().split('\n');
    expect(header).toBe('Date,Flight,Departure,Arrival,STD,STA,Report,Release');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every(r => r.split(',').length === 8)).toBe(true);
    expect(decodeURIComponent(TEMPLATE_HREF.split(',').slice(1).join(','))).toBe(TEMPLATE_CSV);
  });

  it('checks files before upload', () => {
    expect(checkRosterFile({ name: 'October.PDF', size: 2000 })).toEqual({ kind: 'PDF' });
    expect(checkRosterFile({ name: 'roster.csv', size: 10 })).toEqual({ kind: 'CSV' });
    expect(checkRosterFile({ name: 'roster.xlsx', size: 10 })).toHaveProperty('error');
    expect(checkRosterFile({ name: 'roster.pdf', size: 0 })).toHaveProperty('error');
    expect(checkRosterFile({ name: 'roster.pdf', size: 10 * 1024 * 1024 + 1 })).toHaveProperty('error');
  });

  it('shows duty times in a chosen zone with the day change', () => {
    const duty = { report_utc: '2026-10-05T14:15:00+00:00', release_utc: '2026-10-05T21:45:00+00:00' };
    expect(dutyTimes(duty, 'Asia/Qatar')).toEqual({ day: 'Mon 5 Oct', report: '17:15', release: '00:45', dayOffset: '+1' });
    expect(dutyTimes(duty, 'UTC')).toEqual({ day: 'Mon 5 Oct', report: '14:15', release: '21:45', dayOffset: '' });
  });

  it('falls back to flags when an older backend omits needs_confirmation', () => {
    const base = { base_conflict: false, base_source: 'roster_header', block_total_matches_source: true } as const;
    expect(needsConfirmation(base as never)).toBe(false);
    expect(needsConfirmation({ ...base, block_total_matches_source: false } as never)).toBe(true);
    expect(needsConfirmation({ ...base, base_source: 'duty_pattern' } as never)).toBe(true);
  });
});
