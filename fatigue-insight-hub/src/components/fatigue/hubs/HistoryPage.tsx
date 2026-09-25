import { useState } from 'react';
import { History, LogIn } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthSheet } from '@/components/auth/AuthSheet';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { HISTORY_SUB_TABS, type HistorySubTab } from '@/lib/navigation';
import { RostersPage } from '../RostersPage';
import { YearlyDashboardPage } from '../YearlyDashboardPage';
import { ComparativeMetricsPage } from '../ComparativeMetricsPage';
import { SubTabBar } from './SubTabBar';

/** History hub: saved rosters, 12-month view and peer comparison (signed-in only). */
export function HistoryPage() {
  const { state, setSubTab } = useAnalysis();
  const { isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-xl">
          <Card variant="glass" className="p-6 md:p-10 text-center space-y-4">
            <History className="h-8 w-8 text-primary mx-auto" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Sign in to see your history</h2>
            <p className="text-sm text-muted-foreground">
              Signed-in pilots keep every analysed roster, a 12-month view and a comparison with peers.
            </p>
            <Button variant="glow" onClick={() => setAuthOpen(true)}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign in
            </Button>
          </Card>
        </div>
        <AuthSheet open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  const active: HistorySubTab = HISTORY_SUB_TABS.some((t) => t.id === state.activeSubTab)
    ? (state.activeSubTab as HistorySubTab)
    : 'rosters';

  return (
    <div className="flex-1">
      <SubTabBar label="History sections" tabs={HISTORY_SUB_TABS} active={active} onChange={setSubTab} />
      {active === 'rosters' && <RostersPage />}
      {active === 'yearly' && <YearlyDashboardPage />}
      {active === 'compare' && <ComparativeMetricsPage />}
    </div>
  );
}
