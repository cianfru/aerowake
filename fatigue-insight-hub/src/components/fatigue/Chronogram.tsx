import { useState, useMemo } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertnessSample, DutyAnalysis, DutyStatistics, RestDaySleep, StandbyPeriod } from '@/types/fatigue';
import { AlertnessSamplesContext } from '@/lib/kss-band-gradient';
import { TimelineRenderer } from './chronogram/TimelineRenderer';
import { homeBaseTransform, utcTransform } from '@/lib/timeline-transforms';
import { standbyBarsForMonth } from '@/lib/standby-bars';
import { useSleepEdits } from '@/hooks/useSleepEdits';

const NO_SAMPLES: AlertnessSample[] = [];

interface ChronogramProps {
  duties: DutyAnalysis[];
  statistics: DutyStatistics;
  month: Date;
  pilotId?: string;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  homeBaseTimezone?: string;
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  restDaysSleep?: RestDaySleep[];
  analysisId?: string;
  /** Standby periods (not scored) — drawn as muted hatched bars in the home-base view. */
  standbyPeriods?: StandbyPeriod[];
  /** Heading id so the workspace can move focus here after navigation. */
  headingId?: string;
  /** The month's predicted KSS samples: duty bars change colour where the band changes. */
  alertnessTimeline?: AlertnessSample[];
}

type ChronogramTab = 'homebase' | 'utc';

export function Chronogram({ duties, statistics, month, pilotBase, homeBaseTimezone, onDutySelect, selectedDuty, restDaysSleep, analysisId, standbyPeriods, headingId = 'chronogram-heading', alertnessTimeline }: ChronogramProps) {
  const [activeTab, setActiveTab] = useState<ChronogramTab>('homebase');
  const sleepEdits = useSleepEdits(analysisId);

  const homeBaseData = useMemo(
    () => ({
      ...homeBaseTransform(duties, statistics, month, restDaysSleep, homeBaseTimezone),
      standbyBars: standbyBarsForMonth(standbyPeriods, month),
    }),
    [duties, statistics, month, restDaysSleep, standbyPeriods, homeBaseTimezone],
  );

  const utcData = useMemo(
    () => utcTransform(duties, statistics, month, restDaysSleep, homeBaseTimezone),
    [duties, statistics, month, restDaysSleep, homeBaseTimezone],
  );

  return (
    <AlertnessSamplesContext.Provider value={alertnessTimeline ?? NO_SAMPLES}>
    <section id="roster-calendar" aria-labelledby={headingId} className="instrument-surface min-w-0 scroll-mt-32 space-y-5 px-3 sm:px-5 md:px-8">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChronogramTab)}>
        <div className="space-y-1 px-1 sm:px-0">
          <div className="flex items-center justify-between gap-2">
            <h2 id={headingId} tabIndex={-1} className="text-lg font-semibold focus:outline-none sm:text-xl">Roster calendar</h2>
          <TabsList className="h-auto shrink-0 gap-3 rounded-none bg-transparent p-0" aria-label="Calendar time reference">
            {([['homebase', 'Home base'], ['utc', 'UTC']] as const).map(([v, l]) => (
              <TabsTrigger
                key={v}
                value={v}
                title={v === 'homebase' && pilotBase ? `Times in ${pilotBase} local time` : undefined}
                className="min-h-11 rounded-none border-b-2 border-transparent px-0 pb-1 pt-0 text-[13px] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
          </div>
          <p className="text-sm text-muted-foreground">Duties, sleep and body-clock timing.</p>
        </div>

        <TabsContent value="homebase" className="mt-4">
          <TimelineRenderer
            data={homeBaseData}
            duties={duties}
            onDutySelect={onDutySelect}
            selectedDuty={selectedDuty}
            pendingEdits={sleepEdits.pendingEdits}
            onSleepEdit={sleepEdits.addEdit}
            onRemoveEdit={sleepEdits.removeEdit}
            onRemoveBlock={sleepEdits.removeBar}
            activeEditBarId={sleepEdits.activeBarId}
            onActivateEdit={sleepEdits.activateEdit}
            onDeactivateEdit={sleepEdits.deactivateEdit}
          />
        </TabsContent>

        <TabsContent value="utc" className="mt-4">
          <TimelineRenderer data={utcData} duties={duties} onDutySelect={onDutySelect} selectedDuty={selectedDuty} />
        </TabsContent>
      </Tabs>

      {/* Apply bar — shows while sleep edits are pending */}
      {sleepEdits.hasEdits && (
        <div className="sticky bottom-3 z-10 max-md:bottom-24 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {sleepEdits.editCount} sleep {sleepEdits.editCount > 1 ? 'edits' : 'edit'} pending
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={sleepEdits.clearEdits} disabled={sleepEdits.isApplying}>
              Discard
            </Button>
            <Button size="sm" onClick={sleepEdits.applyEdits} disabled={sleepEdits.isApplying}>
              {sleepEdits.isApplying ? 'Recalculating…' : 'Apply and recalculate'}
            </Button>
          </div>
        </div>
      )}

      {/* After recalculation, with no new edits pending */}
      {sleepEdits.hasOriginal && !sleepEdits.hasEdits && (
        <div className="sticky bottom-3 z-10 max-md:bottom-24 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card px-4 py-3" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <span className="text-sm text-muted-foreground">Includes your sleep changes, saved with this roster</span>
          <Button variant="outline" size="sm" onClick={sleepEdits.resetToOriginal} disabled={sleepEdits.isApplying}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Restore all estimates
          </Button>
        </div>
      )}
    </section>
    </AlertnessSamplesContext.Provider>
  );
}
