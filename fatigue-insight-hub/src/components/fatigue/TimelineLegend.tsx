import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineLegendProps {
  showDiscretion?: boolean;
  /** Extra items for HPT (circadian markers) */
  variant?: 'homebase' | 'elapsed';
}

export function TimelineLegend({ showDiscretion, variant = 'homebase' }: TimelineLegendProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-medium">Legend</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] p-2.5 rounded-lg bg-secondary/30 border border-border/30 animate-fade-in">
          {/* WOCL */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-8 rounded-sm wocl-hatch" />
            <span className="text-muted-foreground">WOCL</span>
          </span>

          <span className="text-border">|</span>

          {/* Duty segments */}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm opacity-70" style={{ backgroundColor: 'hsl(120, 70%, 45%)' }} />
            <span className="text-muted-foreground">Check-in</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: 'hsl(120, 70%, 45%)' }} />
            <span className="text-muted-foreground">Flight</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-muted/50" />
            <span className="text-muted-foreground">Ground</span>
          </span>

          <span className="text-border">|</span>

          {/* Training duties */}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm" style={{
              backgroundColor: 'hsl(var(--simulator))',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
            }} />
            <span className="text-muted-foreground">Simulator</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: 'hsl(var(--ground-training))' }} />
            <span className="text-muted-foreground">Ground Training</span>
          </span>

          <span className="text-border">|</span>

          {/* Sleep */}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-primary/10 border border-dashed border-primary/30" />
            <span className="text-muted-foreground">Sleep</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-6 rounded-sm"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(147, 130, 220, 0.5) 2px, rgba(147, 130, 220, 0.5) 4px)',
              }}
            />
            <span className="text-muted-foreground">In-Flight Rest</span>
          </span>

          <span className="text-border">|</span>

          {/* FDP & Discretion */}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-dashed border-muted-foreground/50" />
            <span className="text-muted-foreground">FDP Limit</span>
          </span>
          {showDiscretion && (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-critical ring-2 ring-critical/50" />
              <span className="text-muted-foreground">Discretion</span>
            </span>
          )}

          {/* Circadian markers for HPT */}
          {variant === 'elapsed' && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-1 bg-critical/60 rounded-full" />
                <span className="text-muted-foreground">Nadir</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-4 rounded-sm bg-warning/10 border border-warning/30" />
                <span className="text-muted-foreground">WMZ</span>
              </span>
            </>
          )}

          {/* Performance gradient inline */}
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-16 rounded-sm" style={{
              background: 'linear-gradient(to right, hsl(0, 80%, 50%), hsl(40, 95%, 50%), hsl(55, 90%, 55%), hsl(90, 70%, 50%), hsl(120, 70%, 45%))',
            }} />
            <span className="text-muted-foreground">0–100%</span>
          </span>
        </div>
      )}
    </div>
  );
}
