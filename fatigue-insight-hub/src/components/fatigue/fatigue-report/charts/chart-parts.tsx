import type { ChartPalette } from './chart-palette';

/** Pattern fills: they keep estimated sleep, planned and not-operated duties distinct in black and white. */
export function ChartPatterns({ idPrefix, palette: p }: { idPrefix: string; palette: ChartPalette }) {
  return (
    <defs>
      <pattern id={`${idPrefix}-est`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={5} height={5} fill={p.surface} />
        <line x1={0} y1={0} x2={0} y2={5} stroke={p.sleep} strokeWidth={1.8} />
      </pattern>
      <pattern id={`${idPrefix}-planned`} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} fill={p.surface} />
        <circle cx={3} cy={3} r={0.9} fill={p.muted} />
      </pattern>
      <pattern id={`${idPrefix}-cross`} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} fill={p.surface} />
        <path d="M0,0 L6,6 M6,0 L0,6" stroke={p.muted} strokeWidth={0.8} />
      </pattern>
      <pattern id={`${idPrefix}-wocl`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width={6} height={6} fill={p.wocl} fillOpacity={0.07} />
        <line x1={0} y1={0} x2={0} y2={6} stroke={p.wocl} strokeWidth={0.8} strokeOpacity={0.35} />
      </pattern>
    </defs>
  );
}

