/**
 * Illustrative data for the landing page.
 *
 * A synthetic October roster (DOH base, generic flight numbers, no real pilot
 * or schedule) was run through the Aerowake engine; the values below are that
 * engine's own outputs, rounded to two decimals. Times are home-base local
 * (DOH, UTC+3). Regenerate them from the engine if the model changes; never
 * edit a number by hand.
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
  /** A reason the engine gave for the duty, wording shortened. */
  reason?: string;
}

export const TOUR_BASE = { code: 'DOH', offset: 'UTC+3', month: 'October 2026' } as const;

/** Personal watch level used by the Outlook preview (the app's default). */
export const TOUR_WATCH_KSS = 6.5;

export const TOUR_DUTIES: TourDuty[] = [
  { date: '2026-10-01', route: ['DOH', 'MCT', 'DOH'], report: '06:15', release: '12:15', peakKss: 5.26, wocl: false },
  { date: '2026-10-03', route: ['DOH', 'LHR'], report: '08:00', release: '16:45', peakKss: 4.6, wocl: false },
  { date: '2026-10-05', route: ['LHR', 'DOH'], report: '22:15', release: '06:30', peakKss: 6.79, wocl: true, reason: 'Lands 06:00 home-base time, during the body-clock low' },
  { date: '2026-10-07', route: ['DOH', 'BKK'], report: '00:40', release: '08:40', peakKss: 7.14, wocl: true, reason: 'Only about 5 hours of estimated sleep in the 24 hours before report' },
  { date: '2026-10-09', route: ['BKK', 'DOH'], report: '14:05', release: '22:35', peakKss: 6.97, wocl: false, reason: 'About 20 hours awake by the end of the duty' },
  { date: '2026-10-12', route: ['DOH', 'NJF', 'DOH'], report: '17:15', release: '00:45', peakKss: 6.95, wocl: false, reason: 'About 18 hours awake by the end of the duty' },
  { date: '2026-10-13', route: ['DOH', 'NJF', 'DOH'], report: '17:15', release: '00:45', peakKss: 6.54, wocl: false },
  { date: '2026-10-15', route: ['DOH', 'MCT', 'DOH'], report: '06:15', release: '12:15', peakKss: 4.96, wocl: false },
  { date: '2026-10-18', route: ['DOH', 'IST'], report: '07:15', release: '13:20', peakKss: 4.79, wocl: false },
  { date: '2026-10-19', route: ['IST', 'DOH'], report: '12:45', release: '18:40', peakKss: 4.17, wocl: false },
  { date: '2026-10-21', route: ['DOH', 'CDG'], report: '00:35', release: '09:05', peakKss: 6.74, wocl: true },
  { date: '2026-10-22', route: ['CDG', 'DOH'], report: '11:15', release: '19:00', peakKss: 4.39, wocl: false },
  { date: '2026-10-27', route: ['DOH', 'NJF', 'DOH'], report: '17:15', release: '00:45', peakKss: 6.74, wocl: false },
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
  kss: [
    6.23, 6.47, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.95, 3.95, 3.94, 3.94, 3.94, 3.93,
    3.92, 3.9, 3.88, 3.86, 3.83, 3.8, 3.77, 3.74, 3.72, 3.71, 3.72, 3.75, null, null, null, null, null, 3.51, 3.74, 4, 4.27, 4.07, 4.33, 4.61,
    4.89, 5.16, 5.44, 5.69, 5.93, 6.14, 6.32, 6.48, 6.6, 6.69, 6.75, 6.78, 6.79, 6.77, 6.74, 6.7, 6.65, 6.6, null, null, null, null, null, null,
    null, 4.6, 4.58, 4.56, 4.53, 4.5, 4.46, 4.42, 4.38, 4.34, 4.3, 4.28, 4.27, 4.28, 4.31, 4.37, 4.45, 4.57, null, null, null, null, 4.83, 5.09,
    5.36, 5.63, 6.05, 6.28, 6.49, 6.67, 6.83, 6.95, 7.04, 7.1, 7.13, 7.14, 7.12, 7.09, 7.04, 6.99, 6.93, 6.87, 6.8, 6.74, 6.69, 6.64, 6.58, 6.53,
    6.48, 6.43, 6.38, 6.32, 6.25, 6.19, 6.11, 6.04, 5.97, 5.91, 5.86, 5.82, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, 5.1, 5.25, 5.37, 5.46, 5.52, 5.56, 5.57, 5.56, 5.54, 5.51, 5.48, 5.44, 5.41, 5.37, 5.34, 5.31, 5.28, 5.26,
    5.23, 5.2, 5.16, 5.13, 5.08, 5.03, 4.98, 4.93, 4.88, 4.84, 4.8, 4.78, 4.78, 4.79, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, 4.81, 4.96, 5.09, 5.18, 5.25, 5.29, 5.3, 5.3, 5.29, 5.26, 5.23, 5.2, 5.17, 5.14, 5.11, 5.09, 5.06, 5.04,
    5.01, 4.99, 4.96, 4.92, 4.88, 4.28, 4.28, 4.3, 4.34, 4.42, 4.52, 4.65, 4.81, 5, 5.21, 5.45, 5.69, 5.95, 6.21, 6.46, 6.71, 6.93, 7.14, 7.32,
    7.46, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.69, 3.69, 3.68, 3.67, 3.65, 3.63,
    3.61, 3.58, 3.55, 3.53, 3.51, 3.51, 3.53, 3.56, 3.62, 3.7, 3.82, 3.96, 4.13, 4.33, 4.56, 4.8, 5.06, 5.33, 5.6, 5.86, 6.12, 6.36, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.85, 3.85, 3.85, 3.85, 3.84, 3.84, 3.83, 3.81, 3.8, 3.77,
    3.74, 3.71, 3.69, 3.66, 3.64, 3.64, 3.65, 3.68, 3.74, 3.82, 3.93, 4.08, 4.25, 4.44, 4.67, 4.91, 5.17, 5.43, 5.7, 5.96, 6.22, 6.45, null, null,
  ] as (number | null)[],
  sleep: [[1, 9], [18, 20.5], [33, 36.5], [45, 47], [66, 75], [91, 99], [120.5, 129], [143, 151], [167, 168]] as [number, number][],
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
