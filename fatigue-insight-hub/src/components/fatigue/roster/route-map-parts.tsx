/**
 * Presentational pieces of the route map: view switch, legend, selection card
 * and the route table (the accessible equivalent of the map).
 */
import { Fragment, forwardRef, type ReactNode } from 'react';
import { Globe2, List, Map as MapIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, type RiskLevel } from '@/lib/risk-scale';
import type { AirportName } from '@/lib/airport-api';
import { RiskLabel } from './primitives';
import { formatBlock, median, routeColour, type RouteDirection, type RoutePair } from './route-stats';

export type RouteView = 'globe' | 'flat' | 'list';

const VIEWS: Array<{ id: RouteView; label: string; icon: typeof Globe2 }> = [
  { id: 'globe', label: 'Globe', icon: Globe2 },
  { id: 'flat', label: 'Map', icon: MapIcon },
  { id: 'list', label: 'List', icon: List },
];

export function ViewSwitch({ value, onChange, views = ['globe', 'flat', 'list'], className }: {
  value: RouteView; onChange: (view: RouteView) => void; views?: RouteView[]; className?: string;
}) {
  return (
    <div role="group" aria-label="Map view" className={cn('inline-flex rounded-xl border border-border/80 bg-secondary/60 p-1', className)}>
      {VIEWS.filter((v) => views.includes(v.id)).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[var(--shadow-card)]"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

const LEGEND: Array<{ level: RiskLevel; label: string; range: string }> = [
  { level: 'low', label: 'Low', range: '< 5.5' },
  { level: 'moderate', label: 'Moderate', range: '5.5–6.5' },
  { level: 'high', label: 'High', range: '6.5–7.5' },
  { level: 'critical', label: 'Critical / extreme', range: '≥ 7.5' },
];

export function RouteLegend({ sectorBasis }: { sectorBasis: boolean }) {
  return (
    <div className="space-y-2">
      <ul aria-label="Map legend: peak predicted KSS on each route" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <li className="eyebrow">Peak KSS</li>
        {LEGEND.map(({ level, label, range }) => (
          <li key={level} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-[3px] w-5 rounded-full" style={{ backgroundColor: routeColour(level) }} />
            <span className="text-foreground/85">{label}</span>
            <span className="font-mono tabular">{range}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0 w-5 border-t border-dotted border-foreground/60" />
          Great-circle track
        </li>
        <li>Thicker lines: more sectors</li>
      </ul>
      <p className="text-xs leading-5 text-muted-foreground">
        {sectorBasis
          ? 'Colour shows the highest predicted KSS during any sector on the route this month. '
          : 'Colour shows the peak predicted KSS of the duties that include each route (whole duty, not a sector-specific prediction). '}
        Arcs are lifted for legibility; the dotted line beneath is the actual great-circle track.
      </p>
    </div>
  );
}

const kssText = (kss: number | null) => (kss == null ? '—' : kss.toFixed(1));

function directionOf(pair: RoutePair, from: string): RouteDirection | undefined {
  return pair.directions.find((d) => d.from === from);
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm tabular text-foreground">{children}</dd>
    </div>
  );
}

/** Details of the selected route: peak KSS, sectors, distance and typical block time. */
export function SelectionCard({ pair, distanceNm, names, onClear, className }: {
  pair: RoutePair; distanceNm: number | null; names: Map<string, AirportName>; onClear: () => void; className?: string;
}) {
  const out = directionOf(pair, pair.a);
  const back = directionOf(pair, pair.b);
  const both = !!out && !!back;
  const place = (code: string) => names.get(code)?.city || names.get(code)?.name || '';
  const cities = [place(pair.a), place(pair.b)];
  const blockOut = formatBlock(median(out?.blockHours ?? []));
  const blockBack = formatBlock(median(back?.blockHours ?? []));
  return (
    <div role="status" aria-live="polite" className={cn('rounded-xl border border-border/80 bg-card/95 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-md', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-base font-semibold tracking-tight">
            {pair.a} {both ? '⇄' : '→'} {pair.b}
            <span className="sr-only"> selected.</span>
          </p>
          {(cities[0] || cities[1]) && <p className="truncate text-xs text-muted-foreground">{cities.map((c, i) => c || [pair.a, pair.b][i]).join(' · ')}</p>}
        </div>
        <button type="button" onClick={onClear} aria-label="Clear route selection"
          className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Peak KSS">
          <span className="mr-2">{kssText(pair.peakKss)}</span>
          <RiskLabel level={pair.level} className="align-middle" />
        </Fact>
        <Fact label="Sectors">{both ? `${out!.sectors} out · ${back!.sectors} back` : pair.sectors}</Fact>
        <Fact label="Distance">{distanceNm == null ? '—' : `${Math.round(distanceNm).toLocaleString('en-GB')} NM`}</Fact>
        <Fact label={both ? 'Block (median)' : 'Block time (median)'}>{both ? `${blockOut} · ${blockBack}` : out ? blockOut : blockBack}</Fact>
      </dl>
    </div>
  );
}

function routeAria(pair: RoutePair): string {
  const both = pair.directions.length > 1;
  const level = RISK_LEVEL_LABELS[pair.level];
  const kss = pair.peakKss == null ? 'no KSS' : `peak KSS ${pair.peakKss.toFixed(1)}, ${level}`;
  return `${pair.a} to ${pair.b}${both ? ' and back' : ''}, ${pair.sectors} ${pair.sectors === 1 ? 'sector' : 'sectors'}, ${kss}. Show on map`;
}

/** Route pairs with their directional rows; selecting a pair highlights it on the map. */
export const RouteTable = forwardRef<HTMLDivElement, {
  pairs: RoutePair[];
  selected: string | null;
  hovered: string | null;
  onSelect: (key: string | null) => void;
  onHover: (key: string | null) => void;
  className?: string;
}>(function RouteTable({ pairs, selected, hovered, onSelect, onHover, className }, ref) {
  return (
    <div ref={ref} className={cn('min-w-0', className)}>
      <table className="w-full text-sm">
        <caption className="sr-only">Routes flown this month with sectors and peak predicted KSS. Select a route to show it on the map.</caption>
        <thead className="sticky top-0 z-[1] bg-card text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pl-1 font-medium">Route</th>
            <th scope="col" className="py-2 text-right font-medium">Sectors</th>
            <th scope="col" className="py-2 pr-1 text-right font-medium">Peak KSS</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => {
            const isSelected = selected === p.key;
            const isHovered = hovered === p.key && !isSelected;
            return (
              <Fragment key={p.key}>
                <tr
                  data-pair={p.key}
                  className={cn('border-t border-border/60 transition-colors', isSelected && 'bg-secondary shadow-[inset_3px_0_0_hsl(var(--primary))]', isHovered && 'bg-muted/50')}
                  onMouseEnter={() => onHover(p.key)}
                  onMouseLeave={() => onHover(null)}
                >
                  <td className="py-0 pl-1">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={routeAria(p)}
                      onClick={() => onSelect(isSelected ? null : p.key)}
                      onFocus={() => onHover(p.key)}
                      onBlur={() => onHover(null)}
                      className="flex min-h-11 w-full items-center gap-2.5 py-2 text-left font-mono tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:font-semibold"
                    >
                      <span aria-hidden="true" className="h-[3px] w-5 shrink-0 rounded-full" style={{ backgroundColor: routeColour(p.level) }} />
                      <span>{p.a} {p.directions.length > 1 ? '⇄' : '→'} {p.b}</span>
                    </button>
                  </td>
                  <td className="py-2 text-right font-mono tabular">{p.sectors}</td>
                  <td className="py-2 pr-1 text-right font-mono tabular">
                    {kssText(p.peakKss)}
                    <span className="sr-only"> ({RISK_LEVEL_LABELS[p.level]})</span>
                  </td>
                </tr>
                {p.directions.length > 1 && p.directions.map((d) => (
                  <tr key={d.key} data-direction={d.key} className={cn('text-xs text-muted-foreground', isSelected && 'bg-secondary shadow-[inset_3px_0_0_hsl(var(--primary))]', isHovered && 'bg-muted/50')}
                    onMouseEnter={() => onHover(p.key)} onMouseLeave={() => onHover(null)}>
                    <td className="py-1 pl-[2.1rem] font-mono tabular"><span className="sr-only">Direction </span>{d.from} → {d.to}</td>
                    <td className="py-1 text-right font-mono tabular">{d.sectors}</td>
                    <td className="py-1 pr-1 text-right font-mono tabular">{kssText(d.peakKss)}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
