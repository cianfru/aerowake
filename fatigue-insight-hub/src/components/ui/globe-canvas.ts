/**
 * Base map on a <canvas> behind the SVG: ocean, graticule, land, terminator,
 * atmosphere and limb lighting. Drawing through d3's canvas context avoids
 * building and re-parsing a large SVG path every frame; routes, markers and
 * labels stay in SVG for hit-testing and accessibility.
 */
import { geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import type { Palette, Stop } from './globe-palette';

const SPHERE = { type: 'Sphere' } as const;

/** Resolve a palette colour ('hsl(var(--token))' or '#rrggbb') with an alpha for canvas. */
export function resolveColour(colour: string, alpha: number, style: CSSStyleDeclaration | null): string {
  const token = /^hsl\(var\((--[\w-]+)\)\)$/.exec(colour);
  if (token) {
    const value = style?.getPropertyValue(token[1]).trim();
    return value ? `hsl(${value} / ${alpha})` : `rgba(128, 128, 128, ${alpha})`;
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return colour;
}

export interface BaseFrame {
  projection: GeoProjection;
  size: { w: number; h: number };
  dpr: number;
  pal: Palette;
  style: CSSStyleDeclaration | null;
  flat: boolean;
  /** Disc centre and radius in px (globe only). */
  disc: { cx: number; cy: number; r: number } | null;
  graticule: GeoPermissibleObjects;
  land: GeoPermissibleObjects;
  night: GeoPermissibleObjects[];
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: Stop[], style: CSSStyleDeclaration | null) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  for (const [offset, colour, alpha] of stops) g.addColorStop(Math.min(1, Math.max(0, offset)), resolveColour(colour, alpha, style));
  return g;
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, 2 * Math.PI);
}

export function drawBase(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, f: BaseFrame) {
  const { w, h } = f.size;
  const pw = Math.round(w * f.dpr);
  const ph = Math.round(h * f.dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const { pal, style } = f;
  const path = geoPath(f.projection, ctx);

  if (f.flat) {
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = resolveColour(pal.flatOcean[0], pal.flatOcean[1], style);
    ctx.fill();
  } else if (f.disc) {
    const { cx, cy, r } = f.disc;
    disc(ctx, cx, cy, r * pal.halo);
    ctx.fillStyle = radial(ctx, cx, cy, r * pal.halo, pal.haloStops, style);
    ctx.fill();
    disc(ctx, cx, cy, r);
    ctx.fillStyle = radial(ctx, cx - 0.24 * r, cy - 0.36 * r, 1.5 * r, pal.oceanStops, style);
    ctx.fill();
  }

  ctx.lineJoin = 'round';
  ctx.beginPath();
  path(f.graticule);
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = resolveColour(pal.graticule[0], pal.graticule[1], style);
  ctx.stroke();

  ctx.beginPath();
  path(f.land);
  ctx.fillStyle = resolveColour(pal.land.fill, pal.land.fillOpacity, style);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = resolveColour(pal.land.stroke, pal.land.strokeOpacity, style);
  ctx.stroke();

  if (f.night.length) {
    ctx.fillStyle = resolveColour(pal.night, pal.nightOpacity, style);
    for (const n of f.night) {
      ctx.beginPath();
      path(n);
      ctx.fill();
    }
  }

  if (!f.flat && f.disc) {
    const { cx, cy, r } = f.disc;
    disc(ctx, cx, cy, r);
    ctx.fillStyle = radial(ctx, cx - 0.28 * r, cy - 0.4 * r, 1.6 * r, pal.shadeStops, style);
    ctx.fill();
    ctx.fillStyle = radial(ctx, cx, cy, r, pal.rimStops, style);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = resolveColour(pal.sphereStroke[0], pal.sphereStroke[1], style);
    ctx.stroke();
  }
}
