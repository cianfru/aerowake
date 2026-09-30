import { describe, expect, it } from 'vitest';
import { classifyKss } from '@/lib/risk-scale';
import { formatKssValue, kssBand, roundKss } from '@/components/landing/landingKss';
import { HERO_COPY, HERO_COPY_OPTIONS, LANDING_ARC_HEX, LANDING_ROUTE_PAIRS, getRouteColor } from '@/components/landing/landingData';
import { TOUR_DUTIES, TOUR_WEEK } from '@/components/landing/tourData';
import { aggregateRoutes, dutiesToWatch, highestDuty } from '@/components/landing/tourModel';
import { SCIENCE_PEAKS, SCIENCE_SCENARIO, clockAt, sciencePeakSummary } from '@/components/landing/scienceData';
import { formatDay } from '@/components/landing/landingFormat';

describe('landing KSS display rules', () => {
  it.each([
    [5.46, '5.5', 'moderate'],
    [5.44, '5.4', 'low'],
    [6.54, '6.5', 'high'],
    [7.46, '7.5', 'critical'],
    [7.44, '7.4', 'high'],
    [8.5, '8.5', 'extreme'],
  ])('classifies %s by the value shown (%s → %s)', (kss, shown, band) => {
    expect(formatKssValue(kss)).toBe(shown);
    expect(kssBand(kss)).toBe(band);
    expect(kssBand(kss)).toBe(classifyKss(Number(shown)));
  });

  it('never lets a displayed value disagree with its band across the scale', () => {
    for (let k = 1; k <= 9; k += 0.01) {
      expect(kssBand(k)).toBe(classifyKss(roundKss(k)));
    }
  });
});

describe('hero copy', () => {
  it('keeps the live headline and subline in one switchable constant', () => {
    expect(HERO_COPY).toBe(HERO_COPY_OPTIONS.A);
    expect(HERO_COPY.headline).toBe('Know your roster before you fly it.');
    expect(HERO_COPY.subline).toMatch(/plan rest around them/);
    for (const option of Object.values(HERO_COPY_OPTIONS)) {
      expect(option.headline.length).toBeLessThan(45);
      expect(`${option.headline} ${option.subline}`).not.toMatch(/Analyz|judgment\b|color\b|labeled/);
    }
  });
});

describe('landing globe data', () => {
  it('carries airport pairs only, with one neutral arc colour', () => {
    for (const pair of LANDING_ROUTE_PAIRS) expect(pair.avgPerformance).toBeUndefined();
    expect(getRouteColor(20)).toBe(LANDING_ARC_HEX);
    expect(getRouteColor(95)).toBe(LANDING_ARC_HEX);
  });
});

describe('illustrative tour data', () => {
  it('keeps every duty peak on the KSS scale and in date order', () => {
    const dates = TOUR_DUTIES.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
    for (const d of TOUR_DUTIES) {
      expect(d.peakKss).toBeGreaterThanOrEqual(1);
      expect(d.peakKss).toBeLessThanOrEqual(9);
      expect(d.report).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('never cites the body-clock low for a landing outside 02:00–05:59 without its body-clock time', () => {
    const inWocl = (hhmm: string) => {
      const [h] = hhmm.split(':').map(Number);
      return h >= 2 && h < 6;
    };
    const cited = TOUR_DUTIES.filter((d) => d.reason && /body-clock low/i.test(d.reason) && /\bLands\b/i.test(d.reason));
    expect(cited.length).toBeGreaterThan(0);
    for (const d of cited) {
      const reason = d.reason as string;
      const homeTime = reason.match(/(\d{2}:\d{2}) home-base time/)?.[1];
      const bodyClock = reason.match(/\((\d{2}:\d{2}) body clock\)/)?.[1];
      expect(homeTime ?? bodyClock, reason).toBeTruthy();
      if (bodyClock) expect(inWocl(bodyClock), reason).toBe(true);
      else expect(inWocl(homeTime as string), reason).toBe(true);
    }
  });

  it('describes one full week at 30-minute steps with non-overlapping sleep and duty', () => {
    expect(TOUR_WEEK.kss).toHaveLength(7 * 48);
    const spans = [...TOUR_WEEK.sleep, ...TOUR_WEEK.duties].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
    for (const [a, b] of spans) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(168);
    }
    const weekDuties = TOUR_DUTIES.filter((d) => d.date >= '2026-10-05' && d.date <= '2026-10-11');
    expect(weekDuties).toHaveLength(TOUR_WEEK.duties.length);
  });

  it('derives the outlook facts from duty peaks', () => {
    const watch = dutiesToWatch();
    expect(watch.every((d) => roundKss(d.peakKss) >= 6.5)).toBe(true);
    expect(watch[0].date).toBe('2026-10-05');
    expect(highestDuty().date).toBe('2026-10-07');
    expect(formatDay('2026-10-07')).toBe('Wed 7 Oct');
  });

  it('aggregates routes by airport pair with the worst whole-duty peak', () => {
    const routes = aggregateRoutes();
    const njf = routes.find((r) => r.key === 'DOH-NJF');
    expect(njf).toMatchObject({ from: 'DOH', to: 'NJF', duties: 3, sectors: 6 });
    expect(njf?.worstKss).toBe(6.95);
    expect(routes.map((r) => r.worstKss)).toEqual([...routes.map((r) => r.worstKss)].sort((a, b) => b - a));
    expect(routes.every((r) => r.from === 'DOH')).toBe(true);
  });
});

describe('science scenario', () => {
  it('compares the same duty with and without a nap on one time base', () => {
    expect(SCIENCE_SCENARIO.noNap).toHaveLength(SCIENCE_SCENARIO.nap2h.length);
    const [none, nap] = SCIENCE_PEAKS;
    expect(clockAt(none.index * SCIENCE_SCENARIO.stepHours)).toBe('04:15');
    expect(kssBand(none.kss)).toBe('critical');
    expect(kssBand(nap.kss)).toBe('high');
    expect(nap.kss).toBeLessThan(none.kss);
    expect(sciencePeakSummary()).toContain('7.5 (Critical)');
    expect(sciencePeakSummary()).toContain('6.9 (High)');
  });

  it('pauses the nap line only during the nap and the hour after waking', () => {
    const { nap, stepHours } = SCIENCE_SCENARIO;
    SCIENCE_SCENARIO.nap2h.forEach((value, i) => {
      const h = i * stepHours;
      const pausing = h >= nap[0] && h < nap[1] + 1;
      expect(value === null).toBe(pausing);
    });
    expect(SCIENCE_SCENARIO.noNap.every((v) => v !== null)).toBe(true);
  });
});
