import { Header } from '@/components/fatigue/Header';
import { Footer } from '@/components/fatigue/Footer';
import { RostersPage } from '@/components/fatigue/RostersPage';
import { DashboardContent } from '@/components/fatigue/DashboardContent';
import { InsightsContent } from '@/components/fatigue/InsightsContent';
import { LearnPage } from '@/components/fatigue/LearnPage';
import { AboutPage } from '@/components/fatigue/AboutPage';
import { YearlyDashboardPage } from '@/components/fatigue/YearlyDashboardPage';
import { SummaryPage } from '@/components/fatigue/SummaryPage';

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
        <main className="flex-1">
          {state.activeTab === 'summary' && <SummaryPage />}
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
      </div>
    </div>
  );
};

export default Index;
