import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { Globe, type GlobeAirport, type GlobeRoute } from '@/components/ui/globe';
import { LandingGlobe } from '@/components/landing/LandingGlobe';
import { useRunGate } from '@/hooks/useRunGate';

const airports: GlobeAirport[] = [
  { code: 'DOH', lat: 25.26, lng: 51.61, emphasis: true, priority: 0 },
  { code: 'NJF', lat: 31.99, lng: 44.4, priority: 3 },
  { code: 'TRV', lat: 8.48, lng: 76.92, priority: 4 },
];
const routes: GlobeRoute[] = [
  { key: 'DOH-NJF', from: [51.61, 25.26], to: [44.4, 31.99], color: 'red', endpoints: ['DOH', 'NJF'] },
  { key: 'DOH-TRV', from: [51.61, 25.26], to: [76.92, 8.48], color: 'orange', endpoints: ['DOH', 'TRV'] },
];
const markerX = (container: HTMLElement, code: string) => {
  const t = container.querySelector(`[data-marker="${code}"]`)!.getAttribute('transform')!;
  return Number(/translate\(([-\d.]+)/.exec(t)![1]);
};
const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));

describe('Globe', () => {
  it('draws markers and labels in CSS pixels, with the home base always labelled', () => {
    const { container } = render(<Globe airports={airports} routes={routes} fitTo={airports.map((a) => [a.lng, a.lat])} />);
    const doh = container.querySelector('[data-label="DOH"]')!;
    expect(doh.getAttribute('display')).toBe('inline');
    expect(doh.getAttribute('font-size')).toBe('12');
    expect(container.querySelector('[data-route="DOH-TRV"] [data-part="line"]')!.getAttribute('d')).toMatch(/^M/);
  });

  it('moves the view the way the arrow keys point', async () => {
    const { container } = render(<Globe airports={airports} routes={routes} fitTo={airports.map((a) => [a.lng, a.lat])} ariaLabel="Route map" />);
    const map = screen.getByRole('group', { name: 'Route map' });
    const before = markerX(container, 'DOH');
    fireEvent.keyDown(map, { key: 'ArrowLeft' });
    await nextFrame();
    // Looking further west moves the ground to the right.
    expect(markerX(container, 'DOH')).toBeGreaterThan(before + 20);
  });

  it('zooms with the controls and announces the zoom level', async () => {
    render(<Globe airports={airports} routes={routes} fitTo={airports.map((a) => [a.lng, a.lat])} controls />);
    const live = screen.getByText(/^Zoom /);
    const before = live.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    // The zoom animates for ~260 ms, then the level is announced.
    await act(() => new Promise((r) => setTimeout(r, 450)));
    expect(live.textContent).not.toBe(before);
    expect(screen.getByRole('button', { name: 'Fit my routes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the whole globe' })).toBeInTheDocument();
  });

  it('keeps the landing globe decorative and non-interactive', () => {
    const { container } = render(<LandingGlobe animate={false} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('group')).toBeNull();
    expect(container.querySelectorAll('[data-route]').length).toBeGreaterThan(5);
    expect(container.querySelector('[data-part="hit"]')).toBeNull();
  });
});

function GateProbe() {
  const ref = useRef<HTMLDivElement>(null);
  const running = useRunGate(ref);
  return <div ref={ref} data-testid="probe">{running ? 'running' : 'paused'}</div>;
}

describe('animation gate', () => {
  it('pauses inside a decorative backdrop or when a modal hides the page', () => {
    render(<div aria-hidden="true"><GateProbe /></div>);
    expect(screen.getByTestId('probe').textContent).toBe('paused');
  });

  it('runs when visible and resumes after a modal closes', async () => {
    render(<div data-testid="page"><GateProbe /></div>);
    expect(screen.getByTestId('probe').textContent).toBe('running');
    await act(async () => {
      screen.getByTestId('page').setAttribute('aria-hidden', 'true');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId('probe').textContent).toBe('paused');
    await act(async () => {
      screen.getByTestId('page').removeAttribute('aria-hidden');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId('probe').textContent).toBe('running');
  });
});
