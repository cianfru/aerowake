import { Header } from '@/components/fatigue/Header';
import { Footer } from '@/components/fatigue/Footer';
import { IconRail } from '@/components/fatigue/IconRail';
import { SettingsPanel } from '@/components/fatigue/SettingsPanel';
import { RostersPage } from '@/components/fatigue/RostersPage';
import { MobileBottomBar } from '@/components/fatigue/MobileBottomBar';
import { DashboardContent } from '@/components/fatigue/DashboardContent';
import { InsightsContent } from '@/components/fatigue/InsightsContent';
import { LearnPage } from '@/components/fatigue/LearnPage';
import { AboutPage } from '@/components/fatigue/AboutPage';
import { YearlyDashboardPage } from '@/components/fatigue/YearlyDashboardPage';

import { LandingPage } from '@/components/landing/LandingPage';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { useTheme } from '@/hooks/useTheme';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PilotSettings } from '@/types/fatigue';

const Index = () => {
  const { state, setSettings, setShowLanding } = useAnalysis();
  const { theme, setTheme } = useTheme();

  // Sync theme from context → DOM (useTheme manages localStorage + <html> class)
  useEffect(() => {
    if (state.settings.theme !== theme) {
      setTheme(state.settings.theme);
    }
  }, [state.settings.theme]);

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    if (newSettings.theme) {
      setTheme(newSettings.theme);
    }
    setSettings(newSettings);
  };

  if (state.showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  const hasPanel = state.expandedPanel !== null;

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Desktop: Icon Rail */}
        <IconRail />

        {/* Expandable Settings Panel (desktop only, hidden on mobile) */}
        <div className="hidden md:block">
          {state.expandedPanel === 'settings' && <SettingsPanel />}
        </div>

        {/* Header (positioned right of rail on desktop) */}
        <Header
          theme={state.settings.theme}
          onThemeChange={(t) => handleSettingsChange({ theme: t })}
        />

        {/* Main content (dynamic margin based on rail + panel) */}
        <main
          className={cn(
            'flex-1 transition-[margin-left] duration-200',
            'ml-0 md:ml-[var(--icon-rail-width)]',
            hasPanel && 'md:ml-[calc(var(--icon-rail-width)+var(--panel-width))]',
            // Mobile: add bottom padding for bottom nav bar
            'pb-16 md:pb-0',
          )}
        >
          {state.activeTab === 'rosters' && <RostersPage />}
          {state.activeTab === 'analysis' && <DashboardContent />}
          {state.activeTab === 'insights' && (
            <div className="flex-1">
              <InsightsContent />
            </div>
          )}
          {state.activeTab === 'yearly' && (
            <div className="flex-1">
              <YearlyDashboardPage />
            </div>
          )}
          {state.activeTab === 'learn' && (
            <div className="flex-1">
              <LearnPage />
            </div>
          )}
          {state.activeTab === 'about' && (
            <div className="flex-1">
              <AboutPage />
            </div>
          )}
          <Footer />
        </main>

        {/* Mobile: Bottom Tab Bar */}
        <MobileBottomBar />
      </div>
    </div>
  );
};

export default Index;
