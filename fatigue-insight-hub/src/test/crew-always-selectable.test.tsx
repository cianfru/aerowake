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

describe('rest facility choice', () => {
  it('exposes class 1/2/3 on an augmented duty and reruns with the selected class', () => {
    const onRestFacilityChange = vi.fn();
    const duty = { ...twoPilotDuty, crewComposition: 'augmented_3', restFacilityClass: 'class_1' } as DutyAnalysis;
    render(<DutyInfoColumn duty={duty} hasCrewContent onRestFacilityChange={onRestFacilityChange} />, { wrapper: Providers });
    const selector = screen.getByRole('combobox', { name: 'Rest facility for this duty' });
    fireEvent.change(selector, { target: { value: 'class_3' } });
    expect(onRestFacilityChange).toHaveBeenCalledWith('D1', 'class_3');
    expect(screen.getByText(/modelling assumptions, not measured sleep/)).toBeInTheDocument();
  });

  it('keeps saved estimates read-only when the original roster is unavailable', () => {
    const duty = { ...twoPilotDuty, crewComposition: 'augmented_3', restFacilityClass: 'class_2', restFacilitySource: 'pilot' } as DutyAnalysis;
    render(<DutyInfoColumn duty={duty} hasCrewContent />, { wrapper: Providers });
    expect(screen.getByRole('combobox', { name: 'Rest facility for this duty' })).toBeDisabled();
    expect(screen.getByText(/You selected this facility/)).toBeInTheDocument();
  });

  it('merges a new facility with existing crew choices and retains it on later reruns', () => {
    const out = mergeCrewOverrides(new Map([['D1', 'crew_b' as const]]), new Map([['D1', 'augmented_4' as const]]),
      { dutyId: 'D1', restFacility: 'class_2' });
    expect(out.get('D1')).toEqual({ composition: 'augmented_4', crew_set: 'crew_b', rest_facility_class: 'class_2' });
    const later = mergeCrewOverrides(new Map(), new Map([['D1', 'augmented_3' as const]]), undefined, new Map([['D1', 'class_3' as const]]));
    expect(later.get('D1')).toEqual({ composition: 'augmented_3', rest_facility_class: 'class_3' });
  });
});
