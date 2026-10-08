import { useEffect, useRef, type ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalysisProvider, useAnalysis } from '@/contexts/AnalysisContext';
import { SleepBlockList } from '@/components/fatigue/sleep/SleepBlockList';
import { addBlock, editForBlock, removeBlock, removedIn, restoreBlock, retimeBlock, toPayload } from '@/lib/sleep-edits';
import type { AnalysisResults, SleepEditItem } from '@/types/fatigue';

const saveSleepEdits = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  saveSleepEdits: (...args: unknown[]) => saveSleepEdits(...args),
}));

const NAP = { sleepStartUtc: '2026-10-23T11:30:00Z', sleepEndUtc: '2026-10-23T12:05:00Z', sleepType: 'nap', source: 'estimated' as const };
const NIGHT = { sleepStartUtc: '2026-10-22T20:00:00Z', sleepEndUtc: '2026-10-23T04:00:00Z', sleepType: 'main', source: 'estimated' as const };

describe('sleep edit list', () => {
  it('removes an estimated nap by naming it, and drops a pilot change on remove', () => {
    const removed = removeBlock([], NAP);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({ action: 'remove', kind: 'nap', targetStartUtc: NAP.sleepStartUtc, targetEndUtc: NAP.sleepEndUtc });
    const added = addBlock([], 'nap', '2026-10-23T10:00:00Z', '2026-10-23T11:00:00Z');
    const pilotNap = { sleepStartUtc: '2026-10-23T10:00:00Z', sleepEndUtc: '2026-10-23T11:00:00Z', sleepType: 'nap', source: 'pilot' as const };
    expect(editForBlock(added, pilotNap)?.action).toBe('add');
    expect(removeBlock(added, pilotNap)).toEqual([]);
  });

  it('retimes once per block and restores the estimate', () => {
    let edits: SleepEditItem[] = retimeBlock([], NIGHT, '2026-10-22T21:00:00Z', '2026-10-23T03:00:00Z');
    const moved = { ...NIGHT, sleepStartUtc: '2026-10-22T21:00:00Z', sleepEndUtc: '2026-10-23T03:00:00Z', source: 'pilot' as const };
    edits = retimeBlock(edits, moved, '2026-10-22T22:00:00Z', '2026-10-23T03:00:00Z');
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ action: 'replace', targetStartUtc: NIGHT.sleepStartUtc, startUtc: '2026-10-22T22:00:00Z' });
    const now = { ...moved, sleepStartUtc: '2026-10-22T22:00:00Z' };
    // Removing a moved estimate removes the estimate itself.
    expect(removeBlock(edits, now)[0]).toMatchObject({ action: 'remove', targetStartUtc: NIGHT.sleepStartUtc, startUtc: null });
    expect(restoreBlock(edits, now)).toEqual([]);
    expect(toPayload(edits)[0]).toMatchObject({ action: 'replace', target_start_utc: NIGHT.sleepStartUtc, start_utc: '2026-10-22T22:00:00Z' });
  });

  it('lists removed estimates only inside the window', () => {
    const edits = removeBlock([], NAP);
    expect(removedIn(edits, '2026-10-22T08:00:00Z', '2026-10-23T14:05:00Z')).toHaveLength(1);
    expect(removedIn(edits, '2026-10-23T13:00:00Z', '2026-10-23T14:05:00Z')).toHaveLength(0);
  });
});

function Seed({ children }: { children: ReactNode }) {
  const { state, setAnalysisResults } = useAnalysis();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setAnalysisResults({ analysisId: 'a1', month: new Date('2026-10-01'), duties: [], sleepEdits: [] } as unknown as AnalysisResults);
  });
  return state.analysisResults ? <>{children}</> : null;
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <AnalysisProvider><Seed>{children}</Seed></AnalysisProvider>
    </QueryClientProvider>
  );
}

describe('SleepBlockList', () => {
  beforeEach(() => saveSleepEdits.mockReset());

  it('explains an assumed nap with its evidence and saves its removal', async () => {
    saveSleepEdits.mockResolvedValue({ analysis_id: 'a1', duties: [], sleep_edits: [] });
    const basis = 'About half of crews nap before an evening or night departure: 54 % of 52 long-haul pilots napped (Signal et al. 2014).';
    render(
      <SleepBlockList homeTz="Asia/Qatar" ariaLabel="Estimated sleep before this duty"
        blocks={[NIGHT, { ...NAP, basis, durationHours: 0.6, effectiveHours: 0.5 }]}
        rationale="Pilots keep a consistent bedtime around 23:00."
        confidence={0.6} confidenceBasis="Estimated sleep opportunity, not reported sleep."
        references={[{ key: 'signal_2014', short: 'Signal et al. (2014)', full: 'Signal TL et al. (2014) Aviat Space Environ Med 85:1199-1208' }]}
        window={{ to: '2026-10-23T14:05:00Z' }} addDefault={{ startUtc: '2026-10-23T11:05:00Z', endUtc: '2026-10-23T12:05:00Z' }} />,
      { wrapper: Providers },
    );
    const list = await screen.findByRole('list', { name: 'Estimated sleep before this duty' });
    expect(list).toHaveTextContent('Nap · assumed');
    fireEvent.click(screen.getByRole('button', { name: /^Why this nap/ }));
    expect(await screen.findByText(basis)).toBeInTheDocument();
    expect(screen.getByText('60/100')).toBeInTheDocument();
    expect(screen.getByText(/Sources \(1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I don’t nap here' }));
    await waitFor(() => expect(saveSleepEdits).toHaveBeenCalledTimes(1));
    const [id, payload] = saveSleepEdits.mock.calls[0];
    expect(id).toBe('a1');
    expect(payload).toEqual([expect.objectContaining({ action: 'remove', kind: 'nap', target_start_utc: NAP.sleepStartUtc })]);
  });

  it('explains the main sleep with the strategy and offers to add a nap', async () => {
    render(
      <SleepBlockList homeTz="Asia/Qatar" ariaLabel="Sleep" blocks={[NIGHT]}
        rationale="Pilots keep a consistent bedtime around 23:00." window={{ to: '2026-10-23T14:05:00Z' }}
        addDefault={{ startUtc: '2026-10-23T11:05:00Z', endUtc: '2026-10-23T12:05:00Z' }} />,
      { wrapper: Providers },
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Why this sleep/ }));
    expect(await screen.findByText('Pilots keep a consistent bedtime around 23:00.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add a nap or sleep/ }));
    expect(screen.getByRole('radiogroup', { name: 'Kind of sleep' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and recalculate' })).toBeEnabled();
  });
});
