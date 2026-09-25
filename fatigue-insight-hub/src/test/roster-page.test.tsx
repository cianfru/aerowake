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

    expect(await screen.findByText('2 to watch')).toBeInTheDocument();
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

    // EASA warning listed, info muted, summary totals shown
    expect(screen.getByText('Rest shorter than the minimum')).toBeInTheDocument();
    expect(screen.getByText('ORO.FTL.235(a)')).toBeInTheDocument();
    expect(screen.getByText('38/60h')).toBeInTheDocument();

    // All duties collapsed by default, one row per duty + standby when opened
    const toggle = screen.getByRole('button', { name: /All duties \(4\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Home standby 15:00–22:00')).toBeInTheDocument();
  });

  it('opens details and pre-fills a fatigue report for a watched duty', async () => {
    render(<AnalysisProvider><Loaded results={results} /></AnalysisProvider>);
    await screen.findByText('2 to watch');

    fireEvent.click(screen.getAllByRole('button', { name: /^Details for duty/ })[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent('details D3');

    fireEvent.click(screen.getAllByRole('button', { name: /^Report fatigue for duty/ })[0]);
    expect(tabSpy).toBe('fatigue-report');
    expect(prefillSpy).toEqual({ dutyId: 'D3' });
  });

  it('shows a calm empty state when nothing needs attention', async () => {
    render(<AnalysisProvider><Loaded results={{ ...results, dutiesToWatch: [], easaFindings: [] }} /></AnalysisProvider>);
    expect(await screen.findByText('No duties need special attention this month')).toBeInTheDocument();
    expect(screen.getByTestId('duties-to-watch-empty')).toBeInTheDocument();
    expect(screen.getByText('All EASA cumulative duty and rest checks met')).toBeInTheDocument();
  });

  it('asks for the home base before analysing when no roster is loaded', () => {
    render(<AnalysisProvider><RosterPage /></AnalysisProvider>);
    expect(screen.getByLabelText(/Home base \(IATA\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run analysis/ })).toBeDisabled();
  });
});
