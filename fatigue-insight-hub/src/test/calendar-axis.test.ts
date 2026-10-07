import { describe, expect, it } from 'vitest';
import { buildMonthAxis } from '@/lib/calendar-axis';
import { homeDayKey } from '@/lib/home-time';

describe('calendar-day chart axis', () => {
  it('keeps Santiago September weeks aligned when 6 September 2026 has no midnight', () => {
    const axis = buildMonthAxis(new Date(2026, 8, 1), 'America/Santiago')!;
    expect(axis.days).toHaveLength(30);
    expect(axis.boundaries).toHaveLength(31);
    expect(axis.days[5]).toMatchObject({ date: '2026-09-06', start: Date.parse('2026-09-06T04:00:00Z'), end: Date.parse('2026-09-07T03:00:00Z') });
    expect(axis.days[5].end - axis.days[5].start).toBe(23 * 3_600_000);
    // The following page begins on the 8th, not the 9th after dropping a boundary.
    expect(new Date(axis.boundaries[7]).toISOString()).toBe('2026-09-08T03:00:00.000Z');
    expect(new Date(axis.boundaries[14]).toISOString()).toBe('2026-09-15T03:00:00.000Z');
    expect(axis.weekends).toContainEqual([Date.parse('2026-09-06T04:00:00Z'), Date.parse('2026-09-07T03:00:00Z')]);
    for (const day of axis.days) expect(homeDayKey(new Date(day.tick!).toISOString(), 'America/Santiago')).toBe(day.date);
  });

  it('starts a repeated-midnight date at the first occurrence and retains its full 25 hours', () => {
    const axis = buildMonthAxis(new Date(2026, 10, 1), 'America/Havana')!;
    expect(axis.days[0]).toMatchObject({ start: Date.parse('2026-11-01T04:00:00Z'), end: Date.parse('2026-11-02T05:00:00Z') });
    expect(axis.days[0].end - axis.days[0].start).toBe(25 * 3_600_000);
    expect(axis.boundaries).toHaveLength(31);
  });

  it('retains an empty date slot when an entire civil date was skipped', () => {
    const axis = buildMonthAxis(new Date(2011, 11, 1), 'Pacific/Apia')!;
    expect(axis.days).toHaveLength(31);
    expect(axis.days[29]).toMatchObject({ date: '2011-12-30', start: Date.parse('2011-12-30T10:00:00Z'), end: Date.parse('2011-12-30T10:00:00Z'), tick: null });
    expect(axis.days[30].date).toBe('2011-12-31');
    expect(homeDayKey(new Date(axis.days[30].tick!).toISOString(), 'Pacific/Apia')).toBe('2011-12-31');
  });

  it('does not invent calendar boundaries for an invalid timezone', () => {
    expect(buildMonthAxis(new Date(2026, 8, 1), 'invalid')).toBeNull();
  });
});
