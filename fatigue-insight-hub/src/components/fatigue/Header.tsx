import { Moon, Sun, Menu, LogIn, LogOut, FolderOpen, CalendarRange, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';

interface HeaderProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface NavItem {
  value: string;
  label: string;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { value: 'analysis', label: 'Analysis' },
  { value: 'insights', label: 'Insights' },
  { value: 'yearly', label: '12-Month', requiresAuth: true },
  { value: 'rosters', label: 'Rosters', requiresAuth: true },
  { value: 'learn', label: 'Learn' },
  { value: 'about', label: 'About' },
];

export function Header({ theme, onThemeChange, onMenuToggle, showMenuButton, activeTab = 'analysis', onTabChange }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <header className="border-b border-border/20 glass-strong relative z-20">
      <div className="flex items-center justify-between px-4 py-2.5 md:px-6 md:py-3">
        {/* Left: Logo + subtitle */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={onMenuToggle}
            >
              <Menu className="h-4.5 w-4.5" />
            </Button>
          )}

          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="Aerowake Logo"
            className="h-7 w-auto object-contain md:h-9"
          />
          <div className="hidden lg:block">
            <p className="text-[10px] text-muted-foreground/70">
              Biomathematical fatigue prediction
            </p>
          </div>
        </div>

        {/* Center: Navigation tabs */}
        <nav className="flex items-center gap-0.5 md:gap-1 mx-2 md:mx-8 overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            // Hide auth-required tabs when not logged in
            if (item.requiresAuth && !isAuthenticated) return null;

            return (
              <button
                key={item.value}
                onClick={() => onTabChange?.(item.value)}
                className={`relative px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap
                  ${activeTab === item.value
                    ? 'text-foreground bg-secondary/60 backdrop-blur-sm shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                  }
                `}
              >
                {item.value === 'yearly' && <CalendarRange className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />}
                {item.value === 'rosters' && <FolderOpen className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />}
                {item.label}
                {activeTab === item.value && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>

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
            className="relative h-7 w-12 rounded-full bg-secondary/60 backdrop-blur-sm p-1 transition-all duration-300 hover:bg-secondary/80 md:h-7 md:w-13 border border-border/20"
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
