import { Globe, type GlobeAirport, type GlobeRoute } from '@/components/ui/globe';

/**
 * Illustrative hub network for the hero. Neutral brand colour only: the landing
 * page makes no risk claims about any real schedule.
 */
const HUB = { code: 'DOH', lat: 25.26, lng: 51.57 };
const SPOKES = [
  { code: 'DXB', lat: 25.25, lng: 55.36 },
  { code: 'LHR', lat: 51.47, lng: -0.46 },
  { code: 'JFK', lat: 40.64, lng: -73.78 },
  { code: 'SYD', lat: -33.95, lng: 151.18 },
  { code: 'NRT', lat: 35.77, lng: 140.39 },
  { code: 'CDG', lat: 49.01, lng: 2.55 },
  { code: 'BKK', lat: 13.69, lng: 100.75 },
  { code: 'SIN', lat: 1.35, lng: 103.99 },
  { code: 'BOM', lat: 19.09, lng: 72.87 },
  { code: 'IST', lat: 41.28, lng: 28.73 },
  { code: 'FCO', lat: 41.8, lng: 12.25 },
  { code: 'JNB', lat: -26.13, lng: 28.24 },
];

const ARC = '#0e6f86';
const AIRPORTS: GlobeAirport[] = [{ ...HUB, emphasis: true }, ...SPOKES];
const ROUTES: GlobeRoute[] = SPOKES.map((s) => ({
  key: `${HUB.code}-${s.code}`,
  from: [HUB.lng, HUB.lat],
  to: [s.lng, s.lat],
  color: ARC,
  width: 1.6,
}));

/**
 * Hero globe: lifted arcs from a hub with a slow outbound flow, atmosphere,
 * limb lighting and today's day/night terminator. Decorative, never
 * interactive; it animates only while visible and uncovered.
 */
export function LandingGlobe({ animate = true, className }: { animate?: boolean; className?: string }) {
  return (
    <Globe
      appearance="daylight"
      airports={AIRPORTS}
      routes={ROUTES}
      center={[40, 22]}
      autoRotate
      animate={animate}
      interactive={false}
      showLabels={false}
      terminator
      flow="all"
      className={className ?? 'aspect-square w-full'}
      ariaLabel="Decorative globe"
    />
  );
}
