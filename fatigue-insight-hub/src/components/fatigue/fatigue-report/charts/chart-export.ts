/**
 * Export a report chart as SVG or PNG, always in the light print palette so
 * the image pastes cleanly into an operator form or e-mail.
 */
import { createElement, type ComponentType } from 'react';
import type { FatigueReport } from '@/lib/fatigue-report-api';
import { PRINT_PALETTE, type ChartPalette } from './chart-palette';

export type ChartComponent = ComponentType<{ report: FatigueReport; width: number; palette: ChartPalette; idPrefix: string }>;

export const EXPORT_WIDTH = 900;

export async function chartSvgMarkup(Chart: ChartComponent, report: FatigueReport, width = EXPORT_WIDTH): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(createElement(Chart, { report, width, palette: PRINT_PALETTE, idPrefix: 'x' }));
  // Explicit pixel size so image viewers do not fall back to 300×150.
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup);
  const sized = vb ? markup.replace('width="100%"', `width="${vb[1]}" height="${vb[2]}"`) : markup;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${sized}`;
}

export async function chartPngBlob(Chart: ChartComponent, report: FatigueReport, scale = 2): Promise<Blob> {
  const svg = await chartSvgMarkup(Chart, report);
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const w = vb ? Number(vb[1]) : EXPORT_WIDTH, h = vb ? Number(vb[2]) : 400;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Image render failed')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies the chart as a PNG image; resolves false when the browser does not allow it. */
export async function copyChartImage(Chart: ChartComponent, report: FatigueReport): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    // Safari needs the ClipboardItem created synchronously inside the gesture, with a promise.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': chartPngBlob(Chart, report) })]);
    return true;
  } catch {
    return false;
  }
}
