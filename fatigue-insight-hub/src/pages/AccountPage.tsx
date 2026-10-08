import { apiFetch } from '@/lib/auth-session';
import { offlineStore } from '@/lib/offline-store';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthHeaders, useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudyParticipation } from '@/components/fatigue/debrief/StudyParticipation';
import { SleepHabitsEditor } from '@/components/fatigue/SleepHabitsEditor';
import { useSleepPreferences } from '@/hooks/useSleepPreferences';
const api = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

function AccountSleepHabits() {
  const { preferences, apply, isApplying } = useSleepPreferences();
  return <SleepHabitsEditor value={preferences} busy={isApplying} onSave={async (next) => {
    const outcome = await apply(next);
    return outcome === 'recalculated' ? 'Saved to your account. Recalculating the roster on screen…' : 'Saved to your account.';
  }} />;
}

export default function AccountPage() {
  const { user, logout, refreshProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(path: string, method = 'POST', body?: object) {
    setBusy(true); setMessage('');
    try {
      const res = await apiFetch(`${api}/api/auth/${path}`, { method, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = res.status === 204 ? {} : await res.json();
      if (!res.ok) throw new Error(data.detail || 'Unable to complete the request.');
      if (path === 'export') {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'aerowake-account.json'; link.click(); URL.revokeObjectURL(url);
        setMessage('Your export has been downloaded.');
      } else if (path === 'account') { if (user) await offlineStore.clearInflight(user.id); await logout(); setMessage('Your account and saved data have been deleted.'); }
      else { setMessage(data.message || 'Preference updated.'); await refreshProfile(); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-screen max-w-2xl space-y-8 px-5 py-12">
    <Link to="/" className="text-primary">← Back to AeroWake</Link><h1 className="text-3xl font-semibold">Your account and data</h1>
    {message && <p role="status" className="rounded-md border p-4 text-sm">{message}</p>}
    {!user ? <p><Link to="/login" className="underline">Sign in</Link> to manage saved data.</p> : <>
      <section className="space-y-3" aria-labelledby="sleep-habits-heading"><h2 id="sleep-habits-heading" className="text-lg font-medium">Your sleep habits</h2><p className="text-sm text-muted-foreground">The model starts from an average pilot. Your usual night and nap habit replace those averages in every analysis you run while signed in. You can still change any single sleep on a duty.</p><AccountSleepHabits /></section>
      <section className="space-y-3"><h2 className="text-lg font-medium">Email verification</h2><p className="text-sm text-muted-foreground">{user.email} · {user.email_verified ? 'Verified' : 'Not verified'}</p>{!user.email_verified && <Button disabled={busy} onClick={() => act('verification/request')}>Send verification email</Button>}</section>
      <section className="space-y-3"><h2 className="text-lg font-medium">Optional comparisons</h2><p className="text-sm text-muted-foreground">Compare with pilots who opt in to the same self-declared airline group. Membership is not employer-verified. Groups smaller than five are hidden; this does not guarantee anonymity.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" disabled={busy} checked={user.metrics_consent ?? false} onChange={e => act('consent', 'PUT', { enabled: e.target.checked })} /><span>Include my roster statistics in cohort comparisons. I can withdraw at any time.</span></label></section>
      <section className="space-y-3"><h2 className="text-lg font-medium">Helping calibrate the model</h2><p className="text-sm text-muted-foreground">Contributing is optional. If you join, new ratings, debriefs and diary entries may be pooled and pseudonymised to evaluate the model. They are never sent to your operator or any company. Your roster tools and private in-flight log work without joining. You can export your data, stop contributing, and delete your entries here.</p><StudyParticipation /></section>
      <section className="space-y-3"><h2 className="text-lg font-medium">Export saved data</h2><p className="text-sm text-muted-foreground">Download your saved analysis snapshots, in-flight ratings and study observations.</p><Button disabled={busy} variant="outline" onClick={() => act('export', 'GET')}>Download account data</Button></section>
      <section className="space-y-3 border-t pt-6"><h2 className="text-lg font-medium">Delete account</h2><p className="text-sm text-muted-foreground">Permanently delete your account, uploaded rosters, analysis history, in-flight ratings, study debriefs and diary entries. Export any records you need first.</p><label className="block space-y-2 text-sm"><span>Confirm your current password</span><Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><Button variant="destructive" disabled={busy || !password} onClick={() => act('account', 'DELETE', { password })}>Permanently delete my account</Button></section>
    </>}
    <Link to="/privacy" className="block text-sm text-primary">Privacy and retention</Link>
  </main>;
}
