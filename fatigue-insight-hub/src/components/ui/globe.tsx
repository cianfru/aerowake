import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, geoNaturalEarth1 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { cn } from '@/lib/utils';

/**
 * Keyless SVG globe (d3-geo orthographic + Natural Earth 1:110m land).
 * No map tiles, API keys or accounts: nothing to leak or pay for.
 */

export interface GlobeAirport {
  code: string;
  lat: number;
  lng: number;
  emphasis?: boolean;
}

export interface GlobeRoute {
  from: [number, number]; // [lng, lat]
  to: [number, number];
  color: string;
  width?: number;
  title?: string;
}

interface GlobeProps {
  airports: GlobeAirport[];
  routes: GlobeRoute[];
  center?: [number, number]; // [lng, lat]
  autoRotate?: boolean;
  flat?: boolean;
  interactive?: boolean;
  showLabels?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SIZE = 600;

const landTopology = land110 as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(landTopology, landTopology.objects.land) as unknown as FeatureCollection<Geometry>;
const GRATICULE = geoGraticule10();

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function Globe({
  airports, routes, center = [51.6, 25.3], autoRotate = false, interactive = true, showLabels = true,
  className, ariaLabel = 'Route globe', flat = false,
}: GlobeProps) {
  const oceanId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = svgRef.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // d3 rotation is the negative of the centre point.
  const [rotation, setRotation] = useState<[number, number]>([-center[0], -Math.max(-60, Math.min(60, center[1]))]);
  const drag = useRef<{ x: number; y: number; r: [number, number] } | null>(null);
  const frame = useRef<number>(0);

  useEffect(() => {
    setRotation([-center[0], -Math.max(-60, Math.min(60, center[1]))]);
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRotate || !visible || flat || prefersReducedMotion()) return;
    let last = performance.now();
    // ~30 fps is smooth at this speed and halves the SVG re-render cost.
    const tick = (now: number) => {
      const dt = now - last;
      if (dt >= 33) {
        last = now;
        if (!document.hidden && !drag.current) setRotation(([l, p]) => [l + Math.min(dt, 100) * 0.004, p]);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [autoRotate, visible, flat]);

  const projection = useMemo(
    () => flat ? geoNaturalEarth1().fitExtent([[8, 20], [SIZE - 8, 360]], { type: 'Sphere' }) : geoOrthographic().scale(SIZE / 2 - 8).translate([SIZE / 2, SIZE / 2]).rotate(rotation).clipAngle(90),
    [rotation, flat],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const visibleCentre: [number, number] = [-rotation[0], -rotation[1]];
  const isVisible = (lng: number, lat: number) => flat || geoDistance([lng, lat], visibleCentre) < Math.PI / 2 - 0.02;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || flat) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, r: rotation };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const k = 0.35;
    const { x, y, r } = drag.current;
    setRotation([r[0] + (e.clientX - x) * k, Math.max(-75, Math.min(75, r[1] - (e.clientY - y) * k))]);
  };
  const endDrag = () => { drag.current = null; };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${flat ? 380 : SIZE}`}
      className={cn('h-auto w-full select-none', interactive && 'cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', className)}
      role="img"
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={e => {
        if (!interactive || flat) return;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
        e.preventDefault();
        if (e.key === 'Home') setRotation(center ? [-center[0], -center[1]] : [0, -20]);
        else setRotation(([x, y]) => [x + (e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0), Math.max(-75, Math.min(75, y + (e.key === 'ArrowUp' ? 10 : e.key === 'ArrowDown' ? -10 : 0)))]);
      }}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      style={{ touchAction: interactive ? 'pan-y' : undefined }}
    >
      <defs>
        <radialGradient id={oceanId} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.16} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
        </radialGradient>
      </defs>
      <path d={path({ type: 'Sphere' }) ?? undefined} fill={`url(#${oceanId})`} stroke="hsl(var(--primary))" strokeOpacity={0.35} strokeWidth={1} />
      <path d={path(GRATICULE) ?? undefined} fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.08} strokeWidth={0.6} />
      {LAND.features.map((f: Feature<Geometry>, i: number) => (
        <path key={i} d={path(f) ?? undefined} fill="hsl(var(--primary))" fillOpacity={0.14} stroke="hsl(var(--primary))" strokeOpacity={0.3} strokeWidth={0.5} />
      ))}
      {routes.map((r, i) => (
        <path
          key={i}
          d={path({ type: 'LineString', coordinates: [r.from, r.to] }) ?? undefined}
          fill="none"
          stroke={r.color}
          strokeWidth={r.width ?? 1.5}
          strokeLinecap="round"
          strokeOpacity={0.9}
        >
          {r.title && <title>{r.title}</title>}
        </path>
      ))}
      {airports.filter((a) => isVisible(a.lng, a.lat)).map((a) => {
        const p = projection([a.lng, a.lat]);
        if (!p) return null;
        return (
          <g key={a.code} transform={`translate(${p[0]},${p[1]})`}>
            <circle r={a.emphasis ? 4.5 : 3} fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth={a.emphasis ? 2 : 1.5} />
            {showLabels && (
              <text x={7} y={4} fontSize={12} fontFamily="JetBrains Mono, monospace" fill="hsl(var(--foreground))" fillOpacity={0.85}
                style={{ paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 3 }}>
                {a.code}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
