import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { rosterContext } from '@/components/fatigue/roster/overview-context';
import { RosterContextBriefing } from '@/components/fatigue/roster/RosterContextBriefing';
import { MonthStrip } from '@/components/fatigue/roster/MonthStrip';
import { dailyAlertnessSummaries } from '@/components/fatigue/roster/alertness-summary';
import { rosterFixture } from './fixtures/roster-analysis';

const results = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1));

describe('roster context briefing', () => {
  it('keeps missing coverage visible even when no warning was returned', () => {
    const onView = vi.fn();
    render(<RosterContextBriefing results={{ ...results, easaFindings: [], easaSummary: undefined }} onView={onView} onDetails={vi.fn()} />);
    expect(screen.getByText('Checks unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Check coverage is unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/no preceding roster is linked/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review findings & coverage' }));
    expect(onView).toHaveBeenCalledWith('limits');
  });

  it('separates incomplete checks from findings and opens the crew assumption needing review', () => {
    const duty = { ...results.duties[1], crewSource: 'fdp' as const, woclExposure: 2 };
    const roster = { ...results, duties: [results.duties[0], duty], easaSummary: { ...results.easaSummary!, coverage: {
      duty_7d: { status: 'incomplete_history', reason: 'History missing' },
      fdp_max: { status: 'failed', reason: 'Finding present' },
      min_rest: { status: 'passed', reason: 'Assessed' },
    } } };
    const context = rosterContext(roster);
    expect(context.warnings).toHaveLength(1);
    expect(context.incompleteChecks).toBe(1);
    expect(context.woclDuties).toEqual([duty]);
    const onDetails = vi.fn();
    render(<RosterContextBriefing results={roster} onView={vi.fn()} onDetails={onDetails} />);
    expect(screen.getByText('1 finding to review')).toBeInTheDocument();
    expect(screen.getByText(/1 check is incomplete/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm first crew assumption' }));
    expect(onDetails).toHaveBeenCalledWith(duty);
  });
});

describe('readable roster ranges', () => {
  it('pages seven days without changing the duty selected and restores the complete month', () => {
    const onDetails = vi.fn();
    render(<MonthStrip results={results} reference={6.5} onDetails={onDetails} />);
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(screen.getByRole('button', { name: 'Previous 7 days of duty peaks' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Wed 9 Sep: LGW/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next 7 days of duty peaks' }));
    fireEvent.click(screen.getByRole('button', { name: /Wed 9 Sep: LGW/ }));
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ dutyId: 'D3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Full month' }));
    expect(screen.getByRole('list', { name: /Duty peaks and estimated sleep by day/ }).children).toHaveLength(30);
  });

  it('keeps unavailable awake samples separate from sleep and groups by home-base date', () => {
    const rows = dailyAlertnessSummaries([
      { t: Date.parse('2026-10-01T23:30:00Z'), kss: 7.2, asleep: false, onDuty: true },
      { t: Date.parse('2026-10-02T00:00:00Z'), kss: null, asleep: false, onDuty: true },
      { t: Date.parse('2026-10-02T00:30:00Z'), kss: null, asleep: true, onDuty: false },
    ], 'Europe/London');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: '2026-10-02', peak: 7.2, samples: 3, missing: 1, asleep: 1 });
  });
});
