import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatisticsCards } from '@/components/fatigue/StatisticsCards';
import { RouteNetworkMapbox } from '@/components/fatigue/RouteNetworkMapbox';
import { PerformanceTimeline } from '@/components/fatigue/PerformanceTimeline';
import { BodyClockDriftChart } from '@/components/fatigue/BodyClockDriftChart';
import { SleepDebtTrendChart } from '@/components/fatigue/SleepDebtTrendChart';
import { ExportOptions } from '@/components/fatigue/ExportOptions';
import { useAnalysis } from '@/contexts/AnalysisContext';

export function InsightsContent() {
  const { state } = useAnalysis();
  const { analysisResults, settings } = state;

  if (!analysisResults) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <span className="text-5xl md:text-6xl">📊</span>
              <h3 className="text-lg md:text-xl font-semibold">No Analysis Data</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Run an analysis from the Analysis tab first to see insights here.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6 animate-fade-in">
        {/* Statistics Ribbon */}
        <Card variant="glass" className="data-view-card">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <span className="text-primary">📊</span>
              Summary Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatisticsCards statistics={analysisResults.statistics} duties={analysisResults.duties} />
            {analysisResults.statistics.criticalRiskDuties > 0 && (
              <div className="mt-4 flex items-start gap-2 md:gap-3 rounded-lg border border-critical/50 bg-critical/10 p-3 md:p-4">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0 text-critical" />
                <div>
                  <p className="font-medium text-critical text-sm md:text-base">
                    CRITICAL: {analysisResults.statistics.criticalRiskDuties} duties with critical risk
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    SMS reporting required per EASA ORO.FTL.120
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Route Network Map */}
        <RouteNetworkMapbox duties={analysisResults.duties} homeBase={settings.homeBase} theme={settings.theme} />

        {/* Analytics Charts */}
        <Tabs defaultValue="performance" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-auto">
            <TabsTrigger value="performance" className="text-xs md:text-sm py-2">
              <span className="hidden sm:inline">Performance </span>Timeline
            </TabsTrigger>
            <TabsTrigger value="circadian" className="text-xs md:text-sm py-2">
              <span className="hidden sm:inline">Body Clock </span>Drift
            </TabsTrigger>
            <TabsTrigger value="sleepdebt" className="text-xs md:text-sm py-2">
              <span className="hidden sm:inline">Sleep Debt </span>Trend
            </TabsTrigger>
          </TabsList>
          <TabsContent value="performance" className="mt-4">
            <PerformanceTimeline duties={analysisResults.duties} month={analysisResults.month} />
          </TabsContent>
          <TabsContent value="circadian" className="mt-4">
            <BodyClockDriftChart duties={analysisResults.duties} month={analysisResults.month} homeBase={settings.homeBase} bodyClockTimeline={analysisResults.bodyClockTimeline} />
          </TabsContent>
          <TabsContent value="sleepdebt" className="mt-4">
            <SleepDebtTrendChart duties={analysisResults.duties} month={analysisResults.month} />
          </TabsContent>
        </Tabs>

        {/* Export Options */}
        <ExportOptions duties={analysisResults.duties} />
      </div>
    </div>
  );
}
