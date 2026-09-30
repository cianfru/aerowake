import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, Maximize2, X } from 'lucide-react';
import { Globe, type GlobeAirport, type GlobeFocus, type GlobeRoute } from '@/components/ui/globe';
import { Skeleton } from '@/components/ui/skeleton';
import { getAirportNamesAsync, getMultipleAirportsAsync, type AirportName } from '@/lib/airport-api';
import type { AirportData } from '@/data/airportCoordinates';
import { greatCircleNm, type LngLat } from '@/lib/map-geometry';
import { RISK_LEVEL_LABELS } from '@/lib/risk-scale';
import { cn } from '@/lib/utils';
import type { DutyAnalysis } from '@/types/fatigue';
import { buildRoutePairs, drawOrder, routeColour, routeWidth, type RoutePair } from './route-stats';
import { RouteLegend, RouteTable, SelectionCard, ViewSwitch, type RouteView } from './route-map-parts';

const modifierKey = () => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');

function helpText(view: RouteView, expanded: boolean): string {
  const zoom = expanded ? 'Scroll, pinch or double-tap to zoom.' : `Pinch, double-tap or ${modifierKey()} + scroll to zoom.`;
  return `${view === 'flat' ? 'Drag to pan.' : 'Drag to rotate.'} ${zoom} Select a route to highlight it.`;
}
/** Room around a selected route: the details card sits bottom-left from the sm breakpoint. */
const CARD_PAD = { top: 64, right: 84, bottom: 210, left: 56 };
const COMPACT_PAD = { top: 64, right: 84, bottom: 56, left: 56 };
const isWide = () => typeof window !== 'undefined' && (window.matchMedia?.('(min-width: 640px)').matches ?? true);

const KEYBOARD_HELP = 'Keyboard: arrow keys move the map, plus and minus zoom, 0 fits your routes, Home shows the whole world, Escape clears the selection.';

/** Scroll a row into view inside its own scroll container, never the page. */
function revealRow(container: HTMLElement | null, key: string) {
  if (!container || container.scrollHeight <= container.clientHeight) return;
  const row = container.querySelector<HTMLElement>(`[data-pair="${key}"]`);
  if (!row) return;
  const top = row.offsetTop - 36;
  const bottom = row.offsetTop + row.offsetHeight;
  if (top < container.scrollTop) container.scrollTop = top;
  else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight;
}

interface MapModel {
  airports: GlobeAirport[];
  routes: GlobeRoute[];
  fitTo: LngLat[];
}

/** Keyless route map (globe or flat) plus the route table. Renders a note without flight sectors. */
export function RouteNetwork({ duties, homeBase }: { duties: DutyAnalysis[]; homeBase: string }) {
  const pairs = useMemo(() => buildRoutePairs(duties, homeBase), [duties, homeBase]);
  const codes = useMemo(() => [...new Set([homeBase, ...pairs.flatMap((p) => [p.a, p.b])].filter(Boolean))], [pairs, homeBase]);
  const [airports, setAirports] = useState<Map<string, AirportData>>(new Map());
  const [names, setNames] = useState<Map<string, AirportName>>(new Map());
  const [view, setView] = useState<RouteView>('globe');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const dialogHelpId = useId();

  useEffect(() => {
    if (!codes.length) return;
    let cancelled = false;
    setLoading(true); setError('');
    getMultipleAirportsAsync(codes).then((m) => {
      if (cancelled) return;
      setAirports(new Map(m));
      getAirportNamesAsync([...m.keys()]).then((n) => { if (!cancelled) setNames(n); }, () => undefined);
    })
      .catch(() => { if (!cancelled) setError('Airport locations could not be loaded. Your routes are still listed below.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [codes, retry]);

  // Drop a selection that no longer exists (new roster).
  useEffect(() => {
    if (selected && !pairs.some((p) => p.key === selected)) setSelected(null);
  }, [pairs, selected]);

  const selectFromMap = useCallback((key: string | null) => {
    setSelected(key);
    if (key) requestAnimationFrame(() => { revealRow(listRef.current, key); revealRow(drawerRef.current, key); });
  }, []);

  const coord = useCallback((code: string): LngLat | null => {
    const a = airports.get(code);
    return a ? [a.lng, a.lat] : null;
  }, [airports]);

  const model = useMemo<MapModel>(() => {
    const maxSectors = Math.max(1, ...pairs.map((p) => p.sectors));
    const byAirport = new Map<string, number>();
    for (const p of pairs) for (const c of [p.a, p.b]) byAirport.set(c, (byAirport.get(c) ?? 0) + p.sectors);
    const ranked = [...byAirport.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
    const sel = pairs.find((p) => p.key === selected);
    const hov = pairs.find((p) => p.key === hovered);
    const priority = (code: string) => {
      if (code === homeBase) return 0;
      if (sel && (sel.a === code || sel.b === code)) return 1;
      if (hov && (hov.a === code || hov.b === code)) return 2;
      return 3 + Math.max(0, ranked.indexOf(code));
    };
    const place = (code: string) => names.get(code)?.city || names.get(code)?.name || undefined;
    const globeAirports = codes.flatMap((code) => {
      const a = airports.get(code);
      return a ? [{ code, lat: a.lat, lng: a.lng, emphasis: code === homeBase, name: place(code), priority: priority(code) }] : [];
    });
    const routes = drawOrder(pairs, selected, hovered).flatMap((p) => {
      const from = coord(p.a);
      const to = coord(p.b);
      if (!from || !to) return [];
      const kss = p.peakKss == null ? 'no KSS' : `peak KSS ${p.peakKss.toFixed(1)} (${RISK_LEVEL_LABELS[p.level]})`;
      return [{
        key: p.key, from, to, endpoints: [p.a, p.b] as [string, string],
        color: routeColour(p.level), width: routeWidth(p.sectors, maxSectors),
        title: `${p.a} ${p.directions.length > 1 ? '⇄' : '→'} ${p.b}: ${p.sectors} ${p.sectors === 1 ? 'sector' : 'sectors'}, ${kss}`,
      }];
    });
    return { airports: globeAirports, routes, fitTo: globeAirports.map((a) => [a.lng, a.lat] as LngLat) };
  }, [pairs, codes, airports, names, selected, hovered, homeBase, coord]);

  const selectedPair = pairs.find((p) => p.key === selected) ?? null;
  const focus = useMemo<GlobeFocus | null>(() => {
    if (!selectedPair) return null;
    const a = coord(selectedPair.a);
    const b = coord(selectedPair.b);
    return a && b ? { id: selectedPair.key, points: [a, b] } : null;
  }, [selectedPair, coord]);
  const distanceNm = focus ? greatCircleNm(focus.points[0], focus.points[1]) : null;
  const sectorBasis = pairs.length > 0 && pairs.every((p) => p.sectorBasis);
  const totalSectors = pairs.reduce((s, p) => s + p.sectors, 0);
  const mapReady = !loading && !error && model.airports.length > 0;
  const mapView: RouteView = view === 'list' ? 'globe' : view;

  if (!pairs.length) {
    return (
      <section aria-labelledby="routes-heading" className="instrument-surface space-y-3">
        <h2 id="routes-heading" className="text-lg font-semibold tracking-tight">Route network</h2>
        <p className="text-sm text-muted-foreground">No flight sectors were found in this roster. Training and standby remain available in the calendar.</p>
      </section>
    );
  }

  const mapLabel = `Route map: ${pairs.length} ${pairs.length === 1 ? 'route' : 'routes'}, ${codes.length} airports${homeBase ? `, based at ${homeBase}` : ''}`;
  const renderMap = (inDialog: boolean) => (
    <Globe
      key={inDialog ? 'dialog' : 'inline'}
      flat={mapView === 'flat'}
      airports={model.airports}
      routes={model.routes}
      fitTo={model.fitTo}
      focus={focus}
      focusPad={inDialog || isWide() ? CARD_PAD : COMPACT_PAD}
      selectedKey={selected}
      hoveredKey={hovered}
      onSelect={selectFromMap}
      onHover={setHovered}
      flow="selected"
      controls
      cooperative={!inDialog}
      ariaLabel={mapLabel}
      describedBy={inDialog ? dialogHelpId : helpId}
      className={inDialog ? 'absolute inset-0' : 'h-full w-full rounded-[inherit]'}
    >
      {!inDialog && (
        <button type="button" onClick={() => setExpanded(true)} aria-label="Expand map to full screen"
          className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-border/80 bg-card/90 text-foreground/80 shadow-[var(--shadow-card)] backdrop-blur-md transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {selectedPair && (
        <SelectionCard pair={selectedPair} distanceNm={distanceNm} names={names} onClear={() => setSelected(null)}
          className={cn('absolute bottom-3 left-3 z-10 w-[min(20rem,calc(100%-5rem))]', !inDialog && 'hidden sm:block')} />
      )}
    </Globe>
  );

  return (
    <section aria-labelledby="routes-heading" className="instrument-surface space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="routes-heading" className="text-lg font-semibold tracking-tight text-foreground">Route network</h2>
          <p className="text-sm text-muted-foreground">
            {pairs.length} {pairs.length === 1 ? 'route' : 'routes'} · {codes.length} airports · {totalSectors} {totalSectors === 1 ? 'sector' : 'sectors'}
          </p>
        </div>
        <ViewSwitch value={view} onChange={setView} />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-border/80 bg-muted/40 p-4 text-sm">
          <p>{error}</p>
          <button type="button" className="mt-2 font-medium text-primary underline underline-offset-2" onClick={() => setRetry((n) => n + 1)}>Retry map</button>
        </div>
      )}
      {!loading && !error && airports.size < codes.length && (
        <p className="text-sm text-muted-foreground">Missing coordinates: {codes.filter((c) => !airports.has(c)).join(', ')}. All routes remain in the table.</p>
      )}

      <div className={cn(view !== 'list' && 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]')}>
        {view !== 'list' && !error && (
          <div className="min-w-0 space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-[hsl(var(--surface-recessed))] sm:aspect-[16/10] lg:aspect-auto lg:h-[min(68vh,600px)]">
              {mapReady ? renderMap(false) : (
                <div role="status" className="absolute inset-0 grid place-items-center">
                  <Skeleton className="absolute inset-0 rounded-none bg-muted/40" />
                  <span className="relative text-sm text-muted-foreground">Loading airport locations…</span>
                </div>
              )}
            </div>
            {selectedPair && (
              <SelectionCard pair={selectedPair} distanceNm={distanceNm} names={names} onClear={() => setSelected(null)} className="sm:hidden" />
            )}
            <p id={helpId} className="text-xs text-muted-foreground">
              {helpText(mapView, false)}<span className="sr-only"> {KEYBOARD_HELP}</span>
            </p>
            <RouteLegend sectorBasis={sectorBasis} />
          </div>
        )}
        <RouteTable ref={listRef} pairs={pairs} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered}
          className={cn(view !== 'list' && 'lg:max-h-[min(68vh,600px)] lg:overflow-y-auto')} />
      </div>

      <Dialog.Root open={expanded && mapReady} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={(e) => { if (selected) { e.preventDefault(); setSelected(null); } }}
            onOpenAutoFocus={() => setDrawerOpen(window.matchMedia?.('(min-width: 1024px)').matches ?? true)}
            className="fixed inset-0 z-50 flex flex-col bg-background focus:outline-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3 md:px-6">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold tracking-tight">Route network</Dialog.Title>
                <p id={dialogHelpId} className="text-xs text-muted-foreground">{helpText(mapView, true)}<span className="sr-only"> {KEYBOARD_HELP}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <ViewSwitch value={mapView} onChange={setView} views={['globe', 'flat']} />
                <Dialog.Close aria-label="Close full-screen map"
                  className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="h-5 w-5" aria-hidden="true" />
                </Dialog.Close>
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              {expanded && renderMap(true)}
              <div className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-12rem)] w-[min(20rem,calc(100%-5rem))] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-[var(--shadow-elevated)] backdrop-blur-md lg:max-h-[calc(100%-1.5rem)]">
                <button type="button" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((o) => !o)}
                  className="flex min-h-11 items-center justify-between gap-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  Routes ({pairs.length})
                  <ChevronDown className={cn('h-4 w-4 transition-transform', drawerOpen && 'rotate-180')} aria-hidden="true" />
                </button>
                {drawerOpen && (
                  <RouteTable ref={drawerRef} pairs={pairs} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered}
                    className="min-h-0 overflow-y-auto border-t border-border/70 px-3 pb-2" />
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
