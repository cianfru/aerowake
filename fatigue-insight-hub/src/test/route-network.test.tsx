import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DutyAnalysis, FlightSegment } from '@/types/fatigue';

vi.mock('@/lib/airport-api', () => ({
  getMultipleAirportsAsync: vi.fn(async (codes: string[]) => {
    const db: Record<string, [number, number]> = { DOH: [51.61, 25.26], NJF: [44.4, 31.99], MCT: [58.28, 23.59] };
    return new Map(codes.filter((c) => db[c]).map((c) => [c, { code: c, name: '', city: '', country: '', lat: db[c][1], lng: db[c][0] }]));
  }),
  getAirportNamesAsync: vi.fn(async () => new Map([['NJF', { name: 'Al Najaf International', city: 'Najaf', country: 'IQ' }]])),
}));
import { RouteNetwork } from '@/components/fatigue/roster/RouteNetwork';
import { useMapGestures, wheelZoomFactor } from '@/hooks/useMapGestures';
import { useRef } from 'react';

const seg = (departure: string, arrival: string, blockHours = 2): FlightSegment => ({
  flightNumber: 'XX1', departure, arrival, departureTime: '10:00', arrivalTime: '12:00', blockHours, performance: 60,
});
const duty = (maxKss: number, segments: FlightSegment[]): DutyAnalysis => ({
  date: new Date(2026, 8, 1), dayOfWeek: 'Tue', dutyHours: 8, blockHours: 4, sectors: segments.length,
  minPerformance: 110 - 10 * maxKss, avgPerformance: 60, landingPerformance: 60, sleepDebt: 0, woclExposure: 0, priorSleep: 8,
  overallRisk: 'LOW', minPerformanceRisk: 'LOW', landingRisk: 'LOW', maxKss, modelVersion: 'aerowake-4.0-kss',
  smsReportable: false, riskAdvisory: 'routine', flightSegments: segments,
} as DutyAnalysis);

const duties = [
  duty(6.8, [seg('DOH', 'NJF', 1.9), seg('NJF', 'DOH', 1.75)]),
  duty(6.9, [seg('DOH', 'NJF', 1.8), seg('NJF', 'DOH', 1.75)]),
  duty(5.2, [seg('DOH', 'MCT', 1.5), seg('MCT', 'DOH', 1.75)]),
];

describe('RouteNetwork', () => {
  it('merges directions in the table and keeps both directional rows', async () => {
    render(<RouteNetwork duties={duties} homeBase="DOH" />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('button', { name: /DOH to NJF and back, 4 sectors, peak KSS 6\.9, High/ })).toBeInTheDocument();
    expect(within(table).getByText('DOH → NJF')).toBeInTheDocument();
    expect(within(table).getByText('NJF → DOH')).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: /Route map: 2 routes, 3 airports, based at DOH/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Map legend/ })).toBeInTheDocument();
  });

  it('highlights a selected route instead of hiding the others, and shows its details', async () => {
    const { container } = render(<RouteNetwork duties={duties} homeBase="DOH" />);
    await screen.findByRole('group', { name: /Route map/ });
    const row = screen.getByRole('button', { name: /DOH to MCT and back/ });
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row.closest('tr')!.className).toContain('bg-secondary');
    const routes = container.querySelectorAll('[data-route]');
    expect(routes).toHaveLength(2);
    const selected = container.querySelector('[data-route="DOH-MCT"]')!;
    const other = container.querySelector('[data-route="DOH-NJF"]')!;
    expect(selected.getAttribute('opacity')).toBe('1');
    expect(other.getAttribute('opacity')).toBe('0.25');
    // Selected route is drawn last (on top).
    expect(routes[routes.length - 1]).toBe(selected);
    const cards = screen.getAllByRole('status').filter((el) => el.textContent?.includes('DOH ⇄ MCT'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].textContent).toMatch(/NM/);
    expect(cards[0].textContent).toMatch(/1:30 · 1:45/);
  });

  it('selects from the map and syncs the table', async () => {
    const { container } = render(<RouteNetwork duties={duties} homeBase="DOH" />);
    await screen.findByRole('group', { name: /Route map/ });
    const hit = container.querySelector('[data-route="DOH-NJF"] [data-part="hit"]')!;
    fireEvent.click(hit);
    expect(screen.getByRole('button', { name: /DOH to NJF and back/ })).toHaveAttribute('aria-pressed', 'true');
    // Escape on the map clears the selection.
    fireEvent.keyDown(screen.getByRole('group', { name: /Route map/ }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: /DOH to NJF and back/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches between globe, map and list views', async () => {
    const { container } = render(<RouteNetwork duties={duties} homeBase="DOH" />);
    await screen.findByRole('group', { name: /Route map/ });
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(container.querySelector('svg[data-mode="flat"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryByRole('group', { name: /Route map/ })).toBeNull();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows a note when the roster has no flight sectors', () => {
    render(<RouteNetwork duties={[duty(5, [])]} homeBase="DOH" />);
    expect(screen.getByText(/No flight sectors were found/)).toBeInTheDocument();
  });
});

function GestureProbe({ cooperative, onZoom, onBlocked }: { cooperative: boolean; onZoom: (f: number) => void; onBlocked: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useMapGestures(ref, { onPan: () => undefined, onZoom: (f) => onZoom(f), onBlockedWheel: onBlocked }, { cooperative });
  return <div ref={ref} data-testid="surface" />;
}

describe('map gestures', () => {
  it('converts wheel deltas into bounded zoom factors', () => {
    expect(wheelZoomFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false })).toBeGreaterThan(1);
    expect(wheelZoomFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false })).toBeLessThan(1);
    expect(wheelZoomFactor({ deltaY: -3, deltaMode: 1, ctrlKey: false })).toBeCloseTo(2 ** 0.15);
    expect(wheelZoomFactor({ deltaY: -10_000, deltaMode: 0, ctrlKey: false })).toBe(2);
    // Trackpad pinch (ctrl + small deltas) zooms at a usable rate.
    expect(wheelZoomFactor({ deltaY: -10, deltaMode: 0, ctrlKey: true })).toBeGreaterThan(wheelZoomFactor({ deltaY: -10, deltaMode: 0, ctrlKey: false }));
  });

  it('lets the page scroll inline unless Ctrl or ⌘ is held', () => {
    const onZoom = vi.fn();
    const onBlocked = vi.fn();
    render(<GestureProbe cooperative onZoom={onZoom} onBlocked={onBlocked} />);
    const el = screen.getByTestId('surface');
    const plain = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    act(() => { el.dispatchEvent(plain); });
    expect(plain.defaultPrevented).toBe(false);
    expect(onZoom).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    const withCtrl = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { el.dispatchEvent(withCtrl); });
    expect(withCtrl.defaultPrevented).toBe(true);
    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it('zooms on a plain wheel in the full-screen map', async () => {
    const onZoom = vi.fn();
    render(<GestureProbe cooperative={false} onZoom={onZoom} onBlocked={vi.fn()} />);
    const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    act(() => { screen.getByTestId('surface').dispatchEvent(ev); });
    await waitFor(() => expect(onZoom).toHaveBeenCalled());
    expect(ev.defaultPrevented).toBe(true);
  });
});
