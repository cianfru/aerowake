import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { geoPath, type GeoProjection } from 'd3-geo';
import type { Polygon } from 'geojson';
import { cn } from '@/lib/utils';
import { useMapGestures } from '@/hooks/useMapGestures';
import { motionBudget, prefersReducedMotion, useRunGate } from '@/hooks/useRunGate';
import {
  GLOBE_K_MAX,
  RAD,
  boundsCentre,
  clampFlat,
  easeCubicInOut,
  fitFlat,
  fitFlatView,
  fitGlobe,
  flatArc,
  flatPxPerDeg,
  flatProjection,
  flatViewFromBase,
  globeArc,
  globeCentre,
  globePoint,
  globeProjection,
  globePxPerDeg,
  globeRadius,
  globeViewAt,
  interpolateFlatView,
  interpolateGlobeView,
  limbOpacity,
  nightCircles,
  panFlat,
  panGlobe,
  runsToPath,
  smoothstep,
  zoomFlatAt,
  zoomGlobeAt,
  type FlatBase,
  type FlatView,
  type GlobeView,
  type LngLat,
  type Pad,
  type ScreenPoint,
  type Size,
} from '@/lib/map-geometry';
import { densify, estimateLabelWidth, placeLabels, type Box, type Cluster, type LabelItem } from '@/lib/map-labels';
import { DETAIL_PX_PER_DEG, LAND_110, LAND_110_LITE, getDetailedLand, graticuleFor, loadDetailedLand } from '@/lib/map-land';
import { MapZoomControls } from './map-zoom-controls';
import { usePalette } from './globe-palette';
import { FLOW_PERIOD, GlobeLayers } from './globe-layers';
import { collectElements, setAttr, setD, type Elements } from './globe-dom';
import { drawBase } from './globe-canvas';

/**
 * Keyless SVG globe and flat route map (d3-geo + Natural Earth land).
 * No map tiles, API keys or accounts: nothing to leak or pay for.
 *
 * React renders the structure; geometry is written straight into the SVG
 * attributes by `draw()`, so dragging, zooming and the hero's rotation never
 * re-render React. Sizes are true CSS pixels (the viewBox tracks the element),
 * so a 12 px label is 12 px on every screen.
 */

export type { LngLat } from '@/lib/map-geometry';

export interface GlobeAirport {
  code: string;
  lat: number;
  lng: number;
  emphasis?: boolean;
  /** City or airport name shown beside the code when zoomed in. */
  name?: string;
  /** Label priority: lower wins collisions (0 = home base). */
  priority?: number;
}

export interface GlobeRoute {
  key: string;
  from: LngLat;
  to: LngLat;
  color: string;
  width?: number;
  title?: string;
  /** Airport codes at each end (for selection emphasis). */
  endpoints?: [string, string];
}

export interface GlobeFocus { id: string; points: LngLat[] }

export interface GlobeProps {
  airports: GlobeAirport[];
  routes: GlobeRoute[];
  /** Equirectangular map instead of the globe. */
  flat?: boolean;
  /** Centre of the whole-globe view (and of the hero rotation). */
  center?: LngLat;
  /** Points the default view frames ("fit my routes"). */
  fitTo?: LngLat[];
  /** Fly to these points whenever `id` changes. */
  focus?: GlobeFocus | null;
  /** Padding for `focus` (e.g. room for a details card). */
  focusPad?: Pad;
  autoRotate?: boolean;
  interactive?: boolean;
  showLabels?: boolean;
  /** `daylight` is the fixed landing palette; `app` follows the theme tokens. */
  appearance?: 'app' | 'daylight';
  terminator?: boolean;
  flow?: 'all' | 'selected' | 'none';
  selectedKey?: string | null;
  hoveredKey?: string | null;
  onSelect?: (key: string | null) => void;
  onHover?: (key: string | null) => void;
  /** Inline in a scrolling page: plain wheel scrolls, Ctrl/⌘ + wheel zooms. */
  cooperative?: boolean;
  controls?: boolean;
  /** Set false to draw a single still frame (e.g. behind a sign-in form). */
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
  describedBy?: string;
  children?: ReactNode;
}

/** 2D context, or null where canvas is unavailable (e.g. jsdom in unit tests). */
function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return null;
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}
/** Flow dashes: stepped in JS at the draw rate. */
const FLOW_PX_PER_MS = 0.01;
const DETAIL_IDLE_MS = 150;
/** Keep fitted routes clear of the expand button (top right) and zoom controls (right). */
const CONTROLS_PAD: Pad = { top: 60, right: 76, bottom: 44, left: 44 };
const fitPad = (p: GlobeProps): Pad => (p.controls && p.interactive !== false ? CONTROLS_PAD : 48);
/** Screen areas covered by the floating controls, which labels avoid. */
function controlObstacles(p: GlobeProps, s: Size): Box[] {
  if (!p.controls || p.interactive === false) return [];
  return [
    { x0: s.w - 60, y0: s.h - 212, x1: s.w, y1: s.h },
    { x0: s.w - 60, y0: 0, x1: s.w, y1: 60 },
  ];
}
/** Zoom (px per degree) from which labels add the city name. */
const NAME_PX_PER_DEG = 20;
const SWAY_PERIOD_MS = 90_000;
const SWAY_DEG = 50;

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function Globe(props: GlobeProps) {
  const {
    airports, routes, flat = false, center, fitTo, focus = null, autoRotate = false, interactive = true, showLabels = true,
    appearance = 'app', terminator = false, flow = 'none', selectedKey = null, hoveredKey = null, onSelect, onHover,
    cooperative = true, controls = false, animate = true, className, ariaLabel = 'Route map', describedBy, children,
  } = props;
  const pal = usePalette(appearance);
  const palRef = useRef(pal);
  palRef.current = pal;
  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const styleFor = useRef<{ pal: string; style: CSSStyleDeclaration | null }>({ pal: '', style: null });
  const [size, setSize] = useState<Size>({ w: 600, h: 600 });
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const budget = useMemo(() => motionBudget(), []);
  const running = useRunGate(rootRef, autoRotate || flow !== 'none');

  // Mutable engine state: read by draw() and the gesture handlers, never by render.
  const propsRef = useRef(props);
  const sizeRef = useRef(size);
  const views = useRef<{ globe: GlobeView | null; flat: FlatView | null; base: FlatBase | null }>({ globe: null, flat: null, base: null });
  const els = useRef<Elements | null>(null);
  const slots = useRef(new Map<string, number>());
  const clusters = useRef<Cluster[]>([]);
  const moving = useRef(false);
  const moved = useRef(false);
  const frame = useRef(0);
  const fly = useRef(0);
  const detailTimer = useRef(0);
  const lastBase = useRef('');
  const night = useRef<{ at: number; polygons: Polygon[] }>({ at: 0, polygons: [] });
  const requestDrawRef = useRef<() => void>(() => undefined);

  const [zoom, setZoom] = useState({ level: 1, min: true, max: false });
  const [hint, setHint] = useState('');
  const hintTimer = useRef(0);

  const radius = useCallback((s: Size) => globeRadius(s, appearance === 'daylight' ? 1 / 1.22 : 0.9), [appearance]);
  const routePairs = useCallback(() => propsRef.current.routes.map((r) => [r.from, r.to] as [LngLat, LngLat]), []);

  const defaultGlobe = useCallback((s: Size): GlobeView => {
    const p = propsRef.current;
    if (p.fitTo?.length) return fitGlobe(p.fitTo, s, radius(s), { routes: routePairs(), pad: fitPad(p) });
    return globeViewAt(p.center ?? [45, 20], 1);
  }, [radius, routePairs]);

  const defaultBase = useCallback((s: Size): FlatBase => {
    const p = propsRef.current;
    const pts = p.fitTo?.length ? p.fitTo : [p.center ?? [45, 20]];
    return fitFlat(pts, s, { routes: routePairs(), pad: fitPad(p) });
  }, [routePairs]);

  const ensureViews = useCallback(() => {
    const s = sizeRef.current;
    const v = views.current;
    if (!v.globe) v.globe = defaultGlobe(s);
    if (!v.base) v.base = defaultBase(s);
    if (!v.flat) v.flat = flatViewFromBase(v.base);
    return v as { globe: GlobeView; flat: FlatView; base: FlatBase };
  }, [defaultGlobe, defaultBase]);

  const currentProjection = useCallback((): { projection: GeoProjection; pxPerDeg: number; r0: number; centre: LngLat } => {
    const s = sizeRef.current;
    const v = ensureViews();
    if (propsRef.current.flat) {
      const projection = flatProjection(v.base, v.flat, s);
      const c = projection.invert([s.w / 2, s.h / 2]) ?? [0, 0];
      return { projection, pxPerDeg: flatPxPerDeg(v.base, v.flat), r0: 0, centre: [c[0], c[1]] };
    }
    const r0 = radius(s);
    return { projection: globeProjection(v.globe, s, r0), pxPerDeg: globePxPerDeg(v.globe, r0), r0, centre: globeCentre(v.globe) };
  }, [ensureViews, radius]);

  const syncZoom = useCallback(() => {
    const v = ensureViews();
    const s = sizeRef.current;
    const next = propsRef.current.flat
      ? { level: (v.base.s0 * v.flat.k) / Math.min(s.w / (2 * Math.PI), s.h / Math.PI), min: v.flat.k <= v.base.kMin * 1.001, max: v.flat.k >= v.base.kMax * 0.999 }
      : { level: v.globe.k, min: v.globe.k <= 1.001, max: v.globe.k >= GLOBE_K_MAX * 0.999 };
    setZoom((z) => (Math.abs(z.level - next.level) < 0.05 && z.min === next.min && z.max === next.max ? z : next));
  }, [ensureViews]);

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  const draw = useCallback(() => {
    const svg = svgRef.current;
    const e = els.current;
    if (!svg || !e) return;
    const p = propsRef.current;
    const s = sizeRef.current;
    const pl = palRef.current;
    const v = ensureViews();
    const { projection, pxPerDeg, r0, centre } = currentProjection();
    const path = geoPath(projection).digits(1);
    const lite = p.appearance === 'daylight';

    // Base layers change only when the view does.
    const wantsDetail = !lite && pxPerDeg >= DETAIL_PX_PER_DEG;
    const detailed = getDetailedLand();
    if (wantsDetail && !detailed) loadDetailedLand().then(() => requestDrawRef.current(), () => undefined);
    const useDetail = wantsDetail && !!detailed && !moving.current;
    const now = Date.now();
    if (p.terminator && now - night.current.at > 60_000) night.current = { at: now, polygons: nightCircles(new Date(now)) };
    const viewKey = p.flat ? `f${v.flat.k},${v.flat.x},${v.flat.y}` : `g${v.globe.rotate},${v.globe.k}`;
    const baseKey = `${viewKey}|${s.w}x${s.h}|${useDetail}|${moving.current}|${night.current.at}|${pl.name}`;
    if (baseKey !== lastBase.current) {
      lastBase.current = baseKey;
      const canvas = canvasRef.current;
      const ctx = canvas ? canvasContext(canvas) : null;
      if (canvas && ctx) {
        if (styleFor.current.pal !== pl.name) styleFor.current = { pal: pl.name, style: getComputedStyle(canvas) };
        drawBase(canvas, ctx, {
          projection, size: s, dpr: Math.min(2, window.devicePixelRatio || 1), pal: pl, style: styleFor.current.style,
          flat: !!p.flat, disc: p.flat ? null : { cx: s.w / 2, cy: s.h / 2, r: r0 * v.globe.k },
          graticule: graticuleFor(pxPerDeg, centre, lite),
          // While moving, the lighter coastline keeps frames cheap; the full one returns at rest.
          land: useDetail ? detailed! : lite || moving.current ? LAND_110_LITE : LAND_110,
          night: p.terminator ? night.current.polygons : [],
        });
      }
    }

    // Routes: lifted arcs on the globe, gently bowed great circles on the flat map.
    // Near the view centre a radial lift is foreshortened to nothing, so the app
    // map always adds some screen-space bow; the hero keeps the pure 3D lift.
    const bow = p.flat ? 1 : p.appearance === 'daylight' ? 0.3 : 0.5 + 0.5 * smoothstep(1.5, 4, v.globe.k);
    const linePoints: Array<[number, number]> = [];
    for (const r of p.routes) {
      const parts = e.routes.get(r.key);
      if (!parts) continue;
      let front = '';
      let limb = '';
      let back = '';
      if (p.flat) {
        const runs = flatArc(r.from, r.to, projection, bow);
        front = runsToPath(runs);
        linePoints.push(...densify(runs));
      } else {
        const runs = globeArc(r.from, r.to, v.globe, s, r0, bow);
        front = runsToPath(runs.front);
        limb = runsToPath(runs.limb);
        back = runsToPath(runs.back);
        linePoints.push(...densify(runs.front));
      }
      setD(parts.get('ground'), path({ type: 'LineString', coordinates: [r.from, r.to] }));
      setD(parts.get('back'), back);
      setD(parts.get('limb'), limb);
      for (const part of ['casing', 'line', 'flow']) setD(parts.get(part), front);
      setD(parts.get('hit'), front + limb);
    }

    // Airports, then labels placed around the visible markers.
    const items: LabelItem[] = [];
    const showNames = pxPerDeg >= NAME_PX_PER_DEG;
    for (const a of p.airports) {
      const marker = e.markers.get(a.code);
      let x: number;
      let y: number;
      let opacity = 1;
      if (p.flat) {
        [x, y] = projection([a.lng, a.lat]) ?? [-999, -999];
      } else {
        const q = globePoint([a.lng, a.lat], v.globe, s, r0);
        x = q.x; y = q.y; opacity = limbOpacity(q.z);
      }
      const onScreen = opacity > 0.02 && x > -12 && y > -12 && x < s.w + 12 && y < s.h + 12;
      if (marker) {
        setAttr(marker, 'transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
        setAttr(marker, 'display', onScreen ? 'inline' : 'none');
        setAttr(marker, 'opacity', opacity.toFixed(2));
      }
      if (onScreen && opacity > 0.6 && p.showLabels !== false) {
        const r = a.emphasis ? 5.5 : 4;
        const variants = [{ text: a.code, width: estimateLabelWidth(a.code) }];
        if (showNames && a.name) variants.unshift({ text: `${a.code} ${a.name}`, width: estimateLabelWidth(a.code, a.name) });
        items.push({ id: a.code, x, y, r, priority: a.priority ?? (a.emphasis ? 0 : 5), variants });
      }
    }
    const layout = placeLabels(items, s, { prev: slots.current, obstacles: controlObstacles(p, s), soft: linePoints });
    slots.current = new Map([...layout.placed].map(([id, l]) => [id, l.slot]));
    clusters.current = layout.clusters;
    for (const [code, text] of e.labels) {
      const l = layout.placed.get(code);
      if (!l) { setAttr(text, 'display', 'none'); continue; }
      setAttr(text, 'display', 'inline');
      setAttr(text, 'x', l.x.toFixed(1));
      setAttr(text, 'y', l.y.toFixed(1));
      setAttr(text, 'text-anchor', l.anchor);
      const extra = text.querySelector('[data-extra]');
      const suffix = l.text.slice(code.length);
      if (extra && extra.textContent !== suffix) extra.textContent = suffix;
      setAttr(text, 'pointer-events', l.more ? 'auto' : 'none');
      setAttr(text, 'cursor', l.more ? 'zoom-in' : 'default');
    }
  }, [currentProjection, ensureViews]);

  const requestDraw = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw();
    });
  }, [draw]);
  requestDrawRef.current = requestDraw;

  /** Mark the map as moving (light land), then refine once it has been still for a moment. */
  const setMoving = useCallback((value: boolean) => {
    moving.current = value;
    window.clearTimeout(detailTimer.current);
    if (!value) detailTimer.current = window.setTimeout(() => { lastBase.current = ''; requestDraw(); }, DETAIL_IDLE_MS);
  }, [requestDraw]);

  // ---------------------------------------------------------------------------
  // View changes
  // ---------------------------------------------------------------------------

  const cancelFly = useCallback(() => {
    if (fly.current) cancelAnimationFrame(fly.current);
    fly.current = 0;
  }, []);

  const flyTo = useCallback((target: { globe?: GlobeView; flat?: FlatView }, duration = 520) => {
    cancelFly();
    const v = ensureViews();
    const s = sizeRef.current;
    if (target.globe && !propsRef.current.flat) {
      const interp = interpolateGlobeView(v.globe, target.globe);
      runFly((t) => { v.globe = t === 1 ? target.globe! : interp(t); });
    } else if (target.globe) {
      v.globe = target.globe;
    }
    if (target.flat && propsRef.current.flat) {
      const interp = interpolateFlatView(v.flat, target.flat, s);
      runFly((t) => { v.flat = t === 1 ? target.flat! : interp(t); });
    } else if (target.flat) {
      v.flat = target.flat;
    }
    function runFly(apply: (t: number) => void) {
      if (prefersReducedMotion() || duration <= 0) {
        apply(1);
        draw();
        syncZoom();
        return;
      }
      const start = performance.now();
      setMoving(true);
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        apply(t === 1 ? 1 : easeCubicInOut(t));
        draw();
        if (t < 1) {
          fly.current = requestAnimationFrame(step);
        } else {
          fly.current = 0;
          setMoving(false);
          syncZoom();
        }
      };
      fly.current = requestAnimationFrame(step);
    }
  }, [cancelFly, draw, ensureViews, setMoving, syncZoom]);

  const zoomAround = useCallback((factor: number, anchor: ScreenPoint, animated: boolean) => {
    const v = ensureViews();
    const s = sizeRef.current;
    moved.current = true;
    if (propsRef.current.flat) {
      const next = zoomFlatAt(v.flat, factor, anchor, v.base, s);
      if (animated) flyTo({ flat: next }, 260); else { v.flat = next; requestDraw(); }
    } else {
      const next = zoomGlobeAt(v.globe, factor, anchor, s, radius(s));
      if (animated) flyTo({ globe: next }, 260); else { v.globe = next; requestDraw(); }
    }
  }, [ensureViews, flyTo, radius, requestDraw]);

  const panBy = useCallback((dx: number, dy: number) => {
    const v = ensureViews();
    const s = sizeRef.current;
    moved.current = true;
    if (propsRef.current.flat) v.flat = panFlat(v.flat, dx, dy, v.base, s);
    else v.globe = panGlobe(v.globe, dx, dy, radius(s));
    requestDraw();
  }, [ensureViews, radius, requestDraw]);

  const fitAll = useCallback(() => {
    const s = sizeRef.current;
    moved.current = false;
    const base = ensureViews().base;
    flyTo({ globe: defaultGlobe(s), flat: flatViewFromBase(base) });
  }, [defaultGlobe, ensureViews, flyTo]);

  const worldView = useCallback(() => {
    const s = sizeRef.current;
    const v = ensureViews();
    moved.current = true;
    const centre = boundsCentreOf(propsRef.current);
    flyTo({
      globe: globeViewAt([centre[0], Math.max(-45, Math.min(45, centre[1]))], 1),
      flat: clampFlat(zoomFlatAt(v.flat, v.base.kMin / v.flat.k, { x: s.w / 2, y: s.h / 2 }, v.base, s), v.base, s),
    });
  }, [ensureViews, flyTo]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Measure in CSS pixels.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      setSize((prev) => (Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1 ? prev : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-fit when the airports or the size change, unless the pilot has moved the map.
  const fitKey = (fitTo ?? []).map((q) => `${q[0].toFixed(3)},${q[1].toFixed(3)}`).join(';');
  const fitSize = useRef<Size | null>(null);
  const fitFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    propsRef.current = props;
    const prevSize = fitSize.current;
    const v = views.current;
    const pointsChanged = fitFor.current !== fitKey;
    fitFor.current = fitKey;
    fitSize.current = size;
    sizeRef.current = size;
    if (!prevSize || pointsChanged || !moved.current) {
      moved.current = false;
      v.globe = autoRotate ? globeViewAt(center ?? [45, 20], 1) : defaultGlobe(size);
      v.base = defaultBase(size);
      v.flat = flatViewFromBase(v.base);
    } else if (v.base && v.flat && (prevSize.w !== size.w || prevSize.h !== size.h)) {
      // Keep the pilot's centre and scale on resize.
      const old = flatProjection(v.base, v.flat, prevSize).invert([prevSize.w / 2, prevSize.h / 2]);
      const scale = v.base.s0 * v.flat.k;
      v.base = defaultBase(size);
      const k = Math.max(v.base.kMin, Math.min(v.base.kMax, scale / v.base.s0));
      const l = old ? (((old[0] + v.base.rotate[0] + 540) % 360) - 180) : 0;
      v.flat = clampFlat({ k, x: size.w / 2 - v.base.s0 * k * l * RAD, y: size.h / 2 + v.base.s0 * k * (old?.[1] ?? 0) * RAD }, v.base, size);
    }
    lastBase.current = '';
    syncZoom();
  }, [fitKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps -- fit only when points or size change

  // After every render: pick up new elements and draw them.
  useLayoutEffect(() => {
    propsRef.current = props;
    sizeRef.current = size;
    if (svgRef.current) els.current = collectElements(svgRef.current);
    draw();
  });

  // Mode switch: redraw base and zoom state.
  useLayoutEffect(() => {
    lastBase.current = '';
    syncZoom();
  }, [flat, syncZoom]);

  // Fly to a selected route.
  useEffect(() => {
    if (!focus || !focus.points.length || autoRotate) return;
    const s = sizeRef.current;
    const v = ensureViews();
    const pts = focus.points;
    const pair: Array<[LngLat, LngLat]> = pts.length === 2 ? [[pts[0], pts[1]]] : [];
    const pad = propsRef.current.focusPad ?? fitPad(propsRef.current);
    moved.current = true;
    flyTo({
      globe: fitGlobe(pts, s, radius(s), { routes: pair, pad, kMax: 16 }),
      flat: fitFlatView(pts, v.base, s, pad),
    }, 640);
  }, [focus?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- fly once per focus id

  // Flow dashes: stepped in JS at the draw rate, so a still map repaints ~20×/s at most.
  const flowOffset = useRef(0);
  const stepFlow = useCallback((dt: number) => {
    const e = els.current;
    if (!e) return;
    flowOffset.current = (flowOffset.current - dt * FLOW_PX_PER_MS) % FLOW_PERIOD;
    const value = flowOffset.current.toFixed(1);
    for (const parts of e.routes.values()) setAttr(parts.get('flow'), 'stroke-dashoffset', value);
  }, []);
  const rotating = autoRotate && animate && !reducedMotion && budget !== 'static';
  const hasFlow = !reducedMotion && budget !== 'static' && animate && (flow === 'all' || (flow === 'selected' && !!selectedKey));
  useEffect(() => {
    if (!hasFlow || !running || rotating) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= 50) {
        stepFlow(last ? Math.min(now - last, 100) : 50);
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasFlow, running, rotating, stepFlow]);

  // Hero rotation: a slow sway around the hub, drawn imperatively, paused when unseen.
  const phase = useRef(0);
  useEffect(() => {
    if (!rotating || !running) return;
    let raf = 0;
    let last = 0;
    // The sway moves under 4°/s, so 20 fps (12 on modest devices) is smooth and cheap.
    let interval = budget === 'low' ? 1000 / 12 : 1000 / 20;
    let cost = 0;
    let stopped = false;
    const base = propsRef.current.center ?? [45, 20];
    const tick = (now: number) => {
      raf = 0;
      if (stopped) return;
      const dt = last ? now - last : interval;
      if (dt >= interval - 2) {
        last = now;
        phase.current += Math.min(dt, 100);
        const lng = base[0] + SWAY_DEG * Math.sin((2 * Math.PI * phase.current) / SWAY_PERIOD_MS);
        views.current.globe = globeViewAt([lng, base[1]], 1);
        const t0 = performance.now();
        stepFlow(Math.min(dt, 100));
        draw();
        const took = performance.now() - t0;
        cost = cost ? cost * 0.9 + took * 0.1 : took;
        if (cost > 22) stopped = true; // keep the still frame on very slow devices
        else if (cost > 11) interval = 1000 / 10;
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf && !stopped) raf = requestAnimationFrame(tick); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 500);
    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle); else window.clearTimeout(idle);
    };
  }, [rotating, running, budget, draw, stepFlow]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    cancelFly();
    window.clearTimeout(detailTimer.current);
    window.clearTimeout(hintTimer.current);
  }, [cancelFly]);

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  const { suppressClick } = useMapGestures(surfaceRef, {
    onPan: (dx, dy) => { cancelFly(); panBy(dx, dy); },
    onZoom: (factor, anchor) => { cancelFly(); zoomAround(factor, anchor, false); },
    onDoubleTap: (anchor, out) => zoomAround(out ? 0.5 : 2, anchor, true),
    onGestureStart: () => { cancelFly(); setMoving(true); },
    onGestureEnd: () => { setMoving(false); syncZoom(); },
    onBlockedWheel: () => {
      setHint(`Use ${isMac() ? '⌘' : 'Ctrl'} + scroll to zoom the map`);
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHint(''), 1500);
    },
  }, { enabled: interactive, cooperative });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = 80 * (e.shiftKey ? 3 : 1);
    const s = sizeRef.current;
    const mid = { x: s.w / 2, y: s.h / 2 };
    const actions: Record<string, () => void> = {
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
      '+': () => zoomAround(Math.SQRT2, mid, true),
      '=': () => zoomAround(Math.SQRT2, mid, true),
      '-': () => zoomAround(Math.SQRT1_2, mid, true),
      _: () => zoomAround(Math.SQRT1_2, mid, true),
      '0': fitAll,
      Home: worldView,
      Escape: () => { if (propsRef.current.selectedKey) onSelect?.(null); },
    };
    const action = actions[e.key];
    if (!action) return;
    if (e.key === 'Escape' && !propsRef.current.selectedKey) return; // let dialogs close
    e.preventDefault();
    e.stopPropagation();
    action();
    if (e.key.startsWith('Arrow')) syncZoom();
  };

  const onSurfaceClick = (e: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) return;
    const target = e.target as Element;
    const label = target.closest('[data-label]') as SVGTextElement | null;
    if (label) {
      const cluster = clusters.current.find((c) => c.lead === label.dataset.label);
      if (cluster) {
        const factor = Math.min(8, Math.max(2, 28 / Math.max(1, cluster.minDist)));
        zoomAround(factor, { x: cluster.x, y: cluster.y }, true);
      }
      return;
    }
    const hit = target.closest('[data-part="hit"]') as SVGPathElement | null;
    if (hit) {
      const key = hit.parentElement?.getAttribute('data-route');
      if (key) onSelect?.(key);
      return;
    }
    if (propsRef.current.selectedKey) onSelect?.(null);
  };

  const onRouteHover = (key: string | null, e: ReactPointerEvent<SVGPathElement>) => {
    if (e.pointerType === 'touch' || moving.current) return;
    onHover?.(key);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const flowFor = (key: string) => hasFlow && (flow === 'all' || key === selectedKey);

  return (
    <div ref={rootRef} className={cn('relative isolate select-none', className)} aria-hidden={interactive ? undefined : true}>
      <div
        ref={surfaceRef}
        className={cn(
          'absolute inset-0 overflow-hidden rounded-[inherit] outline-none',
          interactive && 'cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        )}
        role={interactive ? 'group' : undefined}
        aria-roledescription={interactive ? 'interactive map' : undefined}
        aria-label={interactive ? ariaLabel : undefined}
        aria-describedby={interactive ? describedBy : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        onClick={interactive ? onSurfaceClick : undefined}
        style={{ touchAction: interactive ? (cooperative ? 'pan-y' : 'none') : undefined }}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
        <svg ref={svgRef} className="relative block h-full w-full [&_*]:transition-none" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}
          aria-hidden="true" focusable="false" data-mode={flat ? 'flat' : 'globe'}>
          <GlobeLayers
            pal={pal} routes={routes} airports={airports}
            selectedKey={selectedKey} hoveredKey={hoveredKey} flowFor={flowFor} interactive={interactive}
            showLabels={showLabels} onRouteHover={onRouteHover}
          />
        </svg>
      </div>

      {interactive && controls && (
        <MapZoomControls
          canZoomIn={!zoom.max}
          canZoomOut={!zoom.min}
          onZoomIn={() => zoomAround(2, { x: size.w / 2, y: size.h / 2 }, true)}
          onZoomOut={() => zoomAround(0.5, { x: size.w / 2, y: size.h / 2 }, true)}
          onFit={fitAll}
          onWorld={worldView}
          worldLabel={flat ? 'Show the whole map' : 'Show the whole globe'}
        />
      )}
      {hint && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 mx-auto w-fit -translate-y-1/2 rounded-lg bg-foreground/85 px-3 py-2 text-sm font-medium text-background shadow-lg">
          {hint}
        </div>
      )}
      {children}
      {interactive && <p className="sr-only" aria-live="polite">{`Zoom ${zoom.level < 10 ? zoom.level.toFixed(1) : Math.round(zoom.level)}×`}</p>}
    </div>
  );
}

function boundsCentreOf(p: GlobeProps): LngLat {
  return p.center ?? boundsCentre(p.fitTo?.length ? p.fitTo : [[45, 20]]);
}
