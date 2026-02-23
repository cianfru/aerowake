import { useState, useMemo } from 'react';
import { Info, AlertTriangle, ZoomIn, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useChronogramZoom } from '@/hooks/useChronogramZoom';
import { TimelineLegend } from '../TimelineLegend';
import { TimelineGrid } from './TimelineGrid';
import { QuickDutySelector } from './QuickDutySelector';
import { ROW_HEIGHT } from '@/lib/fatigue-utils';
import type { TimelineData } from '@/lib/timeline-types';
import type { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';

interface TimelineRendererProps {
  data: TimelineData;
  duties: DutyAnalysis[];
  statistics: {
    totalDuties: number;
    highRiskDuties: number;
    criticalRiskDuties: number;
  };
  month: Date;
  pilotName?: string;
  pilotBase?: string;
  pilotAircraft?: string;
  onDutySelect: (duty: DutyAnalysis) => void;
  selectedDuty: DutyAnalysis | null;
}

export function TimelineRenderer({
  data,
  duties,
  statistics,
  month,
  pilotName,
  pilotBase,
  pilotAircraft,
  onDutySelect,
  selectedDuty,
}: TimelineRendererProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  // Zoom functionality
  const { zoom, containerRef, resetZoom, isZoomed } = useChronogramZoom({
    minScaleX: 1,
    maxScaleX: 4,
    minScaleY: 1,
    maxScaleY: 3,
  });

  // Show flight phases when zoomed in enough
  const showFlightPhases = zoom.scaleX >= 2;

  // Count duties with commander discretion
  const discretionCount = useMemo(() =>
    duties.filter(d => d.usedDiscretion).length
  , [duties]);

  // Empty state for elapsed view
  if (data.dutyBars.length === 0 && data.variant === 'elapsed') {
    return (
      <Card variant="glass">
        <CardContent className="py-8 text-center text-muted-foreground">
          No duty data available for human performance visualization
        </CardContent>
      </Card>
    );
  }

  // Determine info text based on variant
  const infoText = data.variant === 'utc'
    ? 'This chart shows duties positioned in UTC (Zulu) time. All bars use deterministic UTC coordinates from ISO timestamps — no timezone conversion applied.'
    : data.variant === 'elapsed'
    ? 'This chart shows duties on an elapsed-time axis. Each row represents 24 hours of continuous time. WOCL bands shift with circadian adaptation.'
    : 'The chart shows duty periods across the month. Colors indicate fatigue level (performance score):';

  const woclNote = data.variant === 'utc'
    ? 'Purple shaded area = WOCL (Window of Circadian Low: 02:00-06:00 UTC)'
    : data.variant === 'elapsed'
    ? 'Purple shaded area = WOCL (shifts with body clock adaptation)'
    : 'Purple shaded area = WOCL (Window of Circadian Low: 02:00-06:00)';

  // Title suffix
  const titleSuffix = data.variant === 'utc'
    ? '— UTC (Zulu) Timeline'
    : data.variant === 'elapsed'
    ? '— Human Performance (Elapsed)'
    : '- High-Resolution Duty Timeline';

  return (
    <div className="space-y-4">
      {/* Zoom Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showFlightPhases && (
            <p className="text-xs text-primary flex items-center gap-1">
              <ZoomIn className="h-3 w-3" />
              Flight phases visible
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isZoomed ? `Zoom: ${zoom.scaleX.toFixed(1)}x` : 'Pinch/Ctrl+Scroll to zoom'}
          </span>
          {isZoomed && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
              className="text-xs h-7 px-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Info Collapsible */}
      <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            <Info className="mr-1 h-3 w-3" />
            How to Read This Chart
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p className="mb-2">{infoText}</p>
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(120, 70%, 45%)' }} /> 80-100% (Good)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(55, 90%, 55%)' }} /> 60-80% (Moderate)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(25, 95%, 50%)' }} /> 40-60% (High Risk)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(0, 80%, 50%)' }} /> &lt;40% (Critical)</span>
            </div>
            <p className="mt-2">{woclNote}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Timeline Legend */}
      <div className="mb-3">
        <TimelineLegend showDiscretion={discretionCount > 0} variant="homebase" />
      </div>

      {/* High-Resolution Timeline with zoom support */}
      <div
        ref={containerRef}
        className="overflow-auto pb-4 touch-pan-x touch-pan-y"
        style={{ maxHeight: isZoomed ? '80vh' : undefined }}
      >
        <div
          className="min-w-[800px] transition-transform duration-100"
          style={{
            transform: `translate(${zoom.panX}px, ${zoom.panY}px) scale(${zoom.scaleX}, ${zoom.scaleY})`,
            transformOrigin: 'top left',
            width: `${100 / zoom.scaleX}%`,
          }}
        >
          {/* Header with pilot info */}
          <div className="mb-4 text-center">
            {pilotName && (
              <h2 className="text-lg font-semibold text-foreground">{pilotName}</h2>
            )}
            {(pilotBase || pilotAircraft) && (
              <div className="text-sm text-muted-foreground">
                <span>{[pilotBase, pilotAircraft].filter(Boolean).join(' | ')}</span>
              </div>
            )}
            <div className="mt-1 text-sm font-medium">
              {format(month, 'MMMM yyyy')} {titleSuffix}
            </div>
          </div>

          {/* Stats ribbon */}
          <div className="mb-3 flex items-center justify-center gap-4 text-[11px] flex-wrap">
            <span>Duties: <strong>{statistics.totalDuties}</strong></span>
            <span>High Risk: <strong className="text-high">{statistics.highRiskDuties}</strong></span>
            <span>Critical: <strong className="text-critical">{statistics.criticalRiskDuties}</strong></span>
            {discretionCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" />
                {discretionCount} Discretion
              </Badge>
            )}
          </div>

          {/* The actual grid */}
          <TimelineGrid
            data={data}
            rowHeight={ROW_HEIGHT}
            showFlightPhases={showFlightPhases}
            selectedDuty={selectedDuty}
            onDutySelect={onDutySelect}
          />

          {/* X-axis label */}
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {data.xAxisLabel}
          </div>
        </div>
      </div>

      {/* Quick duty selection grid */}
      <QuickDutySelector
        duties={duties}
        selectedDuty={selectedDuty}
        onDutySelect={onDutySelect}
      />
    </div>
  );
}
