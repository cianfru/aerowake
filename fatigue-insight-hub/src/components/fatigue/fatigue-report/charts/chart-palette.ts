/**
 * Chart colours. On screen they follow the theme tokens through CSS custom
 * properties; in print and in exported images they switch to a fixed light
 * palette that also survives black-and-white printing (patterns carry the
 * reported/estimated and duty-status distinctions, not colour alone).
 */
export interface ChartPalette {
  surface: string;
  ink: string;
  muted: string;
  grid: string;
  wocl: string;
  sleep: string;
  duty: string;
  sector: string;
  event: string;
  rating: string;
  moderate: string;
  high: string;
  critical: string;
  extreme: string;
  font: string;
}

export const SCREEN_PALETTE: ChartPalette = {
  surface: 'var(--rc-surface)',
  ink: 'var(--rc-ink)',
  muted: 'var(--rc-muted)',
  grid: 'var(--rc-grid)',
  wocl: 'var(--rc-wocl)',
  sleep: 'var(--rc-sleep)',
  duty: 'var(--rc-duty)',
  sector: 'var(--rc-sector)',
  event: 'var(--rc-event)',
  rating: 'var(--rc-rating)',
  moderate: 'var(--rc-moderate)',
  high: 'var(--rc-high)',
  critical: 'var(--rc-critical)',
  extreme: 'var(--rc-extreme)',
  font: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

/** Light, print-safe values (also used for PNG/SVG export). */
export const PRINT_PALETTE: ChartPalette = {
  surface: '#ffffff',
  ink: '#16202b',
  muted: '#4a5563',
  grid: '#c9d0d8',
  wocl: '#7b5aa6',
  sleep: '#1d3f66',
  duty: '#9aa4b1',
  sector: '#3b4655',
  event: '#b0183d',
  rating: '#16202b',
  moderate: '#c79a00',
  high: '#c2521c',
  critical: '#a3164a',
  extreme: '#5c0b2b',
  font: SCREEN_PALETTE.font,
};

const vars = (p: ChartPalette) => `--rc-surface:${p.surface};--rc-ink:${p.ink};--rc-muted:${p.muted};--rc-grid:${p.grid};--rc-wocl:${p.wocl};--rc-sleep:${p.sleep};--rc-duty:${p.duty};--rc-sector:${p.sector};--rc-event:${p.event};--rc-rating:${p.rating};--rc-moderate:${p.moderate};--rc-high:${p.high};--rc-critical:${p.critical};--rc-extreme:${p.extreme};`;

/** Theme-aware custom properties for `.report-chart`, with the print override. */
export const CHART_CSS = `
.report-chart {
  --rc-surface: hsl(var(--card));
  --rc-ink: hsl(var(--foreground));
  --rc-muted: hsl(var(--muted-foreground));
  --rc-grid: hsl(var(--border));
  --rc-wocl: hsl(var(--wocl));
  --rc-sleep: hsl(var(--primary));
  --rc-duty: hsl(var(--muted-foreground) / 0.55);
  --rc-sector: hsl(var(--foreground) / 0.8);
  --rc-event: hsl(var(--critical));
  --rc-rating: hsl(var(--foreground));
  --rc-moderate: hsl(var(--warning));
  --rc-high: hsl(var(--high));
  --rc-critical: hsl(var(--critical));
  --rc-extreme: hsl(var(--critical));
}
@media print { .report-chart { ${vars(PRINT_PALETTE)} } }
`;
