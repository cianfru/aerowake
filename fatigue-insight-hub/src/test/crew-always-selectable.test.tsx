import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalysisProvider } from '@/contexts/AnalysisContext';
import { DutyInfoColumn } from '@/components/fatigue/DutyInfoColumn';
import { mergeCrewOverrides } from '@/hooks/useAnalyzeRoster';
import type { DutyAnalysis } from '@/types/fatigue';

const twoPilotDuty = {
  dutyId: 'D1', crewComposition: 'standard', ulrCrewSet: null, isUlr: false, crewSource: null,
  priorSleep: 7, preDutyAwakeHours: 4, woclExposure: 0, reportTimeUtc: '2026-10-02T06:00:00Z', releaseTimeUtc: '2026-10-02T12:00:00Z',
  flightSegments: [{ flightNumber: 'SYN1', departure: 'AAA', arrival: 'BBB', blockHours: 3 }],
} as unknown as DutyAnalysis;

function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}><AnalysisProvider>{children}</AnalysisProvider></QueryClientProvider>;
}

describe('crew choice on every flight duty', () => {
  it('offers Crew A and B even on a 2-pilot duty, and a pick sets the crew set', () => {
    const onCrewChange = vi.fn();
    render(<DutyInfoColumn duty={twoPilotDuty} homeTz="Asia/Qatar" hasCrewContent onCrewChange={onCrewChange} />, { wrapper: Providers });
    fireEvent.click(screen.getByText('Crew and in-flight rest'));
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(onCrewChange).toHaveBeenCalledWith('D1', 'crew_a');
    expect(screen.getByText(/choosing one sets a 4-pilot crew/)).toBeInTheDocument();
  });

  it('sends a crew set as a 4-pilot override that replaces a stated 3-pilot crew', () => {
    const out = mergeCrewOverrides(new Map(), new Map([['D1', 'augmented_3' as const]]),
      { dutyId: 'D1', composition: 'augmented_4', crewSet: 'crew_b' });
    expect(out.get('D1')).toEqual({ composition: 'augmented_4', crew_set: 'crew_b' });
  });
});
