import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Compass, Globe2, Moon, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { DEFAULT_WATCH_KSS } from '@/lib/roster-forecast';
import { Chronogram } from '../Chronogram';
import { ExportOptions } from '../ExportOptions';
import { RosterForecast, RosterRecovery } from './RosterForecast';
import { DutyWatchCard } from './DutyWatchCard';
import { EasaChecksCard } from './EasaChecksCard';
import { TimelineSection } from './TimelineSection';
import { RouteNetwork } from './RouteNetwork';
import { selectDutiesToWatch } from './roster-utils';
import { SectionHeading } from './primitives';

const views = [
  { id: 'outlook', label: 'Outlook', icon: Compass },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'recovery', label: 'Sleep & recovery', icon: Moon },
  { id: 'limits', label: 'FTL checks', icon: ShieldCheck },
  { id: 'routes', label: 'Routes', icon: Globe2 },
] as const;
type RosterView = typeof views[number]['id'];

interface Props {
  results: AnalysisResults;
  pilotId: string;
  homeBase: string;
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  onReportFatigue: (duty: DutyAnalysis) => void;
  onConcern: (duty: DutyAnalysis, reference: number) => void;
}

/** Visited views stay mounted so switching tabs cannot discard sleep edits or map state. */
export function RosterWorkspace({ results, pilotId, homeBase, selectedDuty, onDutySelect, onReportFatigue, onConcern }: Props) {
  const [view, setView] = useState<RosterView>('outlook');
  const [visited, setVisited] = useState<Set<RosterView>>(() => new Set(['outlook']));
  const [reference, setReference] = useState(DEFAULT_WATCH_KSS);
  const nav = useRef<HTMLDivElement>(null);
  const watch = useMemo(() => selectDutiesToWatch(results), [results]);
  const index = views.findIndex(item => item.id === view);

  const navigate = (next: string) => {
    const target = views.find(item => item.id === next);
    if (!target) return;
    setVisited(previous => new Set([...previous, target.id]));
    setView(target.id);
    requestAnimationFrame(() => nav.current?.scrollIntoView?.({ block: 'start' }));
  };

  return <Tabs value={view} onValueChange={navigate} className="min-w-0">
    <div ref={nav} className="sticky top-14 z-10 scroll-mt-14 bg-background/95 pb-4 pt-2 backdrop-blur-xl">
      <TabsList aria-label="Roster views" className="grid h-auto w-full grid-cols-5 gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {views.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}
          className="min-w-0 flex-col gap-1.5 whitespace-normal rounded-lg px-1 py-3 text-center text-[11px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground md:flex-row md:gap-2 md:px-3 md:text-sm">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{label}</span>
        </TabsTrigger>)}
      </TabsList>
    </div>

    <TabsContent value="outlook" forceMount hidden={view !== 'outlook'} className="mt-5 space-y-8">
      <RosterForecast results={results} reference={reference} onReferenceChange={setReference} onDetails={onDutySelect} onConcern={onConcern} />
      <section aria-labelledby="watch-heading" className="space-y-1">
        <SectionHeading id="watch-heading" title="Duties to watch" aside={watch.length ? `${watch.length} ${watch.length === 1 ? 'duty' : 'duties'} · predicted KSS 6.5 or higher` : undefined} />
        {watch.length ? <div className="divide-y divide-border/70" data-testid="duties-to-watch">
          {watch.map((duty, i) => <DutyWatchCard key={duty.dutyId ?? i} duty={duty} onDetails={onDutySelect} onReportFatigue={onReportFatigue} />)}
        </div> : <p className="py-4 text-sm text-muted-foreground" data-testid="duties-to-watch-empty">No duties reach the model watch band. You can still report fatigue whenever you feel it — how you feel always comes first.</p>}
      </section>
    </TabsContent>

    {visited.has('calendar') && <TabsContent value="calendar" forceMount hidden={view !== 'calendar'} className="mt-5 space-y-8">
      <Chronogram duties={results.duties} statistics={results.statistics} month={results.month} pilotId={pilotId}
        pilotName={results.pilotName} pilotBase={results.pilotBase} pilotAircraft={results.pilotAircraft}
        onDutySelect={onDutySelect} selectedDuty={selectedDuty} restDaysSleep={results.restDaysSleep}
        analysisId={results.analysisId} standbyPeriods={results.standbyPeriods} />
      <ExportOptions duties={results.duties} />
    </TabsContent>}

    {visited.has('recovery') && <TabsContent value="recovery" forceMount hidden={view !== 'recovery'} className="mt-5 space-y-8">
      <TimelineSection results={results} homeBase={homeBase} />
      <RosterRecovery results={results} reference={reference} onDetails={onDutySelect} onConcern={onConcern} />
    </TabsContent>}

    {visited.has('limits') && <TabsContent value="limits" forceMount hidden={view !== 'limits'} className="mt-5">
      <EasaChecksCard findings={results.easaFindings} summary={results.easaSummary} />
    </TabsContent>}

    {visited.has('routes') && <TabsContent value="routes" forceMount hidden={view !== 'routes'} className="mt-5">
      <RouteNetwork duties={results.duties} homeBase={results.pilotBase || homeBase} />
    </TabsContent>}

    <nav aria-label="Continue through your roster" className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
      <div>{index > 0 && <Button variant="ghost" onClick={() => navigate(views[index - 1].id)}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />{views[index - 1].label}</Button>}</div>
      {index < views.length - 1 && <Button onClick={() => navigate(views[index + 1].id)}>Next: {views[index + 1].label}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>}
    </nav>
  </Tabs>;
}
