import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/fatigue/Header';
import { Footer } from '@/components/fatigue/Footer';
import { RosterPage } from '@/components/fatigue/roster/RosterPage';
const FatigueReportPage = lazy(() => import('@/components/fatigue/fatigue-report/FatigueReportPage').then(m => ({ default: m.FatigueReportPage })));
const HistoryPage = lazy(() => import('@/components/fatigue/hubs/HistoryPage').then(m => ({ default: m.HistoryPage })));
const LearnHubPage = lazy(() => import('@/components/fatigue/hubs/LearnHubPage').then(m => ({ default: m.LearnHubPage })));

import { LandingPage } from '@/components/landing/LandingPage';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { useTheme } from '@/hooks/useTheme';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import type { PilotSettings } from '@/types/fatigue';

const Index = () => {
  const { state, dispatch, setSettings, setShowLanding } = useAnalysis();
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [reportVisited, setReportVisited] = useState(false);
  useEffect(() => { if (state.activeTab === 'fatigue-report') setReportVisited(true); }, [state.activeTab]);
  const pendingTab = useRef<string | null>(null);
  useEffect(() => {
    const tab = ({ '/roster': 'roster', '/report': 'fatigue-report', '/history': 'history', '/learn': 'learn' } as Record<string, string>)[location.pathname];
    if (tab) { pendingTab.current = tab; setShowLanding(false); dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }); }
  }, [location.pathname]); // Context actions are recreated with state.
  useEffect(() => {
    if (state.showLanding || (pendingTab.current && pendingTab.current !== state.activeTab)) return;
    pendingTab.current = null;
    const path = ({ roster: '/roster', 'fatigue-report': '/report', history: '/history', learn: '/learn' } as Record<string, string>)[state.activeTab];
    if (path && path !== location.pathname) navigate(path, { replace: location.pathname === '/' });
  }, [state.activeTab, state.showLanding, location.pathname, navigate]);

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
          {state.activeTab === 'roster' && (state.analysisResults?.legacyModel ?
            <section className="mx-auto max-w-2xl space-y-4 p-8"><h1 className="text-2xl font-semibold">Legacy model snapshot</h1><p>This analysis predates the current KSS model. Its scores cannot be converted into current sleepiness predictions. Upload the original roster to create a new analysis.</p><button className="text-primary underline" onClick={() => dispatch({ type: 'REMOVE_FILE' })}>Start a new analysis</button></section> : <RosterPage />)}
          {state.analysisResults?.persistenceStatus === 'failed' && <p role="alert" className="mx-auto max-w-4xl rounded-md border border-warning p-4">Analysis completed, but saving to your history failed. Keep this tab open and export your result or retry later.</p>}
          {reportVisited && <div hidden={state.activeTab !== 'fatigue-report'}><Suspense fallback={<p role="status">Loading report…</p>}><FatigueReportPage /></Suspense></div>}
          {state.activeTab === 'history' && <Suspense fallback={<p role="status">Loading history…</p>}><HistoryPage /></Suspense>}
          {state.activeTab === 'learn' && <Suspense fallback={<p role="status">Loading guide…</p>}><LearnHubPage /></Suspense>}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
