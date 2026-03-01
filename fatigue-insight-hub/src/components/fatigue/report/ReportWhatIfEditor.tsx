import { useState, useCallback } from 'react';
import { Sliders, RotateCcw, Loader2, Moon, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DutyAnalysis } from '@/types/fatigue';
import { runWhatIf, getDutyDetail } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { useAnalysis } from '@/contexts/AnalysisContext';

interface Props {
  duty: DutyAnalysis;
  analysisId?: string;
  onResult: (duty: DutyAnalysis) => void;
  onReset: () => void;
  isModified: boolean;
}

/**
 * What-If Scenario Editor for the fatigue report.
 *
 * Allows the user to adjust:
 * 1. Sleep time (bedtime / wake-up) — modifies the sleep block before this duty
 * 2. Report time (shift ± minutes) — modifies the duty start
 *
 * When "Recalculate" is pressed, calls the existing runWhatIf() API,
 * extracts the specific duty from the result, fetches its detailed timeline,
 * and passes the updated DutyAnalysis to the parent report.
 */
export function ReportWhatIfEditor({ duty, analysisId, onResult, onReset, isModified }: Props) {
  const { state } = useAnalysis();

  // Sleep adjustments (minutes from original)
  const [sleepStartShift, setSleepStartShift] = useState(0); // negative = earlier bedtime
  const [sleepEndShift, setSleepEndShift] = useState(0); // positive = wake up later

  // Duty report time shift (minutes)
  const [reportShift, setReportShift] = useState(0);

  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = sleepStartShift !== 0 || sleepEndShift !== 0 || reportShift !== 0;

  // Original sleep times for display
  const origSleepStart = duty.sleepEstimate?.sleepStartTime ?? '—';
  const origSleepEnd = duty.sleepEstimate?.sleepEndTime ?? '—';
  const origReportTime = duty.reportTimeLocal ?? '—';

  const handleRecalculate = useCallback(async () => {
    if (!analysisId || !duty.dutyId) {
      setError('Missing analysis or duty ID');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      // Build what-if request
      const request: Parameters<typeof runWhatIf>[0] = {
        analysis_id: analysisId,
        config_preset: state.settings.configPreset,
      };

      // Duty modifications (report time shift)
      if (reportShift !== 0) {
        request.modifications = [{
          duty_id: duty.dutyId,
          report_shift_minutes: reportShift,
        }];
      }

      // Sleep modifications
      if ((sleepStartShift !== 0 || sleepEndShift !== 0) && duty.sleepEstimate?.sleepStartIso && duty.sleepEstimate?.sleepEndIso) {
        const origStart = new Date(duty.sleepEstimate.sleepStartIso);
        const origEnd = new Date(duty.sleepEstimate.sleepEndIso);

        const newStart = new Date(origStart.getTime() + sleepStartShift * 60 * 1000);
        const newEnd = new Date(origEnd.getTime() + sleepEndShift * 60 * 1000);

        request.sleep_modifications = [{
          duty_id: duty.dutyId,
          sleep_start_utc: newStart.toISOString(),
          sleep_end_utc: newEnd.toISOString(),
          environment: duty.sleepEstimate.environment ?? undefined,
        }];
      }

      // Run what-if analysis
      const result = await runWhatIf(request);

      // Transform the full result to find the modified duty
      const transformed = transformAnalysisResult(result, state.settings.selectedMonth);

      // Find the specific duty in the results
      const updatedDuty = transformed.duties.find(d => d.dutyId === duty.dutyId);
      if (!updatedDuty) {
        throw new Error('Modified duty not found in what-if results');
      }

      // Fetch detailed timeline for the updated duty
      try {
        const detail = await getDutyDetail(result.analysis_id ?? analysisId, duty.dutyId);
        const rawTimeline = detail?.timeline ?? detail?.timeline_points ?? detail?.timelinePoints;

        if (Array.isArray(rawTimeline)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updatedDuty.timelinePoints = rawTimeline.map((pt: any) => ({
            hours_on_duty: pt.hours_on_duty ?? 0,
            time_on_task_penalty: pt.time_on_task_penalty ?? 0,
            sleep_inertia: pt.sleep_inertia ?? 0,
            sleep_pressure: pt.sleep_pressure ?? 0,
            circadian: pt.circadian ?? 0,
            performance: pt.performance,
            is_in_rest: pt.is_in_rest ?? false,
            flight_phase: pt.flight_phase ?? null,
            is_critical: pt.is_critical ?? false,
            timestamp: pt.timestamp,
            timestamp_local: pt.timestamp_local,
            debt_penalty: pt.debt_penalty,
            hypoxia_factor: pt.hypoxia_factor,
            pvt_lapses: pt.pvt_lapses,
            microsleep_probability: pt.microsleep_probability,
          }));
        }
      } catch {
        // Timeline fetch failed — report will work without it (just less detail)
        console.warn('[WhatIf] Timeline fetch failed, using base duty data');
      }

      onResult(updatedDuty);
    } catch (err) {
      console.error('[WhatIf] Recalculation failed:', err);
      setError(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setIsCalculating(false);
    }
  }, [analysisId, duty, reportShift, sleepStartShift, sleepEndShift, state.settings, onResult]);

  const handleReset = useCallback(() => {
    setSleepStartShift(0);
    setSleepEndShift(0);
    setReportShift(0);
    setError(null);
    onReset();
  }, [onReset]);

  return (
    <Card variant="glass" className="border-primary/20">
      <CardContent className="py-4 px-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">What-If Scenario Editor</h3>
            {isModified && (
              <Badge variant="warning" className="text-[9px]">MODIFIED</Badge>
            )}
          </div>
          {isModified && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-xs">
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Adjust sleep or duty times to see how fatigue predictions change. The entire analysis is recalculated on the server.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sleep adjustment */}
          <div className="space-y-3 rounded-lg bg-secondary/15 border border-border/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium">Sleep Timing</span>
            </div>

            {/* Bedtime */}
            <SliderRow
              label="Bedtime"
              originalValue={origSleepStart}
              shiftMinutes={sleepStartShift}
              onShift={setSleepStartShift}
              min={-120}
              max={120}
              step={15}
              description="Shift bedtime earlier (−) or later (+)"
            />

            {/* Wake time */}
            <SliderRow
              label="Wake-up"
              originalValue={origSleepEnd}
              shiftMinutes={sleepEndShift}
              onShift={setSleepEndShift}
              min={-120}
              max={120}
              step={15}
              description="Shift wake-up earlier (−) or later (+)"
            />
          </div>

          {/* Duty adjustment */}
          <div className="space-y-3 rounded-lg bg-secondary/15 border border-border/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium">Duty Timing</span>
            </div>

            {/* Report time */}
            <SliderRow
              label="Report"
              originalValue={origReportTime}
              shiftMinutes={reportShift}
              onShift={setReportShift}
              min={-120}
              max={120}
              step={30}
              description="Shift report time earlier (−) or later (+)"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleRecalculate}
            disabled={!hasChanges || isCalculating || !analysisId}
            size="sm"
            className="gap-1.5"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Recalculating...
              </>
            ) : (
              <>
                <ArrowRight className="h-3.5 w-3.5" />
                Recalculate
              </>
            )}
          </Button>
          {!analysisId && (
            <span className="text-xs text-muted-foreground">Analysis ID not available</span>
          )}
          {error && (
            <span className="text-xs text-critical">{error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Slider sub-component
// ---------------------------------------------------------------------------

function SliderRow({ label, originalValue, shiftMinutes, onShift, min, max, step, description }: {
  label: string;
  originalValue: string;
  shiftMinutes: number;
  onShift: (v: number) => void;
  min: number;
  max: number;
  step: number;
  description: string;
}) {
  const sign = shiftMinutes >= 0 ? '+' : '';
  const absMinutes = Math.abs(shiftMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const shiftLabel = shiftMinutes === 0
    ? 'No change'
    : `${sign}${hours > 0 ? `${hours}h` : ''}${mins > 0 ? `${mins}m` : ''}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}: <span className="font-mono">{originalValue}</span></span>
        <span className={`text-[10px] font-mono font-medium ${shiftMinutes !== 0 ? 'text-primary' : 'text-muted-foreground'}`}>
          {shiftLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shiftMinutes}
        onChange={(e) => onShift(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-secondary
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
                   [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
                   [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
      />
      <p className="text-[9px] text-muted-foreground/70">{description}</p>
    </div>
  );
}
