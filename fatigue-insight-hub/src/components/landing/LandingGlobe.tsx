import { useMemo } from 'react';
import { Globe } from '@/components/ui/globe';
import { LANDING_AIRPORTS, LANDING_ROUTE_PAIRS, getRouteColor } from './landingData';

/** Hero background: slowly rotating keyless globe with the demo route network. */
export function LandingGlobe() {
  const routes = useMemo(() => {
    const byCode = new Map(LANDING_AIRPORTS.map((a) => [a.code, a]));
    return LANDING_ROUTE_PAIRS.flatMap((r) => {
      const a = byCode.get(r.from);
      const b = byCode.get(r.to);
      return a && b ? [{ from: [a.lng, a.lat] as [number, number], to: [b.lng, b.lat] as [number, number], color: getRouteColor(r.avgPerformance), width: 1.5 }] : [];
    });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden opacity-70" aria-hidden="true">
      <div className="w-[min(920px,130vw)]">
        <Globe
          airports={LANDING_AIRPORTS.map((a) => ({ code: a.code, lat: a.lat, lng: a.lng, emphasis: a.code === 'DOH' }))}
          routes={routes}
          center={[51.57, 25.26]}
          autoRotate
          interactive={false}
          showLabels={false}
          ariaLabel="Decorative globe"
        />
      </div>
    </div>
  );
}
