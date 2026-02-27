import { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogIn, UserPlus, Mail, Lock, User, MapPin, AlertCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import logoDark from '@/assets/logo-dark.png';

const ACCESS_PASSWORD = 'Admin123';

interface LandingHeaderProps {
  onEnter: () => void;
}

export function LandingHeader({ onEnter }: LandingHeaderProps) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { state: analysisState } = useAnalysis();

  // Admin quick-access
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [adminShaking, setAdminShaking] = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);

  // Enter dropdown — tabs: 'login' | 'register'
  const [enterOpen, setEnterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const enterRef = useRef<HTMLDivElement>(null);

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

  // Scroll state for header background intensity
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
      if (enterRef.current && !enterRef.current.contains(e.target as Node)) setEnterOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Admin submit
  const handleAdminSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (adminPassword === ACCESS_PASSWORD) {
      setAdminOpen(false);
      setAdminPassword('');
      setAdminError(false);
      onEnter();
    } else {
      setAdminError(true);
      setAdminShaking(true);
      setTimeout(() => setAdminShaking(false), 500);
    }
  };

  // Login submit
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      setEnterOpen(false);
      onEnter();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // Register submit
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
      setEnterOpen(false);
      onEnter();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-500
        ${scrolled
          ? 'bg-[#000408]/70 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.4)]'
          : 'bg-transparent'
        }
      `}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 md:px-8">
        {/* Left — Logo */}
        <div className="flex items-center gap-3">
          <img src={logoDark} alt="Aerowake" className="h-9 md:h-11" />
          <span className="hidden sm:inline text-[10px] font-mono text-white/25 tracking-wider uppercase">
            v2.1.2
          </span>
        </div>

        {/* Right — Buttons */}
        <div className="flex items-center gap-2">
          {/* EASA badge */}
          <span className="hidden md:inline text-[10px] font-mono text-white/20 tracking-wider uppercase mr-3">
            EASA ORO.FTL
          </span>

          {/* Admin button */}
          <div ref={adminRef} className="relative">
            <button
              onClick={() => { setAdminOpen(!adminOpen); setEnterOpen(false); }}
              className={`
                flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200
                ${adminOpen
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/60 hover:border-white/[0.12] hover:bg-white/[0.06]'
                }
              `}
            >
              <Shield className="h-3 w-3" />
              <span className="hidden sm:inline">Admin</span>
            </button>

            {/* Admin dropdown */}
            {adminOpen && (
              <div
                className={`
                  absolute right-0 top-full mt-2 w-64 rounded-xl border border-white/[0.08] bg-[#0a0e14]/90 backdrop-blur-2xl p-4
                  shadow-[0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]
                  animate-in fade-in slide-in-from-top-2 duration-200
                  ${adminShaking ? 'animate-shake' : ''}
                `}
              >
                <p className="mb-3 text-[11px] text-white/30 font-medium tracking-wide uppercase">Quick Access</p>
                <form onSubmit={handleAdminSubmit}>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => { setAdminPassword(e.target.value); setAdminError(false); }}
                      placeholder="Password"
                      className={`
                        w-full rounded-lg border bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20
                        outline-none transition-colors focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
                        ${adminError ? 'border-red-500/40' : 'border-white/[0.08]'}
                      `}
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  {adminError && (
                    <p className="mt-1.5 text-[11px] text-red-400">Incorrect password</p>
                  )}
                  <button
                    type="submit"
                    className="mt-3 w-full rounded-lg bg-amber-500/15 border border-amber-500/25 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/25 active:scale-[0.98]"
                  >
                    Enter
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Enter button with Login/Register dropdown */}
          <div ref={enterRef} className="relative">
            <button
              onClick={() => { setEnterOpen(!enterOpen); setAdminOpen(false); }}
              className={`
                flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200
                ${enterOpen
                  ? 'bg-[hsl(199,89%,48%)] text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]'
                  : 'bg-[hsl(199,89%,48%)] text-white hover:bg-[hsl(199,89%,42%)] hover:shadow-[0_0_24px_rgba(14,165,233,0.25)]'
                }
              `}
            >
              <LogIn className="h-3 w-3" />
              Enter
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${enterOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Login / Register dropdown */}
            {enterOpen && (
              <div
                className="
                  absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0a0e14]/90 backdrop-blur-2xl
                  shadow-[0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]
                  animate-in fade-in slide-in-from-top-2 duration-200
                "
              >
                {/* Tab switcher */}
                <div className="flex border-b border-white/[0.06]">
                  <button
                    onClick={() => setActiveTab('login')}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all
                      ${activeTab === 'login'
                        ? 'text-[hsl(199,89%,48%)] border-b-2 border-[hsl(199,89%,48%)]'
                        : 'text-white/35 hover:text-white/55'
                      }
                    `}
                  >
                    <LogIn className="h-3 w-3" />
                    Sign In
                  </button>
                  <button
                    onClick={() => setActiveTab('register')}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all
                      ${activeTab === 'register'
                        ? 'text-[hsl(199,89%,48%)] border-b-2 border-[hsl(199,89%,48%)]'
                        : 'text-white/35 hover:text-white/55'
                      }
                    `}
                  >
                    <UserPlus className="h-3 w-3" />
                    Register
                  </button>
                </div>

                <div className="p-4">
                  {activeTab === 'login' ? (
                    /* ── Login Tab ────────────────────────── */
                    <form onSubmit={handleLoginSubmit} className="space-y-3">
                      {loginError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-400">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />
                          <span>{loginError}</span>
                        </div>
                      )}

                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
                          required
                          autoComplete="email"
                        />
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
                          required
                          autoComplete="current-password"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loginLoading || !loginEmail || !loginPassword}
                        className="w-full rounded-lg bg-[hsl(199,89%,48%)] py-2 text-xs font-semibold text-white transition-all hover:bg-[hsl(199,89%,42%)] hover:shadow-[0_0_20px_rgba(14,165,233,0.2)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {loginLoading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  ) : (
                    /* ── Register Tab ─────────────────────── */
                    <form onSubmit={handleRegisterSubmit} className="space-y-3">
                      {regError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-400">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />
                          <span>{regError}</span>
                        </div>
                      )}

                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                        <input
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Display name"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
                          autoComplete="name"
                        />
                      </div>

                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="Email *"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
                          required
                          autoComplete="email"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                          <input
                            type="password"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Password *"
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
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
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-3 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
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
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-3 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
                        />
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                          <input
                            type="text"
                            value={regBase}
                            onChange={(e) => setRegBase(e.target.value.toUpperCase())}
                            placeholder="Base (IATA)"
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-[hsl(199,89%,48%)]/40 focus:ring-1 focus:ring-[hsl(199,89%,48%)]/20"
                            maxLength={4}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={regLoading || !regEmail || !regPassword || !regConfirm}
                        className="w-full rounded-lg bg-[hsl(199,89%,48%)] py-2 text-xs font-semibold text-white transition-all hover:bg-[hsl(199,89%,42%)] hover:shadow-[0_0_20px_rgba(14,165,233,0.2)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {regLoading ? 'Creating account...' : 'Create Account'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
