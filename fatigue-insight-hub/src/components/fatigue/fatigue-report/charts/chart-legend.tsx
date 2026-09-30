import type { ReactNode } from 'react';
import type { ChartPalette } from './chart-palette';

export interface LegendItem {
  label: string;
  swatch?: { fill: string; stroke?: string; dash?: string; thin?: boolean };
  line?: { stroke: string; dash?: string; width?: number };
  marker?: 'event' | 'rating' | 'model';
}

/** Wrapping legend inside the SVG (so exported images carry it). Returns its height. */
export function legendRow({ items, x, y, width, palette: p, fs }: {
  items: LegendItem[]; x: number; y: number; width: number; palette: ChartPalette; fs: number;
}): { height: number; node: ReactNode } {
  const nodes: ReactNode[] = [];
  let cx = x, cy = y;
  const lineH = fs + 8;
  items.forEach((item, i) => {
    const w = 18 + item.label.length * fs * 0.56 + 16;
    if (cx + w > x + width && cx > x) { cx = x; cy += lineH; }
    const my = cy + fs / 2 - 1;
    let mark: ReactNode;
    if (item.swatch) {
      const h = item.swatch.thin ? 4 : 9;
      mark = <rect x={cx} y={my - h / 2} width={13} height={h} rx={1.5} fill={item.swatch.fill} stroke={item.swatch.stroke ?? 'none'} strokeDasharray={item.swatch.dash} />;
    } else if (item.line) {
      mark = <line x1={cx} x2={cx + 13} y1={my} y2={my} stroke={item.line.stroke} strokeWidth={item.line.width ?? 2} strokeDasharray={item.line.dash} />;
    } else if (item.marker === 'event') {
      mark = <path d={`M${cx + 6.5},${my - 5} l5,9 h-10 z`} fill={p.event} />;
    } else if (item.marker === 'rating') {
      mark = <path d={`M${cx + 6.5},${my - 6} l5,6 l-5,6 l-5,-6 z`} fill={p.rating} />;
    } else {
      mark = <circle cx={cx + 6.5} cy={my} r={3.5} fill={p.surface} stroke={p.ink} strokeWidth={1.5} />;
    }
    nodes.push(
      <g key={i}>
        {mark}
        <text x={cx + 18} y={cy + fs - 1} fontSize={fs} fill={p.muted}>{item.label}</text>
      </g>,
    );
    cx += w;
  });
  return { height: cy - y + lineH, node: <g>{nodes}</g> };
}
