/**
 * Static landing content: hero copy options and the decorative globe network.
 * Nothing here is a model output; illustrative model data lives in tourData.ts.
 */

export interface HeroCopy {
  eyebrow: string;
  headline: string;
  subline: string;
}

/**
 * Headline options reviewed for the launch. A is live; switch HERO_COPY to
 * B or C to try another promise without touching the layout.
 */
export const HERO_COPY_OPTIONS = {
  A: {
    eyebrow: 'For line pilots · Built on published sleep science',
    headline: 'Know your roster before you fly it.',
    subline: 'See which duties press on sleep and your body clock, plan rest around them, and keep a clear, factual record of how each duty actually went. Built on published sleep science and referenced to EASA ORO.FTL.',
  },
  B: {
    eyebrow: 'For line pilots · Built on published sleep science',
    headline: 'Plan your rest around your roster.',
    subline: 'Predicted sleepiness for every duty, the timing behind it and the assumptions it rests on, so you reach report time with a plan.',
  },
  C: {
    eyebrow: 'For line pilots · Built on published sleep science',
    headline: 'Every duty, seen through sleep science.',
    subline: "From report to release, see how sleep, body clock and time awake add up, and share clear, factual observations through your operator's fatigue risk management process when it matters.",
  },
} as const satisfies Record<'A' | 'B' | 'C', HeroCopy>;

export const HERO_COPY: HeroCopy = HERO_COPY_OPTIONS.A;

/** The one statement every landing surface repeats about independence. */
export const NON_AFFILIATION_NOTE = "Independent tool, not affiliated with or endorsed by any airline or aviation authority. Your operator's approved FTL scheme and FRM process take precedence.";

// Static airport coordinates for the landing globe: no async API dependency.
export interface LandingAirport {
  code: string;
  lat: number;
  lng: number;
  city: string;
}

export const LANDING_AIRPORTS: LandingAirport[] = [
  { code: 'LHR', lat: 51.47, lng: -0.46, city: 'London' },
  { code: 'CDG', lat: 49.01, lng: 2.55, city: 'Paris' },
  { code: 'FRA', lat: 50.03, lng: 8.57, city: 'Frankfurt' },
  { code: 'FCO', lat: 41.80, lng: 12.25, city: 'Rome' },
  { code: 'IST', lat: 41.28, lng: 28.73, city: 'Istanbul' },
  { code: 'DOH', lat: 25.26, lng: 51.57, city: 'Doha' },
  { code: 'DXB', lat: 25.25, lng: 55.36, city: 'Dubai' },
  { code: 'BOM', lat: 19.09, lng: 72.87, city: 'Mumbai' },
  { code: 'DEL', lat: 28.56, lng: 77.10, city: 'Delhi' },
  { code: 'BKK', lat: 13.69, lng: 100.75, city: 'Bangkok' },
  { code: 'SIN', lat: 1.35, lng: 103.99, city: 'Singapore' },
  { code: 'NRT', lat: 35.77, lng: 140.39, city: 'Tokyo' },
  { code: 'JNB', lat: -26.14, lng: 28.24, city: 'Johannesburg' },
  { code: 'NBO', lat: -1.32, lng: 36.93, city: 'Nairobi' },
];

export interface LandingRoutePair {
  from: string;
  to: string;
  /**
   * @deprecated Always undefined. The landing globe no longer carries any
   * model index, so routes cannot imply a risk judgement about a network.
   */
  avgPerformance?: undefined;
}

/**
 * Airport pairs drawn on the decorative globe (one arc per pair): a neutral
 * multi-hub network, not any single carrier's schedule. The social preview
 * (scripts/og-image/og.html) draws the same pairs.
 */
export const LANDING_ROUTE_PAIRS: LandingRoutePair[] = [
  ['CDG', 'JNB'], ['LHR', 'DXB'], ['CDG', 'SIN'], ['FRA', 'NRT'], ['IST', 'BKK'],
  ['DOH', 'BOM'], ['FCO', 'DEL'], ['JNB', 'DXB'], ['NBO', 'IST'], ['DOH', 'LHR'],
].map(([from, to]) => ({ from, to }));

/** Neutral brand teal shared by every landing arc (never a risk colour). */
export const LANDING_ARC_HEX = '#0e6f86';

/** @deprecated Landing arcs are neutral; this returns LANDING_ARC_HEX for any input. */
export const getRouteColor = (_legacy?: unknown): string => LANDING_ARC_HEX;
