import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DutyAnalysis, DutyModification } from '@/types/fatigue';
import { DutyEditControls } from './DutyEditControls';

interface DutyEditorListProps {
  duties: DutyAnalysis[];
  modifications: Map<string, DutyModification>;
  expandedDutyId: string | null;
  onModification: (mod: DutyModification) => void;
  onExpand: (dutyId: string | null) => void;
}

function getRiskVariant(risk: string): 'success' | 'warning' | 'high' | 'critical' {
  switch (risk) {
    case 'LOW': return 'success';
    case 'MODERATE': return 'warning';
    case 'HIGH': return 'high';
    case 'CRITICAL': return 'critical';
    default: return 'success';
  }
}

function getRoute(duty: DutyAnalysis): string {
  if (!duty.flightSegments || duty.flightSegments.length === 0) return '—';
  const first = duty.flightSegments[0];
  const last = duty.flightSegments[duty.flightSegments.length - 1];
  return `${first.departure} → ${last.arrival}`;
}

function formatShift(minutes: number): string {
  if (minutes === 0) return '';
  const sign = minutes > 0 ? '+' : '';
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  if (h > 0 && m > 0) return `${sign}${minutes > 0 ? '' : '-'}${h}h${m}m`;
  if (h > 0) return `${sign}${h}h`;
  return `${sign}${minutes}m`;
}

export function DutyEditorList({
  duties,
  modifications,
  expandedDutyId,
  onModification,
  onExpand,
}: DutyEditorListProps) {
  const sortedDuties = useMemo(
    () => [...duties].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [duties],
  );

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-semibold">Duty Editor</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {duties.length} duties &middot; Click to modify
        </p>
      </div>
      <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
        <div className="divide-y divide-border/10">
          {sortedDuties.map((duty) => {
            const dutyId = duty.dutyId || '';
            const mod = modifications.get(dutyId);
            const isExpanded = expandedDutyId === dutyId;
            const isModified = !!mod && !mod.excluded;
            const isExcluded = !!mod?.excluded;

            return (
              <div key={dutyId} className="group">
                {/* Row header */}
                <button
                  onClick={() => onExpand(isExpanded ? null : dutyId)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-secondary/20
                    ${isExpanded ? 'bg-secondary/30' : ''}
                    ${isExcluded ? 'opacity-50' : ''}
                  `}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${isExcluded ? 'line-through' : ''}`}>
                        {duty.dayOfWeek} {duty.dateString || new Date(duty.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {getRoute(duty)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {duty.reportTimeLocal || '??:??'}–{duty.releaseTimeLocal || '??:??'}
                      </span>
                      {mod?.reportShiftMinutes !== 0 && mod?.reportShiftMinutes !== undefined && (
                        <span className="text-[10px] text-warning font-mono">
                          R{formatShift(mod.reportShiftMinutes)}
                        </span>
                      )}
                      {mod?.releaseShiftMinutes !== 0 && mod?.releaseShiftMinutes !== undefined && (
                        <span className="text-[10px] text-warning font-mono">
                          D{formatShift(mod.releaseShiftMinutes)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isExcluded && (
                      <Badge variant="critical" className="text-[9px] px-1.5 py-0">
                        Excluded
                      </Badge>
                    )}
                    {isModified && (
                      <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                        Modified
                      </Badge>
                    )}
                    <Badge variant={getRiskVariant(duty.overallRisk)} className="text-[9px] px-1.5 py-0">
                      {Math.round(duty.minPerformance)}%
                    </Badge>
                  </div>
                </button>

                {/* Expanded edit controls */}
                {isExpanded && (
                  <div className="px-4 pb-3 bg-secondary/10">
                    <DutyEditControls
                      duty={duty}
                      modification={mod || null}
                      onModification={onModification}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
