import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FATIGUE_INFO, InfoTooltip } from '@/components/ui/InfoTooltip';
import { bodyClockSamples } from '@/lib/body-clock';
import { ALL_REFERENCES } from '@/data/references';
import { PerformanceSummaryCard } from '@/components/fatigue/PerformanceSummaryCard';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { rosterFixture } from './fixtures/roster-analysis';

it('opens a touch explanation with a source without replacing the roster tab', () => {
  render(<InfoTooltip entry={FATIGUE_INFO.fdpUtilization} />);
  fireEvent.click(screen.getByRole('button', { name: 'About flight duty period' }));
  expect(screen.getByText(/must never be treated as a planning allowance/)).toBeVisible();
  expect(screen.getByText('Scheme + approvals')).toBeVisible();
  const source = screen.getByRole('link', { name: /Evidence & limitations/ });
  expect(source).toHaveAttribute('href', '/learn?section=references&source=easa_oro_ftl');
  expect(source).toHaveAttribute('target', '_blank');
  fireEvent.keyDown(source, { key: 'Escape' });
  expect(screen.queryByText('Scheme + approvals')).not.toBeInTheDocument();
});

it('connects every central metric source to a real library record', () => {
  const keys = new Set(ALL_REFERENCES.map(reference => reference.key));
  for (const entry of Object.values(FATIGUE_INFO)) if (entry.sourceId) expect(keys.has(entry.sourceId), entry.sourceId).toBe(true);
});

describe('body-clock presentation', () => {
  const entry = (timestampUtc: string, phaseShiftHours: number) => ({ timestampUtc, phaseShiftHours, referenceTimezone: 'Europe/London' });
  it('uses the home date at month boundaries and retains multiple instants without invented rest-day samples', () => {
    const actual = bodyClockSamples([
      entry('2026-09-30T23:30:00Z', 1), entry('2026-10-01T08:00:00Z', 2),
      entry('2026-10-31T21:30:00Z', 3), entry('invalid', 4),
    ], '2026-10', 'Asia/Qatar');
    expect(actual.map(sample => sample.day)).toEqual(['2026-10-01', '2026-10-01']);
    expect(actual.map(sample => sample.phaseShiftHours)).toEqual([1, 2]);
  });
  it('does not invent zero drift when no model samples exist', () => {
    expect(bodyClockSamples([], '2026-10', 'Europe/London')).toEqual([]);
  });
});


it('explains the headline peak instead of a later, higher post-flight sample', () => {
  const duty = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1)).duties[0];
  duty.maxKss = 6;
  duty.minPerformance = 50;
  duty.peakTimeUtc = '2026-09-02T13:00:00Z';
  duty.timelinePoints = [
    { timestamp: duty.peakTimeUtc, performance: 50, kss: 6, hours_on_duty: 7, hours_awake: 13, sleep_pressure: 0.3, circadian: 0.8, time_on_task_penalty: 1, sleep_inertia: 1 },
    { timestamp: '2026-09-02T14:00:00Z', performance: 30, kss: 8, hours_on_duty: 8, hours_awake: 19, sleep_pressure: 0.9, circadian: 0.2, time_on_task_penalty: 1, sleep_inertia: 1 },
  ];
  render(<PerformanceSummaryCard duty={duty} homeTz="Europe/London" />);
  expect(screen.getByText(/13.0h awake at the peak/)).toBeVisible();
  expect(screen.queryByText(/19.0h awake at the peak/)).not.toBeInTheDocument();
});
