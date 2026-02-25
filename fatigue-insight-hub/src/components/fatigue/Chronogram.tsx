import { useState, useMemo } from 'react';
import { Brain, Battery } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DutyAnalysis, DutyStatistics, RestDaySleep } from '@/types/fatigue';
import { ContinuousPerformanceTimeline } from './ContinuousPerformanceTimeline';
import { TimelineRenderer } from './chronogram/TimelineRenderer';
import { homeBaseTransform, utcTransform, elapsedTransform } from '@/lib/timeline-transforms';
import { useSleepEdits } from '@/hooks/useSleepEdits';

interface ChronogramProps {
  duties: DutyAnalysis[];
  statistics: DutyStatistics;
  month: Date;
  pilotId: string;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  restDaysSleep?: RestDaySleep[];
  analysisId?: string;
}

export function Chronogram({ duties, statistics, month, pilotId, pilotName, pilotBase, pilotAircraft, onDutySelect, selectedDuty, restDaysSleep, analysisId }: ChronogramProps) {
  const [activeTab, setActiveTab] = useState<'homebase' | 'utc' | 'elapsed' | 'continuous'>('homebase');

  // Sleep editing state
  const sleepEdits = useSleepEdits(analysisId);

  // Pre-compute timeline data for each grid-based view
  const homeBaseData = useMemo(
    () => homeBaseTransform(duties, statistics, month, restDaysSleep),
    [duties, statistics, month, restDaysSleep],
  );

  const utcData = useMemo(
    () => utcTransform(duties, statistics, month, restDaysSleep),
    [duties, statistics, month, restDaysSleep],
  );

  const elapsedData = useMemo(
    () => elapsedTransform(duties, month, restDaysSleep),
    [duties, month, restDaysSleep],
  );

  const statsSubset = useMemo(() => ({
    totalDuties: statistics.totalDuties,
    highRiskDuties: statistics.highRiskDuties,
    criticalRiskDuties: statistics.criticalRiskDuties,
  }), [statistics]);

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary">📊</span>
          Monthly Chronogram
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          High-resolution timeline showing duty timing, WOCL exposure, and fatigue patterns
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab selector for timeline type */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'homebase' | 'utc' | 'elapsed' | 'continuous')}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="homebase" className="text-xs">
              🏠 Home-Base Timeline
            </TabsTrigger>
            <TabsTrigger value="utc" className="text-xs">
              🌐 UTC (Zulu)
            </TabsTrigger>
            <TabsTrigger value="elapsed" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              Human Performance (Elapsed)
            </TabsTrigger>
            <TabsTrigger value="continuous" className="text-xs">
              <Battery className="h-3 w-3 mr-1" />
              SAFTE View
            </TabsTrigger>
          </TabsList>

          {/* Home-Base Timeline Tab — editable sleep */}
          <TabsContent value="homebase" className="mt-4 space-y-4">
            <TimelineRenderer
              data={homeBaseData}
              duties={duties}
              statistics={statsSubset}
              month={month}
              pilotName={pilotName}
              pilotBase={pilotBase}
              pilotAircraft={pilotAircraft}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              pendingEdits={sleepEdits.pendingEdits}
              onSleepEdit={sleepEdits.addEdit}
              onRemoveEdit={sleepEdits.removeEdit}
              activeEditBarId={sleepEdits.activeBarId}
              onActivateEdit={sleepEdits.activateEdit}
              onDeactivateEdit={sleepEdits.deactivateEdit}
            />
          </TabsContent>

          {/* UTC (Zulu) Timeline Tab */}
          <TabsContent value="utc" className="mt-4">
            <TimelineRenderer
              data={utcData}
              duties={duties}
              statistics={statsSubset}
              month={month}
              pilotName={pilotName}
              pilotBase={pilotBase}
              pilotAircraft={pilotAircraft}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
            />
          </TabsContent>

          {/* Human Performance (Elapsed Time) Tab */}
          <TabsContent value="elapsed" className="mt-4">
            <TimelineRenderer
              data={elapsedData}
              duties={duties}
              statistics={statsSubset}
              month={month}
              pilotName={pilotName}
              pilotBase={pilotBase}
              pilotAircraft={pilotAircraft}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
            />
          </TabsContent>

          {/* Continuous Performance Timeline (SAFTE View) Tab */}
          <TabsContent value="continuous" className="mt-4">
            <ContinuousPerformanceTimeline
              duties={duties}
              month={month}
              analysisId={analysisId}
              restDaysSleep={restDaysSleep}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              pilotBase={pilotBase}
            />
          </TabsContent>
        </Tabs>

        {/* Floating Apply bar — shows when sleep edits are pending */}
        {sleepEdits.hasEdits && (
          <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border border-border/30 px-4 py-3 flex items-center justify-between rounded-xl shadow-lg">
            <span className="text-sm text-muted-foreground">
              ✎ {sleepEdits.editCount} sleep edit{sleepEdits.editCount > 1 ? 's' : ''} pending
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={sleepEdits.clearEdits}
                disabled={sleepEdits.isApplying}
              >
                Reset All
              </Button>
              <Button
                variant="glow"
                size="sm"
                onClick={sleepEdits.applyEdits}
                disabled={sleepEdits.isApplying}
              >
                {sleepEdits.isApplying ? 'Recalculating…' : 'Apply & Recalculate'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
