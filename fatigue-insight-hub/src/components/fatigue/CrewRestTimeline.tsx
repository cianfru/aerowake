import { useMemo, useState } from 'react';
import { Users, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DutyAnalysis } from '@/types/fatigue';
import { cn } from '@/lib/utils';

interface CrewRestTimelineProps {
  duty: DutyAnalysis;
}

interface RestBlock {
  startUtc: string;
  endUtc: string;
  durationHours: number;
  effectiveSleepHours: number;
  crewSet: string | null;
  isDuringWocl: boolean;
  qualityFactor?: number;
}

interface TimelineBlock {
  startPct: number;
  widthPct: number;
  type: 'rest' | 'duty';
  block?: RestBlock;
}

function parseUtcTime(utcStr: string): number {
  const d = new Date(utcStr);
  return d.getTime();
}

export function CrewRestTimeline({ duty }: CrewRestTimelineProps) {
  const [hoveredBlock, setHoveredBlock] = useState<RestBlock | null>(null);

  const blocks = duty.inflightRestBlocks;
  if (!blocks || blocks.length === 0) return null;

  // Parse duty timespan
  const dutyStart = useMemo(() => {
    // Try report_time_utc from the flightSegments or use the first segment departure
    const reportStr = duty.reportTimeUtc;
    if (reportStr) return parseUtcTime(reportStr);
    // Fallback: earliest rest block start minus 2h
    const earliest = blocks.reduce((min, b) => Math.min(min, parseUtcTime(b.startUtc)), Infinity);
    return earliest - 2 * 3600000;
  }, [duty.reportTimeUtc, blocks]);

  const dutyEnd = useMemo(() => {
    const releaseStr = duty.releaseTimeUtc;
    if (releaseStr) return parseUtcTime(releaseStr);
    // Fallback: latest rest block end plus 2h
    const latest = blocks.reduce((max, b) => Math.max(max, parseUtcTime(b.endUtc)), 0);
    return latest + 2 * 3600000;
  }, [duty.releaseTimeUtc, blocks]);

  const totalDuration = dutyEnd - dutyStart;

  // Build timeline blocks for Crew A and Crew B
  const { crewABlocks, crewBBlocks } = useMemo(() => {
    const crewA: TimelineBlock[] = [];
    const crewB: TimelineBlock[] = [];

    blocks.forEach((block) => {
      const start = parseUtcTime(block.startUtc);
      const end = parseUtcTime(block.endUtc);
      const startPct = ((start - dutyStart) / totalDuration) * 100;
      const widthPct = ((end - start) / totalDuration) * 100;

      const tlBlock: TimelineBlock = {
        startPct: Math.max(0, startPct),
        widthPct: Math.min(widthPct, 100 - startPct),
        type: 'rest',
        block,
      };

      const crewSet = block.crewSet?.toLowerCase();
      if (crewSet === 'crew_a') {
        crewA.push(tlBlock);
      } else if (crewSet === 'crew_b') {
        crewB.push(tlBlock);
      } else {
        // If no crew set specified, show on both
        crewA.push(tlBlock);
        crewB.push(tlBlock);
      }
    });

    return { crewABlocks: crewA, crewBBlocks: crewB };
  }, [blocks, dutyStart, totalDuration]);

  // Format time for labels
  const formatHHMM = (timestamp: number): string => {
    const d = new Date(timestamp);
    return d.toISOString().slice(11, 16) + 'Z';
  };

  const dutyHours = totalDuration / 3600000;

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Users className="h-4 w-4 text-primary" />
          Crew Rotation Timeline
          <Badge variant="outline" className="text-[10px]">
            {dutyHours.toFixed(1)}h total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Time axis labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>{formatHHMM(dutyStart)}</span>
          <span>{formatHHMM(dutyStart + totalDuration / 4)}</span>
          <span>{formatHHMM(dutyStart + totalDuration / 2)}</span>
          <span>{formatHHMM(dutyStart + (totalDuration * 3) / 4)}</span>
          <span>{formatHHMM(dutyEnd)}</span>
        </div>

        {/* Crew A Lane */}
        <SwimLane label="Crew A" blocks={crewABlocks} onHover={setHoveredBlock} />

        {/* Crew B Lane */}
        <SwimLane label="Crew B" blocks={crewBBlocks} onHover={setHoveredBlock} />

        {/* Hover tooltip */}
        {hoveredBlock && (
          <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Moon className="h-3 w-3 text-chart-2" />
              <span className="font-medium">In-Flight Rest</span>
              {hoveredBlock.isDuringWocl && (
                <Badge variant="warning" className="text-[9px]">WOCL</Badge>
              )}
              {hoveredBlock.crewSet && (
                <Badge variant="outline" className="text-[9px] capitalize">
                  {hoveredBlock.crewSet.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>Start:</span>
              <span className="font-mono">{hoveredBlock.startUtc.slice(11, 16)}Z</span>
              <span>End:</span>
              <span className="font-mono">{hoveredBlock.endUtc.slice(11, 16)}Z</span>
              <span>Duration:</span>
              <span className="font-mono">{(hoveredBlock.durationHours ?? 0).toFixed(1)}h</span>
              <span>Effective Sleep:</span>
              <span className="font-mono">{(hoveredBlock.effectiveSleepHours ?? 0).toFixed(1)}h</span>
              {hoveredBlock.qualityFactor != null && (
                <>
                  <span>Quality Factor:</span>
                  <span className="font-mono">{(hoveredBlock.qualityFactor * 100).toFixed(0)}%</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-5 rounded-sm bg-primary/60" />
            On Deck
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-5 rounded-sm bg-chart-2/50 border border-chart-2/30" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, hsl(var(--chart-2) / 0.15) 2px, hsl(var(--chart-2) / 0.15) 4px)',
            }} />
            In Bunk
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-5 rounded-sm bg-wocl/20 border border-wocl/30" />
            WOCL
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface SwimLaneProps {
  label: string;
  blocks: TimelineBlock[];
  onHover: (block: RestBlock | null) => void;
}

function SwimLane({ label, blocks, onHover }: SwimLaneProps) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="relative h-7 rounded bg-primary/15 overflow-hidden">
        {/* Base: "On Deck" fill */}
        <div className="absolute inset-0 bg-primary/10" />

        {/* Rest blocks */}
        {blocks.map((block, i) => (
          <div
            key={i}
            className={cn(
              'absolute inset-y-0 rounded-sm border cursor-pointer transition-opacity hover:opacity-100',
              block.block?.isDuringWocl
                ? 'bg-wocl/25 border-wocl/40'
                : 'bg-chart-2/30 border-chart-2/30',
            )}
            style={{
              left: `${block.startPct}%`,
              width: `${Math.max(block.widthPct, 1)}%`,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px)',
              opacity: 0.85,
            }}
            onMouseEnter={() => block.block && onHover(block.block)}
            onMouseLeave={() => onHover(null)}
          >
            {/* Duration label inside block if wide enough */}
            {block.widthPct > 12 && block.block && (
              <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-foreground/70">
                {(block.block.durationHours ?? 0).toFixed(1)}h
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
