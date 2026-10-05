import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SleepHabitsEditor } from '@/components/fatigue/SleepHabitsEditor';
import { DEFAULT_SLEEP_PREFERENCES, fromPayload, nightHours, toPayload, validateNight } from '@/lib/sleep-preferences';

describe('sleep preferences', () => {
  it('accepts the same nights as the model and explains the rest', () => {
    expect(validateNight('23:00', '07:00')).toBeNull();
    expect(validateNight('0:30', '7:30')).toBeNull();
    expect(nightHours('00:30', '07:30')).toBe(7);
    expect(validateNight('18:00', '06:00')).toMatch(/between 20:00 and 02:00/);
    expect(validateNight('23:00', '03:00')).toMatch(/between 04:00 and 11:00/);
    expect(validateNight('20:00', '11:00')).toMatch(/5 and 11 hours/);
    expect(validateNight('11pm', '07:00')).toMatch(/24-hour/);
  });

  it('round-trips the account payload and ignores unknown habits', () => {
    expect(fromPayload(toPayload(DEFAULT_SLEEP_PREFERENCES))).toEqual(DEFAULT_SLEEP_PREFERENCES);
    expect(fromPayload({ usual_bedtime: '0:30', nap_habit: 'always' })).toEqual({ usualBedtime: '00:30' });
  });

  it('saves a new usual night and nap habit, and explains each choice', async () => {
    const onSave = vi.fn().mockResolvedValue('Saved on this device.');
    render(<SleepHabitsEditor value={DEFAULT_SLEEP_PREFERENCES} onSave={onSave} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText(/54 %, Signal et al\. 2014/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Bedtime (24-hour)'), { target: { value: '0:00' } });
    fireEvent.change(screen.getByLabelText('Wake-up (24-hour)'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Rarely' }));
    expect(screen.getByText('No pre-duty nap is assumed.')).toBeInTheDocument();
    expect(screen.getByText('6.0h')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ usualBedtime: '00:00', usualWakeTime: '06:00', napHabit: 'rarely' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved on this device.');
  });

  it('refuses an impossible night before saving', () => {
    const onSave = vi.fn();
    render(<SleepHabitsEditor value={DEFAULT_SLEEP_PREFERENCES} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Bedtime (24-hour)'), { target: { value: '18:00' } });
    expect(screen.getByRole('alert')).toHaveTextContent('between 20:00 and 02:00');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
