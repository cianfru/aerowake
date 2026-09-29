import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const api = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';
export default function AccountActionPage() {
  const [[purpose, token]] = useState(() => {
    const values = window.location.hash.slice(1).split(':');
    return values;
  });
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="mx-auto min-h-screen max-w-md space-y-6 px-5 py-16"><Link to="/" className="text-primary">← AeroWake</Link><h1 className="text-3xl font-semibold">{purpose === 'verify' ? 'Verify your email' : 'Reset your password'}</h1>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      try {
        const path = purpose === 'verify' ? 'verification/confirm' : token ? 'password-reset/confirm' : 'password-reset/request';
        const res = await fetch(`${api}/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(token ? { token, password } : { email }) });
        const data = await res.json();
        setMessage(typeof data.detail === 'string' ? data.detail : data.message || 'Please check the details and try again.');
      } catch { setMessage('Unable to connect. Please try again.'); } finally { setBusy(false); }
    }}>
      {!token && <label className="block space-y-2 text-sm"><span>Account email</span><Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {token && purpose !== 'verify' && <label className="block space-y-2 text-sm"><span>New password · at least 8 characters</span><Input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <Button disabled={busy} type="submit">{busy ? 'Please wait…' : purpose === 'verify' ? 'Verify email' : token ? 'Update password' : 'Send reset link'}</Button>
    </form>{message && <p role="status">{message}</p>}<Link to="/login" className="block text-primary">Sign in</Link>
  </main>;
}
