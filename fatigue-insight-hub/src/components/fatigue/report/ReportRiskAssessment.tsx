import { Shield, Clock, Moon, AlertTriangle, Wine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DutyAnalysis } from '@/types/fatigue';
import type { ReportData } from '@/lib/report-narrative';
import {
  performanceToEquivalentAwakeHours,
  hoursAwakeToBAC,
  formatBAC,
  describeRiskLevel,
} from '@/lib/report-impairment';
import { performanceToKSS, performanceToReactionTime } from '@/lib/fatigue-calculations';

interface Props {
  data: ReportData;
  duty: DutyAnalysis;
}

export function ReportRiskAssessment({ data, duty }: Props) {
  const perf = duty.minPerformance ?? 100;
  const equivHours = performanceToEquivalentAwakeHours(perf);
  const bac = hoursAwakeToBAC(equivHours);
  const riskInfo = describeRiskLevel(duty.overallRisk ?? 'LOW');
  const kss = performanceToKSS(perf);
  const rt = performanceToReactionTime(perf);
  const baselineRT = 250; // well-rested baseline
  const rtIncrease = rt > baselineRT ? ((rt - baselineRT) / baselineRT * 100).toFixed(0) : '0';

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        6. Risk Assessment
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-5">
          {/* Risk classification */}
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold print:text-black">{riskInfo.label}</span>
                <Badge
                  variant={
                    duty.overallRisk === 'LOW' ? 'success' :
                    duty.overallRisk === 'MODERATE' ? 'warning' : 'critical'
                  }
                  className="text-[10px]"
                >
                  {duty.overallRisk}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground print:text-gray-600">{riskInfo.description}</p>
              <p className="text-xs print:text-black">{riskInfo.implication}</p>
            </div>
          </div>

          {/* Risk metrics table */}
          <div className="border-t border-border/30 pt-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3 print:text-gray-600">
              KEY RISK INDICATORS
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RiskRow
                label="Minimum Performance"
                value={`${perf.toFixed(0)}%`}
                context={perf >= 77 ? 'Within adequate range' : perf >= 55 ? 'Below moderate-risk threshold' : 'Below high-risk threshold'}
                variant={perf >= 77 ? 'success' : perf >= 55 ? 'warning' : 'critical'}
              />
              <RiskRow
                label="Landing Performance"
                value={`${(duty.landingPerformance ?? perf).toFixed(0)}%`}
                context="Performance at final approach/touchdown"
                variant={(duty.landingPerformance ?? perf) >= 77 ? 'success' : (duty.landingPerformance ?? perf) >= 55 ? 'warning' : 'critical'}
              />
              <RiskRow
                label="WOCL Exposure"
                value={`${(duty.woclExposure ?? 0).toFixed(1)}h`}
                context="Time in 02:00–05:59 window"
                variant={(duty.woclExposure ?? 0) <= 0 ? 'success' : (duty.woclExposure ?? 0) <= 2 ? 'warning' : 'critical'}
              />
              <RiskRow
                label="FDP Utilization"
                value={duty.actualFdpHours && duty.maxFdpHours
                  ? `${duty.actualFdpHours.toFixed(1)}h / ${duty.maxFdpHours.toFixed(1)}h`
                  : `${duty.dutyHours.toFixed(1)}h`}
                context={duty.fdpExceedance && duty.fdpExceedance > 0
                  ? `EXCEEDANCE: ${duty.fdpExceedance.toFixed(1)}h over limit`
                  : 'Within regulatory limit'}
                variant={duty.fdpExceedance && duty.fdpExceedance > 0 ? 'critical' : 'success'}
              />
            </div>
          </div>

          {/* Impairment equivalences */}
          {perf < 77 && (
            <div className="border-t border-border/30 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Wine className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-medium text-muted-foreground print:text-gray-600">
                  IMPAIRMENT EQUIVALENCES (at worst performance point)
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3 print:text-gray-500">
                These equivalences provide context for the magnitude of cognitive impairment.
                They describe the same level of performance degradation, not the same mechanism of impairment.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EquivalenceItem
                  icon={<Clock className="h-4 w-4 text-amber-400" />}
                  label="Equivalent Continuous Wakefulness"
                  value={`~${equivHours.toFixed(1)} hours`}
                  reference="Dawson & Reid, 1997"
                />
                <EquivalenceItem
                  icon={<Wine className="h-4 w-4 text-red-400" />}
                  label="Equivalent Blood Alcohol"
                  value={formatBAC(bac)}
                  reference="Dawson & Reid, 1997"
                />
                <EquivalenceItem
                  icon={<Moon className="h-4 w-4 text-blue-400" />}
                  label="Subjective Sleepiness"
                  value={`KSS ${kss.toFixed(1)}`}
                  reference="Åkerstedt & Gillberg, 1990"
                />
                <EquivalenceItem
                  icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
                  label="Reaction Time Increase"
                  value={`${rt}ms (+${rtIncrease}% from baseline)`}
                  reference="Basner & Dinges, 2011"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function RiskRow({ label, value, context, variant }: {
  label: string;
  value: string;
  context: string;
  variant: 'success' | 'warning' | 'critical';
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary/15 border border-border/20 px-3 py-2.5 print:bg-gray-50">
      <div>
        <p className="text-xs font-medium print:text-black">{label}</p>
        <p className="text-[10px] text-muted-foreground print:text-gray-500">{context}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-bold print:text-black">{value}</p>
        <Badge variant={variant} className="text-[9px]">
          {variant === 'success' ? 'OK' : variant === 'warning' ? 'CAUTION' : 'ALERT'}
        </Badge>
      </div>
    </div>
  );
}

function EquivalenceItem({ icon, label, value, reference }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  reference: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/15 border border-border/20 px-3 py-2.5 print:bg-gray-50">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground print:text-gray-600">{label}</span>
      </div>
      <p className="text-sm font-mono font-semibold print:text-black">{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5 print:text-gray-500">Ref: {reference}</p>
    </div>
  );
}
