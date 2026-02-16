// Static airport coordinates for landing page globe — avoids async API dependency
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

export interface LandingRoute {
  from: string;
  to: string;
  performance: number;
}

// Route data extracted from mockAnalysisData flight segments
// Each unique directional route with its performance score
export const LANDING_ROUTES: LandingRoute[] = [
  { from: 'DOH', to: 'DXB', performance: 78.5 },
  { from: 'DXB', to: 'DOH', performance: 75.2 },
  { from: 'DOH', to: 'LHR', performance: 64.2 },
  { from: 'LHR', to: 'DOH', performance: 60.1 },
  { from: 'DOH', to: 'BOM', performance: 70.5 },
  { from: 'BOM', to: 'DOH', performance: 61.8 },
  { from: 'DOH', to: 'JFK', performance: 57.3 },
  { from: 'JFK', to: 'DOH', performance: 50.1 },
  { from: 'DOH', to: 'SIN', performance: 52.8 },
  { from: 'SIN', to: 'DOH', performance: 47.5 },
  { from: 'DOH', to: 'CDG', performance: 54.2 },
  { from: 'CDG', to: 'DOH', performance: 53.2 },
  { from: 'DOH', to: 'BKK', performance: 48.8 },
  { from: 'BKK', to: 'DOH', performance: 46.2 },
  { from: 'DOH', to: 'IST', performance: 76.8 },
  { from: 'IST', to: 'DOH', performance: 74.2 },
  { from: 'DOH', to: 'SYD', performance: 70.2 },
  { from: 'SYD', to: 'DOH', performance: 49.5 },
  { from: 'DOH', to: 'NRT', performance: 65.2 },
  { from: 'NRT', to: 'DOH', performance: 52.4 },
  { from: 'DOH', to: 'FCO', performance: 48.2 },
];

// Get route color based on performance — matches RouteNetworkMapbox.tsx
export const getRouteColor = (performance: number): string => {
  if (performance >= 70) return '#22c55e';
  if (performance >= 60) return '#eab308';
  if (performance >= 50) return '#f97316';
  return '#ef4444';
};

// Aggregate routes by unique pair (for display, take worst performance)
export const LANDING_ROUTE_PAIRS = (() => {
  const pairMap = new Map<string, { from: string; to: string; avgPerformance: number }>();

  LANDING_ROUTES.forEach((route) => {
    const key = [route.from, route.to].sort().join('-');
    const existing = pairMap.get(key);
    if (existing) {
      existing.avgPerformance = Math.min(existing.avgPerformance, route.performance);
    } else {
      pairMap.set(key, { from: route.from, to: route.to, avgPerformance: route.performance });
    }
  });

  return Array.from(pairMap.values());
})();

// Landing page metrics (from mockAnalysisData statistics)
export const LANDING_METRICS = {
  totalDuties: 14,
  totalSectors: 23,
  criticalRiskDuties: 7,
  lowestPerformance: 44.8,
  peakSleepDebt: 8.0,
  totalPinchEvents: 12,
  airports: 12,
} as const;
