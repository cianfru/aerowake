import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SleepBarPopover } from '@/components/fatigue/chronogram/SleepBarPopover';
import { TimelineGrid } from '@/components/fatigue/chronogram/TimelineGrid';
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
      blockKey: 'D1::0', sleepId: 'D1', sleepStartIso: '2026-09-02T00:00:00Z', sleepEndIso: '2026-09-02T07:00:00Z' };
    render(<SleepBarPopover bar={sleep} widthPercent={29} leftPercent={0} variant="homebase" isEditable onActivateEdit={edit} />);
    const button = screen.getByRole('button', { name: 'Inspect estimated sleep 00:00 to 07:00' });
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button); // A keyboard-generated native click has detail=0.
    expect(screen.getByText('Estimated sleep from the roster, not a record of sleep taken.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust sleep times' }));
    expect(edit).toHaveBeenCalledWith('D1::0');
  });
});
