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
      <header className="sticky top-0 border-b border-border/50 glass-strong relative z-20">
        <div className="flex items-center justify-between px-4 py-2 md:px-6 md:py-2.5">
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="h-4.5 w-4.5 text-foreground" />
            </button>
            <button
              onClick={() => { setActiveTab('roster'); setSidebarOpen(false); }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Go to Roster"
            >
              <img
                src={logoDark}
                alt="Aerowake Logo"
                className="h-8 w-auto object-contain md:h-10 cursor-pointer logo-themed"
              />
            </button>
          </div>

          {/* Right: Auth + Badge + theme toggle */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Badge variant="success" className="hidden lg:inline-flex text-[10px]">EASA ORO.FTL</Badge>

            {isAuthenticated ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[100px]">
                  {user?.display_name || user?.email?.split('@')[0] || 'User'}
                </span>
                {user?.company_name && (
                  <Badge variant="outline" className="hidden lg:inline-flex text-[10px]">
                    {user.company_name}
                  </Badge>
                )}
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
              <button
                onClick={() => setAuthSheetOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sign In</span>
              </button>
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
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
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
