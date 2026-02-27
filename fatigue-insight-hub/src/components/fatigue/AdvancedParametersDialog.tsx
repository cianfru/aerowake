import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Brain, Activity, Moon, ShieldAlert, Globe } from 'lucide-react';

interface AdvancedParametersDialogProps {
  preset: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mirrors fatigue-tool/core/parameters.py — each preset's key parameter values
export const PRESET_PARAMS: Record<string, PresetConfig> = {
  default: {
    label: 'EASA Default',
    processS: {
      tau_i: { value: 18.2, unit: 'h', label: 'Time constant (buildup)', citation: 'Jewett & Kronauer 1999' },
      tau_d: { value: 4.2, unit: 'h', label: 'Time constant (recovery)', citation: 'Jewett & Kronauer 1999' },
      baseline_sleep_need: { value: 8.0, unit: 'h', label: 'Baseline sleep need', citation: 'Van Dongen et al. 2003' },
      inertia_duration: { value: 30, unit: 'min', label: 'Sleep inertia duration', citation: 'Tassi & Muzet 2000' },
      inertia_magnitude: { value: 0.30, unit: '', label: 'Sleep inertia max magnitude', citation: 'Tassi & Muzet 2000' },
    },
    processC: {
      amplitude: { value: 0.25, unit: '', label: 'Circadian amplitude', citation: 'Czeisler et al. 1999' },
      weight_circadian: { value: 0.4, unit: '', label: 'Circadian weight', citation: 'Borbely & Achermann 1999' },
      weight_homeostatic: { value: 0.6, unit: '', label: 'Homeostatic weight', citation: 'Borbely & Achermann 1999' },
      interaction_exponent: { value: 1.5, unit: '', label: 'S×C interaction exponent', citation: 'Model calibration' },
    },
    sleepQuality: {
      quality_home: { value: 0.92, unit: '', label: 'Home sleep quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_hotel: { value: 0.80, unit: '', label: 'Hotel sleep quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_hotel_airport: { value: 0.75, unit: '', label: 'Airport hotel quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_crew_rest: { value: 0.65, unit: '', label: 'Crew rest facility', citation: 'Rosekind et al. 1994' },
    },
    riskThresholds: {
      low: { range: '75–100', label: 'Low Risk' },
      moderate: { range: '65–75', label: 'Moderate Risk' },
      high: { range: '55–65', label: 'High Risk' },
      critical: { range: '45–55', label: 'Critical Risk' },
      extreme: { range: '0–45', label: 'Extreme Risk' },
    },
    adaptation: {
      westward: { value: 1.5, unit: 'h/day', label: 'Westward re-entrainment', citation: 'Waterhouse et al. 2007' },
      eastward: { value: 1.0, unit: 'h/day', label: 'Eastward re-entrainment', citation: 'Waterhouse et al. 2007' },
    },
  },
  conservative: {
    label: 'Conservative',
    processS: {
      tau_i: { value: 16.0, unit: 'h', label: 'Time constant (buildup)', citation: 'Safety margin: faster buildup' },
      tau_d: { value: 4.8, unit: 'h', label: 'Time constant (recovery)', citation: 'Safety margin: slower recovery' },
      baseline_sleep_need: { value: 8.5, unit: 'h', label: 'Baseline sleep need', citation: 'Safety margin: higher need' },
      inertia_duration: { value: 40, unit: 'min', label: 'Sleep inertia duration', citation: 'Extended for safety' },
      inertia_magnitude: { value: 0.35, unit: '', label: 'Sleep inertia max magnitude', citation: 'Extended for safety' },
    },
    processC: {
      amplitude: { value: 0.25, unit: '', label: 'Circadian amplitude', citation: 'Czeisler et al. 1999' },
      weight_circadian: { value: 0.4, unit: '', label: 'Circadian weight', citation: 'Borbely & Achermann 1999' },
      weight_homeostatic: { value: 0.6, unit: '', label: 'Homeostatic weight', citation: 'Borbely & Achermann 1999' },
      interaction_exponent: { value: 1.5, unit: '', label: 'S×C interaction exponent', citation: 'Model calibration' },
    },
    sleepQuality: {
      quality_home: { value: 0.92, unit: '', label: 'Home sleep quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_hotel: { value: 0.75, unit: '', label: 'Hotel sleep quality', citation: 'Conservative estimate' },
      quality_hotel_airport: { value: 0.70, unit: '', label: 'Airport hotel quality', citation: 'Conservative estimate' },
      quality_crew_rest: { value: 0.60, unit: '', label: 'Crew rest facility', citation: 'Conservative estimate' },
    },
    riskThresholds: {
      low: { range: '80–100', label: 'Low Risk' },
      moderate: { range: '70–80', label: 'Moderate Risk' },
      high: { range: '60–70', label: 'High Risk' },
      critical: { range: '50–60', label: 'Critical Risk' },
      extreme: { range: '0–50', label: 'Extreme Risk' },
    },
    adaptation: {
      westward: { value: 1.0, unit: 'h/day', label: 'Westward re-entrainment', citation: 'Conservative: slower' },
      eastward: { value: 0.7, unit: 'h/day', label: 'Eastward re-entrainment', citation: 'Conservative: slower' },
    },
  },
  liberal: {
    label: 'Liberal',
    processS: {
      tau_i: { value: 20.0, unit: 'h', label: 'Time constant (buildup)', citation: 'Experienced crew assumption' },
      tau_d: { value: 3.8, unit: 'h', label: 'Time constant (recovery)', citation: 'Experienced crew assumption' },
      baseline_sleep_need: { value: 7.5, unit: 'h', label: 'Baseline sleep need', citation: 'Lower individual need' },
      inertia_duration: { value: 20, unit: 'min', label: 'Sleep inertia duration', citation: 'Reduced for experienced crew' },
      inertia_magnitude: { value: 0.25, unit: '', label: 'Sleep inertia max magnitude', citation: 'Reduced for experienced crew' },
    },
    processC: {
      amplitude: { value: 0.25, unit: '', label: 'Circadian amplitude', citation: 'Czeisler et al. 1999' },
      weight_circadian: { value: 0.4, unit: '', label: 'Circadian weight', citation: 'Borbely & Achermann 1999' },
      weight_homeostatic: { value: 0.6, unit: '', label: 'Homeostatic weight', citation: 'Borbely & Achermann 1999' },
      interaction_exponent: { value: 1.5, unit: '', label: 'S×C interaction exponent', citation: 'Model calibration' },
    },
    sleepQuality: {
      quality_home: { value: 0.92, unit: '', label: 'Home sleep quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_hotel: { value: 0.85, unit: '', label: 'Hotel sleep quality', citation: 'Optimistic estimate' },
      quality_hotel_airport: { value: 0.80, unit: '', label: 'Airport hotel quality', citation: 'Optimistic estimate' },
      quality_crew_rest: { value: 0.70, unit: '', label: 'Crew rest facility', citation: 'Optimistic estimate' },
    },
    riskThresholds: {
      low: { range: '70–100', label: 'Low Risk' },
      moderate: { range: '60–70', label: 'Moderate Risk' },
      high: { range: '50–60', label: 'High Risk' },
      critical: { range: '40–50', label: 'Critical Risk' },
      extreme: { range: '0–40', label: 'Extreme Risk' },
    },
    adaptation: {
      westward: { value: 1.8, unit: 'h/day', label: 'Westward re-entrainment', citation: 'Faster adaptation assumed' },
      eastward: { value: 1.2, unit: 'h/day', label: 'Eastward re-entrainment', citation: 'Faster adaptation assumed' },
    },
  },
  research: {
    label: 'Research',
    processS: {
      tau_i: { value: 18.2, unit: 'h', label: 'Time constant (buildup)', citation: 'Jewett & Kronauer 1999' },
      tau_d: { value: 4.2, unit: 'h', label: 'Time constant (recovery)', citation: 'Jewett & Kronauer 1999' },
      baseline_sleep_need: { value: 8.0, unit: 'h', label: 'Baseline sleep need', citation: 'Van Dongen et al. 2003' },
      inertia_duration: { value: 30, unit: 'min', label: 'Sleep inertia duration', citation: 'Tassi & Muzet 2000' },
      inertia_magnitude: { value: 0.30, unit: '', label: 'Sleep inertia max magnitude', citation: 'Tassi & Muzet 2000' },
    },
    processC: {
      amplitude: { value: 0.30, unit: '', label: 'Circadian amplitude', citation: 'Jewett & Kronauer 1999' },
      weight_circadian: { value: 0.5, unit: '', label: 'Circadian weight', citation: 'Equal weighting (textbook)' },
      weight_homeostatic: { value: 0.5, unit: '', label: 'Homeostatic weight', citation: 'Equal weighting (textbook)' },
      interaction_exponent: { value: 1.0, unit: '', label: 'S×C interaction exponent', citation: 'Linear (no interaction)' },
    },
    sleepQuality: {
      quality_home: { value: 0.92, unit: '', label: 'Home sleep quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_hotel: { value: 0.80, unit: '', label: 'Hotel sleep quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_hotel_airport: { value: 0.75, unit: '', label: 'Airport hotel quality', citation: 'Pilcher & Huffcutt 1996' },
      quality_crew_rest: { value: 0.65, unit: '', label: 'Crew rest facility', citation: 'Rosekind et al. 1994' },
    },
    riskThresholds: {
      low: { range: '75–100', label: 'Low Risk' },
      moderate: { range: '65–75', label: 'Moderate Risk' },
      high: { range: '55–65', label: 'High Risk' },
      critical: { range: '45–55', label: 'Critical Risk' },
      extreme: { range: '0–45', label: 'Extreme Risk' },
    },
    adaptation: {
      westward: { value: 1.5, unit: 'h/day', label: 'Westward re-entrainment', citation: 'Waterhouse et al. 2007' },
      eastward: { value: 1.0, unit: 'h/day', label: 'Eastward re-entrainment', citation: 'Waterhouse et al. 2007' },
    },
  },
};

export interface ParamEntry {
  value: number;
  unit: string;
  label: string;
  citation: string;
}

export interface RiskEntry {
  range: string;
  label: string;
}

export interface PresetConfig {
  label: string;
  processS: Record<string, ParamEntry>;
  processC: Record<string, ParamEntry>;
  sleepQuality: Record<string, ParamEntry>;
  riskThresholds: Record<string, RiskEntry>;
  adaptation: Record<string, ParamEntry>;
}

export function ParamRow({ entry }: { entry: ParamEntry }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <span className="text-xs text-foreground">{entry.label}</span>
        <span className="block text-[10px] text-muted-foreground italic truncate">{entry.citation}</span>
      </div>
      <span className="text-xs font-mono font-semibold tabular-nums text-primary flex-shrink-0 ml-3">
        {entry.value}{entry.unit ? ` ${entry.unit}` : ''}
      </span>
    </div>
  );
}

export const RISK_COLORS: Record<string, string> = {
  low: 'text-success',
  moderate: 'text-warning',
  high: 'text-high',
  critical: 'text-critical',
  extreme: 'text-destructive',
};

export function AdvancedParametersDialog({ preset, open, onOpenChange }: AdvancedParametersDialogProps) {
  const config = PRESET_PARAMS[preset] || PRESET_PARAMS.default;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Model Parameters
            <Badge variant="outline" className="text-[10px] ml-1">{config.label}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Borbely two-process model parameters for the selected configuration preset.
          </p>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={['processS', 'riskThresholds']} className="w-full">
          {/* Process S */}
          <AccordionItem value="processS">
            <AccordionTrigger className="text-sm font-medium py-3">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-chart-1" />
                Process S (Homeostatic)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-0 px-1">
                {Object.values(config.processS).map((entry, i) => (
                  <ParamRow key={i} entry={entry} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Process C */}
          <AccordionItem value="processC">
            <AccordionTrigger className="text-sm font-medium py-3">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-chart-2" />
                Process C (Circadian)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-0 px-1">
                {Object.values(config.processC).map((entry, i) => (
                  <ParamRow key={i} entry={entry} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Sleep Quality */}
          <AccordionItem value="sleepQuality">
            <AccordionTrigger className="text-sm font-medium py-3">
              <span className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-chart-3" />
                Sleep Quality Factors
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-0 px-1">
                {Object.values(config.sleepQuality).map((entry, i) => (
                  <ParamRow key={i} entry={entry} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Risk Thresholds */}
          <AccordionItem value="riskThresholds">
            <AccordionTrigger className="text-sm font-medium py-3">
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-warning" />
                Risk Thresholds
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 px-1">
                {Object.entries(config.riskThresholds).map(([key, entry]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className={`text-xs font-medium ${RISK_COLORS[key] || 'text-foreground'}`}>
                      {entry.label}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {entry.range}%
                    </span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Adaptation Rates */}
          <AccordionItem value="adaptation">
            <AccordionTrigger className="text-sm font-medium py-3">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-chart-4" />
                Timezone Adaptation
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-0 px-1">
                {Object.values(config.adaptation).map((entry, i) => (
                  <ParamRow key={i} entry={entry} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
