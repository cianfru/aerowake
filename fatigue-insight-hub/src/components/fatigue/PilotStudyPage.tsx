import { useState } from 'react';
import { getAuthHeaders, useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';
const labels = ['Extremely alert', 'Very alert', 'Alert', 'Rather alert', 'Neither alert nor sleepy', 'Some signs of sleepiness', 'Sleepy, but no effort to keep awake', 'Sleepy, some effort to keep awake', 'Very sleepy, great effort to keep awake, fighting sleep'];
const nowUTC = () => new Date().toISOString().slice(0, 16);
type Result = { prediction: { kss: number; model_version: string }; exclusions: string[] };

class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }

async function request(method: string, body?: unknown) {
  const response = await fetch(`${API}/api/pilot-study/observations`, {
    method, headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new RequestError(typeof error.detail === 'string' ? error.detail : 'Could not save. Check all fields and your sign-in, then retry.', response.status);
  }
  return response.json();
}

export function PilotStudyPage() {
  const { isAuthenticated } = useAuth();
  const [sleeps, setSleeps] = useState([{ start: '', end: '' }, { start: '', end: '' }]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const field = 'block space-y-2 text-sm';
  const select = 'w-full rounded-md border border-input bg-background p-2 text-foreground';

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Freeze a retry payload; network failure must not allow changing a revealed observation.
    const payload = pending ?? {
      client_id: clientId, observed_at: `${data.get('observed_at')}:00Z`,
      observed_kss: Number(data.get('kss')), home_utc_offset: Number(data.get('offset')),
      phase: data.get('phase'), sleeps: sleeps.map(s => ({ start: `${s.start}:00Z`, end: `${s.end}:00Z` })),
      prediction_seen: data.get('seen') === 'yes', actual_sleep: data.get('actual') === 'yes',
      complete_diary: data.get('complete') === 'yes', home_acclimatized: data.get('home') === 'yes', consent: true,
    };
    setBusy(true); setError('');
    try { setResult(await request('POST', payload)); setPending(null); }
    catch (e) { setPending(e instanceof RequestError && e.status < 500 ? null : payload); setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function exportData() {
    setBusy(true); setError('');
    try {
      const data = await request('GET');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'aerowake-pilot-diary.json'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header className="space-y-2"><p className="text-sm font-medium text-primary">Pilot study · awaiting operational validation</p>
      <h1 className="text-3xl font-semibold">How sleepy do you feel?</h1>
      <p className="text-muted-foreground">Record your own sleepiness before viewing a prediction. This study compares reported sleep with the published Ingre 2014 model 5c. It estimates sleepiness on the 1–9 Karolinska Sleepiness Scale (KSS), not physical exhaustion or fitness to fly.</p>
      <p className="text-sm text-muted-foreground">The roster dashboard uses the same published model with sleep estimated from your roster; this study measures how accurate it is with your actual sleep. It does not reproduce BAM. Use this diary only when safely free from operational tasks.</p>
    </header>
    {!isAuthenticated ? <p className="rounded-lg border p-6">Sign in using the account menu to save your private pilot diary.</p> : <>
      {result ? <div className="rounded-xl border bg-card p-6 space-y-3" role="status">
        <h2 className="text-xl font-semibold">Observation saved</h2>
        <p>Published-model estimate: <strong>{result.prediction.kss.toFixed(1)} / 9 KSS</strong></p>
        <p className="text-sm text-muted-foreground">{result.prediction.model_version} · A single agreement or disagreement does not validate the model.</p>
        {result.exclusions.length > 0 && <p className="text-sm">Saved for exploratory review; excluded from the primary comparison: {result.exclusions.map(x => x.replace(/_/g, ' ')).join('; ')}.</p>}
        <Button onClick={() => { setResult(null); setClientId(crypto.randomUUID()); setPending(null); setFormKey(k => k+1); }}>New observation</Button>
      </div> : <form key={formKey} onSubmit={save} className="rounded-xl border bg-card p-6 space-y-6">
        <fieldset disabled={busy || !!pending} className="space-y-5">
          <legend className="mb-4 text-lg font-semibold">1. Actual sleep diary</legend>
          <p className="text-sm text-muted-foreground">Enter every sleep episode and nap over at least the preceding 48 hours (up to 14 days). At least two completed episodes are required. All dates and times below are UTC, including the rating time. Do not enter local clock times.</p>
          {sleeps.map((s, i) => <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className={field}>Sleep {i+1} start (UTC)<Input aria-label={`Sleep ${i+1} start UTC`} type="datetime-local" required value={s.start} onChange={e => setSleeps(sleeps.map((x,j) => j === i ? {...x,start:e.target.value} : x))} /></label>
            <label className={field}>Wake {i+1} (UTC)<Input aria-label={`Wake ${i+1} UTC`} type="datetime-local" required value={s.end} onChange={e => setSleeps(sleeps.map((x,j) => j === i ? {...x,end:e.target.value} : x))} /></label>
            {sleeps.length > 2 && <Button type="button" variant="ghost" className="self-end" onClick={() => setSleeps(sleeps.filter((_,j) => i !== j))}>Remove {i+1}</Button>}
          </div>)}
          <Button type="button" variant="outline" disabled={sleeps.length >= 100} onClick={() => setSleeps([...sleeps,{start:'',end:''}])}>Add sleep or nap</Button>
          <label className={field}>Home UTC offset for these dates (e.g. Doha +3)<Input name="offset" type="number" min={-12} max={14} step={0.25} required placeholder="3" /></label>
          {([['actual','Are these actual sleep times, rather than planned time in bed?'],['complete','Have you included all sleep and naps in the preceding 48 hours?'],['home','Are you at your home base and acclimatized, with no recent time-zone change?']] as const).map(([name,title]) => <label key={name} className={field}>{title}<select name={name} required defaultValue="" className={select}><option value="" disabled>Select</option><option value="yes">Yes</option><option value="no">No / unsure</option></select></label>)}
          <h2 className="text-lg font-semibold">2. Your observation</h2>
          <label className={field}>Rating time (UTC)<Input name="observed_at" type="datetime-local" required defaultValue={nowUTC()} /></label>
          <label className={field}>Sleepiness at that time<select name="kss" required defaultValue="" className={select}><option value="" disabled>Select your rating</option>{labels.map((label,i) => <option value={i+1} key={label}>{i+1} — {label}</option>)}</select></label>
          <label className={field}>Context<select name="phase" required defaultValue="" className={select}><option value="" disabled>Select</option><option value="pre_duty">Before duty</option><option value="cruise">Cruise / safe break</option><option value="post_duty">After duty</option><option value="off_duty">Off duty</option></select></label>
          <label className={field}>Had you already seen a fatigue prediction for this time?<select name="seen" required defaultValue="" className={select}><option value="" disabled>Select</option><option value="no">No</option><option value="yes">Yes / unsure</option></select></label>
          <label className="flex gap-3 text-sm"><input type="checkbox" required className="mt-1" />I agree to store this voluntary sleep diary and sleepiness rating in my AeroWake account. It is excluded from company dashboards. I can export or delete it below; sharing an export with a study organiser is my choice. Exports contain sensitive dates and times and are pseudonymous, not anonymous.</label>
        </fieldset>
        {pending && <p className="text-sm">The previous submission may have been saved. Retry sends exactly the same observation. If inputs need correcting after a rejected submission, reload this page.</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : pending ? 'Retry original observation' : 'Save rating and reveal estimate'}</Button>
      </form>}
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={exportData}>Export my diary</Button><Button variant="ghost" disabled={busy} onClick={async () => {
        if (!window.confirm('Delete all your pilot-study observations? This cannot remove exports already shared.')) return;
        setBusy(true); setError('');
        try { await request('DELETE'); setResult(null); setPending(null); setClientId(crypto.randomUUID()); setFormKey(k => k+1); setSleeps([{start:'',end:''},{start:'',end:''}]); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>Delete my study data</Button></div>
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <p className="text-sm text-muted-foreground">Method: <a className="underline" href="https://doi.org/10.1371/journal.pone.0108679" target="_blank" rel="noreferrer">Ingre et al., 2014</a>. A fixed home-clock baseline; jet lag and individual calibration are not included. Your feedback will test its accuracy in this study population.</p>
  </section>;
}
