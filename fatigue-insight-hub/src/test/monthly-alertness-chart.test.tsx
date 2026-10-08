import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MonthlyAlertnessChart } from '@/components/fatigue/roster/MonthlyAlertnessChart';
import type { AlertnessSample } from '@/types/fatigue';

// Inspect the actual chart-domain props without relying on jsdom SVG sizing.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  XAxis: ({ domain }: { domain: number[] }) => <output aria-label="Visible chart domain">{domain.map(t => new Date(t).toISOString()).join(' / ')}</output>,
  Area: () => null, Line: () => null, ReferenceArea: () => null,
  ReferenceLine: () => null, Tooltip: () => null, YAxis: () => null, CartesianGrid: () => null,
}));

const samples: AlertnessSample[] = Array.from({ length: 30 }, (_, index) => ({
  t: Date.UTC(2026, 8, index + 1, 16), kss: 4 + index / 100, asleep: false, onDuty: false,
}));

describe('weekly sleepiness chart navigation across a midnight DST change', () => {
  it('keeps each seven-day label, plotted domain and daily summary on the same Santiago dates', () => {
    render(<MonthlyAlertnessChart samples={samples} duties={[]} month={new Date(2026, 8, 1)} homeTz="America/Santiago" />);
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    const next = screen.getByRole('button', { name: 'Next 7 days of sleepiness' });
    const previous = screen.getByRole('button', { name: 'Previous 7 days of sleepiness' });
    expect(previous).toBeDisabled();
    for (let page = 0; page < 5; page++) {
      const first = page * 7 + 1;
      const last = Math.min(first + 6, 30);
      expect(screen.getByText(`${first}–${last} Sept`)).toBeInTheDocument();
      const start = `2026-09-${String(first).padStart(2, '0')}T${page === 0 ? '04' : '03'}:00:00.000Z`;
      const end = last === 30 ? '2026-10-01T03:00:00.000Z' : `2026-09-${String(last + 1).padStart(2, '0')}T03:00:00.000Z`;
      expect(screen.getByLabelText('Visible chart domain')).toHaveTextContent(`${start} / ${end}`);
      const rows = screen.getByRole('table', { name: 'Daily model sleepiness values', hidden: true }).querySelectorAll('tbody tr');
      expect([...rows].map(row => row.querySelector('th')?.textContent)).toEqual(
        Array.from({ length: last - first + 1 }, (_, index) => `${first + index} Sept`),
      );
      if (page < 4) fireEvent.click(next);
    }
    expect(next).toBeDisabled();
    fireEvent.click(previous);
    expect(screen.getByText('22–28 Sept')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Full month' }));
    expect(screen.getByLabelText('Visible chart domain')).toHaveTextContent('2026-09-01T04:00:00.000Z / 2026-10-01T03:00:00.000Z');
    expect(screen.getByRole('table', { name: 'Daily model sleepiness values', hidden: true }).querySelectorAll('tbody tr')).toHaveLength(30);
  });
});
