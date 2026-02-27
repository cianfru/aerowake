import { Moon, Sun, LogIn, LogOut, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { cn } from '@/lib/utils';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';

interface HeaderProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export function Header({ theme, onThemeChange }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const { state } = useAnalysis();
  const hasPanel = state.expandedPanel !== null;

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <header className={cn(
      "border-b border-border/50 glass-strong relative z-20 transition-[margin-left] duration-200",
      "ml-0 md:ml-[var(--icon-rail-width)]",
      hasPanel && "md:ml-[calc(var(--icon-rail-width)+var(--panel-width))]",
    )}>
      <div className="flex items-center justify-between px-4 py-2 md:px-6 md:py-2.5">
        {/* Left: Logo + subtitle */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="Aerowake Logo"
            className="h-6 w-auto object-contain md:h-8"
          />
          <div className="hidden lg:block">
            <p className="text-[10px] text-muted-foreground">
              Biomathematical fatigue prediction
            </p>
          </div>
        </div>

        {/* Right: Auth + Badge + theme toggle */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <Badge variant="success" className="hidden lg:inline-flex text-[10px]">EASA ORO.FTL</Badge>

          {/* User auth section */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[100px]">
                {user?.display_name || user?.email?.split('@')[0] || 'User'}
              </span>
              {user?.is_admin && (
                <a
                  href="/admin"
                  className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  title="Admin Dashboard"
                >
                  <Shield className="h-3.5 w-3.5 text-primary" />
                </a>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center h-7 w-7 rounded-full bg-secondary/40 hover:bg-secondary/70 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign In</span>
            </a>
          )}

          <button
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
            className="relative h-7 w-12 rounded-full bg-secondary/60 backdrop-blur-sm p-1 transition-all duration-300 hover:bg-secondary/80 md:h-7 md:w-13 border border-border/50"
            aria-label="Toggle theme"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 backdrop-blur-sm shadow-sm transition-all duration-300 ${
                theme === 'dark' ? 'translate-x-0' : 'translate-x-5 md:translate-x-5'
              }`}
            >
              {theme === 'dark' ? (
                <Moon className="h-3 w-3 text-primary" />
              ) : (
                <Sun className="h-3 w-3 text-warning" />
              )}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
