import { useState } from 'react';
import {
  Menu, Moon, Sun, LogIn, LogOut, Shield,
  CalendarDays, History, BookOpen, FileWarning, Microscope,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { PilotAvatar } from './PilotAvatar';
import { SettingsProfileManager } from './SettingsProfileManager';
import { AuthSheet } from '@/components/auth/AuthSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import logoDark from '@/assets/logo-dark.png';
import type { PilotSettings } from '@/types/fatigue';
import type { HubId } from '@/lib/navigation';

// ── Nav items (four hubs; see src/lib/navigation.ts) ─────────

const navItems: Array<{ id: HubId; icon: typeof CalendarDays; label: string }> = [
  { id: 'roster',         icon: CalendarDays, label: 'Roster' },
  { id: 'fatigue-report', icon: FileWarning,  label: 'Report fatigue' },
  { id: 'history',        icon: History,      label: 'History' },
  { id: 'learn',          icon: BookOpen,     label: 'Learn' },
];

// ── Header + Sidebar ─────────────────────────────────────────

interface HeaderProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export function Header({ theme, onThemeChange }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const { state, setSettings, setActiveTab } = useAnalysis();
  const { setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);

  const { settings, analysisResults } = state;

  const handleSignOut = async () => {
    await logout();
  };

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    if (newSettings.theme) setTheme(newSettings.theme);
    setSettings(newSettings);
  };

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  // Pilot details (fallback chain: analysis → auth user → settings)
  const pilotName = analysisResults?.pilotName || user?.display_name || null;
  const pilotId = analysisResults?.pilotId || user?.pilot_id || settings.pilotId;
  const pilotBase = analysisResults?.pilotBase || user?.home_base || settings.homeBase;
  const pilotAircraft = analysisResults?.pilotAircraft || null;


  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          {/* Left: menu (mobile) + logo + inline nav (desktop) */}
          <div className="flex min-w-0 items-center gap-2 md:gap-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setActiveTab('roster'); setSidebarOpen(false); }}
              className="flex-shrink-0 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Go to Roster"
            >
              <img src={logoDark} alt="Aerowake Logo" className="h-7 w-auto cursor-pointer object-contain logo-themed" />
            </button>
            <nav className="hidden h-14 items-stretch gap-6 md:flex" aria-label="Sections">
              {navItems.map((item) => {
                const isActive = state.activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      '-mb-px border-b-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:text-foreground',
                      isActive
                        ? 'border-foreground font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: account + theme */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {isAuthenticated ? (
              <>
                <span className="hidden max-w-[160px] truncate px-2 text-[13px] text-muted-foreground md:inline">
                  {user?.display_name || user?.email?.split('@')[0] || 'User'}
                  {user?.company_name ? ` · ${user.company_name}` : ''}
                </span>
                {user?.is_admin && (
                  <a
                    href="/admin"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    title="Admin Dashboard"
                  >
                    <Shield className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthSheetOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-foreground/90 transition-colors hover:bg-muted/60"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden md:inline">Sign in</span>
              </button>
            )}
            <button
              onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="glass-strong border-r border-border/50 p-0 w-[min(280px,85vw)] sm:w-[280px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Pilot card */}
            <div className="p-4 pb-3 border-b border-border/30">
              <div className="flex items-center gap-3">
                <PilotAvatar pilotName={pilotName} size="sm" />
                <div className="flex-1 min-w-0">
                  {pilotName ? (
                    <p className="text-sm font-semibold truncate">{pilotName}</p>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground">Pilot</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {[
                      pilotId && pilotId !== 'P12345' ? `ID: ${pilotId}` : null,
                      pilotBase,
                      pilotAircraft,
                    ].filter(Boolean).join(' \u2022 ') || 'No roster loaded'}
                  </p>
                </div>
              </div>
            </div>

            {/* Primary nav */}
            <nav className="flex-1 p-2 space-y-0.5" aria-label="Main">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = state.activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-muted/70 text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Configuration section */}
            <div className="border-t border-border/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Microscope className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Model &amp; profile</span>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                One alertness model (Three Process Model, KSS — Ingre et al. 2014) with EASA ORO.FTL checks. No presets to tune.
              </p>

              {/* Settings profiles */}
              <SettingsProfileManager
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Auth slide-over (sign in / register from within the app) */}
      {!isAuthenticated && (
        <AuthSheet open={authSheetOpen} onOpenChange={setAuthSheetOpen} />
      )}
    </>
  );
}
