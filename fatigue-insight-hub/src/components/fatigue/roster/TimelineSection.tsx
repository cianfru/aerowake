import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DutyKssChart } from './DutyKssChart';
import { MonthlyAlertnessChart } from './MonthlyAlertnessChart';
import { SleepDebtTrendChart } from '../SleepDebtTrendChart';
import { BodyClockDriftChart } from '../BodyClockDriftChart';
import { RouteNetwork } from './RouteNetwork';
import type { AnalysisResults } from '@/types/fatigue';

interface TimelineSectionProps {
  results: AnalysisResults;
  homeBase: string;
}

const isWide = () => {
  try {
    return typeof window !== 'undefined' && window.innerWidth >= 768;
  } catch {
    return false;
  }
};

/** Supporting trend charts. The interactive calendar is always visible above. */
export function TimelineSection({ results, homeBase }: TimelineSectionProps) {
  const [open, setOpen] = useState(isWide);

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section id="roster-charts" aria-label="Timeline and charts" className="scroll-mt-24 space-y-5">
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
          <Tabs defaultValue={isWide() ? "month" : "alertness"} className="w-full min-w-0">
            <TabsList className="h-auto w-full justify-start flex-wrap gap-x-5 gap-y-3 rounded-none border-b border-border bg-transparent p-0">
              {[['month', 'Through the month'], ['alertness', 'By duty'], ['sleepdebt', 'Sleep debt'], ['bodyclock', 'Body clock']].map(([v, l]) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="-mb-px rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-[13px] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="month" className="mt-5">
              <MonthlyAlertnessChart
                samples={results.alertnessTimeline ?? []}
                duties={results.duties}
                month={results.month}
                homeTz={results.homeBaseTimezone || 'UTC'}
              />
            </TabsContent>
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


        </CollapsibleContent>
      </section>
    </Collapsible>
    <RouteNetwork duties={results.duties} homeBase={results.pilotBase || homeBase} />
    </>
  );
}
