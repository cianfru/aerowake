import { useCallback } from 'react';
import { RotateCcw, Clock, Users, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DutyAnalysis, DutyModification } from '@/types/fatigue';

interface DutyEditControlsProps {
  duty: DutyAnalysis;
  modification: DutyModification | null;
  onModification: (mod: DutyModification) => void;
}

const SHIFT_MIN = -120;
const SHIFT_MAX = 120;
const SHIFT_STEP = 30;

function formatShiftLabel(minutes: number): string {
  if (minutes === 0) return 'No change';
  const sign = minutes > 0 ? '+' : '';
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  if (h > 0 && m > 0) return `${sign}${minutes > 0 ? '' : '-'}${h}h ${m}m`;
  if (h > 0) return `${sign}${minutes > 0 ? '' : '-'}${h}h`;
  return `${sign}${minutes}m`;
}

export function DutyEditControls({
  duty,
  modification,
  onModification,
}: DutyEditControlsProps) {
  const dutyId = duty.dutyId || '';

  const current: DutyModification = modification || {
    dutyId,
    reportShiftMinutes: 0,
    releaseShiftMinutes: 0,
    excluded: false,
  };

  const update = useCallback(
    (partial: Partial<DutyModification>) => {
      onModification({ ...current, ...partial, dutyId });
    },
    [current, dutyId, onModification],
  );

  const handleReset = useCallback(() => {
    onModification({
      dutyId,
      reportShiftMinutes: 0,
      releaseShiftMinutes: 0,
      excluded: false,
    });
  }, [dutyId, onModification]);

  const isAugmentable =
    duty.crewComposition === 'augmented_4' ||
    duty.crewComposition === 'augmented_3' ||
    (duty.dutyHours >= 10 && duty.flightSegments && duty.flightSegments.length > 0);

  const showCrewSet =
    current.crewComposition === 'augmented_4' ||
    (!current.crewComposition && duty.crewComposition === 'augmented_4');

  return (
    <div className={`space-y-3 pt-2 ${current.excluded ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Exclude toggle — always interactive */}
      <div className={`flex items-center justify-between ${current.excluded ? 'opacity-100 pointer-events-auto' : ''}`}>
        <div className="flex items-center gap-2">
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor={`exclude-${dutyId}`} className="text-xs">
            Exclude duty (simulate day off)
          </Label>
        </div>
        <div className="pointer-events-auto">
          <Switch
            id={`exclude-${dutyId}`}
            checked={current.excluded}
            onCheckedChange={(checked) => update({ excluded: checked })}
          />
        </div>
      </div>

      {/* Report time shift */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Report time</span>
          </div>
          <span className="text-xs font-mono text-foreground">
            {formatShiftLabel(current.reportShiftMinutes)}
          </span>
        </div>
        <Slider
          min={SHIFT_MIN}
          max={SHIFT_MAX}
          step={SHIFT_STEP}
          value={[current.reportShiftMinutes]}
          onValueChange={([v]) => update({ reportShiftMinutes: v })}
          className="w-full"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50">
          <span>-2h</span>
          <span>0</span>
          <span>+2h</span>
        </div>
      </div>

      {/* Release time shift */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Release time</span>
          </div>
          <span className="text-xs font-mono text-foreground">
            {formatShiftLabel(current.releaseShiftMinutes)}
          </span>
        </div>
        <Slider
          min={SHIFT_MIN}
          max={SHIFT_MAX}
          step={SHIFT_STEP}
          value={[current.releaseShiftMinutes]}
          onValueChange={([v]) => update({ releaseShiftMinutes: v })}
          className="w-full"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50">
          <span>-2h</span>
          <span>0</span>
          <span>+2h</span>
        </div>
      </div>

      {/* Crew composition (only for eligible duties) */}
      {isAugmentable && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Crew composition</span>
          </div>
          <Select
            value={current.crewComposition || duty.crewComposition || 'standard'}
            onValueChange={(v) =>
              update({
                crewComposition: v as 'standard' | 'augmented_4',
                // Reset crew set if switching to standard
                crewSet: v === 'standard' ? undefined : current.crewSet,
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard (2 pilots)</SelectItem>
              <SelectItem value="augmented_4">Augmented (4 pilots)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Crew set (only for augmented duties) */}
      {showCrewSet && (
        <div className="flex gap-2">
          <Button
            variant={(!current.crewSet && duty.crewComposition === 'augmented_4') || current.crewSet === 'crew_a' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => update({ crewSet: 'crew_a' })}
          >
            Crew A
          </Button>
          <Button
            variant={current.crewSet === 'crew_b' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => update({ crewSet: 'crew_b' })}
          >
            Crew B
          </Button>
        </div>
      )}

      {/* Reset button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        className="w-full h-7 text-xs text-muted-foreground"
      >
        <RotateCcw className="h-3 w-3 mr-1" />
        Reset This Duty
      </Button>
    </div>
  );
}
