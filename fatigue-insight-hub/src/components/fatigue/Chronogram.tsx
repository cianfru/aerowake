import { useState, useMemo } from 'react';
import { Home, Globe, BarChart3, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DutyAnalysis, DutyStatistics, RestDaySleep, StandbyPeriod } from '@/types/fatigue';
import { TimelineRenderer } from './chronogram/TimelineRenderer';
import { homeBaseTransform, utcTransform } from '@/lib/timeline-transforms';
import { standbyBarsForMonth } from '@/lib/standby-bars';
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
  /** Standby periods (not scored) — drawn as muted hatched bars in the home-base view. */
  standbyPeriods?: StandbyPeriod[];
}

type ChronogramTab = 'homebase' | 'utc';

export function Chronogram({ duties, statistics, month, pilotName, pilotBase, pilotAircraft, onDutySelect, selectedDuty, restDaysSleep, analysisId, standbyPeriods }: ChronogramProps) {
  const [activeTab, setActiveTab] = useState<ChronogramTab>('homebase');

  // Sleep editing state
  const sleepEdits = useSleepEdits(analysisId);

  // Pre-compute timeline data for each grid-based view
  const homeBaseData = useMemo(
    () => ({
      ...homeBaseTransform(duties, statistics, month, restDaysSleep),
      standbyBars: standbyBarsForMonth(standbyPeriods, month),
    }),
    [duties, statistics, month, restDaysSleep, standbyPeriods],
  );

  const utcData = useMemo(
    () => utcTransform(duties, statistics, month, restDaysSleep),
    [duties, statistics, month, restDaysSleep],
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
          <BarChart3 className="h-5 w-5 text-primary" />
          Monthly Chronogram
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          High-resolution timeline showing duty timing, WOCL exposure, and fatigue patterns
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab selector for timeline type */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChronogramTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="homebase" className="text-xs">
              <Home className="h-3.5 w-3.5 mr-1 sm:h-3 sm:w-3" />
              Home base
            </TabsTrigger>
            <TabsTrigger value="utc" className="text-xs">
              <Globe className="h-3.5 w-3.5 mr-1 sm:h-3 sm:w-3" />
              UTC (Zulu)
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

        </Tabs>

        {/* Floating Apply bar — shows when sleep edits are pending */}
        {sleepEdits.hasEdits && (
          <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border border-border/50 px-4 py-3 flex items-center justify-between rounded-xl shadow-lg">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              {sleepEdits.editCount} sleep edit{sleepEdits.editCount > 1 ? 's' : ''} pending
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

        {/* Reset to Original bar — shows after recalculation when no new edits pending */}
        {sleepEdits.hasOriginal && !sleepEdits.hasEdits && (
          <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border border-primary/20 px-4 py-3 flex items-center justify-between rounded-xl shadow-lg">
            <span className="text-sm text-muted-foreground">
              Viewing recalculated results
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={sleepEdits.resetToOriginal}
            >
              ↩ Reset to Original
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
