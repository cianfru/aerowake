import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Compass, Globe2, Moon, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { DEFAULT_WATCH_KSS } from '@/lib/roster-forecast';
import { KSS_LABELS, RISK_LEVEL_KSS_RANGE, RISK_LEVEL_LABELS, riskClasses, type RiskLevel } from '@/lib/risk-scale';
import { cn } from '@/lib/utils';
import { InflightLogger, canLogNow } from '../inflight/InflightLogger';
import { OfflineBanner } from '../inflight/OfflineBanner';
import { Chronogram } from '../Chronogram';
import { ExportOptions } from '../ExportOptions';
import { RosterForecast, RosterRecovery } from './RosterForecast';
import { DutyWatchCard } from './DutyWatchCard';
import { DebriefQueue } from '@/components/fatigue/debrief/DebriefQueue';
import { EasaChecksCard } from './EasaChecksCard';
import { TimelineSection } from './TimelineSection';
import { RouteNetwork } from './RouteNetwork';
import { dutyRoute, groupDutiesToWatch, selectDutiesToWatch } from './roster-utils';
import { SectionHeading } from './primitives';

const views = [
  { id: 'outlook', label: 'Outlook', short: 'Outlook', icon: Compass },
  { id: 'calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays },
  { id: 'recovery', label: 'Sleep & recovery', short: 'Sleep', icon: Moon },
  { id: 'limits', label: 'FTL checks', short: 'FTL', icon: ShieldCheck },
  { id: 'routes', label: 'Routes', short: 'Routes', icon: Globe2 },
] as const;
type RosterView = typeof views[number]['id'];

/** Height of the app header the rail sticks under (Header.tsx h-14). */
const HEADER_PX = 56;

/** The verbal KSS anchor that describes a band as a whole. */
const BAND_ANCHOR: Partial<Record<RiskLevel, string>> = {
  moderate: KSS_LABELS[6],
  high: KSS_LABELS[7],
  critical: KSS_LABELS[8],
  extreme: KSS_LABELS[9],
};

interface Props {
  results: AnalysisResults;
  pilotId: string;
  homeBase: string;
  selectedDuty: DutyAnalysis | null;
  onDutySelect: (duty: DutyAnalysis) => void;
  onReportFatigue: (duty: DutyAnalysis) => void;
  onConcern: (duty: DutyAnalysis, reference: number) => void;
}

/** True once the element above the rail has scrolled under the app header. */
function useStuck(sentinel: React.RefObject<HTMLElement>) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < HEADER_PX + 1),
      { rootMargin: `-${HEADER_PX + 1}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sentinel]);
  return stuck;
}

/** Visited views stay mounted so switching tabs cannot discard sleep edits or map state. */
export function RosterWorkspace({ results, pilotId, homeBase, selectedDuty, onDutySelect, onReportFatigue, onConcern }: Props) {
  const [view, setView] = useState<RosterView>('outlook');
  const [visited, setVisited] = useState<Set<RosterView>>(() => new Set(['outlook']));
  const [reference, setReference] = useState(DEFAULT_WATCH_KSS);
  const sentinel = useRef<HTMLDivElement>(null);
  const panels = useRef<HTMLDivElement>(null);
  const stuck = useStuck(sentinel);
  const watch = useMemo(() => selectDutiesToWatch(results), [results]);
  const groups = useMemo(() => groupDutiesToWatch(watch), [watch]);
  const index = views.findIndex(item => item.id === view);
  // A duty in its logging window now (report − 3 h to report + 24 h), the latest report first.
  const onDutyNow = useMemo(() => [...results.duties].filter(d => d.flightSegments.length > 0 && canLogNow(d))
    .sort((a, b) => Date.parse(b.reportTimeUtc ?? '') - Date.parse(a.reportTimeUtc ?? ''))[0], [results.duties]);

  /**
   * Show a view from its top. When the rail is stuck the page is scrolled to
   * just above the rail; a pagination step also moves focus to the view's
   * heading (tab clicks keep focus on the tab list for arrow-key use).
   */
  const navigate = (next: string, moveFocus = false) => {
    const target = views.find(item => item.id === next);
    if (!target) return;
    setVisited(previous => new Set([...previous, target.id]));
    setView(target.id);
    requestAnimationFrame(() => {
      const top = sentinel.current?.getBoundingClientRect().top;
      if (top != null && top < HEADER_PX) {
        window.scrollTo({ top: Math.max(0, top + window.scrollY - HEADER_PX), behavior: 'auto' });
      }
      if (moveFocus) {
        const panel = panels.current?.querySelector<HTMLElement>(`[data-view="${target.id}"]`);
        const heading = panel?.querySelector<HTMLElement>('h2');
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      }
    });
  };

  // Phones: the view bar docks to the bottom of the screen, so leave room for it.
  return <Tabs value={view} onValueChange={v => navigate(v)} className="min-w-0 max-md:pb-20">
    <div ref={sentinel} aria-hidden="true" className="h-0" />
    <div className="roster-rail-strip md:py-2" data-stuck={stuck ? '' : undefined}>
      <TabsList aria-label="Roster views" className="roster-view-rail">
        {views.map(({ id, label, short, icon: Icon }) => <TabsTrigger key={id} value={id} aria-label={label} className="roster-view-tab">
          <Icon className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
          <span className="md:hidden">{short}</span><span className="hidden truncate md:inline">{label}</span>
        </TabsTrigger>)}
      </TabsList>
    </div>

    <div ref={panels}>
      <TabsContent value="outlook" data-view="outlook" forceMount hidden={view !== 'outlook'} className="mt-5 space-y-8">
        <OfflineBanner />
        {onDutyNow && <InflightLogger duty={onDutyNow} analysisId={results.analysisId} homeTz={results.homeBaseTimezone}
          title={`On duty now: ${dutyRoute(onDutyNow)}. How sleepy do you feel?`} />}
        <DebriefQueue />
        <RosterForecast results={results} reference={reference} onReferenceChange={setReference} onDetails={onDutySelect} onConcern={onConcern} />
        <section aria-labelledby="watch-heading" className="space-y-4">
          <SectionHeading id="watch-heading" title="Duties to watch" />
          <p className="-mt-3 text-xs text-muted-foreground" data-testid="watch-criterion">
            {watch.length ? `${watch.length} ${watch.length === 1 ? 'duty' : 'duties'} with a predicted peak of KSS 6.5 or higher, most demanding first.` : 'Duties with a predicted peak of KSS 6.5 or higher appear here.'}
          </p>
          {watch.length ? <div className="space-y-6" data-testid="duties-to-watch">
            {groups.map(group => {
              const rc = riskClasses(group.level);
              return <div key={group.level} className="space-y-3" role="group" aria-label={`${RISK_LEVEL_LABELS[group.level]} band`}>
                <div className="space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <span className={cn('inline-flex items-center gap-1.5 font-semibold', rc.text)}>
                      <span aria-hidden="true" className={cn('h-[8px] w-[8px] rounded-[1px]', rc.fill)} />{RISK_LEVEL_LABELS[group.level]}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular">{RISK_LEVEL_KSS_RANGE[group.level]}</span>
                    {BAND_ANCHOR[group.level] && <span className="text-xs text-muted-foreground">· {BAND_ANCHOR[group.level]}</span>}
                    <span className="text-xs text-muted-foreground">· {group.duties.length} {group.duties.length === 1 ? 'duty' : 'duties'}</span>
                  </p>
                  {group.shared.size > 0 && <p className="text-xs text-muted-foreground">All of these: {[...group.shared].join('; ')}.</p>}
                </div>
                {group.duties.map((duty, i) => <DutyWatchCard key={duty.dutyId ?? i} duty={duty} sharedReasons={group.shared} onDetails={onDutySelect} onReportFatigue={onReportFatigue} />)}
              </div>;
            })}
          </div> : <p className="instrument-surface text-sm text-muted-foreground" data-testid="duties-to-watch-empty">No duty reaches the watch band. Keep planning your rest as usual, and report fatigue whenever you feel it.</p>}
        </section>
      </TabsContent>

      {visited.has('calendar') && <TabsContent value="calendar" data-view="calendar" forceMount hidden={view !== 'calendar'} className="mt-5 space-y-8">
        <Chronogram duties={results.duties} statistics={results.statistics} month={results.month} pilotId={pilotId}
          pilotName={results.pilotName} pilotBase={results.pilotBase} pilotAircraft={results.pilotAircraft}
          onDutySelect={onDutySelect} selectedDuty={selectedDuty} restDaysSleep={results.restDaysSleep}
          analysisId={results.analysisId} standbyPeriods={results.standbyPeriods} alertnessTimeline={results.alertnessTimeline} />
        <ExportOptions duties={results.duties} />
      </TabsContent>}

      {visited.has('recovery') && <TabsContent value="recovery" data-view="recovery" forceMount hidden={view !== 'recovery'} className="mt-5 space-y-8">
        <TimelineSection results={results} homeBase={homeBase} />
        <RosterRecovery results={results} reference={reference} onDetails={onDutySelect} onConcern={onConcern} />
      </TabsContent>}

      {visited.has('limits') && <TabsContent value="limits" data-view="limits" forceMount hidden={view !== 'limits'} className="mt-5">
        <EasaChecksCard findings={results.easaFindings} summary={results.easaSummary} />
      </TabsContent>}

      {visited.has('routes') && <TabsContent value="routes" data-view="routes" forceMount hidden={view !== 'routes'} className="mt-5">
        <RouteNetwork duties={results.duties} homeBase={results.pilotBase || homeBase} />
      </TabsContent>}
    </div>

    <nav aria-label="Continue through your roster" className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
      <div>{index > 0 && <Button variant="ghost" onClick={() => navigate(views[index - 1].id, true)}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />{views[index - 1].label}</Button>}</div>
      {index < views.length - 1 && <Button onClick={() => navigate(views[index + 1].id, true)}>Next: {views[index + 1].label}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>}
    </nav>
  </Tabs>;
}
