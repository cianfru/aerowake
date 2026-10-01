import { useEffect, useMemo, useState } from 'react';
import { LogIn, Trash2 } from 'lucide-react';
import { AuthSheet } from '@/components/auth/AuthSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { StudyApiError, downloadJson, studyRequest } from '@/lib/debrief-api';
import { KSS_OPTIONS, localInputToUtcIso } from '@/lib/fatigue-report-api';
import { ChoiceChips, RatingScale } from './debrief/controls';
import { ConfirmDialog } from './debrief/ConfirmDialog';
import { StudyEnrolmentDialog } from './debrief/StudyEnrolmentDialog';
import { StudyParticipation } from './debrief/StudyParticipation';
import { formatInZone, hhmm, localWithUtc } from './debrief/time';
import { useEnrolment } from './debrief/useStudy';

const PATH = '/api/pilot-study/observations';
const LATE_MS = 15 * 60e3;

type Phase = 'pre_duty' | 'cruise' | 'post_duty' | 'off_duty';
type YesNo = 'yes' | 'no';
interface SleepRow { start: string; end: string }
interface Draft { sleeps: SleepRow[]; phase: Phase | null; seen: YesNo | null; actual: YesNo | null; complete: YesNo | null; home: YesNo | null }
interface Result { id: string; prediction: { kss: number; model_version: string }; exclusions: string[] }
interface SavedObservation extends Result { inputs: { observed_at: string; observed_kss: number; phase: Phase } }

const EMPTY: Draft = { sleeps: [{ start: '', end: '' }, { start: '', end: '' }], phase: null, seen: null, actual: null, complete: null, home: null };
/** In memory only (never storage): survives a session-expiry remount, gone on reload or another account. */
const drafts = new Map<string, Draft>();

const PHASES: Array<{ value: Phase; label: string }> = [
  { value: 'pre_duty', label: 'Before duty' }, { value: 'cruise', label: 'Cruise or safe break' },
  { value: 'post_duty', label: 'After duty' }, { value: 'off_duty', label: 'Off duty' },
];
const YES_NO = (yes: string, no: string): Array<{ value: YesNo; label: string }> => [{ value: 'yes', label: yes }, { value: 'no', label: no }];

const HOME_ZONE_KEY = 'aerowake-study-home-zone';

function storedZone(): string {
  try { return localStorage.getItem(HOME_ZONE_KEY) || ''; } catch { return ''; }
}

function zoneOptions(): string[] {
  try {
    const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (zones?.length) return zones;
  } catch { /* fall through */ }
  return ['UTC', 'Asia/Qatar', 'Asia/Dubai', 'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Asia/Singapore', 'America/New_York'];
}

/**
 * The home zone sets the circadian phase of model 5c, so it is never guessed
 * from the device (wrong on a layover): it comes from the analysed roster or
 * the pilot chooses it.
 */
function HomeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const options = useMemo(zoneOptions, []);
  return (
    <div className="space-y-1.5">
      <label htmlFor="study-home-zone" className="block text-sm font-medium">Home base time zone</label>
      <select id="study-home-zone" value={value} required onChange={(e) => onChange(e.target.value)}
        className="min-h-[40px] w-full max-w-sm rounded-lg border border-input bg-card px-3 text-sm">
        <option value="">Choose your home base time zone…</option>
        {options.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">Your body clock is modelled on home-base time. Analyse a roster to fill this in automatically.</p>
    </div>
  );
}

export function PilotStudyPage() {
  const { isAuthenticated, user } = useAuth();
  const enrolment = useEnrolment();
  const [authOpen, setAuthOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Pilot study · awaiting operational validation</p>
        <h1 className="text-3xl font-semibold">How sleepy do you feel?</h1>
        <p className="text-muted-foreground">
          Rate your sleepiness first, then add your recent sleep. The diary compares the published Ingre 2014 model 5c with your actual sleep, on the 1–9 Karolinska Sleepiness Scale (KSS). It does not measure physical exhaustion or fitness to fly.
        </p>
        <p className="text-sm text-muted-foreground">
          The roster workspace uses the same kind of model with sleep estimated from your roster; to rate a flown duty, use Debrief on that duty. Use the diary only when safely free from operational tasks.
        </p>
      </header>

      {!isAuthenticated ? (
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <p className="font-medium">Sign in to keep a private study diary</p>
          <p className="text-sm text-muted-foreground">Entries are saved to your account so you can export or delete them and withdraw at any time. They are never sent to your operator.</p>
          <Button onClick={() => setAuthOpen(true)}><LogIn className="mr-2 h-4 w-4" aria-hidden="true" />Sign in to join the study</Button>
          <AuthSheet open={authOpen} onOpenChange={setAuthOpen} />
        </div>
      ) : enrolment.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading…</p>
      ) : enrolment.data?.enrolled ? (
        <DiaryForm key={user?.id} userId={user?.id ?? ''} />
      ) : (
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <p className="font-medium">Join the study to keep a diary</p>
          <p className="text-sm text-muted-foreground">Joining is voluntary and takes about two minutes to read. It covers this diary and duty debriefs.</p>
          <Button onClick={() => setJoinOpen(true)}>Read about the study</Button>
          <StudyEnrolmentDialog open={joinOpen} onOpenChange={setJoinOpen} />
          {enrolment.isError && <p role="alert" className="text-sm text-destructive">{enrolment.error.message}</p>}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Method: <a className="underline" href="https://doi.org/10.1371/journal.pone.0108679" target="_blank" rel="noreferrer">Ingre et al., 2014</a>. A fixed home-clock baseline; jet lag and individual calibration are not included. Your entries test its accuracy in this study population.
      </p>
    </section>
  );
}

function DiaryForm({ userId }: { userId: string }) {
  const { state } = useAnalysis();
  const analysedZone = state.analysisResults?.homeBaseTimezone || '';
  const [chosenZone, setChosenZone] = useState(storedZone);
  const tz = analysedZone || chosenZone;
  const zoneLabel = analysedZone ? (state.analysisResults?.pilotBase || 'home') : 'home';
  const chooseZone = (z: string) => { setChosenZone(z); try { localStorage.setItem(HOME_ZONE_KEY, z); } catch { /* private mode */ } };
  const [draft, setDraftState] = useState<Draft>(() => drafts.get(userId) ?? EMPTY);
  const [kss, setKss] = useState<number | null>(null);
  const [ratedAt, setRatedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedObservation[] | null>(null);
  const [confirm, setConfirm] = useState<SavedObservation | 'all' | null>(null);

  const setDraft = (change: Partial<Draft>) => setDraftState((d) => { const next = { ...d, ...change }; drafts.set(userId, next); return next; });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { void load(); }, []);

  const late = ratedAt !== null && now - Date.parse(ratedAt) > LATE_MS;
  const sleepIsos = useMemo(() => draft.sleeps.map((s) => ({ start: tz ? localInputToUtcIso(s.start, tz) : null, end: tz ? localInputToUtcIso(s.end, tz) : null })), [draft.sleeps, tz]);
  const complete = !!tz && kss !== null && draft.phase && draft.seen && draft.actual && draft.complete && draft.home
    && sleepIsos.every((s) => s.start && s.end);

  async function load() {
    try { setSaved((await studyRequest<{ observations: SavedObservation[] }>(PATH)).observations); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your diary.'); }
  }

  async function save() {
    if (!complete && !pending) { setError('Complete every question; check that each sleep time exists in your home time zone.'); return; }
    const payload = pending ?? {
      client_id: clientId, observed_at: ratedAt, observed_kss: kss, home_timezone: tz, phase: draft.phase,
      sleeps: sleepIsos.map((s) => ({ start: s.start, end: s.end })),
      prediction_seen: draft.seen === 'yes', actual_sleep: draft.actual === 'yes', complete_diary: draft.complete === 'yes',
      home_acclimatized: draft.home === 'yes', consent: true,
    };
    setBusy(true); setError('');
    try {
      setResult(await studyRequest<Result>(PATH, { method: 'POST', body: payload }));
      setPending(null);
      drafts.delete(userId);
      void load();
    } catch (e) {
      const status = e instanceof StudyApiError ? e.status : 0;
      // Keep the frozen payload for anything that might have been saved or can be retried.
      setPending(status === 0 || status === 401 || status >= 500 ? payload : null);
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null); setPending(null); setKss(null); setRatedAt(null); setClientId(crypto.randomUUID());
    setDraftState(EMPTY); drafts.delete(userId);
  }

  async function remove() {
    if (!confirm) return;
    setBusy(true); setError('');
    try {
      await studyRequest<void>(confirm === 'all' ? PATH : `${PATH}/${encodeURIComponent(confirm.id)}`, { method: 'DELETE' });
      if (confirm === 'all') reset();
      setConfirm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete.'); }
    finally { setBusy(false); }
  }

  async function exportData() {
    setBusy(true); setError('');
    try { downloadJson(await studyRequest(PATH), 'aerowake-pilot-diary.json'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not export.'); }
    finally { setBusy(false); }
  }

  const zone = !tz ? 'home time (choose your time zone first)' : tz === 'UTC' ? 'UTC' : `${zoneLabel} time (${tz})`;
  return (
    <div className="space-y-6">
      {result ? (
        <div className="space-y-3 rounded-xl border bg-card p-6" role="status">
          <h2 className="text-xl font-semibold">Observation saved</h2>
          <p>Published-model estimate: <strong>{result.prediction.kss.toFixed(1)} / 9 KSS</strong> · you rated {kss}</p>
          <p className="text-sm text-muted-foreground">{result.prediction.model_version} · A single agreement or disagreement does not validate the model.</p>
          {result.exclusions.length > 0 && <p className="text-sm">Saved for exploratory review; outside the primary comparison because: {result.exclusions.map((x) => x.replace(/_/g, ' ')).join('; ')}.</p>}
          <Button onClick={reset}>New observation</Button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-6 rounded-xl border bg-card p-5 md:p-6">
          <fieldset disabled={busy || !!pending} className="space-y-6">
            {!analysedZone && <HomeZonePicker value={chosenZone} onChange={chooseZone} />}
            <RatingScale
              name="diary-kss"
              legend={<span className="text-lg">1. How sleepy are you right now?</span>}
              hint={ratedAt ? `Rated at ${localWithUtc(ratedAt, tz, zoneLabel)}` : 'The rating time is recorded when you choose.'}
              options={KSS_OPTIONS}
              value={kss}
              onChange={(v) => { setKss(v); setRatedAt(new Date().toISOString()); setNow(Date.now()); }}
            />
            {late && (
              <p role="alert" className="rounded-lg bg-muted p-3 text-sm">
                This rating is more than 15 minutes old, so it would count only as exploratory. Choose your rating again to record how you feel now.
              </p>
            )}
            <ChoiceChips legend="Where are you in your day?" options={PHASES} value={draft.phase} onChange={(phase) => setDraft({ phase })} />
            <ChoiceChips legend="Had you already seen a fatigue prediction for this time?" options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes or not sure' }]} value={draft.seen} onChange={(seen) => setDraft({ seen })} />

            <fieldset className="space-y-3">
              <legend className="text-lg font-semibold">2. Your actual sleep</legend>
              <p className="text-sm text-muted-foreground">
                Every sleep and nap over at least the last 48 hours (up to 14 days), in {zone}. At least two are needed. Planned rest or time in bed is not sleep.
              </p>
              {draft.sleeps.map((s, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  {(['start', 'end'] as const).map((edge) => {
                    const iso = sleepIsos[i]?.[edge];
                    return (
                      <label key={edge} className="block space-y-1 text-sm">
                        {edge === 'start' ? `Sleep ${i + 1}: fell asleep` : `Sleep ${i + 1}: woke`}
                        <Input type="datetime-local" required value={s[edge]} className="font-mono"
                          onChange={(e) => setDraft({ sleeps: draft.sleeps.map((x, j) => (j === i ? { ...x, [edge]: e.target.value } : x)) })} />
                        <span className="block font-mono text-xs tabular text-muted-foreground">
                          {iso ? `${formatInZone(iso, 'UTC', { day: 'numeric', month: 'short' })} ${hhmm(iso, 'UTC')}Z` : s[edge] ? 'Check this time' : ''}
                        </span>
                      </label>
                    );
                  })}
                  {draft.sleeps.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" className="self-center" aria-label={`Remove sleep ${i + 1}`}
                      onClick={() => setDraft({ sleeps: draft.sleeps.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" disabled={draft.sleeps.length >= 100} onClick={() => setDraft({ sleeps: [...draft.sleeps, { start: '', end: '' }] })}>Add sleep or nap</Button>
            </fieldset>
            <ChoiceChips legend="Are these actual sleep times, rather than planned time in bed?" options={YES_NO('Yes', 'No or unsure')} value={draft.actual} onChange={(actual) => setDraft({ actual })} />
            <ChoiceChips legend="Have you included all sleep and naps in the last 48 hours?" options={YES_NO('Yes', 'No or unsure')} value={draft.complete} onChange={(complete) => setDraft({ complete })} />
            <ChoiceChips legend="Are you at home base and acclimatised, with no recent time-zone change?" options={YES_NO('Yes', 'No or unsure')} value={draft.home} onChange={(home) => setDraft({ home })} />
          </fieldset>
          {pending && <p className="text-sm">The previous submission may have been saved. Retry sends exactly the same observation.</p>}
          <Button type="submit" disabled={busy || (!pending && !complete)}>{busy ? 'Saving…' : pending ? 'Retry original observation' : 'Save rating and reveal estimate'}</Button>
        </form>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3 rounded-xl border bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold">Your diary</h2>
        {saved === null ? <p className="text-sm text-muted-foreground" role="status">Loading…</p> : saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {saved.slice().reverse().slice(0, 50).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{formatInZone(o.inputs.observed_at, tz, { day: 'numeric', month: 'short' })} {hhmm(o.inputs.observed_at, tz)}</span>
                  <span className="text-muted-foreground"> · you KSS {o.inputs.observed_kss} · model {o.prediction.kss.toFixed(1)}</span>
                </span>
                <Button size="icon" variant="ghost" aria-label="Delete this diary entry" onClick={() => setConfirm(o)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={exportData}>Export my diary</Button>
          <Button variant="ghost" disabled={busy || !saved?.length} onClick={() => setConfirm('all')}>Delete all diary entries</Button>
        </div>
        <div className="border-t border-border pt-3"><StudyParticipation compact /></div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        title={confirm === 'all' ? 'Delete all diary entries?' : 'Delete this diary entry?'}
        description="Deleted entries cannot be restored. Exports you have already shared cannot be recalled."
        confirmLabel="Delete"
        onConfirm={remove}
        busy={busy}
      />
    </div>
  );
}
