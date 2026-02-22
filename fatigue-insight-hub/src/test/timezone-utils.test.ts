import { describe, it, expect } from 'vitest';
import {
  utcToTimezone,
  utcToHomeBase,
  utcToZulu,
  utcDayHour,
  getAcclimatizedTimezone,
  isOnHomeBaseReference,
  buildTripleTime,
  buildSleepTripleTime,
} from '@/lib/timezone-utils';

describe('timezone-utils', () => {
  describe('utcToZulu', () => {
    it('formats ISO UTC to HH:mmZ', () => {
      expect(utcToZulu('2025-03-15T02:00:00Z')).toBe('02:00Z');
      expect(utcToZulu('2025-03-15T14:30:00Z')).toBe('14:30Z');
    });

    it('returns empty string for invalid input', () => {
      expect(utcToZulu('not-a-date')).toBe('');
    });
  });

  describe('utcDayHour', () => {
    it('extracts UTC day and decimal hour', () => {
      const result = utcDayHour('2025-03-15T14:30:00Z');
      expect(result.day).toBe(15);
      expect(result.hour).toBe(14.5);
    });

    it('handles midnight correctly', () => {
      const result = utcDayHour('2025-03-16T00:00:00Z');
      expect(result.day).toBe(16);
      expect(result.hour).toBe(0);
    });
  });

  describe('utcToTimezone', () => {
    it('converts UTC to Asia/Qatar (UTC+3)', () => {
      const result = utcToTimezone('2025-03-15T02:00:00Z', 'Asia/Qatar');
      expect(result.hhMm).toBe('05:00');
      expect(result.day).toBe(15);
      expect(result.hour).toBe(5);
    });

    it('handles timezone that crosses midnight', () => {
      // 23:00 UTC -> 02:00 next day in Asia/Qatar (UTC+3)
      const result = utcToTimezone('2025-03-15T23:00:00Z', 'Asia/Qatar');
      expect(result.hhMm).toBe('02:00');
      expect(result.day).toBe(16); // next day
    });

    it('handles half-hour offset (Asia/Kolkata = UTC+5:30)', () => {
      const result = utcToTimezone('2025-03-15T02:00:00Z', 'Asia/Kolkata');
      expect(result.hhMm).toBe('07:30');
      expect(result.hour).toBe(7.5);
    });
  });

  describe('utcToHomeBase', () => {
    it('is a convenience alias for utcToTimezone', () => {
      const a = utcToTimezone('2025-03-15T02:00:00Z', 'Asia/Qatar');
      const b = utcToHomeBase('2025-03-15T02:00:00Z', 'Asia/Qatar');
      expect(a.hhMm).toBe(b.hhMm);
      expect(a.day).toBe(b.day);
    });
  });

  describe('getAcclimatizedTimezone (EASA ORO.FTL.105)', () => {
    const homeBase = 'Asia/Qatar';
    const location = 'Asia/Kolkata';

    it('returns home base if away < 48h', () => {
      expect(getAcclimatizedTimezone({
        hoursAwayFromBase: 24,
        locationTimezone: location,
        homeBaseTimezone: homeBase,
      })).toBe(homeBase);
    });

    it('returns location if away >= 48h', () => {
      expect(getAcclimatizedTimezone({
        hoursAwayFromBase: 50,
        locationTimezone: location,
        homeBaseTimezone: homeBase,
      })).toBe(location);
    });

    it('returns location if backend says acclimatized AND >= 48h', () => {
      expect(getAcclimatizedTimezone({
        hoursAwayFromBase: 72,
        backendState: 'acclimatized',
        locationTimezone: location,
        homeBaseTimezone: homeBase,
      })).toBe(location);
    });

    it('returns home base if backend says acclimatized but < 48h', () => {
      expect(getAcclimatizedTimezone({
        hoursAwayFromBase: 30,
        backendState: 'acclimatized',
        locationTimezone: location,
        homeBaseTimezone: homeBase,
      })).toBe(homeBase);
    });
  });

  describe('isOnHomeBaseReference', () => {
    it('returns true when < 48h away', () => {
      expect(isOnHomeBaseReference({
        hoursAwayFromBase: 10,
        locationTimezone: 'Europe/London',
        homeBaseTimezone: 'Asia/Qatar',
      })).toBe(true);
    });

    it('returns false when >= 48h away', () => {
      expect(isOnHomeBaseReference({
        hoursAwayFromBase: 50,
        locationTimezone: 'Europe/London',
        homeBaseTimezone: 'Asia/Qatar',
      })).toBe(false);
    });
  });

  describe('buildTripleTime', () => {
    it('produces zulu, local, and home strings', () => {
      const result = buildTripleTime(
        '2025-03-15T02:00:00Z',
        '2025-03-15T06:30:00Z',
        'Asia/Qatar',
        'Asia/Kolkata',
        'Asia/Qatar',
        'DOH',
        'DEL',
        { hoursAwayFromBase: 0 },
      );

      expect(result.zulu).toBe('02:00Z – 06:30Z');
      expect(result.localIsHomeRef).toBe(true); // < 48h
      expect(result.home).toContain('05:00');
      expect(result.home).toContain('09:30');
    });

    it('uses airport-local times when acclimatized (>48h)', () => {
      const result = buildTripleTime(
        '2025-03-15T02:00:00Z',
        '2025-03-15T06:30:00Z',
        'Asia/Qatar',
        'Asia/Kolkata',
        'Asia/Qatar',
        'DOH',
        'DEL',
        { hoursAwayFromBase: 72 },
      );

      expect(result.localIsHomeRef).toBe(false);
      expect(result.local).toContain('DOH');
      expect(result.local).toContain('DEL');
    });
  });

  describe('buildSleepTripleTime', () => {
    it('produces zulu, local, home for sleep window', () => {
      const result = buildSleepTripleTime(
        '2025-03-14T19:00:00Z',
        '2025-03-15T01:00:00Z',
        'Asia/Kolkata',
        'Asia/Qatar',
        { hoursAwayFromBase: 10 },
      );

      expect(result.zulu).toBe('19:00Z – 01:00Z');
      expect(result.localIsHomeRef).toBe(true);
    });
  });
});
