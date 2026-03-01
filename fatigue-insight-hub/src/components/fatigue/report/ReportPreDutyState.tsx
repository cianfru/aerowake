import { Moon, Clock, TrendingDown, Sun } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DutyAnalysis } from '@/types/fatigue';
import type { ReportData } from '@/lib/report-narrative';
import { assessPriorSleep, sleepDebtSeverity, assessWOCLExposure } from '@/lib/report-impairment';

interface Props {
  data: ReportData;
  duty: DutyAnalysis;
}

export function ReportPreDutyState({ data, duty }: Props) {
  const priorSleep = assessPriorSleep(duty.priorSleep ?? 8);
  const debtInfo = sleepDebtSeverity(duty.sleepDebt ?? 0);
  const woclInfo = assessWOCLExposure(duty.woclExposure ?? 0);

  const adequacyVariant = {
    adequate: 'success' as const,
    marginal: 'warning' as const,
    insufficient: 'critical' as const,
    severely_insufficient: 'critical' as const,
  }[priorSleep.adequacy];

  const debtVariant = {
    minimal: 'success' as const,
    moderate: 'warning' as const,
    significant: 'critical' as const,
    severe: 'critical' as const,
  }[debtInfo.severity];

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        3. Pre-Duty Fatigue State
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-4">
          {/* Narrative paragraph */}
          <p className="text-sm leading-relaxed print:text-black">
            {data.preDutyNarrative}
          </p>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/30 pt-4">
            {/* Prior Sleep */}
            <MetricCard
              icon={<Moon className="h-4 w-4 text-blue-400" />}
              title="Prior Sleep"
              value={`${(duty.priorSleep ?? 0).toFixed(1)}h`}
              subtitle={`of 8.0h recommended`}
              badge={priorSleep.label}
              badgeVariant={adequacyVariant}
            />

            {/* Time Awake at Report */}
            <MetricCard
              icon={<Clock className="h-4 w-4 text-amber-400" />}
              title="Awake at Report"
              value={`${(duty.preDutyAwakeHours ?? 0).toFixed(1)}h`}
              subtitle="continuous wakefulness"
              badge={duty.preDutyAwakeHours != null && duty.preDutyAwakeHours > 14 ? 'Extended' : 'Normal'}
              badgeVariant={duty.preDutyAwakeHours != null && duty.preDutyAwakeHours > 14 ? 'warning' : 'success'}
            />

            {/* Cumulative Sleep Debt */}
            <MetricCard
              icon={<TrendingDown className="h-4 w-4 text-red-400" />}
              title="Sleep Debt"
              value={`${(duty.sleepDebt ?? 0).toFixed(1)}h`}
              subtitle="cumulative deficit"
              badge={debtInfo.label.replace(' sleep debt', '')}
              badgeVariant={debtVariant}
            />

            {/* WOCL Exposure */}
            <MetricCard
              icon={<Sun className="h-4 w-4 text-purple-400" />}
              title="WOCL Exposure"
              value={`${(duty.woclExposure ?? 0).toFixed(1)}h`}
              subtitle="in 02:00–05:59 window"
              badge={woclInfo.label.replace(' WOCL exposure', '')}
              badgeVariant={woclInfo.severity === 'none' ? 'success' : woclInfo.severity === 'partial' ? 'warning' : 'critical'}
            />
          </div>

          {/* Sleep quality breakdown (if available) */}
          {duty.sleepEstimate && (
            <div className="border-t border-border/30 pt-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 print:text-gray-600">
                Sleep Quality Analysis
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <QualityItem
                  label="Total Sleep"
                  value={`${duty.sleepEstimate.totalSleepHours.toFixed(1)}h`}
                />
                <QualityItem
                  label="Effective Sleep"
                  value={`${duty.sleepEstimate.effectiveSleepHours.toFixed(1)}h`}
                />
                <QualityItem
                  label="Efficiency"
                  value={`${(duty.sleepEstimate.sleepEfficiency * 100).toFixed(0)}%`}
                />
                <QualityItem
                  label="Strategy"
                  value={formatStrategy(duty.sleepEstimate.sleepStrategy)}
                />
              </div>
              {duty.sleepEstimate.explanation && (
                <p className="text-[11px] text-muted-foreground mt-2 italic print:text-gray-500">
                  {duty.sleepEstimate.explanation}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({ icon, title, value, subtitle, badge, badgeVariant }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  badge: string;
  badgeVariant: 'success' | 'warning' | 'critical';
}) {
  return (
    <div className="rounded-lg bg-secondary/20 border border-border/30 px-4 py-3 print:bg-gray-50 print:border-gray-200">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground print:text-gray-600">{title}</span>
        </div>
        <Badge variant={badgeVariant} className="text-[10px]">{badge}</Badge>
      </div>
      <p className="text-lg font-bold font-mono print:text-black">{value}</p>
      <p className="text-[10px] text-muted-foreground print:text-gray-500">{subtitle}</p>
    </div>
  );
}

function QualityItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground print:text-gray-600 text-[10px]">{label}</p>
      <p className="font-mono font-medium print:text-black">{value}</p>
    </div>
  );
}

function formatStrategy(strategy: string): string {
  return strategy
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}
