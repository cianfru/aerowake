import { Header } from '@/components/fatigue/Header';
import { Footer } from '@/components/fatigue/Footer';
import { RosterPage } from '@/components/fatigue/roster/RosterPage';
import { FatigueReportPage } from '@/components/fatigue/fatigue-report/FatigueReportPage';
import { HistoryPage } from '@/components/fatigue/hubs/HistoryPage';
import { LearnHubPage } from '@/components/fatigue/hubs/LearnHubPage';

import { LandingPage } from '@/components/landing/LandingPage';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { useTheme } from '@/hooks/useTheme';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import type { PilotSettings } from '@/types/fatigue';

const Index = () => {
  const { state, setSettings, setShowLanding } = useAnalysis();
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();

  // Sync theme from context → DOM (useTheme manages localStorage + <html> class)
  useEffect(() => {
    if (state.settings.theme !== theme) {
      setTheme(state.settings.theme);
    }
  }, [state.settings.theme]);

  // Skip landing page for returning authenticated users
  useEffect(() => {
    if (isAuthenticated && state.showLanding) {
      setShowLanding(false);
    }
  }, [isAuthenticated]);

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    if (newSettings.theme) {
      setTheme(newSettings.theme);
    }
    setSettings(newSettings);
  };

  if (state.showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header (full-width, includes hamburger sidebar) */}
        <Header
          theme={state.settings.theme}
          onThemeChange={(t) => handleSettingsChange({ theme: t })}
        />

        {/* Main content (full-width) */}
        <main className="flex-1 min-w-0">
          {state.activeTab === 'roster' && <RosterPage />}
          {state.activeTab === 'fatigue-report' && <FatigueReportPage />}
          {state.activeTab === 'history' && <HistoryPage />}
          {state.activeTab === 'learn' && <LearnHubPage />}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
