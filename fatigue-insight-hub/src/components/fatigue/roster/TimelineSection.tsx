import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthlyAlertnessChart } from './MonthlyAlertnessChart';
import { SleepDebtTrendChart } from '../SleepDebtTrendChart';
import { BodyClockDriftChart } from '../BodyClockDriftChart';
import type { AnalysisResults } from '@/types/fatigue';

/** The month-long sleepiness chart and recovery trends have one dedicated view. */
export function TimelineSection({ results, homeBase }: { results: AnalysisResults; homeBase: string }) {
  return <section aria-labelledby="recovery-heading" className="instrument-surface min-w-0 space-y-5">
    <div className="space-y-2">
      <h2 id="recovery-heading" className="text-xl font-semibold">Sleep &amp; recovery</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">Follow predicted sleepiness through the month, then review the sleep and recovery assumptions behind it.</p>
    </div>
    <Tabs defaultValue="month" className="min-w-0">
      <TabsList aria-label="Recovery charts" className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="month">Monthly sleepiness</TabsTrigger>
        <TabsTrigger value="sleepdebt">Sleep shortfall</TabsTrigger>
        <TabsTrigger value="bodyclock">Body clock</TabsTrigger>
      </TabsList>
      <TabsContent value="month" className="mt-5"><MonthlyAlertnessChart samples={results.alertnessTimeline ?? []} duties={results.duties} month={results.month} homeTz={results.homeBaseTimezone || 'UTC'} /></TabsContent>
      <TabsContent value="sleepdebt" className="mt-5"><SleepDebtTrendChart duties={results.duties} month={results.month} /></TabsContent>
      <TabsContent value="bodyclock" className="mt-5"><BodyClockDriftChart duties={results.duties} month={results.month} homeBase={results.pilotBase || homeBase} bodyClockTimeline={results.bodyClockTimeline} /></TabsContent>
    </Tabs>
  </section>;
}
