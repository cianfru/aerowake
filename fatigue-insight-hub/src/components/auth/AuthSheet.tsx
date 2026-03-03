import { useState, FormEvent } from 'react';
import { LogIn, UserPlus, Mail, Lock, User, MapPin, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { cn } from '@/lib/utils';

interface AuthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthSheet({ open, onOpenChange }: AuthSheetProps) {
  const { login, register } = useAuth();
  const { state: analysisState } = useAnalysis();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regName, setRegName] = useState('');
  const [regPilotId, setRegPilotId] = useState(analysisState.settings.pilotId || '');
  const [regBase, setRegBase] = useState(analysisState.settings.homeBase || '');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      onOpenChange(false);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters');
      return;
    }
    setRegLoading(true);
    try {
      await register(regEmail, regPassword, regName || undefined, regPilotId || undefined, regBase || undefined);
      onOpenChange(false);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border/50 bg-secondary/30 py-2 pl-9 pr-3 text-xs text-foreground placeholder-muted-foreground/50 outline-none transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20';
  const inputClassNoIcon =
    'w-full rounded-lg border border-border/50 bg-secondary/30 py-2 pl-3 pr-3 text-xs text-foreground placeholder-muted-foreground/50 outline-none transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="glass-strong border-l border-border/50 p-0 w-[min(320px,85vw)] sm:w-[320px]"
      >
        <SheetTitle className="sr-only">Sign In or Register</SheetTitle>

        {/* Tab switcher */}
        <div className="flex border-b border-border/30">
          <button
            onClick={() => setActiveTab('login')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-medium transition-all',
              activeTab === 'login'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground',
            )}
          >
            <LogIn className="h-3 w-3" />
            Sign In
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-medium transition-all',
              activeTab === 'register'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground',
            )}
          >
            <UserPlus className="h-3 w-3" />
            Register
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              {loginError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email"
                  className={inputClass}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  className={inputClass}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || !loginEmail || !loginPassword}
                className="w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              {regError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="relative">
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Display name"
                  className={inputClass}
                  autoComplete="name"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Email *"
                  className={inputClass}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password *"
                    className={inputClass}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Confirm *"
                  className={inputClassNoIcon}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={regPilotId}
                  onChange={(e) => setRegPilotId(e.target.value)}
                  placeholder="Pilot ID"
                  className={inputClassNoIcon}
                />
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                  <input
                    type="text"
                    value={regBase}
                    onChange={(e) => setRegBase(e.target.value.toUpperCase())}
                    placeholder="Base (IATA)"
                    className={inputClass}
                    maxLength={4}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading || !regEmail || !regPassword || !regConfirm}
                className="w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                {regLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
