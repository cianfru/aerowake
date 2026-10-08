import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { resolveKss } from '@/lib/risk-scale';
import { DutyFocusList } from './DutyFocusList';
import { Button } from '@/components/ui/button';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { CalendarLegend } from './CalendarLegend';
import { TimelineGrid } from './TimelineGrid';
import { ROW_HEIGHT } from '@/lib/fatigue-utils';
import type { TimelineData, TimelineSleepBar } from '@/lib/timeline-types';
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
  /** Remove a sleep block (saved with the analysis). */
  onRemoveBlock?: (bar: TimelineSleepBar) => void;
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
  onRemoveBlock,
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

  const isMobile = useIsMobile();
  const [requestedView, setRequestedView] = useState<'week' | 'month' | null>(null);
  const view = requestedView ?? (isMobile ? 'week' : 'month');
  const selectedRow = data.dutyBars.find((bar) => bar.duty === selectedDuty)?.rowIndex;
  const [week, setWeek] = useState(() => Math.floor(((selectedRow ?? data.dutyBars[0]?.rowIndex ?? 1) - 1) / 7));
  const weekCount = Math.ceil(data.rowLabels.length / 7);
  const currentWeek = Math.max(0, Math.min(week, weekCount - 1));
  // A selection made elsewhere in the workspace should remain visible here.
  useEffect(() => {
    if (selectedRow != null) setWeek(Math.floor((selectedRow - 1) / 7));
  }, [selectedRow]);
  const visibleData = useMemo(() => view === 'month' ? data : {
    ...data,
    rowLabels: data.rowLabels.slice(currentWeek * 7, currentWeek * 7 + 7),
    totalRows: Math.min(7, data.rowLabels.length - currentWeek * 7),
  }, [data, currentWeek, view]);
  const visibleRows = new Set(visibleData.rowLabels.map((row) => row.rowIndex));
  const visibleDuties = [...new Set(data.dutyBars.filter((bar) => visibleRows.has(bar.rowIndex)).map((bar) => bar.duty))];
  const highestDuty = duties.reduce<DutyAnalysis | null>((highest, duty) => {
    const kss = resolveKss(duty.maxKss, duty.minPerformance, duty.modelVersion);
    const prior = highest ? resolveKss(highest.maxKss, highest.minPerformance, highest.modelVersion) : null;
    return kss != null && (prior == null || kss > prior) ? duty : highest;
  }, null);
  const highestRow = data.dutyBars.find((bar) => bar.duty === highestDuty)?.rowIndex;
  const firstDate = visibleData.rowLabels[0]?.date;
  const lastDate = visibleData.rowLabels[visibleData.rowLabels.length - 1]?.date;
  const rangeLabel = firstDate && lastDate ? `${format(firstDate, 'd')}–${format(lastDate, 'd MMM')}` : `Days ${currentWeek * 7 + 1}–${Math.min((currentWeek + 1) * 7, data.rowLabels.length)}`;

  const discretionCount = useMemo(() => duties.filter((d) => d.usedDiscretion).length, [duties]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label="Calendar range">
          {(['week', 'month'] as const).map((range) => <Button key={range} variant="ghost" size="sm"
            aria-pressed={view === range} onClick={() => { setRequestedView(range); resetZoom(); }}
            className={cn('min-h-11 rounded-lg px-3', view === range && 'bg-card text-foreground shadow-sm')}>
            {range === 'week' ? '7 days' : 'Full month'}
          </Button>)}
        </div>
        {highestRow != null && <Button variant="ghost" size="sm" aria-label="Find highest peak" className="min-h-11 px-2 text-xs" onClick={() => {
          setRequestedView('week'); setWeek(Math.floor((highestRow - 1) / 7)); resetZoom();
        }}>Peak day <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" /></Button>}
      </div>
      {view === 'week' && <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-2 py-1">
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Previous 7 days"
          disabled={currentWeek === 0} onClick={() => { setWeek(currentWeek - 1); resetZoom(); }}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center" aria-live="polite" aria-atomic="true">
          <p className="text-sm font-semibold">{rangeLabel}</p>
          <p className="text-xs text-muted-foreground">{visibleDuties.length} {visibleDuties.length === 1 ? 'duty' : 'duties'} · {data.variant === 'utc' ? 'UTC' : 'home-base time'}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Next 7 days"
          disabled={currentWeek >= weekCount - 1} onClick={() => { setWeek(currentWeek + 1); resetZoom(); }}><ChevronRight className="h-4 w-4" /></Button>
      </div>}
      <CalendarLegend showDiscretion={discretionCount > 0} showStandby={(data.standbyBars ?? []).length > 0} showNightReference={data.woclBands.length > 0} />

      <div className={cn('flex min-h-[28px] items-center justify-between gap-3 text-xs text-muted-foreground', discretionCount === 0 && !isZoomed && 'hidden md:flex')}>
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
            <Button variant="outline" size="sm" onClick={resetZoom} className="min-h-11 px-3 text-xs">
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
            width: '100%',
          }}
        >
          <TimelineGrid
            data={visibleData}
            rowHeight={view === 'week' ? 56 : ROW_HEIGHT}
            selectedDuty={selectedDuty}
            onDutySelect={onDutySelect}
            pendingEdits={pendingEdits}
            onSleepEdit={onSleepEdit}
            onRemoveEdit={onRemoveEdit}
            onRemoveBlock={onRemoveBlock}
            activeEditBarId={activeEditBarId}
            onActivateEdit={onActivateEdit}
            onDeactivateEdit={onDeactivateEdit}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">{data.xAxisLabel}</p>
          {data.variant === 'utc' && data.woclBands.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Home-base night shading is unavailable without a verified timezone.</p>}
        </div>
      </div>
      {view === 'week' && <DutyFocusList duties={visibleDuties} selectedDuty={selectedDuty} onDutySelect={onDutySelect} variant={data.variant} />}
    </div>
  );
}
