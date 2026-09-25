import { FileWarning, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  RISK_LEVEL_LABELS,
  formatKss,
  kssLabel,
  riskBadgeVariant,
  riskClasses,
} from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { dutyDateLabel, dutyPeakKss, dutyRiskLevel, dutyRoute, dutyTimes } from './roster-utils';

interface DutyWatchCardProps {
  duty: DutyAnalysis;
  onDetails: (duty: DutyAnalysis) => void;
  onReportFatigue: (duty: DutyAnalysis) => void;
}

/** One duty the model flags (high / critical / extreme): the facts and two actions. */
export function DutyWatchCard({ duty, onDetails, onReportFatigue }: DutyWatchCardProps) {
  const level = dutyRiskLevel(duty);
  const rc = riskClasses(level);
  const kss = dutyPeakKss(duty);
  const times = dutyTimes(duty);
  const route = dutyRoute(duty);
  const date = dutyDateLabel(duty);
  const reasons = (duty.riskReasons ?? []).slice(0, 3);

  return (
    <Card variant="glass" className={cn('border-l-4', rc.border)} data-testid="duty-watch-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{date}</h3>
            <p className="text-sm text-foreground/90 break-words">{route}</p>
            {times && (
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{times}</span> home time
              </p>
            )}
          </div>
          <Badge variant={riskBadgeVariant(level)} className="flex-shrink-0 text-[10px]">
            {RISK_LEVEL_LABELS[level]}
          </Badge>
        </div>

        {kss != null && (
          <p className="text-sm">
            <span className="text-muted-foreground">Predicted peak: </span>
            <span className={cn('font-semibold', rc.text)}>{formatKss(kss)}</span>
            <span className="text-muted-foreground"> · {kssLabel(kss)}</span>
          </p>
        )}

        {reasons.length > 0 && (
          <ul className="space-y-1 text-sm text-foreground/85" aria-label="Why this duty is flagged">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn('mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full', rc.fill)} aria-hidden="true" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDetails(duty)}
            aria-label={`Details for duty on ${date}`}
          >
            <Info className="h-3.5 w-3.5 mr-1.5" />
            Details
          </Button>
          <Button
            variant="glow"
            size="sm"
            onClick={() => onReportFatigue(duty)}
            aria-label={`Report fatigue for duty on ${date}`}
          >
            <FileWarning className="h-3.5 w-3.5 mr-1.5" />
            Report fatigue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
