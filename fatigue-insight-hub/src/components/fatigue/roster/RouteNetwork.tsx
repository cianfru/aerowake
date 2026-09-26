import { useEffect, useMemo, useState } from 'react';
import { Globe, type GlobeRoute } from '@/components/ui/globe';
import { getMultipleAirportsAsync } from '@/lib/airport-api';
import type { AirportData } from '@/data/airportCoordinates';
import { RISK_LEVEL_LABELS, riskCssColor, type RiskLevel } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { dutyPeakKss, dutyRiskLevel } from './roster-utils';
import { SectionHeading } from './primitives';

const ORDER: RiskLevel[] = ['low', 'moderate', 'high', 'critical', 'extreme'];

interface RouteStat {
  key: string;
  a: string;
  b: string;
  count: number;
  worst: RiskLevel;
  worstKss: number | null;
}

/** Route pairs flown this month (direction-agnostic), with the worst duty risk on each. */
function routeStats(duties: DutyAnalysis[]): RouteStat[] {
  const map = new Map<string, RouteStat>();
  for (const d of duties) {
    const level = dutyRiskLevel(d);
    const kss = dutyPeakKss(d);
    for (const s of d.flightSegments ?? []) {
      if (!s.departure || !s.arrival || s.activityCode === 'IR') continue;
      const [a, b] = [s.departure, s.arrival].sort();
      const key = `${a}-${b}`;
      const cur = map.get(key) ?? { key, a, b, count: 0, worst: 'low' as RiskLevel, worstKss: null };
      cur.count += 1;
      if (ORDER.indexOf(level) > ORDER.indexOf(cur.worst)) cur.worst = level;
      if (kss != null && (cur.worstKss == null || kss > cur.worstKss)) cur.worstKss = kss;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

/** Keyless route globe + frequency table. Renders nothing without flight sectors. */
export function RouteNetwork({ duties, homeBase }: { duties: DutyAnalysis[]; homeBase: string }) {
  const stats = useMemo(() => routeStats(duties), [duties]);
  const codes = useMemo(() => [...new Set(stats.flatMap((s) => [s.a, s.b]))], [stats]);
  const [airports, setAirports] = useState<Map<string, AirportData>>(new Map());

  useEffect(() => {
    if (!codes.length) return;
    let cancelled = false;
    getMultipleAirportsAsync(codes).then((m) => { if (!cancelled) setAirports(new Map(m)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [codes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stats.length) return null;

  const base = airports.get(homeBase);
  const maxCount = Math.max(...stats.map((s) => s.count));
  const routes: GlobeRoute[] = stats.flatMap((s) => {
    const a = airports.get(s.a);
    const b = airports.get(s.b);
    if (!a || !b) return [];
    return [{
      from: [a.lng, a.lat] as [number, number],
      to: [b.lng, b.lat] as [number, number],
      color: riskCssColor(s.worst),
      width: 1.25 + 2.25 * (s.count / maxCount),
      title: `${s.a} – ${s.b}: ${s.count} sectors, worst ${RISK_LEVEL_LABELS[s.worst]}`,
    }];
  });
  const globeAirports = codes
    .map((c) => airports.get(c))
    .filter((a): a is AirportData => !!a)
    .map((a) => ({ code: a.code, lat: a.lat, lng: a.lng, emphasis: a.code === homeBase }));

  return (
    <section aria-labelledby="routes-heading" className="space-y-4">
      <SectionHeading id="routes-heading" title="Route network" aside={`${stats.length} routes · ${codes.length} airports · drag to rotate`} />
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[420px]">
          <Globe
            airports={globeAirports}
            routes={routes}
            center={base ? [base.lng, base.lat] : undefined}
            ariaLabel={`Globe of ${stats.length} routes flown this month`}
          />
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 font-medium">Route</th>
              <th className="py-2 text-right font-medium">Sectors</th>
              <th className="py-2 text-right font-medium">Worst KSS</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.key} className="border-b border-border/60">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-[3px] w-4" style={{ backgroundColor: riskCssColor(s.worst) }} />
                    <span className="font-mono">{s.a} – {s.b}</span>
                  </span>
                </td>
                <td className="py-2 text-right font-mono tabular">{s.count}</td>
                <td className="py-2 text-right font-mono tabular">
                  {s.worstKss != null ? s.worstKss.toFixed(1) : '—'}
                  <span className="sr-only"> ({RISK_LEVEL_LABELS[s.worst]})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
