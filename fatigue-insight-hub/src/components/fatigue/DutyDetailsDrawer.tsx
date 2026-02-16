import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DutyAnalysis } from '@/types/fatigue';
import { DutyDetails } from './DutyDetails';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { getDutyDetail } from '@/lib/api-client';

interface DutyDetailsDrawerProps {
  duty: DutyAnalysis | null;
  analysisId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  globalCrewSet?: 'crew_a' | 'crew_b';
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
}

export function DutyDetailsDrawer({ duty, analysisId, open, onOpenChange, globalCrewSet, dutyCrewOverride, onCrewChange }: DutyDetailsDrawerProps) {
  const [detailedDuty, setDetailedDuty] = useState<DutyAnalysis | null>(null);

  const dutyKey = useMemo(() => {
    if (!analysisId || !duty?.dutyId) return null;
    return `${analysisId}:${duty.dutyId}`;
  }, [analysisId, duty?.dutyId]);

  // Fetch detailed duty (timeline_points etc.) when drawer opens.
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

        // Backend returns 'timeline' array - map to timelinePoints
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
        })) : undefined;

        setDetailedDuty({
          ...duty,
          timelinePoints: timelinePoints ?? duty.timelinePoints,
        });
      } catch (err) {
        console.error('Failed to fetch duty detail:', err);
        // Silent fail: drawer still renders base duty data.
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, dutyKey, analysisId, duty]);

  const displayDuty = detailedDuty ?? duty;

  if (!displayDuty) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 md:p-6">
        <SheetHeader className="pb-3 md:pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm md:text-base">
              <span className="text-primary">✈️</span>
              Duty - {displayDuty.dayOfWeek}, {format(displayDuty.date, 'MMM dd')}
            </SheetTitle>
          </div>
        </SheetHeader>
        
        {/* All content is now consolidated in DutyDetails */}
        <DutyDetails
          duty={displayDuty}
          globalCrewSet={globalCrewSet}
          dutyCrewOverride={dutyCrewOverride}
          onCrewChange={onCrewChange}
        />
      </SheetContent>
    </Sheet>
  );
}
