import { useState } from 'react';
import { ChevronDown, LineChart, Activity, Clock, TrendingDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Chronogram } from '../Chronogram';
import { PerformanceTimeline } from '../PerformanceTimeline';
import { SleepDebtTrendChart } from '../SleepDebtTrendChart';
import { BodyClockDriftChart } from '../BodyClockDriftChart';
import { RouteNetworkMapbox } from '../RouteNetworkMapbox';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';

interface TimelineSectionProps {
  results: AnalysisResults;
  pilotId: string;
  homeBase: string;
  theme: 'dark' | 'light';
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
}

const isWide = () => {
  try {
    return typeof window !== 'undefined' && window.innerWidth >= 768;
  } catch {
    return false;
  }
};

/** Monthly chronogram + trend charts. Collapsed by default on mobile. */
export function TimelineSection({ results, pilotId, homeBase, theme, selectedDuty, onDutySelect }: TimelineSectionProps) {
  const [open, setOpen] = useState(isWide);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-label="Timeline and charts" className="space-y-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <LineChart className="h-4 w-4" aria-hidden="true" />
              Timeline &amp; charts
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 min-w-0">
          {/* The chronogram scrolls horizontally inside its own container on small screens. */}
          <div className="min-w-0">
            <Chronogram
              duties={results.duties}
              statistics={results.statistics}
              month={results.month}
              pilotId={pilotId}
              pilotName={results.pilotName}
              pilotBase={results.pilotBase}
              pilotAircraft={results.pilotAircraft}
              onDutySelect={onDutySelect}
              selectedDuty={selectedDuty}
              restDaysSleep={results.restDaysSleep}
              analysisId={results.analysisId}
              standbyPeriods={results.standbyPeriods}
            />
          </div>

          <Tabs defaultValue="alertness" className="w-full min-w-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="alertness" className="text-xs">
                <Activity className="h-3 w-3 mr-1" aria-hidden="true" />
                Alertness
              </TabsTrigger>
              <TabsTrigger value="sleepdebt" className="text-xs">
                <TrendingDown className="h-3 w-3 mr-1" aria-hidden="true" />
                Sleep debt
              </TabsTrigger>
              <TabsTrigger value="bodyclock" className="text-xs">
                <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                Body clock
              </TabsTrigger>
            </TabsList>
            <TabsContent value="alertness" className="mt-4">
              <PerformanceTimeline duties={results.duties} month={results.month} />
            </TabsContent>
            <TabsContent value="sleepdebt" className="mt-4">
              <SleepDebtTrendChart duties={results.duties} month={results.month} />
            </TabsContent>
            <TabsContent value="bodyclock" className="mt-4">
              <BodyClockDriftChart
                duties={results.duties}
                month={results.month}
                homeBase={results.pilotBase || homeBase}
                bodyClockTimeline={results.bodyClockTimeline}
              />
            </TabsContent>
          </Tabs>

          {/* Renders nothing without a Mapbox token. */}
          <RouteNetworkMapbox duties={results.duties} homeBase={results.pilotBase || homeBase} theme={theme} />
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
