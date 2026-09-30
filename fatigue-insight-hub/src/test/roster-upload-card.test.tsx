import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnalysisProvider } from '@/contexts/AnalysisContext';
import { RosterUploadCard } from '@/components/fatigue/roster/RosterUploadCard';
import { RosterRequestError, type RosterPreview } from '@/lib/api-client';

const previewRoster = vi.fn();
const runAnalysis = vi.fn();
const reset = vi.fn();
const analysis: { error: Error | null; isAnalyzing: boolean } = { error: null, isAnalyzing: false };

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  previewRoster: (...args: unknown[]) => previewRoster(...args),
}));
vi.mock('@/hooks/useAnalyzeRoster', () => ({
  useAnalyzeRoster: () => ({ runAnalysis, reset, isAnalyzing: analysis.isAnalyzing, error: analysis.error }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
  getAuthHeaders: () => ({}),
}));

/** Synthetic October roster at a Doha base (no personal data). */
function preview(overrides: Partial<RosterPreview> = {}): RosterPreview {
  return {
    month: '2026-10', home_base: 'DOH', home_timezone: 'Asia/Qatar', time_convention: 'zulu',
    total_duties: 3, total_sectors: 5, standby_periods: 1,
    whole_duty_block_hours: 7.5, calendar_month_block_hours: 7.5,
    source_block_hours: 7.5, source_duty_hours: 20, block_total_matches_source: true,
    warnings: [], roster_format: 'crewlink', base_source: 'roster_header', detected_base: 'DOH',
    detected_base_source: 'roster_header', entered_base: null, base_conflict: false, base_override: false,
    base_city: 'Doha', base_country: 'QA', base_utc_offsets: ['+03:00'],
    flight_duties: 3, training_duties: 0, airport_standbys: 0, duties_touching_base: 3,
    inferred_release_count: 3, needs_confirmation: false,
    checks: [{ code: 'inferred_release', severity: 'info', message: 'CrewLink does not print release times, so they are inferred for 3 duties.' }],
    duties: [
      { id: 'D1', report_utc: '2026-10-05T14:15:00+00:00', release_utc: '2026-10-05T21:45:00+00:00', type: 'flight', route: 'DOH → NJF → DOH', sectors: 2, release_inferred: true },
      { id: 'S1', report_utc: '2026-10-06T19:00:00+00:00', release_utc: '2026-10-07T01:00:00+00:00', type: 'home_standby', route: 'Home standby', sectors: 0, release_inferred: false },
    ],
    ...overrides,
  };
}

function choose(name = 'october.pdf', size = 2048) {
  const file = new File(['%PDF-synthetic'], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'text/csv' });
  Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(screen.getByLabelText('Choose roster file (PDF or CSV)'), { target: { files: [file] } });
  return file;
}

const renderCard = () => render(<AnalysisProvider><RosterUploadCard /></AnalysisProvider>);

beforeEach(() => {
  previewRoster.mockReset();
  runAnalysis.mockReset();
  analysis.error = null;
  analysis.isAnalyzing = false;
});
afterEach(() => localStorage.clear());

describe('RosterUploadCard', () => {
  it('reads the roster as soon as it is chosen and offers one primary action', async () => {
    previewRoster.mockResolvedValue(preview());
    renderCard();
    const file = choose();
    expect(await screen.findByRole('heading', { name: 'October 2026 roster' })).toHaveFocus();
    expect(previewRoster).toHaveBeenCalledWith(file, null, { override: false });

    expect(screen.getByText('Doha, Qatar')).toBeInTheDocument();
    expect(screen.getByText('From roster header')).toBeInTheDocument();
    expect(screen.getByText('7:30')).toBeInTheDocument();
    expect(screen.getByText('Matches roster total')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(/inferred for 3 duties/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Analyse roster' }));
    expect(runAnalysis).toHaveBeenCalledWith({ homeBase: 'DOH', override: false });
    expect(JSON.parse(localStorage.getItem('aerowake-pilot-settings') ?? '{}').homeBase).toBe('DOH');
  });

  it('asks for confirmation only when something is flagged', async () => {
    previewRoster.mockResolvedValue(preview({
      roster_format: 'csv', base_source: 'duty_pattern', detected_base_source: 'duty_pattern', needs_confirmation: true,
      checks: [{ code: 'block_mismatch', severity: 'warning', message: 'Parsed block time is 7:30; your roster says 9:00.' }],
    }));
    renderCard();
    choose('october.csv');
    await screen.findByRole('heading', { name: 'October 2026 roster' });
    expect(screen.getByText(/Inferred from your duties/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Flagged for checking' })).getByText(/your roster says 9:00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Analyse roster' }));
    expect(runAnalysis).not.toHaveBeenCalled();
    expect(screen.getByText('Tick the box to confirm before analysing.')).toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: "DOH is my home base, and I've checked the flagged items above." });
    expect(box).toHaveFocus();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Analyse roster' }));
    expect(runAnalysis).toHaveBeenCalledWith({ homeBase: 'DOH', override: false });
  });

  it('asks for the base only when the roster does not state one', async () => {
    previewRoster
      .mockRejectedValueOnce(new RosterRequestError('This roster does not state a home base.', 'home_base_required', 422))
      .mockResolvedValueOnce(preview({ home_base: 'LGW', home_timezone: 'Europe/London', base_source: 'entered', base_city: 'London', base_country: 'GB' }));
    renderCard();
    const file = choose();
    const input = await screen.findByLabelText('Home base');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'lgw' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByRole('heading', { name: 'October 2026 roster' });
    expect(previewRoster).toHaveBeenLastCalledWith(file, 'LGW', { override: false });
    expect(screen.getByText('Entered by you')).toBeInTheDocument();
  });

  it('overrides a header base only through the warned action', async () => {
    previewRoster
      .mockResolvedValueOnce(preview())
      .mockResolvedValueOnce(preview({
        home_base: 'LGW', home_timezone: 'Europe/London', base_source: 'entered', entered_base: 'LGW',
        base_override: true, base_conflict: true, base_city: 'London', base_country: 'GB', needs_confirmation: true,
        checks: [{ code: 'base_override', severity: 'warning', message: 'Analysing with LGW (London) as home base instead of DOH (Doha).' }],
      }));
    renderCard();
    const file = choose();
    await screen.findByRole('heading', { name: 'October 2026 roster' });
    fireEvent.click(screen.getByRole('button', { name: 'Use a different base' }));
    expect(screen.getByText(/Use a different base only if you are based/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Base to use instead'), { target: { value: 'LGW' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this base' }));
    await screen.findByText(/Chosen by you instead of DOH/);
    expect(previewRoster).toHaveBeenLastCalledWith(file, 'LGW', { override: true });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Analyse roster' }));
    expect(runAnalysis).toHaveBeenCalledWith({ homeBase: 'LGW', override: true });
  });

  it('rejects the wrong file type or size before uploading', () => {
    renderCard();
    choose('roster.xlsx');
    expect(screen.getByRole('alert')).toHaveTextContent('Aerowake reads PDF or CSV rosters.');
    choose('roster.pdf', 11 * 1024 * 1024);
    expect(screen.getByRole('alert')).toHaveTextContent('larger than 10 MB');
    expect(previewRoster).not.toHaveBeenCalled();
  });

  it('shows read failures inline with a way forward', async () => {
    previewRoster.mockRejectedValue(new RosterRequestError("We couldn't find any duties in this file.", 'no_duties', 422));
    renderCard();
    choose();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't find any duties in this file.");
    expect(within(alert).getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: /CSV template/ })).toBeInTheDocument();
  });

  it('shows analysis errors next to the primary action', async () => {
    analysis.error = new Error('Analysis is temporarily unavailable. Please try again shortly.');
    previewRoster.mockResolvedValue(preview());
    renderCard();
    choose();
    await screen.findByRole('heading', { name: 'October 2026 roster' });
    expect(screen.getByRole('alert')).toHaveTextContent('Analysis is temporarily unavailable.');
    expect(screen.getByRole('button', { name: 'Analyse roster' })).toHaveAttribute('aria-describedby');
  });

  it('lists duties in home-base time with UTC on demand', async () => {
    previewRoster.mockResolvedValue(preview());
    renderCard();
    choose();
    await screen.findByRole('heading', { name: 'October 2026 roster' });
    const list = screen.getByRole('list', { name: 'Duties, times in Doha time' });
    expect(within(list).getByText('Mon 5 Oct')).toBeInTheDocument();
    expect(within(list).getByText(/17:15–00:45/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'UTC' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Duties, times in UTC' })).toHaveTextContent('14:15–21:45'));
  });
});
