import { describe, expect, it } from 'vitest';
import { geoDistance } from 'd3-geo';
import {
  boundsCentre,
  clampFlat,
  fitFlat,
  fitFlatView,
  fitGlobe,
  flatArc,
  flatProjection,
  flatViewFromBase,
  globeArc,
  globePoint,
  globeProjection,
  greatCircleNm,
  interpolateGlobeView,
  limbOpacity,
  nightCircles,
  panGlobe,
  subsolarPoint,
  upNormal,
  zoomFlatAt,
  zoomGlobeAt,
  type LngLat,
  type Size,
} from '@/lib/map-geometry';

const DOH: LngLat = [51.61, 25.26];
const AUH: LngLat = [54.65, 24.43];
const BAH: LngLat = [50.63, 26.27];
const KWI: LngLat = [47.97, 29.24];
const SHJ: LngLat = [55.52, 25.33];
const NJF: LngLat = [44.4, 31.99];
const TRV: LngLat = [76.92, 8.48];
const JFK: LngLat = [-73.78, 40.64];
const SIZE: Size = { w: 700, h: 440 };
const R0 = 200;

const inside = (p: [number, number], size: Size, pad: number) =>
  p[0] >= pad - 0.5 && p[0] <= size.w - pad + 0.5 && p[1] >= pad - 0.5 && p[1] <= size.h - pad + 0.5;

describe('great-circle helpers', () => {
  it('measures DOH–AUH at about 173 NM', () => {
    expect(greatCircleNm(DOH, AUH)).toBeGreaterThan(165);
    expect(greatCircleNm(DOH, AUH)).toBeLessThan(180);
  });

  it('centres bounds across the antimeridian', () => {
    const [lng] = boundsCentre([[170, 0], [-170, 10]]);
    expect(Math.abs(Math.abs(lng) - 180)).toBeLessThan(1e-6);
    expect(boundsCentre([DOH])).toEqual(DOH);
  });
});

describe('globe fit and zoom', () => {
  it('fits a Gulf short-haul network with every airport inside the padded frame', () => {
    const pts = [DOH, SHJ, AUH, BAH, KWI];
    const view = fitGlobe(pts, SIZE, R0, { pad: 48 });
    expect(view.k).toBeGreaterThan(10);
    const proj = globeProjection(view, SIZE, R0);
    for (const p of pts) expect(inside(proj(p) as [number, number], SIZE, 48)).toBe(true);
  });

  it('fits the October network at a moderate zoom', () => {
    const pts = [DOH, NJF, TRV, AUH];
    const view = fitGlobe(pts, SIZE, R0, { pad: 48, routes: [[DOH, NJF], [DOH, TRV], [DOH, AUH]] });
    expect(view.k).toBeGreaterThan(2.5);
    expect(view.k).toBeLessThan(6);
    const proj = globeProjection(view, SIZE, R0);
    for (const p of pts) expect(inside(proj(p) as [number, number], SIZE, 48)).toBe(true);
  });

  it('keeps asymmetric padding clear (room for map controls)', () => {
    const pad = { top: 60, right: 90, bottom: 40, left: 40 };
    const pts = [DOH, NJF, TRV];
    const view = fitGlobe(pts, SIZE, R0, { pad });
    const proj = globeProjection(view, SIZE, R0);
    for (const p of pts) {
      const [x, y] = proj(p) as [number, number];
      expect(x).toBeLessThanOrEqual(SIZE.w - pad.right + 0.5);
      expect(x).toBeGreaterThanOrEqual(pad.left - 0.5);
      expect(y).toBeGreaterThanOrEqual(pad.top - 0.5);
    }
  });

  it('falls back to the whole globe when the network spans more than a hemisphere', () => {
    expect(fitGlobe([DOH, JFK, [151.18, -33.95]], SIZE, R0).k).toBe(1);
  });

  it('keeps the ground under the anchor fixed while zooming', () => {
    const view = fitGlobe([DOH, NJF, TRV], SIZE, R0);
    const anchor = { x: 420, y: 180 };
    const before = globeProjection(view, SIZE, R0, false).invert([anchor.x, anchor.y])!;
    const zoomed = zoomGlobeAt(view, 4, anchor, SIZE, R0);
    const after = globeProjection(zoomed, SIZE, R0, false)(before as LngLat)!;
    expect(Math.hypot(after[0] - anchor.x, after[1] - anchor.y)).toBeLessThan(0.5);
    expect(zoomed.k).toBeCloseTo(view.k * 4, 5);
  });

  it('clamps zoom and latitude', () => {
    const view = zoomGlobeAt({ rotate: [0, 0], k: 20 }, 10, { x: 350, y: 220 }, SIZE, R0);
    expect(view.k).toBe(24);
    expect(zoomGlobeAt({ rotate: [0, 0], k: 1 }, 0.1, { x: 350, y: 220 }, SIZE, R0).k).toBe(1);
    expect(panGlobe({ rotate: [0, 0], k: 1 }, 0, -10_000, R0).rotate[1]).toBe(80);
  });

  it('pans so the ground follows the pointer', () => {
    const view = { rotate: [-50, -25] as [number, number], k: 3 };
    const before = globePoint(DOH, view, SIZE, R0);
    const after = globePoint(DOH, panGlobe(view, 30, 0, R0), SIZE, R0);
    expect(after.x - before.x).toBeGreaterThan(25);
    expect(after.x - before.x).toBeLessThan(35);
  });

  it('fades markers at the limb and hides them behind it', () => {
    expect(limbOpacity(1)).toBe(1);
    expect(limbOpacity(Math.cos((89 * Math.PI) / 180))).toBe(0);
    const o = limbOpacity(Math.cos((82 * Math.PI) / 180));
    expect(o).toBeGreaterThan(0);
    expect(o).toBeLessThan(1);
  });

  it('interpolates views from start to end', () => {
    const a = { rotate: [-50, -25] as [number, number], k: 1 };
    const b = { rotate: [-10, -40] as [number, number], k: 8 };
    const f = interpolateGlobeView(a, b);
    expect(f(0).k).toBeCloseTo(1);
    expect(f(1).k).toBeCloseTo(8);
    expect(f(1).rotate[0]).toBeCloseTo(-10);
    expect(f(0.5).k).toBeCloseTo(Math.sqrt(8));
  });
});

describe('lifted arcs', () => {
  const view = { rotate: [-51.6, -25.3] as [number, number], k: 1 };

  it('starts and ends on the airport projections', () => {
    const runs = globeArc(DOH, TRV, view, SIZE, R0);
    expect(runs.front).toHaveLength(1);
    const run = runs.front[0];
    const a = globePoint(DOH, view, SIZE, R0);
    const b = globePoint(TRV, view, SIZE, R0);
    expect(Math.hypot(run[0][0] - a.x, run[0][1] - a.y)).toBeLessThan(0.01);
    expect(Math.hypot(run[run.length - 1][0] - b.x, run[run.length - 1][1] - b.y)).toBeLessThan(0.01);
  });

  it('lifts the middle of the arc away from the ground track', () => {
    const runs = globeArc(DOH, TRV, { rotate: [0, 0], k: 1 }, SIZE, R0);
    const run = runs.front[0];
    const mid = run[Math.floor(run.length / 2)];
    const ground = globePoint([64.5, 17.2], { rotate: [0, 0], k: 1 }, SIZE, R0);
    const cx = SIZE.w / 2;
    const cy = SIZE.h / 2;
    expect(Math.hypot(mid[0] - cx, mid[1] - cy)).toBeGreaterThan(Math.hypot(ground.x - cx, ground.y - cy));
  });

  it('draws nothing in front for an arc wholly behind the globe', () => {
    const behind = { rotate: [-51.6 + 180, 25.3] as [number, number], k: 1 };
    const runs = globeArc(DOH, AUH, behind, SIZE, R0);
    expect(runs.front).toHaveLength(0);
    expect(runs.limb).toHaveLength(0);
    expect(runs.back.length).toBeGreaterThan(0);
  });

  it('rises over the limb before an arc to a far airport passes behind the globe', () => {
    // Seen from above Doha, JFK is more than 90° away.
    expect(geoDistance(DOH, JFK)).toBeGreaterThan(Math.PI / 2);
    const runs = globeArc(DOH, JFK, view, SIZE, R0);
    expect(runs.front).toHaveLength(1);
    expect(runs.limb).toHaveLength(1);
    expect(runs.back.length).toBeGreaterThan(0);
    // The piece beyond the limb is outside the disc, then meets the limb where the globe hides it.
    const dist = ([x, y]: [number, number]) => Math.hypot(x - SIZE.w / 2, y - SIZE.h / 2);
    expect(Math.max(...runs.limb[0].map(dist))).toBeGreaterThan(R0 * 1.02);
    expect(dist(runs.limb[0][runs.limb[0].length - 1])).toBeCloseTo(R0, 0);
  });

  it('bows chords upwards on screen', () => {
    expect(upNormal(10, 0).y).toBeLessThan(0);
    expect(upNormal(-10, 0).y).toBeLessThan(0);
    expect(upNormal(10, 10).y).toBeLessThan(0);
  });
});

describe('flat map', () => {
  it('fits the network with padding and a minimum span', () => {
    const pts = [DOH, SHJ, AUH, BAH, KWI];
    const base = fitFlat(pts, SIZE, { pad: 48 });
    const proj = flatProjection(base, flatViewFromBase(base), SIZE);
    for (const p of pts) expect(inside(proj(p) as [number, number], SIZE, 48)).toBe(true);
    // A single-airport "network" still gets a sensible 3° window.
    const single = fitFlat([DOH], SIZE, { pad: 48 });
    expect(single.s0 * (Math.PI / 180) * 3).toBeLessThanOrEqual(SIZE.h - 96 + 0.5);
  });

  it('zooms about the anchor and clamps to the world', () => {
    const base = fitFlat([DOH, NJF, TRV], SIZE);
    const view = flatViewFromBase(base);
    const anchor = { x: 200, y: 150 };
    const geo = flatProjection(base, view, SIZE).invert([anchor.x, anchor.y])!;
    const zoomed = zoomFlatAt(view, 2, anchor, base, SIZE);
    const back = flatProjection(base, zoomed, SIZE)(geo as LngLat)!;
    expect(Math.hypot(back[0] - anchor.x, back[1] - anchor.y)).toBeLessThan(0.5);
    const out = zoomFlatAt(view, 1e-6, anchor, base, SIZE);
    expect(out.k).toBeCloseTo(base.kMin);
    expect(out.x).toBeCloseTo(SIZE.w / 2);
  });

  it('never pans the map off the viewport', () => {
    const base = fitFlat([DOH, NJF], SIZE);
    const clamped = clampFlat({ k: 1, x: 1e7, y: -1e7 }, base, SIZE);
    const s = base.s0;
    expect(clamped.x - Math.PI * s).toBeLessThanOrEqual(0);
    expect(clamped.y + (Math.PI / 2) * s).toBeGreaterThanOrEqual(SIZE.h);
  });

  it('frames a selected pair', () => {
    const base = fitFlat([DOH, NJF, TRV, AUH], SIZE);
    const view = fitFlatView([DOH, AUH], base, SIZE, 60);
    const proj = flatProjection(base, view, SIZE);
    for (const p of [DOH, AUH]) expect(inside(proj(p) as [number, number], SIZE, 60)).toBe(true);
  });

  it('bows a route and keeps its endpoints', () => {
    const base = fitFlat([DOH, NJF], SIZE);
    const proj = flatProjection(base, flatViewFromBase(base), SIZE);
    const [run] = flatArc(DOH, NJF, proj);
    const a = proj(DOH)!;
    expect(Math.hypot(run[0][0] - a[0], run[0][1] - a[1])).toBeLessThan(0.01);
  });
});

describe('sun', () => {
  it('puts the June solstice noon sun over the Tropic of Cancer at Greenwich', () => {
    const [lng, lat] = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
    expect(lat).toBeGreaterThan(23.1);
    expect(lat).toBeLessThan(23.7);
    expect(Math.abs(lng)).toBeLessThan(2.5);
  });

  it('centres night on the antisolar point', () => {
    const date = new Date('2026-03-20T00:00:00Z');
    const [lng] = subsolarPoint(date);
    expect(Math.abs(Math.abs(lng) - 180)).toBeLessThan(3);
    expect(nightCircles(date)).toHaveLength(7);
  });
});
