import { CalendarRange, Upload, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useYearlyDashboard } from '@/hooks/useYearlyDashboard';
import { YearlySummaryCards } from './yearly/YearlySummaryCards';
import { DutyHoursChart } from './yearly/DutyHoursChart';
import { PerformanceTrendChart } from './yearly/PerformanceTrendChart';
import { RiskDistributionChart } from './yearly/RiskDistributionChart';
import { SleepMetricsChart } from './yearly/SleepMetricsChart';
import { WoclExposureChart } from './yearly/WoclExposureChart';

export function YearlyDashboardPage() {
  const { isAuthenticated } = useAuth();
  const { setActiveTab } = useAnalysis();
  const { months, summary, isLoading, isError } = useYearlyDashboard();

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to view your 12-month fatigue trends and analytics.
            </p>
            <a href="/login">
              <Button variant="glow" size="sm">Sign In</Button>
            </a>
          </Card>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
          <div className="flex items-center gap-3">
            <CalendarRange className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">12-Month Rolling Dashboard</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} variant="glass" className="p-4 md:p-5">
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 w-16 rounded bg-muted-foreground/10" />
                  <div className="h-6 w-12 rounded bg-muted-foreground/10" />
                  <div className="h-2.5 w-20 rounded bg-muted-foreground/10" />
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} variant="glass" className="p-6">
                <div className="h-[280px] animate-pulse rounded bg-muted-foreground/5" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (isError || !summary) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load dashboard data. Please try again later.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Empty — no rosters uploaded yet
  if (months.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <CalendarRange className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">12-Month Rolling Dashboard</h2>
          </div>
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Roster Data Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Upload your monthly roster PDFs to start tracking fatigue trends.
              Charts will appear once you have analyzed rosters.
            </p>
            <Button variant="glow" size="sm" onClick={() => setActiveTab('analysis')}>
              Upload Roster
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarRange className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">12-Month Rolling Dashboard</h2>
            <span className="text-xs text-muted-foreground">
              ({months.length} month{months.length !== 1 ? 's' : ''} of data)
            </span>
          </div>
        </div>

        {/* Single-month notice */}
        {months.length === 1 && (
          <Card variant="glass" className="p-3 border-primary/20">
            <p className="text-xs text-muted-foreground text-center">
              📊 Showing data from 1 month. Upload more rosters to see trends over time.
            </p>
          </Card>
        )}

        {/* Summary Cards */}
        <YearlySummaryCards summary={summary} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <DutyHoursChart months={months} />
          <PerformanceTrendChart months={months} />
          <RiskDistributionChart months={months} />
          <SleepMetricsChart months={months} />
        </div>

        {/* Full-width WOCL chart */}
        <WoclExposureChart months={months} />
      </div>
    </div>
  );
}
