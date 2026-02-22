import { useState, useMemo } from 'react';
import { Brain, Battery } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DutyAnalysis, DutyStatistics, RestDaySleep } from '@/types/fatigue';
import { addDays, getDaysInMonth, startOfMonth } from 'date-fns';
import { HumanPerformanceTimeline } from './HumanPerformanceTimeline';
import { UtcTimeline } from './UtcTimeline';
import { ContinuousPerformanceTimeline } from './ContinuousPerformanceTimeline';
import { HomeBaseTimeline } from './chronogram/HomeBaseTimeline';

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

  // Days that have actual duties (used by UTC tab)
  const daysInMonth = getDaysInMonth(month);
  const monthStart = startOfMonth(month);
  const dutyDays = useMemo(() => {
    const dutyDayIndices = new Set<number>();
    duties.forEach((duty) => {
      dutyDayIndices.add(duty.date.getDate());
      // Also include next day for overnight duties
      if (duty.flightSegments.length > 0) {
        const lastSegment = duty.flightSegments[duty.flightSegments.length - 1];
        const firstSegment = duty.flightSegments[0];
        const [startH] = firstSegment.departureTime.split(':').map(Number);
        const [endH] = lastSegment.arrivalTime.split(':').map(Number);
        if (endH < startH && duty.date.getDate() < daysInMonth) {
          dutyDayIndices.add(duty.date.getDate() + 1);
        }
      }
    });
    return Array.from(dutyDayIndices).sort((a, b) => a - b).map(dayNum => addDays(monthStart, dayNum - 1));
  }, [duties, daysInMonth, monthStart]);

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

          {/* Home-Base Timeline Tab */}
          <TabsContent value="homebase" className="mt-4 space-y-4">
            <HomeBaseTimeline
              duties={duties}
              statistics={statistics}
              month={month}
              pilotId={pilotId}
              pilotName={pilotName}
              pilotBase={pilotBase}
              pilotAircraft={pilotAircraft}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              restDaysSleep={restDaysSleep}
            />
          </TabsContent>

          {/* UTC (Zulu) Timeline Tab */}
          <TabsContent value="utc" className="mt-4">
            <UtcTimeline
              duties={duties}
              statistics={{
                totalDuties: statistics.totalDuties,
                highRiskDuties: statistics.highRiskDuties,
                criticalRiskDuties: statistics.criticalRiskDuties,
              }}
              month={month}
              pilotName={pilotName}
              pilotBase={pilotBase}
              pilotAircraft={pilotAircraft}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              restDaysSleep={restDaysSleep}
            />
          </TabsContent>

          {/* Human Performance (Elapsed Time) Tab */}
          <TabsContent value="elapsed" className="mt-4">
            <HumanPerformanceTimeline
              duties={duties}
              month={month}
              pilotName={pilotName}
              pilotBase={pilotBase}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              restDaysSleep={restDaysSleep}
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
      </CardContent>
    </Card>
  );
}
