/**
 * Pure map geometry for the keyless route globe and flat map.
 *
 * Everything here works in CSS pixels and plain numbers so it can be unit
 * tested without React or the DOM. Conventions:
 * - Geographic points are `[longitude, latitude]` in degrees (GeoJSON order).
 * - A globe view is a d3 rotation plus a zoom factor `k` over the base
 *   radius `r0`; the visible centre is `[-rotate[0], -rotate[1]]`.
 * - A flat view is a zoom factor and translate over a fitted
 *   equirectangular base (`FlatBase`).
 */
import {
  geoBounds,
  geoCircle,
  geoDistance,
  geoEquirectangular,
  geoInterpolate,
  geoOrthographic,
  geoRotation,
  type GeoProjection,
} from 'd3-geo';
import type { Geometry, MultiPolygon, Polygon, Position } from 'geojson';

export type LngLat = [number, number];
export interface Size { w: number; h: number }
export interface ScreenPoint { x: number; y: number }
export interface GlobeView { rotate: [number, number]; k: number }
export interface FlatView { k: number; x: number; y: number }
export interface FlatBase {
  /** d3 rotation that centres the network's longitude. */
  rotate: [number, number];
  /** Scale (px per radian) at k = 1. */
  s0: number;
  /** Translate at k = 1. */
  t0: [number, number];
  kMin: number;
  kMax: number;
}

/** Padding around a fitted view, in px (a number applies to every side). */
export type Pad = number | { top: number; right: number; bottom: number; left: number };
export const padSides = (pad: Pad) => (typeof pad === 'number' ? { top: pad, right: pad, bottom: pad, left: pad } : pad);

export const DEG = 180 / Math.PI;
export const RAD = Math.PI / 180;
/** Mean Earth radius in nautical miles (great-circle distances). */
export const EARTH_RADIUS_NM = 3440.065;
export const GLOBE_K_MAX = 24;
export const GLOBE_LAT_LIMIT = 80;
/** Beyond this angular distance from the view centre a point is on the limb. */
export const LIMB_HIDE_DEG = 88;
export const LIMB_FADE_DEG = 75;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Wrap a longitude difference into [-180, 180). */
export const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Great-circle distance in nautical miles. */
export function greatCircleNm(a: LngLat, b: LngLat): number {
  return geoDistance(a, b) * EARTH_RADIUS_NM;
}

/** Centre of the geographic bounding box, correct across the antimeridian. */
export function boundsCentre(points: LngLat[]): LngLat {
  if (!points.length) return [0, 20];
  if (points.length === 1) return [points[0][0], points[0][1]];
  const [[x0, y0], [x1, y1]] = geoBounds({ type: 'MultiPoint', coordinates: points });
  const lng = x0 <= x1 ? (x0 + x1) / 2 : (((x0 + x1 + 360) / 2 + 180) % 360) - 180;
  return [lng, (y0 + y1) / 2];
}

/** Sample every route along its great circle so fits include poleward bulges. */
export function sampleRoutes(routes: Array<[LngLat, LngLat]>, steps = 16): LngLat[] {
  const out: LngLat[] = [];
  for (const [a, b] of routes) {
    const it = geoInterpolate(a, b);
    for (let i = 1; i < steps; i++) out.push(it(i / steps) as LngLat);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Globe (orthographic)
// ---------------------------------------------------------------------------

/** Radius of the whole globe at k = 1, as a fraction of the smaller side. */
export function globeRadius(size: Size, fill = 0.92): number {
  return Math.max(24, (Math.min(size.w, size.h) / 2) * fill);
}

/** Angular radius (degrees) of the part of the sphere inside the viewport. */
export function visibleCapDeg(view: GlobeView, size: Size, r0: number): number {
  const ratio = Math.hypot(size.w, size.h) / 2 / (r0 * view.k);
  return ratio >= 0.98 ? 90 : Math.min(90, Math.asin(ratio) * DEG + 3);
}

export function globeProjection(view: GlobeView, size: Size, r0: number, clipToViewport = true): GeoProjection {
  const p = geoOrthographic()
    .rotate(view.rotate)
    .scale(r0 * view.k)
    .translate([size.w / 2, size.h / 2]);
  const cap = clipToViewport ? visibleCapDeg(view, size, r0) : 90;
  p.clipAngle(cap);
  if (clipToViewport && view.k > 1.05) p.clipExtent([[-4, -4], [size.w + 4, size.h + 4]]);
  return p;
}

/** Visible centre `[lng, lat]` of a globe view. */
export const globeCentre = (view: GlobeView): LngLat => [wrapDeg(-view.rotate[0]), -view.rotate[1]];

export function globeViewAt(centre: LngLat, k = 1): GlobeView {
  return { rotate: [-centre[0], -clamp(centre[1], -GLOBE_LAT_LIMIT, GLOBE_LAT_LIMIT)], k };
}

/**
 * Fit a globe view to a set of airports (and their great-circle routes).
 * Falls back to the whole-globe view when anything is more than 80° from the
 * centre, where the orthographic limb would swallow it.
 */
export function fitGlobe(
  points: LngLat[],
  size: Size,
  r0: number,
  opts: { routes?: Array<[LngLat, LngLat]>; pad?: Pad; kMax?: number; minDeg?: number } = {},
): GlobeView {
  const { routes = [], pad = 48, kMax = GLOBE_K_MAX, minDeg = 2.5 } = opts;
  const sides = padSides(pad);
  if (!points.length) return globeViewAt([0, 20], 1);
  const centre = boundsCentre(points);
  const samples = [...points, ...sampleRoutes(routes)];
  if (samples.some((p) => geoDistance(centre, p) > 80 * RAD)) {
    return globeViewAt([centre[0], clamp(centre[1], -60, 60)], 1);
  }
  const rot = geoRotation([-centre[0], -centre[1]]);
  const floor = Math.sin(minDeg * RAD);
  let mx = floor;
  let my = floor;
  for (const p of samples) {
    const [l, f] = rot(p);
    mx = Math.max(mx, Math.abs(Math.cos(f * RAD) * Math.sin(l * RAD)) * 1.04);
    my = Math.max(my, Math.abs(Math.sin(f * RAD)) * 1.04);
  }
  const halfW = Math.max(8, (size.w - sides.left - sides.right) / 2);
  const halfH = Math.max(8, (size.h - sides.top - sides.bottom) / 2);
  const k = clamp(Math.min(halfW / (r0 * mx), halfH / (r0 * my)), 1, kMax);
  const view = globeViewAt(centre, k);
  // Centre the network in the padded area rather than the whole viewport.
  return k > 1 ? panGlobe(view, (sides.left - sides.right) / 2, (sides.top - sides.bottom) / 2, r0) : view;
}

/** Pan a globe by a screen delta so the ground follows the pointer at any zoom. */
export function panGlobe(view: GlobeView, dx: number, dy: number, r0: number): GlobeView {
  const s = (DEG / (r0 * view.k));
  return {
    k: view.k,
    rotate: [wrapDeg(view.rotate[0] + dx * s), clamp(view.rotate[1] - dy * s, -GLOBE_LAT_LIMIT, GLOBE_LAT_LIMIT)],
  };
}

/**
 * Zoom a globe by `factor`, keeping the ground under `anchor` fixed.
 * Anchors outside the disc zoom about the centre instead.
 */
export function zoomGlobeAt(
  view: GlobeView,
  factor: number,
  anchor: ScreenPoint,
  size: Size,
  r0: number,
  kMax = GLOBE_K_MAX,
): GlobeView {
  const k2 = clamp(view.k * factor, 1, kMax);
  if (k2 === view.k) return view;
  const cx = size.w / 2;
  const cy = size.h / 2;
  const d = Math.hypot(anchor.x - cx, anchor.y - cy);
  const m: [number, number] = d < r0 * Math.min(view.k, k2) * 0.97 ? [anchor.x, anchor.y] : [cx, cy];
  const g = globeProjection(view, size, r0, false).invert(m);
  let rotate: [number, number] = [view.rotate[0], view.rotate[1]];
  if (!g || !Number.isFinite(g[0])) return { rotate, k: k2 };
  for (let i = 0; i < 4; i++) {
    const g2 = globeProjection({ rotate, k: k2 }, size, r0, false).invert(m);
    if (!g2 || !Number.isFinite(g2[0])) break;
    rotate = [
      wrapDeg(rotate[0] + wrapDeg(g2[0] - g[0])),
      clamp(rotate[1] + (g2[1] - g[1]), -GLOBE_LAT_LIMIT, GLOBE_LAT_LIMIT),
    ];
  }
  return { rotate, k: k2 };
}

/** Screen position of a point on the globe, with its depth (cos of the angle from the centre). */
export function globePoint(p: LngLat, view: GlobeView, size: Size, r0: number, lift = 1) {
  const [l, f] = geoRotation(view.rotate)(p).map((v) => v * RAD);
  const x = Math.cos(f) * Math.sin(l);
  const y = Math.sin(f);
  const z = Math.cos(f) * Math.cos(l);
  const s = r0 * view.k * lift;
  return { x: size.w / 2 + s * x, y: size.h / 2 - s * y, z };
}

/** Opacity of a marker near the limb: 1 in front, fading to 0 at 88°. */
export function limbOpacity(depth: number): number {
  const deg = Math.acos(clamp(depth, -1, 1)) * DEG;
  return 1 - smoothstep(LIMB_FADE_DEG, LIMB_HIDE_DEG, deg);
}

export function globePxPerDeg(view: GlobeView, r0: number): number {
  return r0 * view.k * RAD;
}

// ---------------------------------------------------------------------------
// Arcs
// ---------------------------------------------------------------------------

/** Peak arc altitude as a fraction of the Earth radius: short hops low, long haul high. */
export function arcHeight(distanceRad: number): number {
  return 0.04 + 0.18 * Math.min(1, distanceRad / Math.PI);
}

/** Unit normal of a chord, always pointing up the screen so arcs bow like a rainbow. */
export function upNormal(dx: number, dy: number): ScreenPoint {
  const len = Math.hypot(dx, dy) || 1;
  let nx = dy / len;
  let ny = -dx / len;
  if (ny > 1e-9 || (Math.abs(ny) <= 1e-9 && nx < 0)) { nx = -nx; ny = -ny; }
  return { x: nx, y: ny };
}

export type Run = Array<[number, number]>;
/**
 * Arc pieces by depth: `front` faces the viewer, `limb` is behind the centre
 * plane but still seen beyond the edge of the disc (drawn fainter), `back` is
 * hidden by the globe.
 */
export interface ArcRuns { front: Run[]; limb: Run[]; back: Run[] }

export const runsToPath = (runs: Run[]) =>
  runs.filter((r) => r.length > 1).map((r) => `M${r.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}`).join('');

/**
 * Lifted great-circle arc on an orthographic globe.
 *
 * Each sample on the great circle is raised radially by h·sin(πt), which is
 * the same as projecting it with the scale multiplied by (1 + h). A lifted
 * sample is hidden only when it is behind the centre plane (z < 0) and inside
 * the disc silhouette, so arcs rise visibly over the limb. Near the view
 * centre a radial lift is foreshortened to nothing, so zoomed-in views blend in
 * a screen-space bow (`bow` = 0…1).
 */
export function globeArc(a: LngLat, b: LngLat, view: GlobeView, size: Size, r0: number, bow = 0): ArcRuns {
  const out: ArcRuns = { front: [], limb: [], back: [] };
  const d = geoDistance(a, b);
  if (!(d > 1e-6)) return out;
  const h = arcHeight(d);
  const n = clamp(Math.ceil((d * DEG) / 2), 12, 64);
  const it = geoInterpolate(a, b);
  const rot = geoRotation(view.rotate);
  const s = r0 * view.k;
  const cx = size.w / 2;
  const cy = size.h / 2;
  const kinds = ['front', 'limb', 'back'] as const;
  const sample = (t: number) => {
    const [l, f] = rot(it(t)).map((v) => v * RAD);
    const lift = 1 + h * Math.sin(Math.PI * t);
    const x = Math.cos(f) * Math.sin(l);
    const y = Math.sin(f);
    const z = Math.cos(f) * Math.cos(l);
    const kind = z >= 0 ? 0 : lift * Math.hypot(x, y) > 1 ? 1 : 2;
    return { sx: cx + s * lift * x, sy: cy - s * lift * y, kind };
  };
  const start = sample(0);
  const end = sample(1);
  const chord = Math.hypot(end.sx - start.sx, end.sy - start.sy);
  const normal = upNormal(end.sx - start.sx, end.sy - start.sy);
  // Bow only chords whose ends are both in view; arcs to the far side rise over the limb in 3D.
  const bowPx = start.kind === 0 && end.kind === 0 ? bow * 0.18 * chord : 0;
  const point = (t: number, q = sample(t)): [number, number] => {
    const o = bowPx * Math.sin(Math.PI * t);
    return [q.sx + normal.x * o, q.sy + normal.y * o];
  };
  let run: Run = [point(0, start)];
  let prevT = 0;
  let prevKind = start.kind;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const q = sample(t);
    if (q.kind !== prevKind) {
      // Bisect for the exact crossing so pieces meet cleanly at the limb.
      let lo = prevT;
      let hi = t;
      for (let j = 0; j < 6; j++) {
        const mid = (lo + hi) / 2;
        if (sample(mid).kind === prevKind) lo = mid; else hi = mid;
      }
      const edge = point((lo + hi) / 2);
      run.push(edge);
      out[kinds[prevKind]].push(run);
      run = [edge];
      prevKind = q.kind;
    }
    run.push(point(t, q));
    prevT = t;
  }
  out[kinds[prevKind]].push(run);
  return out;
}

// ---------------------------------------------------------------------------
// Flat map (equirectangular)
// ---------------------------------------------------------------------------

/** Fit an equirectangular base to the network, with a minimum span and padding. */
export function fitFlat(
  points: LngLat[],
  size: Size,
  opts: { routes?: Array<[LngLat, LngLat]>; pad?: Pad; minDeg?: number } = {},
): FlatBase {
  const { routes = [], pad = 48, minDeg = 3 } = opts;
  const sides = padSides(pad);
  const centre = boundsCentre(points.length ? points : [[0, 20]]);
  const rotate: [number, number] = [-centre[0], 0];
  const samples = [...points, ...sampleRoutes(routes)];
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const [lng, lat] of samples.length ? samples : [centre]) {
    const l = wrapDeg(lng - centre[0]);
    x0 = Math.min(x0, l); x1 = Math.max(x1, l);
    y0 = Math.min(y0, lat); y1 = Math.max(y1, lat);
  }
  const spanX = Math.max(x1 - x0, minDeg);
  const spanY = Math.max(y1 - y0, minDeg);
  const w = Math.max(1, size.w - sides.left - sides.right);
  const h = Math.max(1, size.h - sides.top - sides.bottom);
  const s0 = Math.min(w / (spanX * RAD), h / (spanY * RAD));
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const sWorld = Math.min(size.w / (2 * Math.PI), size.h / Math.PI);
  return {
    rotate,
    s0,
    t0: [sides.left + w / 2 - s0 * mx * RAD, sides.top + h / 2 + s0 * my * RAD],
    kMin: Math.min(1, sWorld / s0),
    kMax: Math.max(1, (150 * DEG) / s0),
  };
}

export const flatViewFromBase = (base: FlatBase): FlatView => ({ k: 1, x: base.t0[0], y: base.t0[1] });

export function flatProjection(base: FlatBase, view: FlatView, size: Size): GeoProjection {
  return geoEquirectangular()
    .rotate(base.rotate)
    .scale(base.s0 * view.k)
    .translate([view.x, view.y])
    .clipExtent([[-4, -4], [size.w + 4, size.h + 4]]);
}

/** Keep the map covering the viewport; centre it on an axis where it is smaller. */
export function clampFlat(view: FlatView, base: FlatBase, size: Size): FlatView {
  const s = base.s0 * view.k;
  const halfW = Math.PI * s;
  const halfH = (Math.PI / 2) * s;
  const x = 2 * halfW <= size.w ? size.w / 2 : clamp(view.x, size.w - halfW, halfW);
  const y = 2 * halfH <= size.h ? size.h / 2 : clamp(view.y, size.h - halfH, halfH);
  return { k: view.k, x, y };
}

export function zoomFlatAt(view: FlatView, factor: number, anchor: ScreenPoint, base: FlatBase, size: Size): FlatView {
  const k2 = clamp(view.k * factor, base.kMin, base.kMax);
  const f = k2 / view.k;
  return clampFlat({ k: k2, x: anchor.x - (anchor.x - view.x) * f, y: anchor.y - (anchor.y - view.y) * f }, base, size);
}

export function panFlat(view: FlatView, dx: number, dy: number, base: FlatBase, size: Size): FlatView {
  return clampFlat({ k: view.k, x: view.x + dx, y: view.y + dy }, base, size);
}

/** Flat view that frames `points` within the existing base. */
export function fitFlatView(points: LngLat[], base: FlatBase, size: Size, pad: Pad = 56, minDeg = 1.5): FlatView {
  const inner = fitFlat(points, size, { pad, minDeg });
  const k = clamp(inner.s0 / base.s0, base.kMin, base.kMax);
  const sides = padSides(pad);
  const centre = boundsCentre(points);
  const l = wrapDeg(centre[0] + base.rotate[0]);
  const s = base.s0 * k;
  const cx = sides.left + (size.w - sides.left - sides.right) / 2;
  const cy = sides.top + (size.h - sides.top - sides.bottom) / 2;
  return clampFlat({ k, x: cx - s * l * RAD, y: cy + s * centre[1] * RAD }, base, size);
}

export const flatPxPerDeg = (base: FlatBase, view: FlatView) => base.s0 * view.k * RAD;

/**
 * Great-circle route on the flat map with a gentle screen-space bow.
 * Splits where the path would jump across the edge of the map.
 */
export function flatArc(a: LngLat, b: LngLat, projection: GeoProjection, bow = 1): Run[] {
  const d = geoDistance(a, b);
  if (!(d > 1e-6)) return [];
  const n = clamp(Math.ceil((d * DEG) / 2), 12, 64);
  const it = geoInterpolate(a, b);
  const jump = Math.PI * projection.scale();
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) pts.push(projection(it(i / n)) as [number, number]);
  const runs: Run[] = [[pts[0]]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][0] - pts[i - 1][0]) > jump) runs.push([]);
    runs[runs.length - 1].push(pts[i]);
  }
  if (runs.length > 1 || bow === 0) return runs;
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const normal = upNormal(ex - sx, ey - sy);
  const bowPx = bow * 0.18 * Math.hypot(ex - sx, ey - sy);
  return [pts.map(([x, y], i) => {
    const o = bowPx * Math.sin((Math.PI * i) / n);
    return [x + normal.x * o, y + normal.y * o] as [number, number];
  })];
}

// ---------------------------------------------------------------------------
// View interpolation (fly-to)
// ---------------------------------------------------------------------------

export const easeCubicInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function interpolateGlobeView(a: GlobeView, b: GlobeView): (t: number) => GlobeView {
  const centre = geoInterpolate(globeCentre(a), globeCentre(b));
  return (t) => {
    const c = centre(t) as LngLat;
    return globeViewAt(c, a.k * Math.pow(b.k / a.k, t));
  };
}

export function interpolateFlatView(a: FlatView, b: FlatView, size: Size): (t: number) => FlatView {
  // Interpolate the base-projection point under the viewport centre, and zoom geometrically.
  const ua = (size.w / 2 - a.x) / a.k;
  const va = (size.h / 2 - a.y) / a.k;
  const ub = (size.w / 2 - b.x) / b.k;
  const vb = (size.h / 2 - b.y) / b.k;
  return (t) => {
    const k = a.k * Math.pow(b.k / a.k, t);
    return { k, x: size.w / 2 - (ua + (ub - ua) * t) * k, y: size.h / 2 - (va + (vb - va) * t) * k };
  };
}

// ---------------------------------------------------------------------------
// Sun and terminator
// ---------------------------------------------------------------------------

/**
 * Subsolar point `[lng, lat]` for a UTC instant (NOAA low-precision formulae:
 * declination from the day of year, longitude corrected by the equation of
 * time). Accurate to a fraction of a degree, ample for a decorative terminator.
 */
export function subsolarPoint(date: Date): LngLat {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 864e5);
  const decl = -23.44 * Math.cos((2 * Math.PI * (day + 10)) / 365);
  const B = (2 * Math.PI * (day - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return [wrapDeg(-15 * (hours - 12 + eot / 60)), decl];
}

/** Night layer radii around the antisolar point: sunset (90°) down to astronomical twilight (72°). */
export const NIGHT_RADII = [90, 87, 84, 81, 78, 75, 72];

/**
 * Night polygons centred on the antisolar point, from sunset through civil,
 * nautical and astronomical twilight. Stacked at low opacity they give a soft
 * terminator that darkens towards true night.
 */
export function nightCircles(date: Date): Polygon[] {
  const [lng, lat] = subsolarPoint(date);
  const centre: LngLat = [wrapDeg(lng + 180), -lat];
  return NIGHT_RADII.map((r) => geoCircle().center(centre).radius(r).precision(2)() as Polygon);
}

// ---------------------------------------------------------------------------
// Land simplification for small, animated globes
// ---------------------------------------------------------------------------

function decimateRing(ring: Position[], step: number): Position[] {
  if (ring.length <= 24) return ring;
  const out = ring.filter((_, i) => i % step === 0);
  out.push(ring[ring.length - 1]);
  return out;
}

/** Keep every `step`-th vertex of long rings (always closing the ring). */
export function decimateGeometry<G extends Geometry>(g: G, step = 2): G {
  if (g.type === 'Polygon') return { ...g, coordinates: (g as Polygon).coordinates.map((r) => decimateRing(r, step)) };
  if (g.type === 'MultiPolygon') return { ...g, coordinates: (g as MultiPolygon).coordinates.map((p) => p.map((r) => decimateRing(r, step))) };
  return g;
}
