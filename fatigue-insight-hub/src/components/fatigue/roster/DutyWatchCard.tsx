import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { kssLabel, riskClasses } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { dutyDateLabel, dutyPeakKss, dutyRiskLevel, dutyRoute, dutyTimes } from './roster-utils';
import { RiskLabel, SeverityRule, TextAction } from './primitives';

interface DutyWatchCardProps {
  duty: DutyAnalysis;
  onDetails: (duty: DutyAnalysis) => void;
  onReportFatigue: (duty: DutyAnalysis) => void;
}

/**
 * One flagged duty as an editorial row: severity rule · date/route/times ·
 * reasons · predicted peak KSS as the headline figure · two text actions.
 */
export function DutyWatchCard({ duty, onDetails, onReportFatigue }: DutyWatchCardProps) {
  const level = dutyRiskLevel(duty);
  const rc = riskClasses(level);
  const kss = dutyPeakKss(duty);
  const times = dutyTimes(duty);
  const route = dutyRoute(duty);
  const date = dutyDateLabel(duty);
  const reasons = (duty.riskReasons ?? []).slice(0, 3);

  return (
    <article className="group flex gap-4 py-5 first:pt-4" data-testid="duty-watch-card">
      <SeverityRule level={level} />
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-1.5 md:col-start-1 md:row-start-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold">{date}</h3>
            <p className="text-[15px] text-foreground/90 break-words">{route}</p>
          </div>
          {times && (
            <p className="font-mono text-xs text-muted-foreground tabular">{times} <span className="font-sans">home-base time</span></p>
          )}
        </div>

        {kss != null && (
          <div className="flex items-center gap-4 md:col-start-2 md:row-span-2 md:row-start-1 md:flex-col md:items-end md:gap-1.5 md:text-right">
            <p className={cn('font-mono text-3xl font-medium leading-none tabular', rc.text)}>
              {kss.toFixed(1)}
              <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">KSS</span>
            </p>
            <div className="space-y-1 md:text-right">
              <RiskLabel level={level} />
              <p className="max-w-[14rem] text-xs text-muted-foreground">{kssLabel(kss)}</p>
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-2 md:col-start-1 md:row-start-2">
          {reasons.length > 0 && (
            <ul className="space-y-1 text-sm text-foreground/80" aria-label="Why this duty is flagged">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[9px] h-px w-3 flex-shrink-0 bg-muted-foreground/60" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="-ml-2 flex flex-wrap gap-1 pt-1">
            <TextAction onClick={() => onDetails(duty)} ariaLabel={`Details for duty on ${date}`}>
              Details
            </TextAction>
            <TextAction onClick={() => onReportFatigue(duty)} ariaLabel={`Report fatigue for duty on ${date}`} emphasis>
              Report fatigue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </TextAction>
          </div>
        </div>
      </div>
    </article>
  );
}
