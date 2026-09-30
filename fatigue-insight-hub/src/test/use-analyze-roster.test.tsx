import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalysisProvider, useAnalysis } from '@/contexts/AnalysisContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { rosterFixture } from './fixtures/roster-analysis';

const analyzeRoster = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  analyzeRoster: (...args: unknown[]) => analyzeRoster(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}><AnalysisProvider>{children}</AnalysisProvider></QueryClientProvider>;
}

const useBoth = () => ({ analysis: useAnalysis(), analyze: useAnalyzeRoster({ inlineErrors: true }) });
const roster = new File(['synthetic'], 'october.pdf');

beforeEach(() => {
  analyzeRoster.mockReset();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
});
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

describe('useAnalyzeRoster', () => {
  it('sends the confirmed base and override, then reveals the workspace heading', async () => {
    analyzeRoster.mockResolvedValue(rosterFixture);
    const heading = document.createElement('h1');
    heading.setAttribute('data-analysis-heading', '');
    document.body.appendChild(heading);
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.analysis.uploadFile({ name: 'october.pdf', size: 9, type: 'PDF' }, roster));
    act(() => result.current.analyze.runAnalysis({ homeBase: 'lgw', override: true }));
    await waitFor(() => expect(result.current.analysis.state.analysisResults).not.toBeNull());
    expect(analyzeRoster).toHaveBeenCalledWith(roster, 'P12345', 'LGW', expect.any(Map), { override: true });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });

  it('drops a result for a file the pilot has since removed', async () => {
    let resolve: (value: unknown) => void = () => {};
    analyzeRoster.mockReturnValue(new Promise(r => { resolve = r; }));
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.analysis.uploadFile({ name: 'october.pdf', size: 9, type: 'PDF' }, roster));
    act(() => result.current.analyze.runAnalysis({ homeBase: 'DOH' }));
    act(() => result.current.analysis.removeFile());
    await act(async () => { resolve(rosterFixture); });
    await waitFor(() => expect(result.current.analyze.isAnalyzing).toBe(false));
    expect(result.current.analysis.state.analysisResults).toBeNull();
  });

  it('exposes failures for inline display', async () => {
    analyzeRoster.mockRejectedValue(new Error('Analysis is temporarily unavailable.'));
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.analysis.uploadFile({ name: 'october.pdf', size: 9, type: 'PDF' }, roster));
    act(() => result.current.analyze.runAnalysis());
    await waitFor(() => expect(result.current.analyze.error?.message).toBe('Analysis is temporarily unavailable.'));
    expect(analyzeRoster.mock.calls[0][2]).toBeNull();
  });
});
