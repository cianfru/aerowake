import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AnalysisProvider, useAnalysis } from '@/contexts/AnalysisContext';
import { RosterPage } from '@/components/fatigue/roster/RosterPage';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import type { AnalysisResults } from '@/types/fatigue';
import { rosterFixture } from './fixtures/roster-analysis';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, confirmCompany: vi.fn() }),
  getAuthHeaders: () => ({}),
}));
// Heavy visual sections are covered elsewhere; keep this test on the page structure.
vi.mock('@/components/fatigue/Chronogram', () => ({ Chronogram: () => <section aria-label="Roster calendar">calendar</section> }));
vi.mock('@/components/fatigue/roster/RouteNetwork', () => ({ RouteNetwork: () => <div>route map</div> }));
vi.mock('@/components/fatigue/roster/TimelineSection', () => ({ TimelineSection: () => <div>timeline</div> }));
vi.mock('@/components/fatigue/DutyDetailsDialog', () => ({
  DutyDetailsDialog: ({ open, duty }: { open: boolean; duty: { dutyId?: string } | null }) =>
    open ? <div role="dialog">details {duty?.dutyId}</div> : null,
}));
vi.mock('@/hooks/useAnalyzeRoster', () => ({ useAnalyzeRoster: () => ({ runAnalysis: vi.fn(), isAnalyzing: false }) }));

let tabSpy: string | null = null;
let prefillSpy: { dutyId: string } | null = null;

function Loaded({ results }: { results: AnalysisResults }) {
  const { state, loadAnalysis } = useAnalysis();
  useEffect(() => { loadAnalysis(results); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  tabSpy = state.activeTab;
  prefillSpy = state.fatigueReportPrefill;
  return <RosterPage />;
}

const results = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1));

describe('RosterPage', () => {
  it('shows only duties_to_watch in the watch section, worst first, with reasons', async () => {
    render(<AnalysisProvider><Loaded results={results} /></AnalysisProvider>);

    expect(await screen.findByText('September 2026')).toBeInTheDocument();
    const watch = screen.getByTestId('duties-to-watch');
    const cards = within(watch).getAllByTestId('duty-watch-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('LGW → TFS')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Critical')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/during the body-clock low/)).toBeInTheDocument();
    expect(within(cards[1]).getByText('LGW → GVA → LGW')).toBeInTheDocument();
    // Low / moderate duties are not in the watch section
    expect(within(watch).queryByText('LGW → NCE → LGW')).toBeNull();
    expect(within(watch).queryByText('LGW → AMS → LGW')).toBeNull();

    // Each view has a distinct purpose; limits are not repeated in the outlook.
    expect(screen.queryByRole('region', { name: 'Roster calendar' })).toBeNull();
    expect(screen.queryByText('Rest shorter than the minimum')).toBeNull();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'FTL checks' }), { button: 0, ctrlKey: false });
    // EASA warning listed, info muted, summary totals shown
    expect(screen.getByText('Rest shorter than the minimum')).toBeInTheDocument();
    expect(screen.getByText('ORO.FTL.235(a)')).toBeInTheDocument();
    expect(screen.getByText('38/60h')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Calendar' }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('region', { name: 'Roster calendar' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Your fatigue outlook' })).toBeNull();
    expect(screen.queryByRole('button', { name: /All duties/ })).toBeNull();

  });

  it('opens details and pre-fills a fatigue report for a watched duty', async () => {
    render(<AnalysisProvider><Loaded results={results} /></AnalysisProvider>);
    await screen.findByText('September 2026');

    fireEvent.click(screen.getAllByRole('button', { name: /^Details for duty/ })[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent('details D3');

    fireEvent.click(screen.getAllByRole('button', { name: /^Report fatigue for duty/ })[0]);
    expect(tabSpy).toBe('fatigue-report');
    expect(prefillSpy).toEqual({ dutyId: 'D3' });
  });

  it('shows a calm empty state when nothing needs attention', async () => {
    render(<AnalysisProvider><Loaded results={{ ...results, duties: results.duties.filter(d => (d.maxKss ?? 9) < 6.5), dutiesToWatch: [], easaFindings: [] }} /></AnalysisProvider>);
    await screen.findByText('September 2026');
    expect(screen.getByTestId('duties-to-watch-empty')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'FTL checks' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('No exceedances found in the supplied activities')).toBeInTheDocument();
  });

  it('starts with the roster picker, not a base to type, when no roster is loaded', () => {
    render(<AnalysisProvider><RosterPage /></AnalysisProvider>);
    expect(screen.getByLabelText('Choose roster file (PDF or CSV)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Home base/)).toBeNull();
    expect(screen.getByRole('link', { name: /Download CSV template/ })).toBeInTheDocument();
  });

  it('preserves model warnings when a pilot raises their personal watch level and carries it to a concern', async () => {
    render(<AnalysisProvider><Loaded results={results} /></AnalysisProvider>);
    await screen.findByText('September 2026');
    fireEvent.change(screen.getByLabelText('My watch level (KSS)'), { target: { value: '9' } });
    expect(screen.getByText('No crossing in assessed duties')).toBeInTheDocument();
    expect(within(screen.getByTestId('duties-to-watch')).getAllByTestId('duty-watch-card')).toHaveLength(2);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sleep & recovery' }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getAllByRole('button', { name: /^Raise roster concern for/ })[0]);
    expect(prefillSpy).toEqual({ dutyId: 'D1', purpose: 'roster_concern', watchReference: 9 });
    expect(tabSpy).toBe('fatigue-report');
  });
});
