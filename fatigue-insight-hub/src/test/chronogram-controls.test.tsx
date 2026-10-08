import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SleepBarPopover } from '@/components/fatigue/chronogram/SleepBarPopover';
import { TimelineGrid } from '@/components/fatigue/chronogram/TimelineGrid';
import { TimelineRenderer } from '@/components/fatigue/chronogram/TimelineRenderer';
import { homeBaseTransform } from '@/lib/timeline-transforms';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import type { TimelineData, TimelineSleepBar } from '@/lib/timeline-types';
import { rosterFixture } from './fixtures/roster-analysis';

const duty = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1)).duties[0];
const data: TimelineData = {
  variant: 'homebase', dutyBars: [], sleepBars: [], inflightRestBars: [],
  fdpMarkers: [{ rowIndex: 1, hour: 18, maxFdp: 12, duty }],
  woclBands: [], wmzBands: [], totalRows: 1, xAxisLabel: 'Home base',
  rowLabels: [{ rowIndex: 1, label: 'Wed 2', hasDuty: true, warnings: [] }],
  standbyBars: [{ rowIndex: 1, startHour: 3, endHour: 11, period: {
    id: 'S1', type: 'home_standby', code: 'PSBY', date: '2026-09-02',
    startUtc: '2026-09-02T00:00:00Z', endUtc: '2026-09-02T08:00:00Z',
    startHome: '03:00', endHome: '11:00', countedDutyHours: 0,
  } }],
};

describe('calendar controls', () => {
  it('opens the linked duty from the formerly inert FDP marker', () => {
    const select = vi.fn();
    render(<TimelineGrid data={data} rowHeight={32} selectedDuty={null} onDutySelect={select} />);
    fireEvent.click(screen.getByRole('button', { name: /FDP limit for Wed 2 Sep: 12 hours/ }));
    expect(select).toHaveBeenCalledWith(duty);
  });

  it('explains standby without inventing a sleepiness score', () => {
    render(<TimelineGrid data={data} rowHeight={32} selectedDuty={null} onDutySelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Home standby 03:00 to 11:00' }));
    expect(screen.getByText('2026-09-02 · 03:00–11:00 home-base time')).toBeVisible();
    expect(screen.getByText(/It has no predicted duty KSS score/)).toBeVisible();
  });

  it('offers a named sleep control and an explicit edit action', () => {
    const edit = vi.fn();
    const sleep: TimelineSleepBar = { rowIndex: 1, startHour: 0, endHour: 7, recoveryScore: 80,
      effectiveSleep: 7, sleepEfficiency: 1, sleepStrategy: 'normal', isPreDuty: true, relatedDuty: duty,
      blockKey: 'D1::0', sleepId: 'D1', sleepStartIso: '2026-09-02T00:00:00Z', sleepEndIso: '2026-09-02T07:00:00Z',
      confidence: 0.8, references: [{ key: 'borbely_1982', short: 'Borbély (1982)', full: 'A two process model of sleep regulation.' }] };
    render(<SleepBarPopover bar={sleep} widthPercent={29} leftPercent={0} variant="homebase" isEditable onActivateEdit={edit} />);
    const button = screen.getByRole('button', { name: 'Inspect estimated sleep 00:00 to 07:00' });
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button); // A keyboard-generated native click has detail=0.
    expect(screen.getByText('Estimated sleep from the roster, not a record of sleep taken.')).toBeVisible();
    expect(screen.getByText('Assumption rating')).toBeVisible();
    expect(screen.getByText(/not statistical confidence or the probability that you slept/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'References (1)' }));
    expect(screen.getByRole('link', { name: /View evidence & limitations/ })).toHaveAttribute('href', '/learn?section=references&source=borbely_1982');
    fireEvent.click(screen.getByRole('button', { name: 'Adjust sleep times' }));
    expect(edit).toHaveBeenCalledWith('D1::0');
  });

  it('makes in-flight rest inspectable by a native click, including touch and keyboard', () => {
    render(<TimelineGrid data={{ ...data, inflightRestBars: [{ rowIndex: 1, startHour: 9, endHour: 11,
      durationHours: 2, effectiveSleepHours: 1.4, isDuringWocl: false, crewSet: 'crew_a', relatedDuty: duty }] }}
      rowHeight={56} selectedDuty={null} onDutySelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect in-flight rest: 2.0 hours' }));
    expect(screen.getByText('Effective sleep')).toBeVisible();
    expect(screen.getByText('1.4h')).toBeVisible();
    expect(screen.getByText(/A modelled rest allocation, not recorded sleep/)).toBeVisible();
  });

  it('keeps a per-day night band aligned after the calendar is focused to a later week', () => {
    const { container } = render(<TimelineGrid data={{ ...data,
      rowLabels: [{ rowIndex: 8, label: 'Tue 8', hasDuty: false, warnings: [] }],
      woclBands: [{ rowIndex: 1, startHour: 1, endHour: 5 }, { rowIndex: 8, startHour: 1, endHour: 5 }],
    }} rowHeight={56} selectedDuty={null} onDutySelect={vi.fn()} />);
    const bands = container.querySelectorAll('.wocl-hatch');
    expect(bands).toHaveLength(1);
    expect(bands[0]).toHaveStyle({ top: '0px', height: '56px' });
  });

  it('defaults a phone to seven days and offers month, week and highest-peak navigation', () => {
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const roster = transformAnalysisResult(rosterFixture, new Date(2026, 8, 1));
    const select = vi.fn();
    try {
      render(<TimelineRenderer data={homeBaseTransform(roster.duties, roster.statistics, roster.month)} duties={roster.duties}
        selectedDuty={null} onDutySelect={select} />);
      expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('1–7 Sep')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Previous 7 days' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
      expect(screen.getByText('8–14 Sep')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: /Inspect Wed 9 Sep/ }));
      expect(select).toHaveBeenCalledWith(roster.duties[2]);
      fireEvent.click(screen.getByRole('button', { name: 'Full month' }));
      expect(screen.getByText('Wed 30')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: /Find highest peak/ }));
      expect(screen.getByText('8–14 Sep')).toBeVisible();
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    }
  });
});
