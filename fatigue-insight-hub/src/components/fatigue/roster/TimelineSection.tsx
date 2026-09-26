import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Chronogram } from '../Chronogram';
import { DutyKssChart } from './DutyKssChart';
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
      <section aria-label="Timeline and charts" className="space-y-5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-2 border-b border-border pb-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="text-[13px] font-semibold">Timeline &amp; charts</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {open ? 'Hide' : 'Show'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </span>
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
            <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent p-0">
              {[['alertness', 'Sleepiness'], ['sleepdebt', 'Sleep debt'], ['bodyclock', 'Body clock']].map(([v, l]) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="-mb-px rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-[13px] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="alertness" className="mt-5">
              <DutyKssChart duties={results.duties} month={results.month} />
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
