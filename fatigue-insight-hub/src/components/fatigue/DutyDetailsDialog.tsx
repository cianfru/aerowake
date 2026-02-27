import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DutyAnalysis } from '@/types/fatigue';
import { getDutyDetail } from '@/lib/api-client';
import { DutyDetailsHeader } from './DutyDetailsHeader';
import { DutyInfoColumn } from './DutyInfoColumn';
import { PerformanceColumn } from './PerformanceColumn';
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
 * DutyDetailsDialog — full-screen two-column overlay.
 *
 * Layout:
 *  - Compact header: date, stats, risk badge
 *  - Two columns:
 *    Left  → DutyInfoColumn (segments, FDP, sleep, risk, crew)
 *    Right → PerformanceColumn (summary, S/C/W chart, phase performance)
 *
 * Desktop: side-by-side, no scrolling for typical 1-3 sector duties.
 * Mobile: stacked vertically, scrollable.
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

        {/* Compact header */}
        <div className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 md:px-6 py-2.5 md:py-3">
          <DutyDetailsHeader duty={displayDuty} />
        </div>

        {/* Two-column content */}
        <div className="flex-1 min-h-0 px-3 md:px-5 py-3 md:py-4">
          <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto md:overflow-hidden">
            {/* Left: Duty Info */}
            <div className="md:overflow-y-auto md:pr-1 space-y-3">
              <DutyInfoColumn
                duty={displayDuty}
                globalCrewSet={globalCrewSet}
                dutyCrewOverride={dutyCrewOverride}
                onCrewChange={hasCrewContent ? onCrewChange : undefined}
                hasCrewContent={!!hasCrewContent}
              />
            </div>
            {/* Right: Performance */}
            <div className="md:overflow-y-auto md:pl-1 space-y-3">
              <PerformanceColumn duty={displayDuty} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
