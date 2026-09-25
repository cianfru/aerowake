import { Plane, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReportData } from '@/lib/report-narrative';
import { getPerformanceColor } from '@/lib/fatigue-utils';
import { RISK_LEVEL_LABELS, classifyPerformance, isElevatedRisk } from '@/lib/risk-scale';

interface Props {
  data: ReportData;
}

export function ReportCriticalPhases({ data }: Props) {
  const { criticalPhaseAnalysis, duty } = data;

  if (criticalPhaseAnalysis.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
          5. Critical Phase Analysis
        </h2>
        <Card variant="glass" className="print:bg-white print:border-gray-300">
          <CardContent className="py-4 px-5">
            <p className="text-sm text-muted-foreground print:text-gray-600">
              {duty.dutyType === 'simulator' || duty.dutyType === 'ground_training'
                ? 'Critical phase analysis is not applicable for training duties.'
                : 'No flight segments available for critical phase analysis.'}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        5. Critical Phase Analysis
      </h2>
      <p className="text-xs text-muted-foreground mb-3 print:text-gray-600">
        Predicted sleepiness (KSS) at approach and landing — the phases where
        reduced alertness carries the highest operational risk.
      </p>

      <div className="space-y-3">
        {criticalPhaseAnalysis.map((phase) => {
          const level = classifyPerformance(phase.performance, duty.riskThresholds);
          const isImpaired = isElevatedRisk(level);
          const isReduced = level === 'moderate';

          return (
            <Card
              key={`${phase.sectorIndex}-${phase.phase}`}
              variant="glass"
              className={`print:bg-white print:border-gray-300 ${isImpaired ? 'border-critical/30' : isReduced ? 'border-warning/30' : ''}`}
            >
              <CardContent className="py-4 px-5">
                {/* Sector header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Plane className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium print:text-black">
                      Sector {phase.sectorIndex}: {phase.flightNumber}
                    </span>
                    <span className="text-xs text-muted-foreground print:text-gray-500">
                      {phase.departure} → {phase.arrival}
                    </span>
                  </div>
                  {isImpaired && (
                    <Badge variant="critical" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />
                      {RISK_LEVEL_LABELS[level].toUpperCase()}
                    </Badge>
                  )}
                  {isReduced && (
                    <Badge variant="warning" className="text-[10px]">
                      MODERATE
                    </Badge>
                  )}
                </div>

                {/* Phase metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <PhaseMetric
                    label="KSS (predicted)"
                    value={phase.kss.toFixed(1)}
                    sublabel={phase.kssLabel}
                    color={getPerformanceColor(phase.performance, duty.riskThresholds)}
                    emphasis
                  />
                  <PhaseMetric
                    label="Index"
                    value={phase.performance.toFixed(0)}
                    sublabel="110 − 10·KSS"
                  />
                  {phase.kss90 != null && (
                    <PhaseMetric
                      label="KSS 90th pct"
                      value={phase.kss90.toFixed(1)}
                      sublabel="sensitive pilot"
                    />
                  )}
                  {phase.pSevere != null && (
                    <PhaseMetric
                      label="P(KSS ≥ 7)"
                      value={`${(phase.pSevere * 100).toFixed(0)}%`}
                      sublabel="sleepy or worse"
                    />
                  )}
                  {phase.hoursAwake != null && (
                    <PhaseMetric
                      label="Hours awake"
                      value={`${phase.hoursAwake.toFixed(1)}h`}
                    />
                  )}
                  {phase.microsleepProbability != null && phase.microsleepProbability > 0.005 && (
                    <PhaseMetric
                      label="P(KSS 9)"
                      value={`${(phase.microsleepProbability * 100).toFixed(1)}%`}
                      sublabel="fighting sleep"
                    />
                  )}
                </div>

                {/* Dominant factor callout */}
                <p className="text-[11px] text-muted-foreground mt-3 print:text-gray-600">
                  Primary factor at this phase: <span className="font-medium">{phase.dominantFactor}</span>
                  {phase.timestamp && (
                    <span className="ml-2">
                      at <span className="font-mono">
                        {new Date(phase.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function PhaseMetric({ label, value, sublabel, color, emphasis }: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground print:text-gray-600 uppercase tracking-wide">{label}</p>
      <p
        className={`font-mono ${emphasis ? 'text-lg font-bold' : 'text-sm font-semibold'} print:text-black`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-[9px] text-muted-foreground print:text-gray-500">{sublabel}</p>
      )}
    </div>
  );
}
