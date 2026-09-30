import { useEffect, useState } from 'react';

/**
 * Colours of the keyless globe and flat map. The app palettes follow the theme
 * (dark: token-driven glow; light: pale chart paper); the daylight palette is
 * the landing page's, which stays light in dark mode.
 */
export interface Palette {
  halo: number;
  /** Extra casing width (px) beyond the route stroke. */
  casingWidth: number;
  casingOpacity: number;
  haloStops: Array<[number, string, number]>;
  oceanStops: Array<[number, string, number]>;
  shadeStops: Array<[number, string, number]>;
  rimStops: Array<[number, string, number]>;
  flatOcean: [string, number];
  sphereStroke: [string, number];
  graticule: [string, number];
  land: { fill: string; fillOpacity: number; stroke: string; strokeOpacity: number };
  night: string;
  /** Opacity of each stacked night layer (the terminator). */
  nightOpacity: number;
  casing: string | null;
  ground: [string, number];
  flow: string;
  marker: { fill: string; stroke: string };
  label: { fill: string; halo: string };
}

/** Dark theme: token-driven, glowing on the dark surface. */
export const APP_DARK: Palette = {
  halo: 1.07,
  casingWidth: 3,
  casingOpacity: 0.9,
  haloStops: [[1 / 1.07, 'hsl(var(--primary))', 0.2], [0.965, 'hsl(var(--primary))', 0.06], [1, 'hsl(var(--primary))', 0]],
  oceanStops: [[0, 'hsl(var(--primary))', 0.17], [1, 'hsl(var(--primary))', 0.035]],
  shadeStops: [[0, 'hsl(var(--foreground))', 0.05], [0.45, 'hsl(var(--foreground))', 0], [1, 'hsl(var(--background))', 0.32]],
  rimStops: [[0.86, 'hsl(var(--primary))', 0], [1, 'hsl(var(--primary))', 0.2]],
  flatOcean: ['hsl(var(--primary))', 0.07],
  sphereStroke: ['hsl(var(--primary))', 0.4],
  graticule: ['hsl(var(--primary))', 0.09],
  land: { fill: 'hsl(var(--primary))', fillOpacity: 0.15, stroke: 'hsl(var(--primary))', strokeOpacity: 0.34 },
  night: 'hsl(var(--background))',
  nightOpacity: 0.06,
  casing: 'hsl(var(--card))',
  ground: ['hsl(var(--foreground))', 0.28],
  flow: 'hsl(var(--card))',
  marker: { fill: 'hsl(var(--card))', stroke: 'hsl(var(--foreground))' },
  label: { fill: 'hsl(var(--foreground))', halo: 'hsl(var(--card))' },
};

/** Light theme: a pale chart-paper globe with white casings under the routes. */
export const APP_LIGHT: Palette = {
  halo: 1.07,
  casingWidth: 3,
  casingOpacity: 0.95,
  haloStops: [[1 / 1.07, '#8fc3d6', 0.45], [0.965, '#b9dbe7', 0.15], [1, '#b9dbe7', 0]],
  oceanStops: [[0, '#f6fafc', 1], [0.65, '#e1ecf1', 1], [1, '#c9dce4', 1]],
  shadeStops: [[0, '#ffffff', 0.35], [0.45, '#ffffff', 0], [1, '#0b2c3f', 0.16]],
  rimStops: [[0.86, '#ffffff', 0], [1, '#ffffff', 0.55]],
  flatOcean: ['#e5eff3', 1],
  sphereStroke: ['#7fa9ba', 0.7],
  graticule: ['#0b2c3f', 0.07],
  land: { fill: '#8fa9b6', fillOpacity: 0.5, stroke: '#5f8292', strokeOpacity: 0.45 },
  night: '#0b2c3f',
  nightOpacity: 0.06,
  casing: 'hsl(var(--card))',
  ground: ['hsl(var(--foreground))', 0.4],
  flow: '#ffffff',
  marker: { fill: 'hsl(var(--card))', stroke: 'hsl(var(--foreground))' },
  label: { fill: 'hsl(var(--foreground))', halo: 'hsl(var(--card))' },
};

/** Fixed daylight palette of the landing page (it stays light in dark mode). */
export const DAYLIGHT: Palette = {
  halo: 1.15,
  casingWidth: 0,
  casingOpacity: 0,
  haloStops: [[1 / 1.15, '#6fc0db', 0.55], [0.95, '#9fd6e8', 0.12], [1, '#9fd6e8', 0]],
  oceanStops: [[0, '#eaf6fa', 1], [0.6, '#bcd9e4', 1], [1, '#8fb6c6', 1]],
  shadeStops: [[0, '#ffffff', 0.45], [0.45, '#ffffff', 0], [1, '#0b2c3f', 0.28]],
  rimStops: [[0.86, '#e6f7fc', 0], [1, '#e6f7fc', 0.55]],
  flatOcean: ['#dcebf2', 1],
  sphereStroke: ['#7fb3c6', 0.6],
  graticule: ['#0b2c3f', 0.06],
  land: { fill: '#6f98aa', fillOpacity: 0.55, stroke: '#4f7d91', strokeOpacity: 0.5 },
  night: '#0b2c3f',
  nightOpacity: 0.035,
  casing: null,
  ground: ['#0b2c3f', 0.1],
  flow: '#e9fbff',
  marker: { fill: '#fcfdfe', stroke: '#0b2c3f' },
  label: { fill: '#0b2c3f', halo: '#fcfdfe' },
};

/** The app theme class on <html> ('light' or 'dark'), kept in sync. */
export function useDocumentTheme(): 'light' | 'dark' {
  const read = () => (typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark');
  const [theme, setTheme] = useState<'light' | 'dark'>(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(() => setTheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}


export function usePalette(appearance: 'app' | 'daylight'): Palette {
  const theme = useDocumentTheme();
  return appearance === 'daylight' ? DAYLIGHT : theme === 'light' ? APP_LIGHT : APP_DARK;
}
