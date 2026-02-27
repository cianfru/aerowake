import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DutyAnalysis } from '@/types/fatigue';
import { getDutyDetail } from '@/lib/api-client';
import { DutyDetailsHeader } from './DutyDetailsHeader';
import { DutyDetailsPerformanceTab } from './DutyDetailsPerformanceTab';
import { DutyDetailsSleepTab } from './DutyDetailsSleepTab';
import { DutyDetailsCrewTab } from './DutyDetailsCrewTab';
import { format } from 'date-fns';

interface DutyDetailsDialogProps {
  duty: DutyAnalysis | null;
  analysisId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  globalCrewSet?: 'crew_a' | 'crew_b';
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
}

/**
 * DutyDetailsDialog — full-screen centered overlay replacing the old Sheet drawer.
 *
 * Layout:
 *  - Sticky header: DutyDetailsHeader (date, flight segments, stats, FDP)
 *  - Tabs: Performance | Sleep & Recovery | Crew & Compliance (conditional)
 *
 * Data fetching: same pattern as old DutyDetailsDrawer — fetches detailed
 * timeline_points when the dialog opens.
 */
export function DutyDetailsDialog({
  duty,
  analysisId,
  open,
  onOpenChange,
  globalCrewSet,
  dutyCrewOverride,
  onCrewChange,
}: DutyDetailsDialogProps) {
  const [detailedDuty, setDetailedDuty] = useState<DutyAnalysis | null>(null);

  const dutyKey = useMemo(() => {
    if (!analysisId || !duty?.dutyId) return null;
    return `${analysisId}:${duty.dutyId}`;
  }, [analysisId, duty?.dutyId]);

  // Fetch detailed duty (timeline_points etc.) when dialog opens.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Always start from the base duty passed in.
      setDetailedDuty(duty);

      if (!open) return;
      if (!analysisId || !duty?.dutyId) return;

      try {
        const detail = await getDutyDetail(analysisId, duty.dutyId);
        if (cancelled) return;

        // Backend returns 'timeline' array — map to timelinePoints
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawTimeline = detail?.timeline ?? detail?.timeline_points ?? detail?.timelinePoints;

        // Map snake_case fields to TimelinePoint interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timelinePoints = Array.isArray(rawTimeline) ? rawTimeline.map((pt: any) => ({
          hours_on_duty: pt.hours_on_duty ?? 0,
          time_on_task_penalty: pt.time_on_task_penalty ?? 0,
          sleep_inertia: pt.sleep_inertia ?? 0,
          sleep_pressure: pt.sleep_pressure ?? 0,
          circadian: pt.circadian ?? 0,
          performance: pt.performance,
          is_in_rest: pt.is_in_rest ?? false,
          flight_phase: pt.flight_phase ?? null,
          is_critical: pt.is_critical ?? false,
          timestamp: pt.timestamp,
          timestamp_local: pt.timestamp_local,
          // Phase 2 model deepening fields
          debt_penalty: pt.debt_penalty,
          hypoxia_factor: pt.hypoxia_factor,
          pvt_lapses: pt.pvt_lapses,
          microsleep_probability: pt.microsleep_probability,
        })) : undefined;

        setDetailedDuty({
          ...duty,
          timelinePoints: timelinePoints ?? duty.timelinePoints,
        });
      } catch (err) {
        console.error('Failed to fetch duty detail:', err);
        // Silent fail: dialog still renders base duty data.
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, dutyKey, analysisId, duty]);

  const displayDuty = detailedDuty ?? duty;

  if (!displayDuty) return null;

  // Determine if this duty has crew/ULR content worth showing
  const hasCrewContent =
    (displayDuty.crewComposition === 'augmented_4' && !!onCrewChange) ||
    (displayDuty.isUlr && !!displayDuty.ulrCompliance) ||
    (displayDuty.inflightRestBlocks && displayDuty.inflightRestBlocks.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-[95vw] w-full max-h-[92vh] h-full p-0
          flex flex-col gap-0
          sm:rounded-xl
          overflow-hidden
          data-[state=open]:duration-300
        "
      >
        {/* Accessible title (visually hidden since header has its own) */}
        <DialogTitle className="sr-only">
          Duty Details — {format(displayDuty.date, 'MMM dd, yyyy')}
        </DialogTitle>

        {/* Sticky header */}
        <div className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 md:px-6 py-3 md:py-4">
          <DutyDetailsHeader duty={displayDuty} />
        </div>

        {/* Tabs area — scrollable content */}
        <Tabs defaultValue="performance" className="flex flex-col flex-1 min-h-0">
          {/* Tab triggers — sticky below header */}
          <div className="flex-shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 md:px-6">
            <TabsList className="w-full h-10 bg-transparent justify-start gap-1 rounded-none p-0">
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-md px-3 py-1.5 text-sm"
              >
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="sleep"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-md px-3 py-1.5 text-sm"
              >
                <span className="hidden sm:inline">Sleep & Recovery</span>
                <span className="sm:hidden">Sleep</span>
              </TabsTrigger>
              {hasCrewContent && (
                <TabsTrigger
                  value="crew"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-md px-3 py-1.5 text-sm"
                >
                  <span className="hidden sm:inline">Crew & Compliance</span>
                  <span className="sm:hidden">Crew</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Scrollable tab content */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5">
            <TabsContent value="performance" className="mt-0">
              <DutyDetailsPerformanceTab duty={displayDuty} />
            </TabsContent>

            <TabsContent value="sleep" className="mt-0">
              <DutyDetailsSleepTab duty={displayDuty} />
            </TabsContent>

            {hasCrewContent && (
              <TabsContent value="crew" className="mt-0">
                <DutyDetailsCrewTab
                  duty={displayDuty}
                  globalCrewSet={globalCrewSet}
                  dutyCrewOverride={dutyCrewOverride}
                  onCrewChange={onCrewChange}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
