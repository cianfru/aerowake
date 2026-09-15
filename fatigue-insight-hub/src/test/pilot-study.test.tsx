import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PilotStudyPage } from '@/components/fatigue/PilotStudyPage';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }), getAuthHeaders: () => ({ Authorization: 'Bearer test' }) }));
afterEach(() => vi.unstubAllGlobals());

describe('pilot study collection', () => {
  it('reveals a prediction only after the observation has been saved', async () => {
    let resolve: (value: unknown) => void;
    const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise(r => { resolve = r; }));
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<PilotStudyPage />);
    expect(screen.queryByText(/Published-model estimate/)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.queryByText(/Published-model estimate/)).toBeNull();
    resolve!({ ok: true, json: async () => ({ prediction: { kss: 4.2, model_version: 'test' }, exclusions: [] }) });
    await waitFor(() => expect(screen.getByText('4.2 / 9 KSS')).toBeTruthy());
    expect(fetch.mock.calls[0][0]).toContain('/api/pilot-study/observations');
  });
});
