/**
 * Land and graticule layers for the keyless maps (Natural Earth via world-atlas).
 *
 * 1:110m land ships with the page (≈21 KB gzip). 1:50m land (≈174 KB gzip) is
 * a separate chunk, fetched only once a pilot zooms past ~4× and drawn only
 * while the map is at rest, so gestures stay on the light layer.
 */
import { geoGraticule } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiLineString } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { decimateGeometry } from '@/lib/map-geometry';

type LandTopology = Topology<{ land: GeometryCollection }>;

export function landFromTopology(topology: unknown): FeatureCollection<Geometry> {
  const topo = topology as LandTopology;
  return feature(topo, topo.objects.land) as unknown as FeatureCollection<Geometry>;
}

export const LAND_110 = landFromTopology(land110);

/** Every second vertex of long rings: invisible on a hero-sized globe, ~35% less work per frame. */
export const LAND_110_LITE: FeatureCollection<Geometry> = {
  type: 'FeatureCollection',
  features: LAND_110.features.map((f: Feature<Geometry>) => ({ ...f, geometry: decimateGeometry(f.geometry, 2) })),
};

/** Pixels per degree from which the 1:50m coastline is worth drawing (≈4× the world view). */
export const DETAIL_PX_PER_DEG = 12;

let detailed: FeatureCollection<Geometry> | null = null;
let detailedJob: Promise<FeatureCollection<Geometry>> | null = null;

export const getDetailedLand = () => detailed;

export function loadDetailedLand(): Promise<FeatureCollection<Geometry>> {
  detailedJob ??= import('world-atlas/land-50m.json')
    .then((m) => {
      detailed = landFromTopology((m as { default?: unknown }).default ?? m);
      return detailed;
    })
    .catch((error) => {
      detailedJob = null; // offline: keep the light layer and retry on the next zoom
      throw error;
    });
  return detailedJob;
}

const graticules = new Map<string, MultiLineString>();

/**
 * Graticule spacing that stays useful as the map zooms (30° → 10° → 5° → 2°;
 * 15° on the hero). Finer grids cover only a window around the view centre, so the
 * per-frame cost stays flat however far the map is zoomed.
 */
export function graticuleFor(pxPerDeg: number, centre: [number, number], coarse = false): MultiLineString {
  const step = coarse ? 15 : pxPerDeg > 45 ? 2 : pxPerDeg > 12 ? 5 : pxPerDeg < 3 ? 30 : 10;
  if (step >= 10) {
    const key = String(step);
    let g = graticules.get(key);
    if (!g) {
      g = geoGraticule().step([step, step]).precision(2.5)();
      graticules.set(key, g);
    }
    return g;
  }
  const snap = step * 5;
  const lng = Math.round(centre[0] / snap) * snap;
  const lat = Math.round(centre[1] / snap) * snap;
  const key = `${step}:${lng}:${lat}`;
  let g = graticules.get(key);
  if (!g) {
    const dx = step * 12;
    const dy = step * 8;
    g = geoGraticule()
      .extent([[lng - dx, Math.max(-85, lat - dy)], [lng + dx, Math.min(85, lat + dy)]])
      .step([step, step])
      .precision(1)();
    if (graticules.size > 24) graticules.clear();
    graticules.set(key, g);
  }
  return g;
}
