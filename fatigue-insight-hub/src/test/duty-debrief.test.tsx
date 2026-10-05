import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DutyDebriefAction } from '@/components/fatigue/debrief/DutyDebriefAction';
import { DebriefQueue } from '@/components/fatigue/debrief/DebriefQueue';
import { debriefQueue, dutyKey, isFlagged, isFlown, personalSummary, type Debrief } from '@/lib/debrief-api';
import type { DutyAnalysis } from '@/types/fatigue';

const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { id: 'u1' } as { id: string } | null } }));
const analysis = vi.hoisted(() => ({ results: null as unknown }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('@/contexts/AnalysisContext', () => ({ useAnalysis: () => ({ state: { settings: {}, analysisResults: analysis.results } }) }));
vi.mock('@/components/auth/AuthSheet', () => ({ AuthSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog">Auth sheet</div> : null) }));

const NOW = Date.parse('2026-09-30T12:00:00Z');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ENROLLED = { enrolled: true, enrolled_at: '2026-09-01T00:00:00Z', withdrawn_at: null, consent_version: 'duty-debrief-v1', debriefs: 0, observations: 0, last_activity_at: null };

function duty(id: string, report: string, release: string, maxKss?: number): DutyAnalysis {
  return {
    dutyId: id, reportTimeUtc: report, releaseTimeUtc: release, maxKss,
    flightSegments: [{ flightNumber: 'SYN1', departure: 'AAA', arrival: 'BBB', departureTime: '', arrivalTime: '', blockHours: 2, performance: 60 },
      { flightNumber: 'SYN2', departure: 'BBB', arrival: 'AAA', departureTime: '', arrivalTime: '', blockHours: 2, performance: 60 }],
    sleepEstimate: { sleepBlocks: [
      { sleepStartUtc: '2026-09-28T23:15:00+00:00', sleepEndUtc: '2026-09-29T06:45:00+00:00', sleepType: 'main' },
    ] },
  } as unknown as DutyAnalysis;
}

const FLOWN = duty('D20260929', '2026-09-29T14:15:00+00:00', '2026-09-29T21:45:00+00:00', 6.62);
const FUTURE = duty('D20261002', '2026-10-02T14:15:00+00:00', '2026-10-02T21:45:00+00:00', 7.1);

function saved(overrides: Partial<Debrief> = {}): Debrief {
  return {
    id: 'deb1', analysis_id: 'a1', roster_id: 'r1', duty_id: 'D20260929', duty_report_utc: '2026-09-29T14:15:00+00:00',
    duty_release_utc: '2026-09-29T21:45:00+00:00', moment: 'worst_moment', operation: 'as_rostered', kss: 7, samn_perelli: null,
    felt_vs_prediction: null, rated_at_utc: '2026-09-30T12:00:00Z', prediction_seen: false, created_at: '2026-09-30T12:00:01Z',
    forecast: { engine_version: 'aerowake-4.0-kss', max_kss: 6.62, landing_kss: 6.32, kss_at_event: null, event_time_utc: null, risk_level: 'high', flagged: true, home_timezone: 'Asia/Qatar' },
    published_tpm: null, sleeps: [], countermeasures: [], note: null, duty: { date: '2026-09-29', route: ['AAA', 'BBB', 'AAA'], sectors: 2 },
    quality: { recall_delay_hours: 14, stream: 'recalled', exclusions: [] }, ...overrides,
  };
}

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('aerowake-token', 'token');
  auth.value = { isAuthenticated: true, user: { id: 'u1' } };
  analysis.results = { analysisId: 'a1', homeBaseTimezone: 'Asia/Qatar', pilotBase: 'DOH', duties: [FLOWN, FUTURE] };
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('debrief helpers', () => {
  it('treats a duty as flown only once its planned release has passed', () => {
    expect(isFlown(FLOWN, NOW)).toBe(true);
    expect(isFlown(FUTURE, NOW)).toBe(false);
    expect(isFlown({ releaseTimeUtc: '21:45' }, NOW)).toBe(false);
  });

  it('flags on the peak rounded to one decimal, like the displayed number', () => {
    expect(isFlagged({ maxKss: 6.45 })).toBe(true);
    expect(isFlagged({ maxKss: 6.44 })).toBe(false);
    expect(isFlagged({ maxKss: undefined })).toBe(false);
  });

  it('queues flown, not yet debriefed duties with flagged ones first', () => {
    const calm = duty('D20260927', '2026-09-27T04:00:00Z', '2026-09-27T12:00:00Z', 4.2);
    const old = duty('D20260801', '2026-08-01T04:00:00Z', '2026-08-01T12:00:00Z', 7.9);
    const late = duty('D20260928', '2026-09-28T04:00:00Z', '2026-09-28T12:00:00Z', 5.0);
    expect(debriefQueue([calm, FUTURE, old, FLOWN, late], [], NOW).map((d) => d.dutyId)).toEqual(['D20260929', 'D20260928', 'D20260927']);
    expect(debriefQueue([FLOWN], [saved()], NOW)).toEqual([]);
    // Forecast-blind: a newer calm duty comes before an older flagged one.
    const flaggedOlder = duty('D20260926', '2026-09-26T04:00:00Z', '2026-09-26T12:00:00Z', 7.4);
    expect(debriefQueue([flaggedOlder, late], [], NOW).map((d) => d.dutyId)).toEqual(['D20260928', 'D20260926']);
    expect(dutyKey('D1', '2026-09-29T14:15:00Z')).toBe(dutyKey('D1', '2026-09-29T14:15:00+00:00'));
  });

  it('summarises personal differences only after five debriefs', () => {
    expect(personalSummary([saved()])).toBeNull();
    const five = [1, 2, 3, 4, 5].map((i) => saved({ id: `d${i}`, kss: 8 }));
    expect(personalSummary(five)?.meanDifference).toBeCloseTo(1.38);
  });
});

describe('DutyDebriefAction', () => {
  it('shows Debrief on a flown duty and nothing on a future one', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ debriefs: [] }))));
    const { container } = render(wrap(<><DutyDebriefAction duty={FLOWN} analysisId="a1" now={NOW} /><DutyDebriefAction duty={FUTURE} analysisId="a1" now={NOW} /></>));
    expect(await screen.findAllByRole('button', { name: /debrief this flown duty/i })).toHaveLength(1);
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('asks guests to sign in and explains the fresh workspace', async () => {
    auth.value = { isAuthenticated: false, user: null };
    vi.stubGlobal('fetch', vi.fn());
    render(wrap(<DutyDebriefAction duty={FLOWN} analysisId="a1" now={NOW} />));
    fireEvent.click(screen.getByRole('button', { name: /debrief this flown duty/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Upload this roster again once you are signed in/);
    fireEvent.click(within(dialog).getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Auth sheet')).toBeInTheDocument();
  });

  it('keeps the forecast hidden until the rating is saved and never sends unconfirmed estimated sleep', async () => {
    let resolvePost!: (r: Response) => void;
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/study/enrolment')) return Promise.resolve(json(ENROLLED));
      if (url.endsWith('/api/debriefs') && init?.method === 'POST') return new Promise<Response>((r) => { resolvePost = r; });
      return Promise.resolve(json({ debriefs: [] }));
    });
    vi.stubGlobal('fetch', fetch);
    render(wrap(<DutyDebriefAction duty={FLOWN} analysisId="a1" now={NOW} />));
    fireEvent.click(await screen.findByRole('button', { name: /debrief this flown duty/i }));
    expect(await screen.findByText(/The forecast stays hidden until you save/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'As rostered' }));
    fireEvent.click(screen.getByRole('radio', { name: '7: Sleepy, but no effort to keep awake' }));
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('button', { name: /add detail/i }));
    expect(screen.getByText(/Estimated sleep/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Caffeine' }));
    expect(document.body.textContent).not.toMatch(/6\.6/);
    fireEvent.click(screen.getByRole('button', { name: /save and show forecast/i }));
    await waitFor(() => expect(fetch.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    const body = JSON.parse(String(fetch.mock.calls.find(([, i]) => i?.method === 'POST')![1]!.body));
    expect(body).toMatchObject({ analysis_id: 'a1', duty_id: 'D20260929', operation: 'as_rostered', moment: 'worst_moment', kss: 7, prediction_seen: false, sleeps: [], countermeasures: ['caffeine'] });
    expect(body).not.toHaveProperty('forecast');
    expect(document.body.textContent).not.toMatch(/6\.6/);
    resolvePost(json(saved()));
    expect(await screen.findByText('6.6')).toBeInTheDocument();
    expect(screen.getByText(/Duty peak · High/)).toBeInTheDocument();
    expect(screen.getByText(/One duty does not validate or invalidate the model/)).toBeInTheDocument();
  });

  it('sends estimated sleep as reported only after explicit confirmation', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/study/enrolment')) return Promise.resolve(json(ENROLLED));
      if (init?.method === 'POST') return Promise.resolve(json(saved()));
      return Promise.resolve(json({ debriefs: [] }));
    });
    vi.stubGlobal('fetch', fetch);
    render(wrap(<DutyDebriefAction duty={FLOWN} analysisId="a1" now={NOW} />));
    fireEvent.click(await screen.findByRole('button', { name: /debrief this flown duty/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'As rostered' }));
    fireEvent.click(screen.getByRole('radio', { name: '5: Neither alert nor sleepy' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: /add detail/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Confirm as actual' }));
    fireEvent.click(screen.getByRole('button', { name: /save and show forecast/i }));
    await waitFor(() => expect(fetch.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    const body = JSON.parse(String(fetch.mock.calls.find(([, i]) => i?.method === 'POST')![1]!.body));
    expect(body.sleeps).toEqual([{ start_utc: '2026-09-28T23:15:00.000Z', end_utc: '2026-09-29T06:45:00.000Z', kind: 'main' }]);
    expect(body.prediction_seen).toBe(true);
  });

  it('asks a pilot who stopped contributing before the debrief', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(json(url.endsWith('/api/study/enrolment') ? { ...ENROLLED, enrolled: false, withdrawn_at: '2026-09-01T00:00:00Z' } : { debriefs: [] }))));
    render(wrap(<DutyDebriefAction duty={FLOWN} analysisId="a1" now={NOW} />));
    fireEvent.click(await screen.findByRole('button', { name: /debrief this flown duty/i }));
    expect(await screen.findByRole('heading', { name: /contribute again/i })).toBeInTheDocument();
    expect(screen.getByText(/not a fatigue report and are not sent to your operator/)).toBeInTheDocument();
    expect(screen.getByText(/pseudonymised, not anonymous/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^contribute again$/i })).toBeDisabled();
  });

  it('goes straight to the debrief for a pilot who never opted out', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(json(url.endsWith('/api/study/enrolment') ? { ...ENROLLED, enrolled: false, withdrawn_at: null } : { debriefs: [] }))));
    render(wrap(<DutyDebriefAction duty={FLOWN} analysisId="a1" now={NOW} />));
    fireEvent.click(await screen.findByRole('button', { name: /debrief this flown duty/i }));
    expect(await screen.findByText(/pooled, pseudonymised/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /contribute again/i })).not.toBeInTheDocument();
  });
});

describe('DebriefQueue', () => {
  it('lists flown duties awaiting a debrief without revealing the forecast', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(json(url.endsWith('/api/study/enrolment') ? ENROLLED : { debriefs: [] }))));
    render(wrap(<DebriefQueue now={NOW} />));
    expect(await screen.findByRole('heading', { name: '1 flown duty to debrief' })).toBeInTheDocument();
    expect(screen.getByText('AAA–BBB–AAA')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/6\.6|High/);
  });
});
