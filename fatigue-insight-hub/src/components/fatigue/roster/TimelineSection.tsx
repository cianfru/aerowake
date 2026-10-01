import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthlyAlertnessChart } from './MonthlyAlertnessChart';
import { SleepShortfallChart } from '../SleepDebtTrendChart';
import { BodyClockDriftChart } from '../BodyClockDriftChart';
import type { AnalysisResults } from '@/types/fatigue';

const chartTab = 'rounded-lg border border-transparent px-3 py-1.5 text-[13px] text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';

/** The month-long sleepiness chart and recovery trends have one dedicated view. */
export function TimelineSection({ results, homeBase }: { results: AnalysisResults; homeBase: string }) {
  return <section aria-labelledby="recovery-heading" className="instrument-surface min-w-0 space-y-5">
    <div className="space-y-1">
      <h2 id="recovery-heading" className="text-title font-semibold">Sleep &amp; recovery</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">Predicted sleepiness through the month, with the estimated sleep and 7-day sleep shortfall behind it.</p>
    </div>
    <Tabs defaultValue="month" className="min-w-0">
      <TabsList aria-label="Recovery charts" className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1 sm:w-auto">
        <TabsTrigger value="month" className={chartTab}>Monthly sleepiness</TabsTrigger>
        <TabsTrigger value="shortfall" className={chartTab}>7-day sleep shortfall</TabsTrigger>
        <TabsTrigger value="bodyclock" className={chartTab}>Body clock</TabsTrigger>
      </TabsList>
      <TabsContent value="month" className="mt-5"><MonthlyAlertnessChart samples={results.alertnessTimeline ?? []} duties={results.duties} month={results.month} homeTz={results.homeBaseTimezone || 'UTC'} /></TabsContent>
      <TabsContent value="shortfall" className="mt-5"><SleepShortfallChart duties={results.duties} month={results.month} /></TabsContent>
      <TabsContent value="bodyclock" className="mt-5"><BodyClockDriftChart duties={results.duties} month={results.month} homeBase={results.pilotBase || homeBase} bodyClockTimeline={results.bodyClockTimeline} /></TabsContent>
    </Tabs>
  </section>;
}
