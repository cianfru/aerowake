import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReportData } from '@/lib/report-narrative';

interface Props {
  data: ReportData;
}

export function ReportExecutiveSummary({ data }: Props) {
  const { duty, executiveSummary } = data;
  const risk = (duty.overallRisk ?? 'LOW').toUpperCase();
  const perf = duty.minPerformance ?? 100;

  const riskConfig = {
    LOW: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', badge: 'success' as const },
    MODERATE: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', badge: 'warning' as const },
    HIGH: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', badge: 'warning' as const },
    CRITICAL: { icon: AlertTriangle, color: 'text-critical', bg: 'bg-critical/10', border: 'border-critical/30', badge: 'critical' as const },
  }[risk] ?? { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-secondary/10', border: 'border-border/50', badge: 'secondary' as const };

  const Icon = riskConfig.icon;

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        1. Executive Summary
      </h2>
      <Card className={`${riskConfig.bg} ${riskConfig.border} border print:bg-white print:border-gray-300`}>
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Icon className={`h-5 w-5 ${riskConfig.color} print:text-black flex-shrink-0`} />
            <Badge variant={riskConfig.badge} className="text-xs">
              {risk} RISK
            </Badge>
            {duty.riskAdvisory === 'report_recommended' && (
              <Badge variant="critical" className="text-xs">
                REPORT RECOMMENDED
              </Badge>
            )}
            {duty.riskAdvisory === 'consider_reporting' && (
              <Badge variant="warning" className="text-xs">
                ELEVATED RISK
              </Badge>
            )}
            <span className="text-xs text-muted-foreground print:text-gray-600">
              Worst Performance: {perf.toFixed(0)}%
            </span>
          </div>
          <p className="text-sm leading-relaxed print:text-black">
            {executiveSummary}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
