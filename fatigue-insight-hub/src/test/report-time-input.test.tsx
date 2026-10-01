import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReportTimeInput } from '@/components/fatigue/fatigue-report/ReportTimeInput';
import { isCompleteClock } from '@/lib/report-time';

function Harness({ onIso }: { onIso: (iso: string) => void }) {
  const [value, setValue] = useState('2026-10-01T00:00:00Z');
  return <ReportTimeInput label="Event" value={value} tz="UTC" zone="UTC"
    onChange={(iso) => { setValue(iso); onIso(iso); }} />;
}

/** Like a keyboard: each key appends to what the field shows now (maxLength 5). */
function typeChars(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: '' } });
  for (const ch of text) {
    if (input.value.length >= 5) continue;
    fireEvent.change(input, { target: { value: input.value + ch } });
  }
}

describe('report time entry', () => {
  it('only treats unambiguous text as a complete time', () => {
    expect(isCompleteClock('043')).toBe(false);
    expect(isCompleteClock('213')).toBe(false);
    expect(isCompleteClock('0430')).toBe(true);
    expect(isCompleteClock('4:30')).toBe(true);
    expect(isCompleteClock('21:3')).toBe(false);
  });

  it.each([['0430', '04:30'], ['2130', '21:30'], ['04:30', '04:30']])('typing %s keystroke by keystroke keeps %s', (typed, shown) => {
    const onIso = vi.fn();
    render(<Harness onIso={onIso} />);
    const input = screen.getByLabelText('Event, time (24-hour)') as HTMLInputElement;
    typeChars(input, typed);
    expect((input as HTMLInputElement).value).toBe(shown);
    expect(onIso).toHaveBeenLastCalledWith(`2026-10-01T${shown}:00.000Z`);
  });
});
