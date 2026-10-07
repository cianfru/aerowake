import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PilotStudyPage } from '@/components/fatigue/PilotStudyPage';

const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { id: 'u1' } as { id: string } | null } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('@/contexts/AnalysisContext', () => ({
  useAnalysis: () => ({ state: { settings: {}, analysisResults: { homeBaseTimezone: 'Asia/Qatar', pilotBase: 'DOH' } } }),
}));
vi.mock('@/components/auth/AuthSheet', () => ({ AuthSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog">Auth sheet</div> : null) }));

const ENROLLED = { enrolled: true, enrolled_at: '2026-09-01T00:00:00Z', withdrawn_at: null, consent_version: 'duty-debrief-v1', debriefs: 0, observations: 0, last_activity_at: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('aerowake-token', 'old-token'); localStorage.setItem('aerowake-refresh', 'refresh-token');
  auth.value = { isAuthenticated: true, user: { id: 'u1' } };
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function fillDiary() {
  fireEvent.click(await screen.findByLabelText('After duty'));
  fireEvent.click(screen.getAllByLabelText('No')[0]);
  const dates = ['2026-09-01T22:00', '2026-09-02T06:00', '2026-09-02T22:00', '2026-09-03T06:00'];
  Array.from(document.querySelectorAll('input[type="datetime-local"]'))
    .forEach((el, i) => fireEvent.change(el, { target: { value: dates[i] } }));
  for (const el of screen.getAllByLabelText('Yes')) fireEvent.click(el);
}

describe('pilot study diary', () => {
  it('offers guests a sign-in button instead of a dead end', () => {
    auth.value = { isAuthenticated: false, user: null };
    render(wrap(<PilotStudyPage />));
    fireEvent.click(screen.getByRole('button', { name: /sign in to keep a diary/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Auth sheet');
  });

  it('stamps the rating when KSS is chosen, not when the page opened, and reveals only after saving', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-03T12:00:00Z'));
    let resolvePost!: (r: Response) => void;
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/study/enrolment')) return Promise.resolve(json(ENROLLED));
      if (init?.method === 'POST') return new Promise<Response>((r) => { resolvePost = r; });
      return Promise.resolve(json({ observations: [] }));
    });
    vi.stubGlobal('fetch', fetch);
    render(wrap(<PilotStudyPage />));
    await fillDiary();
    vi.setSystemTime(new Date('2026-09-03T12:25:00Z'));  // slow diary entry before rating
    fireEvent.click(screen.getByRole('radio', { name: '8: Sleepy, some effort to keep awake' }));
    expect(screen.getByText(/Rated at 15:25 DOH \(12:25Z\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save rating/i }));
    await waitFor(() => expect(fetch.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    const [, init] = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!;
    const body = JSON.parse(String(init!.body));
    expect(body.observed_at).toBe('2026-09-03T12:25:00.000Z');
    expect(body.observed_kss).toBe(8);
    expect(body.home_timezone).toBe('Asia/Qatar');
    expect(body.sleeps[0]).toEqual({ start: '2026-09-01T19:00:00.000Z', end: '2026-09-02T03:00:00.000Z' });
    expect(screen.queryByText(/Published-model estimate/)).toBeNull();
    resolvePost(json({ id: 'o1', prediction: { kss: 4.2, model_version: 'test' }, exclusions: [] }));
    await waitFor(() => expect(screen.getByText('4.2 / 9 KSS')).toBeInTheDocument());
  });

  it('refreshes an expired token and retries the save with the new bearer token', async () => {
    const posts: string[] = [];
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/refresh')) return Promise.resolve(json({ access_token: 'new-token', refresh_token: 'next' }));
      if (url.endsWith('/api/study/enrolment')) return Promise.resolve(json(ENROLLED));
      if (init?.method === 'POST') {
        const bearer = new Headers(init.headers).get('Authorization') ?? '';
        posts.push(bearer);
        return Promise.resolve(bearer === 'Bearer old-token' ? json({ detail: 'Invalid or expired token' }, 401)
          : json({ id: 'o1', prediction: { kss: 5.1, model_version: 'test' }, exclusions: [] }));
      }
      return Promise.resolve(json({ observations: [] }));
    });
    vi.stubGlobal('fetch', fetch);
    render(wrap(<PilotStudyPage />));
    await fillDiary();
    fireEvent.click(screen.getByRole('radio', { name: '3: Alert' }));
    fireEvent.click(screen.getByRole('button', { name: /save rating/i }));
    await waitFor(() => expect(screen.getByText('5.1 / 9 KSS')).toBeInTheDocument());
    expect(posts).toEqual(['Bearer old-token', 'Bearer new-token']);
    expect(screen.queryByText(/Invalid or expired token/)).toBeNull();
  });

  it('asks a pilot who stopped contributing before showing the diary', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ ...ENROLLED, enrolled: false, withdrawn_at: '2026-09-02T00:00:00Z' }))));
    render(wrap(<PilotStudyPage />));
    expect(await screen.findByRole('button', { name: /contribute again/i })).toBeInTheDocument();
    expect(screen.queryByText(/How sleepy are you right now/)).toBeNull();
  });

  it('requires an explicit choice before showing a new pilot the diary', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(json(url.endsWith('/api/study/enrolment') ? { ...ENROLLED, enrolled: false } : { observations: [] }))));
    render(wrap(<PilotStudyPage />));
    expect(await screen.findByRole('button', { name: /read study information/i })).toBeInTheDocument();
    expect(screen.queryByText(/How sleepy are you right now/)).not.toBeInTheDocument();
  });
});
