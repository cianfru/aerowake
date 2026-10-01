import { useEffect, useMemo, useState } from 'react';
import { mapTimelinePoints } from '@/lib/transform-analysis';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { canBeAugmented } from '@/lib/crew';
import type { CrewCompositionValue } from '@/lib/api-client';
import { DutyDebriefAction } from '@/components/fatigue/debrief/DutyDebriefAction';
import { DutyAnalysis } from '@/types/fatigue';
import { getDutyDetail } from '@/lib/api-client';
import { zoneOffsetLabel } from '@/lib/home-time';
import { DutyDetailsHeader } from './DutyDetailsHeader';
import { DutyInfoColumn } from './DutyInfoColumn';
import { DutySectors } from './DutySectors';
import { PerformanceColumn } from './PerformanceColumn';
import { PerformanceSummaryCard } from './PerformanceSummaryCard';
import { FatigueReport } from './report/FatigueReport';
import { format } from 'date-fns';

interface DutyDetailsDialogProps {
  duty: DutyAnalysis | null;
  analysisId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Home-base IANA zone: every time in the dialog is home-base 24-hour. */
  homeTz?: string;
  /** Home base code for time labels, e.g. "DOH". */
  homeBase?: string;
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
  onCrewReset?: (dutyId: string) => void;
  crewCompositionOverride?: CrewCompositionValue | null;
  onCrewCompositionChange?: (dutyId: string, composition: CrewCompositionValue | null) => void;
  /** Optional: start a fatigue report pre-filled for this duty. */
  onReportFatigue?: (duty: DutyAnalysis) => void;
}

/**
 * Duty details: one scrolling sheet in the workspace design language.
 *
 * Desktop: the prediction (peak, drivers, KSS through the duty) on the left,
 * the roster facts (sectors, sleep, FDP, crew) on the right.
 * Phones: full-screen, in reading order — peak → sectors → sleep and FDP → chart.
 */
export function DutyDetailsDialog({
  duty,
  analysisId,
  open,
  onOpenChange,
  homeTz,
  homeBase,
  dutyCrewOverride,
  onCrewChange,
  onCrewReset,
  crewCompositionOverride,
  onCrewCompositionChange,
  onReportFatigue,
}: DutyDetailsDialogProps) {
  const [detailedDuty, setDetailedDuty] = useState<DutyAnalysis | null>(null);
  const [reportMode, setReportMode] = useState(false);

  const dutyKey = useMemo(() => {
    if (!analysisId || !duty?.dutyId) return null;
    return `${analysisId}:${duty.dutyId}`;
  }, [analysisId, duty?.dutyId]);

  // Fetch the detailed duty timeline when the dialog opens.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setDetailedDuty(duty);
      setReportMode(false);

      if (!open) return;
      if (!analysisId || !duty?.dutyId) return;

      try {
        const detail = await getDutyDetail(analysisId, duty.dutyId);
        if (cancelled) return;
        const rawTimeline = detail?.timeline ?? detail?.timeline_points ?? detail?.timelinePoints;
        const timelinePoints = mapTimelinePoints(rawTimeline);
        setDetailedDuty({ ...duty, timelinePoints: timelinePoints ?? duty.timelinePoints });
      } catch (err) {
        console.error('Failed to fetch duty detail:', err);
        // The dialog still renders the base duty data.
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, dutyKey, analysisId, duty]);

  const displayDuty = detailedDuty ?? duty;
  if (!displayDuty) return null;

  const offset = homeTz ? zoneOffsetLabel(homeTz, displayDuty.reportTimeUtc || undefined) : '';
  const zoneLabel = [homeBase, offset].filter(Boolean).join(' · ');

  const hasCrewContent =
    (canBeAugmented(displayDuty) && !!onCrewCompositionChange) ||
    (displayDuty.crewComposition === 'augmented_4' && !!onCrewChange) ||
    (displayDuty.isUlr && !!displayDuty.ulrCompliance) ||
    (displayDuty.inflightRestBlocks && displayDuty.inflightRestBlocks.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose={reportMode}
        className="
          flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0
          sm:h-[92vh] sm:max-h-[92vh] sm:max-w-[min(95vw,72rem)] sm:rounded-2xl sm:border
          data-[state=open]:duration-300
        "
      >
        <DialogTitle className="sr-only">Duty details, {format(displayDuty.date, 'EEE d MMM yyyy')}</DialogTitle>
        <DialogDescription className="sr-only">Predicted sleepiness, sectors, estimated sleep and flight duty period for this duty.</DialogDescription>

        {!reportMode && (
          <div className="flex-shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl md:px-6 md:py-4">
            <DutyDetailsHeader
              duty={displayDuty}
              zoneLabel={zoneLabel}
              onGenerateReport={() => setReportMode(true)}
              onReportFatigue={onReportFatigue ? () => onReportFatigue(displayDuty) : undefined}
              debrief={<DutyDebriefAction duty={displayDuty} analysisId={analysisId} />}
            />
          </div>
        )}

        {reportMode ? (
          <FatigueReport duty={displayDuty} analysisId={analysisId} onBack={() => setReportMode(false)} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto bg-background/60 px-4 py-4 md:px-6 md:py-6">
            {/* `contents` on phones lets `order` interleave the two columns into reading order. */}
            <div className="flex flex-col gap-4 md:grid md:grid-cols-[1.1fr_1fr] md:items-start md:gap-5">
              <div className="contents md:flex md:flex-col md:gap-4">
                <div className="order-1 md:order-none">
                  <PerformanceSummaryCard duty={displayDuty} homeTz={homeTz} homeLabel={homeBase} />
                </div>
                <div className="order-4 md:order-none">
                  <PerformanceColumn duty={displayDuty} homeTz={homeTz} zoneLabel={zoneLabel} />
                </div>
              </div>
              <div className="contents md:flex md:flex-col md:gap-4">
                <div className="order-2 md:order-none">
                  <DutySectors duty={displayDuty} homeLabel={homeBase} />
                </div>
                <div className="order-3 md:order-none">
                  <DutyInfoColumn
                    duty={displayDuty}
                    homeTz={homeTz}
                    dutyCrewOverride={dutyCrewOverride}
                    onCrewChange={hasCrewContent ? onCrewChange : undefined}
                    onCrewReset={hasCrewContent ? onCrewReset : undefined}
                    hasCrewContent={!!hasCrewContent}
                    crewCompositionOverride={crewCompositionOverride}
                    onCrewCompositionChange={canBeAugmented(displayDuty) ? onCrewCompositionChange : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
