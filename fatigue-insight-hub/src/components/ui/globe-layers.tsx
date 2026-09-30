import type { PointerEvent as ReactPointerEvent } from 'react';
import { NIGHT_RADII } from '@/lib/map-geometry';
import type { Palette } from './globe-palette';
import type { GlobeAirport, GlobeRoute } from './globe';

/**
 * SVG structure of the globe and flat map. React renders the elements once
 * per data change; `draw()` in globe.tsx writes their geometry directly, found
 * through the data-* attributes below.
 */

export const FLOW_DASH = '3 13';
export const FLOW_PERIOD = 16;

interface GlobeLayersProps {
  uid: string;
  pal: Palette;
  flat: boolean;
  terminator: boolean;
  routes: GlobeRoute[];
  airports: GlobeAirport[];
  selectedKey: string | null;
  hoveredKey: string | null;
  flowFor: (key: string) => boolean;
  interactive: boolean;
  showLabels: boolean;
  onRouteHover: (key: string | null, e: ReactPointerEvent<SVGPathElement>) => void;
}

export function GlobeLayers({ uid, pal, flat, terminator, routes, airports, selectedKey, hoveredKey, flowFor, interactive, showLabels, onRouteHover }: GlobeLayersProps) {
  const selectedEnds = new Set(routes.find((r) => r.key === selectedKey)?.endpoints ?? []);
  const hasSelection = !!selectedKey && routes.some((r) => r.key === selectedKey);
  const gid = (name: string) => `${uid}-${name}`;
  const stops = (list: Array<[number, string, number]>) => list.map(([o, c, a], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={a} />);
  return (
    <>
      <defs>
        <radialGradient id={gid('halo')} data-grad="halo" gradientUnits="userSpaceOnUse">{stops(pal.haloStops)}</radialGradient>
        <radialGradient id={gid('ocean')} data-grad="ocean" gradientUnits="userSpaceOnUse">{stops(pal.oceanStops)}</radialGradient>
        <radialGradient id={gid('shade')} data-grad="shade" gradientUnits="userSpaceOnUse">{stops(pal.shadeStops)}</radialGradient>
        <radialGradient id={gid('rim')} data-grad="rim" gradientUnits="userSpaceOnUse">{stops(pal.rimStops)}</radialGradient>
      </defs>
      {!flat && <circle data-layer="halo" fill={`url(#${gid('halo')})`} />}
      <path data-layer="sphere" fill={flat ? pal.flatOcean[0] : `url(#${gid('ocean')})`} fillOpacity={flat ? pal.flatOcean[1] : 1}
        stroke={pal.sphereStroke[0]} strokeOpacity={flat ? 0 : pal.sphereStroke[1]} strokeWidth={1} />
      <path data-layer="graticule" fill="none" stroke={pal.graticule[0]} strokeOpacity={pal.graticule[1]} strokeWidth={0.6} />
      <path data-layer="land" fill={pal.land.fill} fillOpacity={pal.land.fillOpacity} stroke={pal.land.stroke}
        strokeOpacity={pal.land.strokeOpacity} strokeWidth={0.6} strokeLinejoin="round" />
      {terminator && NIGHT_RADII.map((r, i) => <path key={r} data-night={i} fill={pal.night} fillOpacity={pal.nightOpacity} />)}
      <path data-layer="shade" fill={`url(#${gid('shade')})`} pointerEvents="none" />
      <path data-layer="rim" fill={`url(#${gid('rim')})`} pointerEvents="none" />

      <g data-routes="">
        {routes.map((r) => {
          const width = r.width ?? 1.6;
          const selected = r.key === selectedKey;
          const hovered = r.key === hoveredKey;
          const dim = hasSelection && !selected;
          const w = width + (selected ? 2 : hovered ? 1 : 0);
          return (
            <g key={r.key} data-route={r.key} data-selected={selected || undefined} opacity={dim ? (hovered ? 0.6 : 0.25) : 1}>
              <path data-part="ground" fill="none" stroke={pal.ground[0]} strokeOpacity={pal.ground[1]} strokeWidth={1} strokeDasharray="1.5 3.5" />
              <path data-part="back" fill="none" stroke={r.color} strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 4" />
              {pal.casing && <path data-part="casing" fill="none" stroke={pal.casing} strokeOpacity={pal.casingOpacity} strokeWidth={w + pal.casingWidth} strokeLinecap="round" strokeLinejoin="round" />}
              <path data-part="line" fill="none" stroke={r.color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
              <path data-part="limb" fill="none" stroke={r.color} strokeOpacity={0.4} strokeWidth={Math.max(1, w - 0.4)} strokeLinecap="round" />
              {flowFor(r.key) && <path data-part="flow" fill="none" stroke={pal.flow} strokeOpacity={0.85}
                strokeWidth={Math.max(1, w - 0.6)} strokeDasharray={FLOW_DASH} strokeLinecap="round" />}
              {interactive && (
                <path data-part="hit" fill="none" stroke="transparent" strokeWidth={18} pointerEvents="stroke" style={{ cursor: 'pointer' }}
                  onPointerEnter={(e) => onRouteHover(r.key, e)} onPointerLeave={(e) => onRouteHover(null, e)}>
                  {r.title && <title>{r.title}</title>}
                </path>
              )}
            </g>
          );
        })}
      </g>

      <g data-markers="" pointerEvents="none">
        {airports.map((a) => {
          const dim = hasSelection && !selectedEnds.has(a.code) && !a.emphasis;
          return (
            <g key={a.code} opacity={dim ? 0.45 : 1}>
              <g data-marker={a.code} display="none">
                <circle r={a.emphasis ? 5.5 : 4} fill={pal.marker.fill} stroke={pal.marker.stroke} strokeWidth={a.emphasis ? 2.25 : 1.5} />
                {a.emphasis && <circle r={1.75} fill={pal.marker.stroke} />}
              </g>
            </g>
          );
        })}
      </g>

      {showLabels && (
        <g data-labels="" pointerEvents="none">
          {airports.map((a) => {
            const dim = hasSelection && !selectedEnds.has(a.code) && !a.emphasis;
            return (
              <g key={a.code} opacity={dim ? 0.5 : 1}>
                <text data-label={a.code} display="none" className="font-mono" fontSize={12} fontWeight={a.emphasis || selectedEnds.has(a.code) ? 600 : 500}
                  fill={pal.label.fill} stroke={pal.label.halo} strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke">
                  <tspan>{a.code}</tspan>
                  <tspan data-extra="" className="font-sans" fontSize={11} fontWeight={400} fillOpacity={0.78} />
                </text>
              </g>
            );
          })}
        </g>
      )}
    </>
  );
}
