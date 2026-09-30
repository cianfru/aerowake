import type { ReactNode } from 'react';
import { Earth, LocateFixed, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapZoomControlsProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onWorld: () => void;
  worldLabel: string;
  className?: string;
}

function ControlButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}

/** Zoom and framing buttons floating over a map (44 px targets on touch screens). */
export function MapZoomControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut, onFit, onWorld, worldLabel, className }: MapZoomControlsProps) {
  return (
    <div className={cn('absolute bottom-3 right-3 z-10 flex flex-col gap-2', className)}>
      <div className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-md">
        <ControlButton label="Zoom in" onClick={onZoomIn} disabled={!canZoomIn}><Plus className="h-4 w-4" aria-hidden="true" /></ControlButton>
        <ControlButton label="Zoom out" onClick={onZoomOut} disabled={!canZoomOut}><Minus className="h-4 w-4" aria-hidden="true" /></ControlButton>
      </div>
      <div className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-md">
        <ControlButton label="Fit my routes" onClick={onFit}><LocateFixed className="h-4 w-4" aria-hidden="true" /></ControlButton>
        <ControlButton label={worldLabel} onClick={onWorld}><Earth className="h-4 w-4" aria-hidden="true" /></ControlButton>
      </div>
    </div>
  );
}
