import { useMemo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { CalendarLegend } from './CalendarLegend';
import { TimelineGrid } from './TimelineGrid';
import { ROW_HEIGHT } from '@/lib/fatigue-utils';
import type { TimelineData } from '@/lib/timeline-types';
import type { DutyAnalysis } from '@/types/fatigue';
import type { SleepEdit } from '@/hooks/useSleepEdits';

interface TimelineRendererProps {
  data: TimelineData;
  duties: DutyAnalysis[];
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
  /** Pending sleep edits (homebase view only) */
  pendingEdits?: Map<string, SleepEdit>;
  /** Callback when user adjusts a sleep bar via drag */
  onSleepEdit?: (edit: SleepEdit) => void;
  /** Callback when user resets a single sleep edit */
  onRemoveEdit?: (blockKey: string) => void;
  /** ID of the sleep bar currently in drag-edit mode (blockKey) */
  activeEditBarId?: string | null;
  /** Called on double-click to enter drag-edit mode (blockKey) */
  onActivateEdit?: (blockKey: string) => void;
  /** Called to exit drag-edit mode */
  onDeactivateEdit?: () => void;
}

/**
 * The month grid with its single key. The whole 24 hours fit the width on
 * phones too, so evening duties are never hidden behind a horizontal scroll.
 */
export function TimelineRenderer({
  data,
  duties,
  onDutySelect,
  selectedDuty,
  pendingEdits,
  onSleepEdit,
  onRemoveEdit,
  activeEditBarId,
  onActivateEdit,
  onDeactivateEdit,
}: TimelineRendererProps) {
  const { zoom, containerRef, resetZoom, isZoomed } = useChronogramZoom({
    minScaleX: 1,
    maxScaleX: 4,
    minScaleY: 1,
    maxScaleY: 3,
  });

  const discretionCount = useMemo(() => duties.filter((d) => d.usedDiscretion).length, [duties]);

  return (
    <div className="space-y-4">
      <CalendarLegend showDiscretion={discretionCount > 0} showStandby={(data.standbyBars ?? []).length > 0} />

      <div className="flex min-h-[28px] items-center justify-between gap-3 text-xs text-muted-foreground">
        {discretionCount > 0 ? (
          <p className="flex items-center gap-1.5 text-risk-critical-ink">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {discretionCount} {discretionCount === 1 ? 'duty uses' : 'duties use'} commander&apos;s discretion
          </p>
        ) : <span />}
        <div className="flex items-center gap-2">
          {isZoomed ? <span className="font-mono tabular">Zoom {zoom.scaleX.toFixed(1)}×</span>
            : <span className="hidden [@media(hover:hover)]:inline">Ctrl + scroll to zoom</span>}
          {isZoomed && (
            <Button variant="outline" size="sm" onClick={resetZoom} className="h-7 px-2 text-xs">
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
              Reset zoom
            </Button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-auto pb-2"
        style={{ maxHeight: isZoomed ? '80vh' : undefined }}
      >
        <div
          className="transition-transform duration-100"
          style={{
            transform: `translate(${zoom.panX}px, ${zoom.panY}px) scale(${zoom.scaleX}, ${zoom.scaleY})`,
            transformOrigin: 'top left',
            width: `${100 / zoom.scaleX}%`,
          }}
        >
          <TimelineGrid
            data={data}
            rowHeight={ROW_HEIGHT}
            selectedDuty={selectedDuty}
            onDutySelect={onDutySelect}
            pendingEdits={pendingEdits}
            onSleepEdit={onSleepEdit}
            onRemoveEdit={onRemoveEdit}
            activeEditBarId={activeEditBarId}
            onActivateEdit={onActivateEdit}
            onDeactivateEdit={onDeactivateEdit}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">{data.xAxisLabel}</p>
        </div>
      </div>
    </div>
  );
}
