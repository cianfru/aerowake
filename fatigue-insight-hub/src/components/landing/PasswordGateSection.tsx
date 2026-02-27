import { useState, FormEvent } from 'react';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuroraBackground } from '@/components/ui/aurora-background';
import logoDark from '@/assets/logo-dark.png';
import { ScrollReveal } from './ScrollReveal';

const ACCESS_PASSWORD = 'Admin123';

interface PasswordGateSectionProps {
  onEnter: () => void;
}

export function PasswordGateSection({ onEnter }: PasswordGateSectionProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      setError(false);
      setAuthenticated(true);
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center bg-[#000408] overflow-hidden">
      {/* Aurora background with reduced opacity */}
      <AuroraBackground className="opacity-30" />

      <ScrollReveal>
        <div
          className={`
            relative z-10 mx-4 w-full max-w-md rounded-2xl border p-8 backdrop-blur-2xl transition-all duration-500
            ${authenticated
              ? 'border-green-500/30 bg-card/60 shadow-[0_0_40px_rgba(34,197,94,0.1)]'
              : error
                ? 'border-red-500/30 bg-card/60'
                : 'border-white/[0.1] bg-card/50'
            }
            ${shaking ? 'animate-shake' : ''}
          `}
          style={{
            boxShadow: authenticated
              ? '0 0 60px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <img src={logoDark} alt="Aerowake" className="h-11" />
          </div>

          {/* Title */}
          <h3 className="text-center text-xl font-bold text-white">
            Enter the Platform
          </h3>
          <p className="mt-1.5 text-center text-xs text-white/35">
            Professional access required
          </p>

          {authenticated ? (
            /* Success state */
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-1.5 text-sm text-green-400 border border-green-500/20">
                <ShieldCheck className="h-4 w-4" />
                Access Granted
              </div>
              <button
                onClick={onEnter}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(199,89%,48%)] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-[hsl(199,89%,42%)] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-[0.98]"
              >
                Enter Platform
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Password form */
            <form onSubmit={handleSubmit} className="mt-8">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder="Enter password"
                  className={`
                    w-full rounded-lg border bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder-white/25
                    outline-none transition-colors focus:border-[hsl(199,89%,48%)/0.5] focus:ring-1 focus:ring-[hsl(199,89%,48%)/0.2]
                    ${error ? 'border-red-500/40' : 'border-white/10'}
                  `}
                  autoComplete="off"
                />
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-400">
                  Incorrect password. Please try again.
                </p>
              )}

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(199,89%,48%)] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-[hsl(199,89%,42%)] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-[0.98]"
              >
                <Lock className="h-3.5 w-3.5" />
                Unlock Access
              </button>
            </form>
          )}
        </div>
      </ScrollReveal>
    </section>
  );
}
