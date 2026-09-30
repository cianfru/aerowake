/**
 * Blinded duty debrief: the pilot rates first; the forecast appears only after the
 * server has saved the rating (the server takes the forecast snapshot itself).
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { KSS_OPTIONS, SAMN_PERELLI_OPTIONS, localInputToUtcIso, utcIsoToLocalInput } from '@/lib/fatigue-report-api';
import {
  COUNTERMEASURE_LABELS, FELT_LABELS, MOMENT_LABELS, OPERATION_LABELS, StudyApiError, createDebrief, dutyRoute, setFelt,
  type Countermeasure, type Debrief, type DebriefMoment, type DebriefOperation, type DebriefRequest, type FeltVsPrediction,
} from '@/lib/debrief-api';
import { RISK_LEVEL_LABELS, normalizeRiskLevel } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { cn } from '@/lib/utils';
import { ChoiceChips, RatingScale } from './controls';
import { dutyDateLabel, hhmm, localWithUtc } from './time';
import { useRefreshStudy } from './useStudy';

interface SleepRow { id: string; start: string; end: string; kind: 'main' | 'nap'; estimated: boolean; confirmed: boolean }

const MOMENTS: DebriefMoment[] = ['worst_moment', 'top_of_descent', 'end_of_duty'];
const COUNTERMEASURES = Object.keys(COUNTERMEASURE_LABELS) as Countermeasure[];
const SLEEP_WINDOW_MS = 72 * 3600e3;

function estimatedRows(duty: DutyAnalysis, tz: string): SleepRow[] {
  const report = Date.parse(duty.reportTimeUtc ?? '');
  if (Number.isNaN(report)) return [];
  return (duty.sleepEstimate?.sleepBlocks ?? [])
    .filter((b) => b.sleepStartUtc && b.sleepEndUtc)
    .filter((b) => Date.parse(b.sleepEndUtc!) <= report && Date.parse(b.sleepStartUtc!) >= report - SLEEP_WINDOW_MS)
    .map((b, i) => ({
      id: `est-${i}`, start: utcIsoToLocalInput(b.sleepStartUtc!, tz), end: utcIsoToLocalInput(b.sleepEndUtc!, tz),
      kind: b.sleepType === 'nap' ? 'nap' : 'main', estimated: true, confirmed: false,
    }));
}

function hoursBetween(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '';
  const hours = (Date.parse(endIso) - Date.parse(startIso)) / 3600e3;
  return hours > 0 ? `${hours.toFixed(1)} h` : '';
}

export function DebriefSheet({ open, onOpenChange, duty, analysisId, homeTimezone, zoneLabel, existing }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duty: DutyAnalysis;
  analysisId: string;
  homeTimezone: string;
  zoneLabel: string;
  existing: Debrief[];
}) {
  const isMobile = useIsMobile();
  const refresh = useRefreshStudy();
  const tz = homeTimezone || 'UTC';
  const taken = useMemo(() => new Set(existing.map((d) => d.moment)), [existing]);
  const hasSector = (duty.flightSegments ?? []).some((s) => s.activityCode !== 'IR');
  const available = MOMENTS.filter((m) => !taken.has(m) && (m !== 'top_of_descent' || hasSector));

  const [operation, setOperation] = useState<DebriefOperation | null>(existing[0]?.operation ?? null);
  const [moment, setMoment] = useState<DebriefMoment>(available[0] ?? 'worst_moment');
  const [kss, setKss] = useState<number | null>(null);
  const [sp, setSp] = useState<number | null>(null);
  const [ratedAt, setRatedAt] = useState<string | null>(null);
  const [countermeasures, setCountermeasures] = useState<Countermeasure[]>([]);
  const [sleeps, setSleeps] = useState<SleepRow[]>(() => estimatedRows(duty, tz));
  const [sleepComplete, setSleepComplete] = useState(false);
  const [note, setNote] = useState('');
  const [seen, setSeen] = useState<'yes' | 'no' | 'unsure' | null>(existing[0] ? (existing[0].prediction_seen ? 'yes' : 'no') : null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState<DebriefRequest | null>(null);
  const [saved, setSaved] = useState<Debrief | null>(null);
  const [felt, setFeltState] = useState<FeltVsPrediction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const operated = operation !== null && operation !== 'not_operated';
  const stamp = () => setRatedAt(new Date().toISOString());
  const ready = operation !== null && seen !== null && (!operated || kss !== null || sp !== null) && available.length > 0;

  function toggleCountermeasure(value: Countermeasure) {
    setCountermeasures((current) => {
      if (value === 'none') return current.includes('none') ? [] : ['none'];
      const next = current.filter((c) => c !== 'none');
      return next.includes(value) ? next.filter((c) => c !== value) : [...next, value];
    });
  }

  function updateSleep(id: string, change: Partial<SleepRow>) {
    setSleeps((rows) => rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function buildRequest(): DebriefRequest | string {
    const reported = [];
    for (const row of sleeps.filter((r) => r.confirmed)) {
      const start = localInputToUtcIso(row.start, tz);
      const end = localInputToUtcIso(row.end, tz);
      if (!start || !end) return 'Check the confirmed sleep times: one is missing or falls in a clock change.';
      if (Date.parse(end) <= Date.parse(start)) return 'Each sleep must end after it starts.';
      reported.push({ start_utc: start, end_utc: end, kind: row.kind });
    }
    return {
      client_id: crypto.randomUUID(), analysis_id: analysisId, duty_id: duty.dutyId!, duty_report_utc: duty.reportTimeUtc!,
      operation: operation!, moment, kss: operated ? kss : null, samn_perelli: operated ? sp : null,
      rated_at_utc: ratedAt ?? new Date().toISOString(), prediction_seen: seen !== 'no',
      sleeps: reported, sleep_complete: reported.length > 0 && sleepComplete,
      countermeasures: operated ? countermeasures : [], note: note.trim() || null,
    };
  }

  async function save() {
    const request = pending ?? buildRequest();
    if (typeof request === 'string') { setError(request); return; }
    setBusy(true); setError('');
    try {
      const result = await createDebrief(request);
      setPending(null);
      setSaved(result);
      void refresh();
    } catch (e) {
      const status = e instanceof StudyApiError ? e.status : 0;
      // Network or server failure: retry exactly the same rating (idempotent on client_id).
      setPending(status === 0 || status >= 500 ? request : null);
      setError(e instanceof Error ? e.message : 'Could not save the debrief.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseFelt(value: FeltVsPrediction) {
    if (!saved) return;
    setFeltState(value);
    try { await setFelt(saved.id, value); void refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your comparison.'); }
  }

  const route = dutyRoute(duty);
  const title = `${dutyDateLabel(duty.reportTimeUtc, tz)}${route ? ` · ${route}` : ''}`;
  const times = duty.reportTimeUtc && duty.releaseTimeUtc
    ? `${hhmm(duty.reportTimeUtc, tz)}–${hhmm(duty.releaseTimeUtc, tz)} ${tz === 'UTC' ? 'UTC' : `${zoneLabel} time`}` : '';

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn('flex flex-col gap-0 p-0', isMobile ? 'max-h-[92dvh] rounded-t-2xl' : 'w-full sm:max-w-lg')}
      >
        <SheetHeader className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12 text-left">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Duty debrief</p>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>
            {times && <span className="font-mono tabular">{times}. </span>}
            {saved ? 'Saved to your private study diary.' : 'Rate first. The forecast stays hidden until you save.'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {saved ? (
            <Reveal saved={saved} tz={tz} zoneLabel={zoneLabel} felt={felt} onFelt={chooseFelt} />
          ) : (
            <fieldset disabled={busy || !!pending} className="space-y-6">
              <ChoiceChips<DebriefOperation>
                legend="Did this duty operate as rostered?"
                options={(Object.keys(OPERATION_LABELS) as DebriefOperation[]).map((v) => ({ value: v, label: OPERATION_LABELS[v] }))}
                value={operation}
                onChange={setOperation}
              />
              {operated && (
                <>
                  <ChoiceChips<DebriefMoment>
                    legend="Which moment are you rating?"
                    options={MOMENTS.map((v) => ({ value: v, label: MOMENT_LABELS[v] }))}
                    value={moment}
                    onChange={setMoment}
                    disabled={(v) => !available.includes(v)}
                  />
                  <RatingScale
                    name="debrief-kss"
                    legend={moment === 'worst_moment' ? 'At your sleepiest point on this duty, how did you feel?' : `At ${MOMENT_LABELS[moment].toLowerCase()}, how did you feel?`}
                    hint={ratedAt ? `Rating time: ${localWithUtc(ratedAt, tz, zoneLabel)}` : 'Karolinska Sleepiness Scale. The rating time is recorded when you choose.'}
                    options={KSS_OPTIONS}
                    value={kss}
                    onChange={(v) => { setKss(v); stamp(); }}
                  />
                </>
              )}
              {operation === 'not_operated' && (
                <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">Thanks. Recording that a duty did not operate keeps the comparison honest; no rating is needed.</p>
              )}

              {operation && (
                <ChoiceChips<'yes' | 'no' | 'unsure'>
                  legend="Had you looked at Aerowake's forecast for this duty before or during it?"
                  options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }, { value: 'unsure', label: 'Not sure' }]}
                  value={seen}
                  onChange={setSeen}
                />
              )}

              {operated && (
                <div className="rounded-lg border border-border">
                  <button
                    type="button"
                    aria-expanded={detailsOpen}
                    onClick={() => setDetailsOpen((v) => !v)}
                    className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Add detail (optional)
                    <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', detailsOpen && 'rotate-180')} />
                  </button>
                  {detailsOpen && (
                    <div className="space-y-6 border-t border-border p-3">
                      <ChoiceChips
                        legend="What helped?"
                        options={COUNTERMEASURES.map((v) => ({ value: v, label: COUNTERMEASURE_LABELS[v] }))}
                        value={countermeasures}
                        onChange={toggleCountermeasure}
                        multiple
                      />
                      <RatingScale
                        name="debrief-sp"
                        legend="Samn-Perelli fatigue at the same moment"
                        options={SAMN_PERELLI_OPTIONS}
                        value={sp}
                        onChange={(v) => { setSp(v); if (kss === null) stamp(); }}
                      />
                      <SleepEditor
                        rows={sleeps}
                        tz={tz}
                        zoneLabel={zoneLabel}
                        complete={sleepComplete}
                        onComplete={setSleepComplete}
                        onChange={updateSleep}
                        onAdd={() => setSleeps((rows) => [...rows, { id: crypto.randomUUID(), start: '', end: '', kind: 'nap', estimated: false, confirmed: true }])}
                        onRemove={(id) => setSleeps((rows) => rows.filter((r) => r.id !== id))}
                      />
                      <label className="block space-y-2 text-sm">
                        <span className="font-semibold">Private note</span>
                        <Textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="Anything that explains how the duty felt" />
                        <span className="block text-xs text-muted-foreground">Kept in your account only. Never included in study exports. Avoid names of other people.</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}
          {pending && <p className="text-sm text-muted-foreground">The rating may already have been saved. Retry sends exactly the same rating.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          {saved ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy || (!pending && !ready)}>
                {busy ? 'Saving…' : pending ? 'Retry' : 'Save and show forecast'}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Reveal({ saved, tz, zoneLabel, felt, onFelt }: {
  saved: Debrief; tz: string; zoneLabel: string; felt: FeltVsPrediction | null; onFelt: (v: FeltVsPrediction) => void;
}) {
  const forecast = saved.forecast ?? ({} as Debrief['forecast']);
  const atMoment = saved.moment === 'worst_moment' ? forecast.max_kss : forecast.kss_at_event;
  const level = normalizeRiskLevel(forecast.risk_level);
  if (saved.operation === 'not_operated') {
    return <p className="text-sm">Recorded as not operated. Nothing else is needed.</p>;
  }
  return (
    <div className="space-y-5" aria-live="polite">
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">You</dt>
          <dd className="mt-1 font-mono text-2xl tabular">{saved.kss !== null ? `KSS ${saved.kss}` : `SP ${saved.samn_perelli}`}</dd>
          <dd className="text-xs text-muted-foreground">{MOMENT_LABELS[saved.moment]}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Forecast</dt>
          <dd className="mt-1 font-mono text-2xl tabular">{atMoment != null ? atMoment.toFixed(1) : '–'}</dd>
          <dd className="text-xs text-muted-foreground">
            {saved.moment === 'worst_moment'
              ? `Duty peak${level !== 'unknown' ? ` · ${RISK_LEVEL_LABELS[level]}` : ''}`
              : atMoment != null ? `Model at ${MOMENT_LABELS[saved.moment].toLowerCase()}` : `No model value at that time; duty peak ${forecast.max_kss?.toFixed(1) ?? '–'}`}
          </dd>
        </div>
      </dl>
      {saved.published_tpm && (
        <p className="text-sm text-muted-foreground">With the sleep you confirmed, the published model gives {saved.published_tpm.kss.toFixed(1)} at that moment.</p>
      )}
      <p className="text-sm text-muted-foreground">
        Rated at {localWithUtc(saved.rated_at_utc, tz, zoneLabel)}. One duty does not validate or invalidate the model; the comparison becomes useful across many duties.
      </p>
      <ChoiceChips
        legend="Compared with this forecast, the duty felt"
        options={(Object.keys(FELT_LABELS) as FeltVsPrediction[]).map((v) => ({ value: v, label: FELT_LABELS[v] }))}
        value={felt}
        onChange={onFelt}
      />
    </div>
  );
}

function SleepEditor({ rows, tz, zoneLabel, complete, onComplete, onChange, onAdd, onRemove }: {
  rows: SleepRow[]; tz: string; zoneLabel: string; complete: boolean; onComplete: (v: boolean) => void;
  onChange: (id: string, change: Partial<SleepRow>) => void; onAdd: () => void; onRemove: (id: string) => void;
}) {
  const zone = tz === 'UTC' ? 'UTC' : `${zoneLabel} time`;
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">What you actually slept before the duty</legend>
      <p className="text-xs text-muted-foreground">
        Times in {zone}. Aerowake's estimates are shown for reference; only sleep you confirm or enter is saved as reported.
      </p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No estimated sleep in the 72 hours before report.</p>}
      <ul className="space-y-3">
        {rows.map((row) => {
          const startIso = localInputToUtcIso(row.start, tz);
          const endIso = localInputToUtcIso(row.end, tz);
          return (
            <li key={row.id} className={cn('space-y-2 rounded-lg border p-3', row.confirmed ? 'border-primary/50' : 'border-dashed border-border')}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {row.estimated && !row.confirmed ? 'Estimated ' : row.estimated ? 'Confirmed ' : 'Reported '}
                  {row.kind === 'nap' ? 'nap' : 'sleep'} {hoursBetween(startIso, endIso) && <span className="font-mono tabular text-muted-foreground">· {hoursBetween(startIso, endIso)}</span>}
                </span>
                {row.estimated ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={row.confirmed} onChange={(e) => onChange(row.id, { confirmed: e.target.checked })} />
                    Confirm as actual
                  </label>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Remove this sleep">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['start', 'end'] as const).map((edge) => (
                  <label key={edge} className="space-y-1 text-xs text-muted-foreground">
                    {edge === 'start' ? 'Fell asleep' : 'Woke'}
                    <Input
                      type="datetime-local"
                      value={row[edge]}
                      onChange={(e) => onChange(row.id, { [edge]: e.target.value, confirmed: true })}
                      className="h-10 font-mono text-sm"
                    />
                    <span className="block font-mono tabular">{(edge === 'start' ? startIso : endIso) ? `${hhmm(edge === 'start' ? startIso : endIso, 'UTC')}Z` : ''}</span>
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" aria-hidden="true" />Add a nap or sleep</Button>
      {rows.some((r) => r.confirmed) && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={complete} onChange={(e) => onComplete(e.target.checked)} />
          I've included all sleep and naps in the 48 hours before report
        </label>
      )}
    </fieldset>
  );
}
