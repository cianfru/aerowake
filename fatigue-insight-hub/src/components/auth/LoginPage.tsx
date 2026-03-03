import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { LandingPage } from '@/components/landing/LandingPage';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { setShowLanding } = useAnalysis();
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Landing page as visual backdrop */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <LandingPage onEnter={() => {}} />
      </div>

      {/* Overlay — click outside card dismisses back to landing */}
      <div
        className="relative z-10 min-h-screen flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
        onClick={() => navigate(-1)}
      >
      <Card variant="glass" className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold">Sign In to Aerowake</CardTitle>
          <p className="text-sm text-muted-foreground">
            Access your saved rosters and analysis history
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-critical/50 bg-critical/10 p-3 text-sm text-critical">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="pilot@airline.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="glow"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">
                Register
              </Link>
            </p>

            <p className="text-center text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => { setShowLanding(false); navigate('/'); }}
                className="hover:text-muted-foreground"
              >
                Continue without account
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
