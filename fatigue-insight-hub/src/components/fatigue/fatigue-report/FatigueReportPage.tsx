import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BedDouble, CalendarClock, ClipboardList, FileWarning,
  Loader2, Plane, Plus, Trash2, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { getAirportCoordinatesAsync } from '@/lib/airport-api';
import { cn } from '@/lib/utils';
import {
  FACTOR_OPTIONS, KSS_OPTIONS, SAMN_PERELLI_OPTIONS,
  dutiesInPeriod, estimatedSleepsFromAnalysis, generateFatigueReport, localInputToUtcIso, utcIsoToLocalInput,
  type DutyStatus, type EventType, type FatigueReport, type ReportDuty, type ReportSector, type ReportSleep,
} from '@/lib/fatigue-report-api';
import { FatigueReportView } from './FatigueReportView';

const STEPS = [
  { id: 'event', label: 'Event', icon: CalendarClock },
  { id: 'duties', label: 'Duties', icon: Plane },
  { id: 'sleep', label: 'Sleep', icon: BedDouble },
  { id: 'feel', label: 'How you feel', icon: UserRound },
] as const;

const field = 'block space-y-1.5 text-sm';
const select = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground';

const STATUS_LABEL: Record<DutyStatus, string> = {
  operated: 'Operated',
  planned: 'Planned (not yet flown)',
  cancelled_fatigue: 'Not operated — fatigue',
  not_operated: 'Not operated — other reason',
};

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function hoursBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600e3;
  return Number.isFinite(h) ? h : null;
}

function fmtH(h: number | null): string {
  if (h == null) return '—';
  const whole = Math.floor(h);
  return `${whole}h${String(Math.round((h - whole) * 60)).padStart(2, '0')}`;
}

/** datetime-local bound to a UTC ISO value, displayed in `tz`. */
function TimeInput({ value, onChange, tz, label, required }: {
  value: string; onChange: (iso: string) => void; tz: string; label: string; required?: boolean;
}) {
  return (
    <label className={field}>
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="datetime-local"
        aria-label={label}
        required={required}
        value={value ? utcIsoToLocalInput(value, tz) : ''}
        onChange={(e) => {
          const iso = localInputToUtcIso(e.target.value, tz);
          if (iso) onChange(iso);
        }}
      />
    </label>
  );
}

export function FatigueReportPage() {
  const { state } = useAnalysis();
  const results = state.analysisResults;

  const [step, setStep] = useState(0);
  const [report, setReport] = useState<FatigueReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Home base & time display
  const [homeBase, setHomeBase] = useState(results?.pilotBase ?? state.settings.homeBase ?? '');
  const [homeTz, setHomeTz] = useState(results?.homeBaseTimezone ?? '');
  const [timeMode, setTimeMode] = useState<'local' | 'utc'>('local');
  const inputTz = timeMode === 'utc' || !homeTz ? 'UTC' : homeTz;

  // Event
  const now = useMemo(() => new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), []);
  const [eventType, setEventType] = useState<EventType>('fatigue_call_before_duty');
  const [eventTime, setEventTime] = useState(now);
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 3 * 86400e3).toISOString());
  const [periodEnd, setPeriodEnd] = useState(new Date(Date.now() + 12 * 3600e3).toISOString());

  // Duties & sleep
  const [duties, setDuties] = useState<ReportDuty[]>([]);
  const [affectedId, setAffectedId] = useState<string | null>(null);
  const [sleeps, setSleeps] = useState<(ReportSleep & { key: string })[]>([]);
  const [prefilledFor, setPrefilledFor] = useState('');

  // Self assessment
  const [kss, setKss] = useState<number | null>(null);
  const [sp, setSp] = useState<number | null>(null);
  const [factors, setFactors] = useState<string[]>([]);
  const [narrative, setNarrative] = useState('');
  const [pilot, setPilot] = useState({ name: state.analysisResults?.pilotName ?? '', staff_number: '', rank: '', fleet: '', operator: '' });

  // Resolve the home-base time zone for manual entry.
  useEffect(() => {
    if (results?.homeBaseTimezone) return;
    const code = homeBase.trim().toUpperCase();
    if (code.length < 3) return;
    let cancelled = false;
    getAirportCoordinatesAsync(code).then((a) => {
      if (!cancelled && a?.timezone) setHomeTz(a.timezone);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [homeBase, results?.homeBaseTimezone]);

  // Pre-fill duties and estimated sleep from the loaded roster when entering step 2.
  const periodKey = `${periodStart}|${periodEnd}`;
  const prefill = () => {
    if (!results) return;
    const found = dutiesInPeriod(results, periodStart, periodEnd);
    setDuties(found);
    setSleeps(estimatedSleepsFromAnalysis(results, periodStart, periodEnd).map((s) => ({ ...s, key: newId('s') })));
    const eventMs = new Date(eventTime).getTime();
    const next = found.find((d) => new Date(d.release_utc).getTime() >= eventMs);
    setAffectedId(next?.id ?? null);
    if (next && eventType === 'fatigue_call_before_duty') {
      setDuties((ds) => ds.map((d) => (d.id === next.id ? { ...d, status: 'cancelled_fatigue' } : d)));
    }
    setPrefilledFor(periodKey);
  };

  const goTo = (n: number) => {
    setError('');
    if (n === 1 && results && prefilledFor !== periodKey) prefill();
    setStep(n);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const eventValid = !!homeTz && !!eventTime && !!periodStart && !!periodEnd && periodEnd > periodStart;

  // ── Duty editing ──
  const updateDuty = (id: string, patch: Partial<ReportDuty>) =>
    setDuties((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const updateSector = (id: string, i: number, patch: Partial<ReportSector>) =>
    setDuties((ds) => ds.map((d) => (d.id === id
      ? { ...d, sectors: d.sectors.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : d)));
  const addDuty = () => {
    const report = eventTime;
    const release = new Date(new Date(report).getTime() + 8 * 3600e3).toISOString();
    const duty: ReportDuty = {
      id: newId('d'), report_utc: report, release_utc: release, sectors: [], status: 'operated',
      duty_type: 'flight', source: 'manual',
    };
    setDuties((ds) => [...ds, duty].sort((a, b) => a.report_utc.localeCompare(b.report_utc)));
  };
  const addSector = (d: ReportDuty) => {
    const last = d.sectors[d.sectors.length - 1];
    const dep = last ? new Date(new Date(last.arrival_utc).getTime() + 45 * 60e3) : new Date(new Date(d.report_utc).getTime() + 60 * 60e3);
    updateDuty(d.id, {
      sectors: [...d.sectors, {
        flight_number: '', departure: last?.arrival ?? homeBase.toUpperCase(), arrival: '',
        departure_utc: dep.toISOString(), arrival_utc: new Date(dep.getTime() + 2 * 3600e3).toISOString(),
      }],
    });
  };

  // ── Sleep editing ──
  const updateSleep = (key: string, patch: Partial<ReportSleep>) =>
    setSleeps((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch, source: 'reported' } : s)));
  const addSleep = (kind: 'main' | 'nap') => {
    const last = sleeps[sleeps.length - 1];
    const start = last ? new Date(new Date(last.end_utc).getTime() + 16 * 3600e3) : new Date(periodStart);
    const hours = kind === 'nap' ? 1 : 7.5;
    const entry: ReportSleep & { key: string } = {
      key: newId('s'), start_utc: start.toISOString(),
      end_utc: new Date(start.getTime() + hours * 3600e3).toISOString(),
      kind, location: 'home', quality: null, source: 'reported',
    };
    setSleeps((ss) => [...ss, entry].sort((a, b) => a.start_utc.localeCompare(b.start_utc)));
  };

  const sleepIssues = useMemo(() => {
    const issues: string[] = [];
    const sorted = [...sleeps].sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    sorted.forEach((s, i) => {
      if (s.end_utc <= s.start_utc) issues.push(`Sleep ${i + 1}: wake time is before sleep time.`);
      if (i && s.start_utc < sorted[i - 1].end_utc) issues.push(`Sleep ${i + 1} overlaps the previous sleep.`);
    });
    return issues;
  }, [sleeps]);

  const unconfirmed = sleeps.filter((s) => s.source === 'estimated').length;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const r = await generateFatigueReport({
        home_base: homeBase.trim() ? homeBase.trim().toUpperCase() : null,
        home_timezone: homeTz || null,
        event_type: eventType,
        event_time_utc: eventTime,
        period_start_utc: periodStart,
        period_end_utc: periodEnd,
        affected_duty_id: affectedId,
        duties,
        sleeps: sleeps.map(({ key: _key, ...s }) => s),
        self_assessment: { kss, samn_perelli: sp, rated_at_utc: eventTime },
        contributing_factors: factors,
        narrative,
        pilot,
      });
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (report) {
    return <FatigueReportView report={report} onEdit={() => setReport(null)} />;
  }

  const tzLabel = inputTz === 'UTC' ? 'UTC' : `${homeTz} (home-base local)`;

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <FileWarning className="h-4 w-4" /> Fatigue report
        </p>
        <h1 className="text-3xl font-semibold">Report fatigue</h1>
        <p className="text-muted-foreground">
          Describe what happened in a few steps. AeroWake checks your sleep and duties against published
          sleep science and EASA rest rules, then writes a structured report you can submit through your
          operator&apos;s fatigue reporting system. Nothing is stored on our servers.
        </p>
        {results ? (
          <p className="text-sm text-muted-foreground">
            Duties and estimated sleep will be pre-filled from your loaded roster
            {results.month ? ` (${results.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })})` : ''}.
            Please correct the sleep times to what actually happened.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No roster loaded — enter duties manually, or upload a roster first to pre-fill them.
          </p>
        )}
      </header>

      {/* Stepper */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Report steps">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => (i <= step || eventValid) && goTo(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs sm:text-sm transition-colors',
                i === step ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{i + 1}. {s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Enter times in</span>
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Time entry mode">
          {(['local', 'utc'] as const).map((m) => (
            <button key={m} type="button" disabled={m === 'local' && !homeTz}
              onClick={() => setTimeMode(m)}
              className={cn('rounded px-3 py-1', timeMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {m === 'local' ? 'Home-base local' : 'UTC'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Showing: {tzLabel}</span>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={field}>
                  <span className="text-muted-foreground">Home base (IATA)</span>
                  <Input value={homeBase} maxLength={4} placeholder="e.g. LGW"
                    onChange={(e) => setHomeBase(e.target.value.toUpperCase())} />
                  <span className="text-xs text-muted-foreground">
                    {homeTz ? `Time zone: ${homeTz}` : 'Enter your base to resolve its time zone.'}
                  </span>
                </label>
                <label className={field}>
                  <span className="text-muted-foreground">What happened?</span>
                  <select className={select} value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                    <option value="fatigue_call_before_duty">I called fatigue before a duty</option>
                    <option value="fatigue_during_duty">I became fatigued during a duty</option>
                    <option value="fatigue_after_duty">I am reporting fatigue after a duty</option>
                  </select>
                </label>
              </div>
              <TimeInput label="When did you call / feel fatigued?" tz={inputTz} value={eventTime} onChange={setEventTime} required />
              <div className="space-y-2">
                <p className="text-sm font-medium">Days to include</p>
                <p className="text-xs text-muted-foreground">
                  Include at least the 2–3 days before the event so the sleep history is complete (up to 31 days).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TimeInput label="From" tz={inputTz} value={periodStart} onChange={setPeriodStart} required />
                  <TimeInput label="To" tz={inputTz} value={periodEnd} onChange={setPeriodEnd} required />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[2, 3, 7].map((n) => (
                    <Button key={n} type="button" size="sm" variant="outline" onClick={() => {
                      const ev = new Date(eventTime).getTime();
                      setPeriodStart(new Date(ev - n * 86400e3).toISOString());
                      setPeriodEnd(new Date(ev + 18 * 3600e3).toISOString());
                    }}>{n} days before event</Button>
                  ))}
                </div>
                {periodEnd <= periodStart && <p className="text-sm text-destructive">The end must be after the start.</p>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Duties in this period</h2>
                  <p className="text-sm text-muted-foreground">
                    Mark the duty you were due to operate (or were operating) when fatigue occurred.
                  </p>
                </div>
                <div className="flex gap-2">
                  {results && <Button type="button" size="sm" variant="outline" onClick={prefill}>Reload from roster</Button>}
                  <Button type="button" size="sm" onClick={addDuty}><Plus className="mr-1 h-4 w-4" />Add duty</Button>
                </div>
              </div>
              {duties.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No duties yet. Add the duties you worked in this period and the one affected by fatigue.
                </p>
              )}
              {duties.map((d, idx) => {
                const prev = duties[idx - 1];
                const rest = prev ? hoursBetween(prev.release_utc, d.report_utc) : null;
                return (
                  <div key={d.id} className="space-y-2">
                    {rest != null && (
                      <p className={cn('text-xs', rest < 12 ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                        Rest before this duty: {fmtH(rest)}
                      </p>
                    )}
                    <div className={cn('rounded-lg border p-4 space-y-4', affectedId === d.id && 'border-primary ring-1 ring-primary/40')}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input type="radio" name="affected" checked={affectedId === d.id}
                            onChange={() => setAffectedId(d.id)} />
                          Duty affected by fatigue
                        </label>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{d.source === 'roster' ? 'From roster' : 'Manual'}</Badge>
                          <Button type="button" size="icon" variant="ghost" aria-label="Remove duty"
                            onClick={() => { setDuties(duties.filter((x) => x.id !== d.id)); if (affectedId === d.id) setAffectedId(null); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <TimeInput label="Report" tz={inputTz} value={d.report_utc} onChange={(v) => updateDuty(d.id, { report_utc: v })} />
                        <TimeInput label="Release (off duty)" tz={inputTz} value={d.release_utc} onChange={(v) => updateDuty(d.id, { release_utc: v })} />
                        <label className={field}>
                          <span className="text-muted-foreground">Status</span>
                          <select className={select} value={d.status} onChange={(e) => updateDuty(d.id, { status: e.target.value as DutyStatus })}>
                            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="space-y-2">
                        {d.sectors.map((s, i) => (
                          <div key={i} className="grid items-end gap-2 sm:grid-cols-[5rem_4.5rem_4.5rem_1fr_1fr_auto]">
                            <label className={field}><span className="text-muted-foreground">Flight</span>
                              <Input value={s.flight_number} maxLength={12} onChange={(e) => updateSector(d.id, i, { flight_number: e.target.value })} /></label>
                            <label className={field}><span className="text-muted-foreground">From</span>
                              <Input value={s.departure} maxLength={4} onChange={(e) => updateSector(d.id, i, { departure: e.target.value.toUpperCase() })} /></label>
                            <label className={field}><span className="text-muted-foreground">To</span>
                              <Input value={s.arrival} maxLength={4} onChange={(e) => updateSector(d.id, i, { arrival: e.target.value.toUpperCase() })} /></label>
                            <TimeInput label="Off blocks" tz={inputTz} value={s.departure_utc} onChange={(v) => updateSector(d.id, i, { departure_utc: v })} />
                            <TimeInput label="On blocks" tz={inputTz} value={s.arrival_utc} onChange={(v) => updateSector(d.id, i, { arrival_utc: v })} />
                            <Button type="button" size="icon" variant="ghost" aria-label="Remove sector"
                              onClick={() => updateDuty(d.id, { sectors: d.sectors.filter((_, j) => j !== i) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" size="sm" variant="outline" onClick={() => addSector(d)}>
                          <Plus className="mr-1 h-4 w-4" />Add sector
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Your actual sleep</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter when you actually fell asleep and woke up (not time in bed), including naps. The more
                    complete this is, the more reliable the report.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => addSleep('nap')}><Plus className="mr-1 h-4 w-4" />Nap</Button>
                  <Button type="button" size="sm" onClick={() => addSleep('main')}><Plus className="mr-1 h-4 w-4" />Sleep</Button>
                </div>
              </div>
              {unconfirmed > 0 && (
                <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    {unconfirmed} sleep period(s) are estimates from the roster. Edit them to match what happened,
                    or confirm them. Unconfirmed estimates are labelled as such in the report.
                  </span>
                </div>
              )}
              {sleeps.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No sleep entered. At least two sleep periods are needed to model alertness.
                </p>
              )}
              {sleeps.map((s, i) => (
                <div key={s.key} className={cn('rounded-lg border p-4 space-y-3', s.source === 'estimated' && 'border-dashed')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {s.kind === 'nap' ? 'Nap' : s.kind === 'inflight_rest' ? 'In-flight rest' : 'Sleep'} {i + 1}
                      <span className="ml-2 font-normal text-muted-foreground">{fmtH(hoursBetween(s.start_utc, s.end_utc))}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {s.source === 'estimated' ? (
                        <>
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">Estimated</Badge>
                          <Button type="button" size="sm" variant="outline" onClick={() => updateSleep(s.key, {})}>Confirm</Button>
                        </>
                      ) : <Badge variant="outline">Reported</Badge>}
                      <Button type="button" size="icon" variant="ghost" aria-label="Remove sleep"
                        onClick={() => setSleeps(sleeps.filter((x) => x.key !== s.key))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-1"><TimeInput label="Fell asleep" tz={inputTz} value={s.start_utc} onChange={(v) => updateSleep(s.key, { start_utc: v })} /></div>
                    <div className="lg:col-span-1"><TimeInput label="Woke up" tz={inputTz} value={s.end_utc} onChange={(v) => updateSleep(s.key, { end_utc: v })} /></div>
                    <label className={field}><span className="text-muted-foreground">Type</span>
                      <select className={select} value={s.kind} onChange={(e) => updateSleep(s.key, { kind: e.target.value as ReportSleep['kind'] })}>
                        <option value="main">Main sleep</option><option value="nap">Nap</option><option value="inflight_rest">In-flight rest</option>
                      </select></label>
                    <label className={field}><span className="text-muted-foreground">Where</span>
                      <select className={select} value={s.location} onChange={(e) => updateSleep(s.key, { location: e.target.value as ReportSleep['location'] })}>
                        <option value="home">Home</option><option value="hotel">Hotel</option><option value="crew_rest">Crew rest / bunk</option><option value="other">Other</option>
                      </select></label>
                    <label className={field}><span className="text-muted-foreground">Quality</span>
                      <select className={select} value={s.quality ?? ''} onChange={(e) => updateSleep(s.key, { quality: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Not rated</option>
                        <option value="1">1 — Very poor</option><option value="2">2 — Poor</option><option value="3">3 — Fair</option>
                        <option value="4">4 — Good</option><option value="5">5 — Very good</option>
                      </select></label>
                  </div>
                </div>
              ))}
              {sleepIssues.map((m) => <p key={m} className="text-sm text-destructive">{m}</p>)}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <fieldset className="space-y-2">
                <legend className="text-lg font-semibold">How sleepy did you feel? (KSS)</legend>
                <p className="text-sm text-muted-foreground">Karolinska Sleepiness Scale, at the time you called or felt fatigued.</p>
                <div className="grid gap-1.5">
                  {KSS_OPTIONS.map((label, i) => (
                    <label key={label} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm',
                      kss === i + 1 ? 'border-primary bg-primary/10' : 'hover:bg-muted/50')}>
                      <input type="radio" name="kss" checked={kss === i + 1} onChange={() => setKss(i + 1)} />
                      <span className="w-5 font-semibold tabular-nums">{i + 1}</span>{label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-lg font-semibold">How tired did you feel? (Samn-Perelli)</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {SAMN_PERELLI_OPTIONS.map((label, i) => (
                    <label key={label} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm',
                      sp === i + 1 ? 'border-primary bg-primary/10' : 'hover:bg-muted/50')}>
                      <input type="radio" name="sp" checked={sp === i + 1} onChange={() => setSp(i + 1)} />
                      <span className="w-5 font-semibold tabular-nums">{i + 1}</span>{label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-lg font-semibold">What contributed?</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {FACTOR_OPTIONS.map((f) => (
                    <label key={f.code} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={factors.includes(f.code)}
                        onChange={(e) => setFactors(e.target.checked ? [...factors, f.code] : factors.filter((x) => x !== f.code))} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={field}>
                <span className="text-lg font-semibold text-foreground">Your account</span>
                <Textarea rows={5} maxLength={5000} value={narrative} onChange={(e) => setNarrative(e.target.value)}
                  placeholder="What happened, how you felt, and anything the data above does not show (e.g. disturbed hotel room, illness, delays)." />
              </label>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Your details (optional — only printed on the report)</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([['name', 'Name'], ['staff_number', 'Staff number'], ['rank', 'Rank'], ['fleet', 'Fleet'], ['operator', 'Operator']] as const).map(([k, l]) => (
                    <label key={k} className={field}><span className="text-muted-foreground">{l}</span>
                      <Input value={pilot[k]} maxLength={120} onChange={(e) => setPilot({ ...pilot, [k]: e.target.value })} /></label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={(step === 0 && !eventValid) || (step === 2 && sleepIssues.length > 0)}
            onClick={() => goTo(step + 1)}>
            Next<ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={busy || sleepIssues.length > 0} onClick={submit}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
            Generate report
          </Button>
        )}
      </div>
    </section>
  );
}
