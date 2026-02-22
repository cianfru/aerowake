import { Header } from '@/components/fatigue/Header';
import { Footer } from '@/components/fatigue/Footer';
import { DashboardContent } from '@/components/fatigue/DashboardContent';
import { InsightsContent } from '@/components/fatigue/InsightsContent';
import { LearnPage } from '@/components/fatigue/LearnPage';
import { AboutPage } from '@/components/fatigue/AboutPage';
import { MyRostersPage } from '@/components/fatigue/MyRostersPage';
import { LandingPage } from '@/components/landing/LandingPage';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { useTheme } from '@/hooks/useTheme';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useEffect } from 'react';
import { PilotSettings } from '@/types/fatigue';

const Index = () => {
  const { state, setSettings, setSidebarOpen, setActiveTab, setShowLanding } = useAnalysis();
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

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <AuroraBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header
          theme={state.settings.theme}
          onThemeChange={(t) => handleSettingsChange({ theme: t })}
          onMenuToggle={() => setSidebarOpen(true)}
          showMenuButton={true}
          activeTab={state.activeTab}
          onTabChange={setActiveTab}
        />

        {state.activeTab === 'analysis' && (
          <div className="flex-1">
            <DashboardContent />
          </div>
        )}

        {state.activeTab === 'insights' && (
          <div className="flex-1">
            <InsightsContent />
          </div>
        )}

        {state.activeTab === 'rosters' && (
          <div className="flex-1">
            <MyRostersPage />
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
      </div>
    </div>
  );
};

export default Index;
