import { useMemo } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { riskCssColor } from '@/lib/risk-scale';
import { useMeasuredWidth } from '../useMeasuredWidth';
import { formatKssValue, kssBand } from '../landingKss';
import { TOUR_AIRPORTS, TOUR_BASE } from '../tourData';
import { aggregateRoutes } from '../tourModel';
import { BandTag } from '../BandTag';

const topology = land110 as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(topology, topology.objects.land) as unknown as FeatureCollection<Geometry>;
const ROUTES = aggregateRoutes();
const CODES = Object.keys(TOUR_AIRPORTS);
/** Label offsets that keep close airports (LHR/CDG, DOH/MCT) and edge airports readable. */
const LABEL: Record<string, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  LHR: { dx: 0, dy: -9, anchor: 'middle' },
  CDG: { dx: 6, dy: 13, anchor: 'start' },
  IST: { dx: 7, dy: -5, anchor: 'start' },
  NJF: { dx: -7, dy: -5, anchor: 'end' },
  DOH: { dx: 8, dy: -6, anchor: 'start' },
  MCT: { dx: 7, dy: 12, anchor: 'start' },
  BKK: { dx: 0, dy: -9, anchor: 'end' },
};

/** Routes: the month's network on a keyless flat map, each pair coloured by its worst duty peak. */
export function RoutesPreview() {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(320);
  const h = Math.round(width * 0.62);
  const { path, project } = useMemo(() => {
    const projection = geoEquirectangular().fitExtent([[26, 26], [width - 22, h - 22]], {
      type: 'MultiPoint', coordinates: CODES.map((c) => TOUR_AIRPORTS[c]),
    });
    return { path: geoPath(projection), project: (c: string) => projection(TOUR_AIRPORTS[c]) ?? [0, 0] };
  }, [width, h]);
  const drawOrder = [...ROUTES].reverse();

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
    <div ref={ref} className="overflow-hidden rounded-xl border border-[color:var(--lp-dbe7ed)] bg-[color:var(--lp-eef4f7)]">
      <svg width={width} height={h} role="img" aria-label={`Route map with ${ROUTES.length} routes from ${TOUR_BASE.code}`} className="block max-w-full">
        <path d={path(LAND) ?? ''} fill="var(--lp-d7e3ea)" stroke="var(--lp-c3d3dc)" strokeWidth={0.6} />
        {drawOrder.map((r) => <path key={r.key} d={path({ type: 'LineString', coordinates: [TOUR_AIRPORTS[r.from], TOUR_AIRPORTS[r.to]] }) ?? ''} fill="none" stroke="var(--lp-eef4f7)" strokeWidth={5} strokeLinecap="round" />)}
        {drawOrder.map((r) => <path key={`${r.key}-c`} d={path({ type: 'LineString', coordinates: [TOUR_AIRPORTS[r.from], TOUR_AIRPORTS[r.to]] }) ?? ''} fill="none" style={{ stroke: kssBand(r.worstKss) === 'low' ? 'var(--lp-6b8196)' : riskCssColor(kssBand(r.worstKss)) }} strokeWidth={2.25} strokeLinecap="round" />)}
        {CODES.map((code) => {
          const [px, py] = project(code);
          const base = code === TOUR_BASE.code;
          return <g key={code}>
            <circle cx={px} cy={py} r={base ? 5 : 3.5} fill="var(--lp-fcfdfe)" stroke="var(--lp-142e45)" strokeWidth={base ? 2 : 1.5} />
            <text x={px + LABEL[code].dx} y={py + LABEL[code].dy} textAnchor={LABEL[code].anchor} className="fill-[color:var(--lp-142e45)] font-mono text-[10px] font-semibold" style={{ paintOrder: 'stroke', stroke: 'var(--lp-eef4f7)', strokeWidth: 3 }}>{code}</text>
          </g>;
        })}
      </svg>
    </div>
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Routes flown this month with the worst duty peak on each</caption>
        <thead><tr className="border-b border-[color:var(--lp-dbe7ed)] text-left text-[11px] uppercase tracking-[0.08em] text-[color:var(--lp-526579)]"><th scope="col" className="pb-2 font-medium">Route</th><th scope="col" className="pb-2 text-right font-medium">Sectors</th><th scope="col" className="pb-2 text-right font-medium">Worst KSS</th></tr></thead>
        <tbody>{ROUTES.map((r) => <tr key={r.key} className="border-b border-[color:var(--lp-e6eef2)] last:border-0">
          <th scope="row" className="py-2 text-left font-mono text-xs font-medium text-[color:var(--lp-142e45)]">{r.from} ⇄ {r.to}</th>
          <td className="py-2 text-right font-mono text-xs text-[color:var(--lp-425d73)]">{r.sectors}</td>
          <td className="py-2 text-right"><span className="font-mono text-xs text-[color:var(--lp-142e45)]">{formatKssValue(r.worstKss)}</span> <BandTag kss={r.worstKss} className="ml-1.5" /></td>
        </tr>)}</tbody>
      </table>
      <p className="mt-3 text-xs leading-5 text-[color:var(--lp-526579)]">Colours show the peak across each whole duty, not a sector-specific prediction.</p>
    </div>
  </div>;
}
