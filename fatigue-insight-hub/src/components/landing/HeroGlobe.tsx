import { useEffect, useRef, useState } from 'react';
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import { LAND_110_LITE } from '@/lib/map-land';
import { motionBudget, useRunGate } from '@/hooks/useRunGate';
import { LANDING_AIRPORTS, LANDING_ROUTE_PAIRS } from './landingData';

const GRID = geoGraticule10();
const SPHERE = { type: 'Sphere' } as const;
const AIRPORTS = new Map(LANDING_AIRPORTS.map(airport => [airport.code, [airport.lng, airport.lat] as [number, number]]));
const ROUTES = LANDING_ROUTE_PAIRS.slice(0, 5).map(route => {
  const from = AIRPORTS.get(route.from)!;
  const to = AIRPORTS.get(route.to)!;
  return { from, to, interpolate: geoInterpolate(from, to) };
});

/** A background globe, drawn locally: no map services, labels or hit targets. */
export function HeroGlobe() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [budget] = useState(motionBudget);
  const visible = useRunGate(root);
  const running = visible && !reducedMotion && budget !== 'static';

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const container = root.current;
    if (!element || !container || /jsdom/i.test(navigator.userAgent)) return;
    const context = element.getContext('2d');
    if (!context) return;
    let frame = 0;
    let previous = 0;
    let lastDraw = 0;
    let size = 0;
    const projection = geoOrthographic().clipAngle(90).precision(1.2);
    const path = geoPath(projection, context);
    const dpr = Math.min(window.devicePixelRatio || 1, budget === 'full' ? 1.5 : 1);

    const draw = () => {
      if (!size) return;
      const centre = size / 2;
      const radius = size * .43;
      const longitude = 35 + phase.current * .002;
      projection.translate([centre, centre]).scale(radius).rotate([-longitude, -18, -12]);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size, size);

      const halo = context.createRadialGradient(centre, centre, radius * .9, centre, centre, radius * 1.14);
      halo.addColorStop(0, 'rgba(88, 205, 215, 0)');
      halo.addColorStop(.45, 'rgba(88, 205, 215, .12)');
      halo.addColorStop(1, 'rgba(88, 205, 215, 0)');
      context.fillStyle = halo;
      context.fillRect(0, 0, size, size);

      const ocean = context.createRadialGradient(centre - radius * .45, centre - radius * .5, 0, centre, centre, radius);
      ocean.addColorStop(0, 'rgba(91, 137, 185, .24)');
      ocean.addColorStop(.65, 'rgba(26, 105, 134, .12)');
      ocean.addColorStop(1, 'rgba(7, 29, 49, .08)');
      context.beginPath();
      path(SPHERE);
      context.fillStyle = ocean;
      context.fill();
      context.strokeStyle = 'rgba(118, 220, 227, .32)';
      context.lineWidth = 1;
      context.stroke();

      context.beginPath();
      path(GRID);
      context.strokeStyle = 'rgba(140, 205, 225, .15)';
      context.lineWidth = .65;
      context.stroke();

      context.beginPath();
      path(LAND_110_LITE);
      context.fillStyle = 'rgba(101, 207, 191, .10)';
      context.fill();
      context.strokeStyle = 'rgba(136, 224, 213, .46)';
      context.lineWidth = .8;
      context.stroke();

      ROUTES.forEach((route, index) => {
        context.beginPath();
        path({ type: 'LineString', coordinates: [route.from, route.to] });
        context.strokeStyle = 'rgba(116, 221, 216, .30)';
        context.lineWidth = 1;
        context.stroke();
        const point = route.interpolate((phase.current / 16000 + index * .21) % 1);
        if (geoDistance([longitude, 18], point) >= Math.PI / 2) return;
        const xy = projection(point);
        if (!xy) return;
        context.beginPath();
        context.arc(xy[0], xy[1], 2.3, 0, Math.PI * 2);
        context.fillStyle = '#a6f5df';
        context.shadowBlur = 10;
        context.shadowColor = '#6ef1d0';
        context.fill();
        context.shadowBlur = 0;
      });
    };

    const resize = () => {
      size = container.clientWidth;
      element.width = Math.round(size * dpr);
      element.height = Math.round(size * dpr);
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const tick = (now: number) => {
      if (previous) phase.current += Math.min(now - previous, 100);
      previous = now;
      if (now - lastDraw >= (budget === 'low' ? 1000 / 15 : 1000 / 30)) {
        draw();
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    };
    if (running) frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [running, budget]);

  return <div ref={root} className="aw-hero-globe" aria-hidden="true" data-running={running}>
    <canvas ref={canvas} className="aw-hero-globe-canvas" />
  </div>;
}
