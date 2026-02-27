import { useState } from 'react';
import {
  Menu, Moon, Sun, LogIn, LogOut, Shield,
  Home, FolderOpen, BarChart3, Activity, CalendarRange,
  BookOpen, Info, Microscope, Settings2, Globe, ShieldAlert,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRESET_PARAMS, ParamRow, RISK_COLORS } from './AdvancedParametersDialog';
import { PilotAvatar } from './PilotAvatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SettingsProfileManager } from './SettingsProfileManager';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import type { PilotSettings } from '@/types/fatigue';

// ── Config presets (shared with former SettingsPanel) ─────────

const configPresets = [
  { value: 'default', label: 'EASA Default', description: 'Balanced Borbely two-process model, EASA-compliant thresholds' },
  { value: 'conservative', label: 'Conservative', description: 'Faster fatigue buildup, stricter thresholds, 8.5h sleep need' },
  { value: 'liberal', label: 'Liberal', description: 'Relaxed thresholds for experienced crew, 7.5h sleep need' },
  { value: 'research', label: 'Research', description: 'Textbook Borbely (Jewett & Kronauer 1999), 50/50 S/C weighting' },
];

// ── Nav items ────────────────────────────────────────────────

const navItems = [
  { id: 'summary',  icon: Home,          label: 'Summary',   section: 'primary' },
  { id: 'rosters',  icon: FolderOpen,    label: 'Rosters',   section: 'primary' },
  { id: 'analysis', icon: BarChart3,     label: 'Analysis',  section: 'primary' },
  { id: 'insights', icon: Activity,      label: 'Insights',  section: 'primary' },
  { id: 'yearly',   icon: CalendarRange, label: '12-Month',  section: 'primary', requiresAuth: true },
  { id: 'learn',    icon: BookOpen,      label: 'Learn',     section: 'secondary' },
  { id: 'about',    icon: Info,          label: 'About',     section: 'secondary' },
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

  const activePreset = configPresets.find(p => p.value === settings.configPreset);
  const paramConfig = PRESET_PARAMS[settings.configPreset] || PRESET_PARAMS.default;

  const primaryNav = navItems.filter(n => n.section === 'primary');
  const secondaryNav = navItems.filter(n => n.section === 'secondary');

  return (
    <>
      <header className="border-b border-border/50 glass-strong relative z-20">
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
              onClick={() => { setActiveTab('summary'); setSidebarOpen(false); }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Go to Summary"
            >
              <img
                src={theme === 'dark' ? logoDark : logoLight}
                alt="Aerowake Logo"
                className="h-12 w-auto object-contain md:h-16 cursor-pointer"
              />
            </button>
            <div className="hidden lg:block">
              <p className="text-[10px] text-muted-foreground">
                Biomathematical fatigue prediction
              </p>
            </div>
          </div>

          {/* Right: Auth + Badge + theme toggle */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Badge variant="success" className="hidden lg:inline-flex text-[10px]">EASA ORO.FTL</Badge>

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

      {/* Navigation Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="glass-strong border-r border-border/50 p-0 w-[280px] sm:max-w-[280px]">
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
            <nav className="flex-1 p-2 space-y-0.5">
              {primaryNav.map(item => {
                if (item.requiresAuth && !isAuthenticated) return null;
                const Icon = item.icon;
                const isActive = state.activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
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

              {/* Divider */}
              <div className="my-2 border-t border-border/30" />

              {secondaryNav.map(item => {
                const Icon = item.icon;
                const isActive = state.activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
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
                <span className="text-xs font-semibold">Configuration</span>
              </div>

              {/* Model preset */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Model Preset</Label>
                <Select
                  value={settings.configPreset}
                  onValueChange={(value) => handleSettingsChange({ configPreset: value })}
                >
                  <SelectTrigger className="h-8 bg-secondary/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {configPresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value} className="text-xs">
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activePreset && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {activePreset.description}
                  </p>
                )}
              </div>

              {/* Crew set */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Crew Set</Label>
                <Select
                  value={settings.crewSet}
                  onValueChange={(value) => handleSettingsChange({ crewSet: value as 'crew_a' | 'crew_b' })}
                >
                  <SelectTrigger className="h-8 bg-secondary/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="crew_a" className="text-xs">Crew A (In-seat)</SelectItem>
                    <SelectItem value="crew_b" className="text-xs">Crew B (In-bunk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Inline model parameters (collapsed accordions) */}
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="processS" className="border-border/30">
                  <AccordionTrigger className="text-[11px] font-medium py-2">
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3 w-3 text-chart-1" />
                      Process S
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-0">
                      {Object.values(paramConfig.processS).map((entry, i) => (
                        <ParamRow key={i} entry={entry} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="processC" className="border-border/30">
                  <AccordionTrigger className="text-[11px] font-medium py-2">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-chart-2" />
                      Process C
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-0">
                      {Object.values(paramConfig.processC).map((entry, i) => (
                        <ParamRow key={i} entry={entry} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sleepQuality" className="border-border/30">
                  <AccordionTrigger className="text-[11px] font-medium py-2">
                    <span className="flex items-center gap-1.5">
                      <Moon className="h-3 w-3 text-chart-3" />
                      Sleep Quality
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-0">
                      {Object.values(paramConfig.sleepQuality).map((entry, i) => (
                        <ParamRow key={i} entry={entry} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="riskThresholds" className="border-border/30">
                  <AccordionTrigger className="text-[11px] font-medium py-2">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3 w-3 text-warning" />
                      Risk Thresholds
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1">
                      {Object.entries(paramConfig.riskThresholds).map(([key, entry]) => (
                        <div key={key} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                          <span className={`text-[10px] font-medium ${RISK_COLORS[key] || 'text-foreground'}`}>
                            {entry.label}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                            {entry.range}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="adaptation" className="border-border/30">
                  <AccordionTrigger className="text-[11px] font-medium py-2">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-chart-4" />
                      Adaptation
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-0">
                      {Object.values(paramConfig.adaptation).map((entry, i) => (
                        <ParamRow key={i} entry={entry} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Settings profiles */}
              <SettingsProfileManager
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
