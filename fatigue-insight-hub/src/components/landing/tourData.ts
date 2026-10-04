/**
 * Illustrative data for the landing page.
 *
 * A synthetic October roster (DOH base, generic flight numbers, no real pilot
 * or schedule) was run through the Aerowake engine; the values below are that
 * engine's own outputs, rounded to two decimals. Times are home-base local
 * (DOH, UTC+3). The roster is in fatigue-tool/scripts/landing_data.py;
 * regenerate with `python scripts/landing_data.py` (run from fatigue-tool) and
 * never edit a number by hand. fatigue-tool/tests/test_landing_data.py fails
 * when these literals drift from the engine.
 */

export interface TourDuty {
  /** Home-base duty date, ISO. */
  date: string;
  /** Airports in order, e.g. ['DOH', 'MCT', 'DOH']. */
  route: string[];
  /** Report and release, home-base local time (release may fall on the next day). */
  report: string;
  release: string;
  /** Peak predicted KSS over the duty: the duty's headline risk. */
  peakKss: number;
  /** True when the duty overlaps the WOCL, 02:00–05:59 home-base time. */
  wocl: boolean;
  /**
   * A reason the engine gave for the duty, wording shortened. A landing cited
   * against the body-clock low must carry its body-clock time when the
   * home-base time falls outside 02:00–05:59.
   */
  reason?: string;
}

export const TOUR_BASE = { code: 'DOH', offset: 'UTC+3', month: 'October 2026' } as const;

/** Personal watch level used by the Outlook preview (the app's default). */
export const TOUR_WATCH_KSS = 6.5;

export const TOUR_DUTIES: TourDuty[] = [
  { date: '2026-10-01', route: ['DOH', 'MCT', 'DOH'], report: '06:15', release: '12:15', peakKss: 5.26, wocl: false },
  { date: '2026-10-03', route: ['DOH', 'LHR'], report: '08:00', release: '16:45', peakKss: 4.59, wocl: false },
  { date: '2026-10-05', route: ['LHR', 'DOH'], report: '22:15', release: '06:30', peakKss: 7.12, wocl: true, reason: 'Lands 06:00 home-base time (04:47 body clock), inside the body-clock low' },
  { date: '2026-10-07', route: ['DOH', 'BKK'], report: '00:40', release: '08:40', peakKss: 7.31, wocl: true, reason: 'Only about 5 hours of estimated sleep in the 24 hours before report' },
  { date: '2026-10-09', route: ['BKK', 'DOH'], report: '14:05', release: '22:35', peakKss: 6.49, wocl: false, reason: 'About 20 hours awake by the end of the duty' },
  { date: '2026-10-12', route: ['DOH', 'NJF', 'DOH'], report: '17:15', release: '00:45', peakKss: 6.41, wocl: false, reason: 'About 18 hours awake by the end of the duty' },
  { date: '2026-10-13', route: ['DOH', 'NJF', 'DOH'], report: '17:15', release: '00:45', peakKss: 6.34, wocl: false },
  { date: '2026-10-15', route: ['DOH', 'MCT', 'DOH'], report: '06:15', release: '12:15', peakKss: 5.03, wocl: false },
  { date: '2026-10-18', route: ['DOH', 'IST'], report: '07:15', release: '13:20', peakKss: 4.8, wocl: false },
  { date: '2026-10-19', route: ['IST', 'DOH'], report: '12:45', release: '18:40', peakKss: 4.34, wocl: false },
  { date: '2026-10-21', route: ['DOH', 'CDG'], report: '00:35', release: '09:05', peakKss: 7.15, wocl: true },
  { date: '2026-10-22', route: ['CDG', 'DOH'], report: '11:15', release: '19:00', peakKss: 4.48, wocl: false },
  { date: '2026-10-27', route: ['DOH', 'NJF', 'DOH'], report: '17:15', release: '00:45', peakKss: 6.14, wocl: false },
];

/** Totals the engine reported for the same supplied roster. */
export const TOUR_TOTALS = { duties: 13, sectors: 18 } as const;

/**
 * Week of Monday 5 to Sunday 11 October from the engine's alertness timeline:
 * predicted KSS every 30 minutes from Monday 00:00 home-base time (null while
 * asleep). Sleep and duty spans are hours from the same origin.
 */
export const TOUR_WEEK = {
  start: '2026-10-05',
  stepHours: 0.5,
  kss: [6.29, 6.53, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.97, 3.97, 3.96, 3.96, 3.95, 3.95, 3.94, 3.92, 3.9, 3.88, 3.85, 3.82, 3.78, 3.76, 3.74, 3.73, 3.74, 3.76, 3.81, 3.89, null, null, null, 3.97, 4.2, 4.45, 4.71, 4.5, 4.76, 5.03, 5.3, 5.57, 5.83, 6.08, 6.31, 6.52, 6.69, 6.84, 6.96, 7.04, 7.09, 7.12, 7.12, 7.1, 7.06, 7.02, 6.96, 6.9, null, null, null, null, null, null, null, 4.9, 4.88, 4.85, 4.82, 4.78, 4.73, 4.69, 4.64, 4.6, 4.56, 4.53, 4.52, 4.52, 4.55, 4.6, 4.68, 4.8, null, null, null, null, 5.05, 5.31, 5.57, 5.84, 6.25, 6.48, 6.69, 6.87, 7.02, 7.14, 7.22, 7.28, 7.31, 7.31, 7.29, 7.26, 7.21, 7.15, 7.09, 7.02, 6.96, 6.9, 6.84, 6.78, 6.73, 6.68, 6.62, 6.57, 6.51, 6.45, 6.38, 6.31, 6.24, 6.17, 6.09, 6.03, 5.97, 5.93, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5.18, 5.33, 5.45, 5.54, 5.6, 5.63, 5.64, 5.63, 5.61, 5.58, 5.55, 5.51, 5.47, 5.44, 5.4, 5.37, 5.34, 5.32, 5.29, 5.25, 5.22, 5.18, 5.14, 5.09, 5.04, 4.98, 4.93, 4.89, 4.85, 4.83, 4.82, 4.84, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4.82, 4.98, 5.11, 5.2, 5.26, 5.3, 5.32, 5.32, 5.3, 5.28, 5.25, 5.22, 5.18, 5.15, 5.12, 5.1, 5.07, null, null, 4.63, 4.61, 4.58, 4.55, 3.95, 3.95, 3.98, 4.03, 4.11, 4.22, 4.35, 4.52, 4.71, 4.93, 5.17, 5.42, 5.68, 5.95, 6.21, 6.45, 6.68, 6.89, 7.08, 7.23, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.77, 3.77, 3.77, 3.76, 3.75, 3.73, 3.7, 3.68, 3.65, 3.62, 3.6, 3.58, 3.58, 3.59, 3.62, 3.68, 3.76, 3.88, 4.02, 4.19, 4.39, 4.62, 4.86, 5.12, 5.38, 5.65, 5.92, 6.17, 6.41, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.86, 3.86, 3.86, 3.86, 3.85, 3.85, 3.84, 3.82, 3.81, 3.78, 3.75, 3.72, 3.69, 3.67, 3.65, 3.65, 3.66, 3.69, 3.75, 3.83, 3.94, 4.08, 4.25, 4.45, 4.67, 4.92, 5.17, 5.44, 5.71, 5.97, 6.22, 6.46, null, null] as (number | null)[],
  sleep: [[1, 9], [19, 20.5], [33, 36.5], [45, 47], [66, 75], [91, 99], [107.5, 108.5], [120.5, 128.5], [143, 151], [167, 168]] as [number, number][],
  /** Report to release of the three duties that week (5, 7 and 9 October). */
  duties: [[22.25, 30.5], [48.67, 56.67], [110.08, 118.58]] as [number, number][],
};

/** Rolling EASA ORO.FTL.210 totals the engine found (supplied activities only). */
export const TOUR_FTL = [
  { label: 'Duty · 7 days', hours: 33.5, limit: 60 },
  { label: 'Duty · 14 days', hours: 57.75, limit: 110 },
  { label: 'Duty · 28 days', hours: 96.25, limit: 190 },
  { label: 'Block · 28 days', hours: 67.5, limit: 100 },
] as const;

/** Airport coordinates, [lng, lat], for the Routes preview. */
export const TOUR_AIRPORTS: Record<string, [number, number]> = {
  DOH: [51.57, 25.26],
  MCT: [58.28, 23.59],
  NJF: [44.4, 31.99],
  LHR: [-0.46, 51.47],
  CDG: [2.55, 49.01],
  IST: [28.73, 41.28],
  BKK: [100.75, 13.69],
};
