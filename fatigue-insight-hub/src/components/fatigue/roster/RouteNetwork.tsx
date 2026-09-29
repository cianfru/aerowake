import { useEffect, useMemo, useState } from 'react';
import { Globe, type GlobeRoute } from '@/components/ui/globe';
import { getMultipleAirportsAsync } from '@/lib/airport-api';
import type { AirportData } from '@/data/airportCoordinates';
import { RISK_LEVEL_LABELS, riskCssColor, type RiskLevel } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { dutyPeakKss, dutyRiskLevel } from './roster-utils';
import { SectionHeading } from './primitives';

const ORDER: RiskLevel[] = ['unknown', 'low', 'moderate', 'high', 'critical', 'extreme'];

interface RouteStat {
  key: string;
  a: string;
  b: string;
  count: number;
  worst: RiskLevel;
  worstKss: number | null;
}

/** Route pairs flown this month (directional), with the worst duty risk on each. */
function routeStats(duties: DutyAnalysis[]): RouteStat[] {
  const map = new Map<string, RouteStat>();
  for (const d of duties) {
    const level = dutyRiskLevel(d);
    const kss = dutyPeakKss(d);
    for (const s of d.flightSegments ?? []) {
      if (!s.departure || !s.arrival || s.activityCode === 'IR') continue;
      const [a, b] = [s.departure, s.arrival];
      const key = `${a}-${b}`;
      const cur = map.get(key) ?? { key, a, b, count: 0, worst: 'unknown' as RiskLevel, worstKss: null };
      cur.count += 1;
      if (ORDER.indexOf(level) > ORDER.indexOf(cur.worst)) cur.worst = level;
      if (kss != null && (cur.worstKss == null || kss > cur.worstKss)) cur.worstKss = kss;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

/** Keyless route globe + frequency table. Renders nothing without flight sectors. */
export function RouteNetwork({ duties, homeBase }: { duties: DutyAnalysis[]; homeBase: string }) {
  const stats = useMemo(() => routeStats(duties), [duties]);
  const codes = useMemo(() => [...new Set([...stats.flatMap((s) => [s.a, s.b]), homeBase].filter(Boolean))], [stats, homeBase]);
  const [airports, setAirports] = useState<Map<string, AirportData>>(new Map());

  const [view, setView] = useState<'globe' | 'flat' | 'list'>('globe');
  const [selection, setSelection] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!codes.length) return;
    let cancelled = false;
    setLoading(true); setError('');
    getMultipleAirportsAsync(codes).then((m) => { if (!cancelled) setAirports(new Map(m)); })
      .catch(() => { if (!cancelled) setError('Airport locations could not be loaded. Your routes are still listed below.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [codes, retry]);

  if (!stats.length) return null;

  const base = airports.get(homeBase);
  const maxCount = Math.max(...stats.map((s) => s.count));
  const routes: GlobeRoute[] = stats.flatMap((s) => {
    const a = airports.get(s.a);
    const b = airports.get(s.b);
    if (!a || !b || (selection && selection !== s.key)) return [];
    return [{
      from: [a.lng, a.lat] as [number, number],
      to: [b.lng, b.lat] as [number, number],
      color: riskCssColor(s.worst),
      width: 1.25 + 2.25 * (s.count / maxCount),
      title: `${s.a} – ${s.b}: ${s.count} sectors, worst ${RISK_LEVEL_LABELS[s.worst]}`,
    }];
  });
  const globeAirports = codes
    .map((c) => airports.get(c))
    .filter((a): a is AirportData => !!a)
    .map((a) => ({ code: a.code, lat: a.lat, lng: a.lng, emphasis: a.code === homeBase }));

  return (
    <section aria-labelledby="routes-heading" className="space-y-4">
      <SectionHeading id="routes-heading" title="Route network" aside={`${stats.length} routes · ${codes.length} airports · drag to rotate`} />
      <div className="flex flex-wrap items-center gap-2" aria-label="Map view">{(['globe', 'flat', 'list'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className="rounded border border-border px-3 py-2 text-sm capitalize aria-pressed:bg-secondary">{v === 'flat' ? 'Flat routes' : v}</button>)}<button onClick={() => { setReset(n => n + 1); setSelection(null); }} className="px-3 py-2 text-sm text-primary">Reset to base</button></div>
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading airport locations…</p>}
      {error && <div role="alert" className="text-sm"><p>{error}</p><button className="mt-2 text-primary underline" onClick={() => setRetry(n => n + 1)}>Retry map</button></div>}
      {!loading && !error && airports.size < codes.length && <p className="text-sm text-muted-foreground">Missing coordinates: {codes.filter(c => !airports.has(c)).join(', ')}. All routes remain in the table.</p>}
      <p className="text-xs text-muted-foreground">Colors show peak risk across each whole duty, not a sector-specific prediction. Use arrow keys to rotate the globe; Home resets it.</p>
      <div className={view === 'list' ? '' : "grid items-start gap-8 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"}>
        {view !== 'list' && <div className="mx-auto w-full max-w-[420px]">
          <Globe
            key={reset}
            flat={view === 'flat'}
            airports={globeAirports}
            routes={routes}
            center={base ? [base.lng, base.lat] : undefined}
            ariaLabel={`Globe of ${stats.length} routes flown this month`}
          />
        </div>}
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 font-medium">Route</th>
              <th className="py-2 text-right font-medium">Sectors</th>
              <th className="py-2 text-right font-medium">Worst KSS</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.key} className="border-b border-border/60">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-[3px] w-4" style={{ backgroundColor: riskCssColor(s.worst) }} />
                    <button className="py-2 font-mono text-left hover:underline" aria-pressed={selection === s.key} onClick={() => setSelection(selection === s.key ? null : s.key)}>{s.a} → {s.b}</button>
                  </span>
                </td>
                <td className="py-2 text-right font-mono tabular">{s.count}</td>
                <td className="py-2 text-right font-mono tabular">
                  {s.worstKss != null ? s.worstKss.toFixed(1) : '—'}
                  <span className="sr-only"> ({RISK_LEVEL_LABELS[s.worst]})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
