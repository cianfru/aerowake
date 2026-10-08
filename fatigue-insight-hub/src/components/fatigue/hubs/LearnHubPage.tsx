import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { LEARN_SUB_TABS, type LearnSubTab } from '@/lib/navigation';
import { LearnPage } from '../LearnPage';
import { MathematicalModelPage } from '../MathematicalModelPage';
import { PilotStudyPage } from '../PilotStudyPage';
import { AboutPage } from '../AboutPage';
import { SubTabBar } from './SubTabBar';

/** Learn hub: sleep science, how the model works, pilot study, about. */
export function LearnHubPage() {
  const { state, setSubTab } = useAnalysis();
  const { search } = useLocation();
  useEffect(() => {
    const section = new URLSearchParams(search).get('section');
    if (section === 'references' || section === 'science') setSubTab('learn');
    else if (section === 'model') setSubTab('model');
    // Context actions are recreated with state. Apply only when the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const active: LearnSubTab = LEARN_SUB_TABS.some((t) => t.id === state.activeSubTab)
    ? (state.activeSubTab as LearnSubTab)
    : 'learn';

  return (
    <div className="flex-1">
      <SubTabBar label="Learn sections" tabs={LEARN_SUB_TABS} active={active} onChange={setSubTab} />
      {active === 'learn' && <LearnPage />}
      {active === 'model' && <MathematicalModelPage />}
      {active === 'pilot-study' && <PilotStudyPage />}
      {active === 'about' && <AboutPage />}
    </div>
  );
}
