import { ArrowRight, Users } from 'lucide-react';
import { crewLabel } from '@/lib/crew';
import { cn } from '@/lib/utils';
import { riskClasses } from '@/lib/risk-scale';
import type { DutyAnalysis } from '@/types/fatigue';
import { dutyDateLabel, dutyPeakKss, dutyRiskLevel, dutyRoute, dutyTimes } from './roster-utils';
import { RiskLabel, SeverityRule, TextAction } from './primitives';
import { DutyDebriefAction } from '@/components/fatigue/debrief/DutyDebriefAction';
import { useAnalysis } from '@/contexts/AnalysisContext';

interface DutyWatchCardProps {
  duty: DutyAnalysis;
  onDetails: (duty: DutyAnalysis) => void;
  onReportFatigue: (duty: DutyAnalysis) => void;
  /** Reasons already stated once for the card's band group. */
  sharedReasons?: ReadonlySet<string>;
}

/**
 * One flagged duty as an editorial row: severity rule · date/route/times ·
 * what sets it apart · predicted peak KSS as the headline figure · two text
 * actions. The band's verbal anchor and shared reasons live in the group header.
 */
export function DutyWatchCard({ duty, onDetails, onReportFatigue, sharedReasons }: DutyWatchCardProps) {
  const analysisId = useAnalysis().state.analysisResults?.analysisId;
  const level = dutyRiskLevel(duty);
  const rc = riskClasses(level);
  const kss = dutyPeakKss(duty);
  const times = dutyTimes(duty);
  const route = dutyRoute(duty);
  const date = dutyDateLabel(duty);
  const crew = crewLabel(duty);
  const reasons = (duty.riskReasons ?? []).filter((r) => !sharedReasons?.has(r)).slice(0, 3);

  return (
    <article className="duty-watch-surface group flex gap-4" data-testid="duty-watch-card">
      <SeverityRule level={level} />
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-1.5 md:col-start-1 md:row-start-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold">{date}</h3>
            <p className="text-base text-foreground/90 break-words">{route}</p>
            {crew && <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground/80"><Users className="h-3 w-3" aria-hidden="true" />{crew}</span>}
          </div>
          {times && (
            <p className="font-mono text-xs text-muted-foreground tabular">{times} <span className="font-sans">home-base time</span></p>
          )}
        </div>

        {kss != null && (
          <div className="flex items-center gap-4 md:col-start-2 md:row-span-2 md:row-start-1 md:flex-col md:items-end md:gap-1.5 md:text-right">
            <p className={cn('text-[32px] font-semibold tracking-tight leading-none tabular', rc.text)}>
              {kss.toFixed(1)}
              <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">KSS</span>
            </p>
            <RiskLabel level={level} />
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
            <DutyDebriefAction duty={duty} analysisId={analysisId} />
          </div>
        </div>
      </div>
    </article>
  );
}
