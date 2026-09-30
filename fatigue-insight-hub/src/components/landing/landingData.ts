/**
 * Static landing content for the decorative globe network.
 * Nothing here is a model output.
 */

// Static airport coordinates for the landing globe: no async API dependency.
export interface LandingAirport {
  code: string;
  lat: number;
  lng: number;
  city: string;
}

export const LANDING_AIRPORTS: LandingAirport[] = [
  { code: 'DOH', lat: 25.26, lng: 51.57, city: 'Doha' },
  { code: 'DXB', lat: 25.25, lng: 55.36, city: 'Dubai' },
  { code: 'LHR', lat: 51.47, lng: -0.46, city: 'London' },
  { code: 'JFK', lat: 40.64, lng: -73.78, city: 'New York' },
  { code: 'SYD', lat: -33.95, lng: 151.18, city: 'Sydney' },
  { code: 'NRT', lat: 35.77, lng: 140.39, city: 'Tokyo' },
  { code: 'CDG', lat: 49.01, lng: 2.55, city: 'Paris' },
  { code: 'BKK', lat: 13.69, lng: 100.75, city: 'Bangkok' },
  { code: 'SIN', lat: 1.35, lng: 103.99, city: 'Singapore' },
  { code: 'BOM', lat: 19.09, lng: 72.87, city: 'Mumbai' },
  { code: 'IST', lat: 41.28, lng: 28.73, city: 'Istanbul' },
  { code: 'FCO', lat: 41.80, lng: 12.25, city: 'Rome' },
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

/** Airport pairs drawn on the decorative globe (one arc per pair). */
export const LANDING_ROUTE_PAIRS: LandingRoutePair[] = [
  'DXB', 'LHR', 'BOM', 'JFK', 'SIN', 'CDG', 'BKK', 'IST', 'SYD', 'NRT', 'FCO',
].map((to) => ({ from: 'DOH', to }));

/** Neutral brand teal shared by every landing arc (never a risk colour). */
export const LANDING_ARC_HEX = '#0e6f86';

/** @deprecated Landing arcs are neutral; this returns LANDING_ARC_HEX for any input. */
export const getRouteColor = (_legacy?: unknown): string => LANDING_ARC_HEX;
