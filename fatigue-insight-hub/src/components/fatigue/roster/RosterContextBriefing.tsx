import { ArrowUpRight } from 'lucide-react';
import { FATIGUE_INFO, InfoTooltip } from '@/components/ui/InfoTooltip';
import type { AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { rosterContext } from './overview-context';

export function RosterContextBriefing({ results, onDetails, onView }: {
  results: AnalysisResults;
  onDetails: (duty: DutyAnalysis) => void;
  onView: (view: 'calendar' | 'recovery' | 'limits') => void;
}) {
  const context = rosterContext(results);
  const hasPlannedSleep = results.sleepEdits?.some(edit => edit.applied)
    || results.duties.some(duty => duty.sleepEstimate?.isUserOverride)
    || results.restDaysSleep?.some(day => day.isUserOverride);
  const actionClass = 'inline-flex min-h-11 items-center gap-1 rounded-md text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-3" aria-label="Roster context to review">
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">Sleep &amp; body clock <InfoTooltip entry={FATIGUE_INFO.wocl} /></p>
      <p className="text-sm font-medium">{context.woclDuties.length} {context.woclDuties.length === 1 ? 'duty overlaps' : 'duties overlap'} the body-clock low</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{context.highestShortfall
        ? <>Highest estimated 7-day sleep shortfall: {context.highestShortfall.sleepDeficit7d!.deficitHours.toFixed(1)}h. <InfoTooltip entry={FATIGUE_INFO.sleepDeficit7d} /></>
        : 'The sleep assumptions behind your forecast can be reviewed and adjusted.'}</p>
      <button type="button" className={actionClass} onClick={() => onView('recovery')}>Review sleep &amp; recovery <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
    </div>
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">Inputs &amp; history</p>
      <p className="text-sm font-medium">{context.inferredCrew.length
        ? `${context.inferredCrew.length} ${context.inferredCrew.length === 1 ? 'crew assumption' : 'crew assumptions'} to confirm`
        : hasPlannedSleep ? 'Includes your planned sleep changes' : 'Roster times · estimated sleep'}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{results.continuityFromMonth
        ? `Model state carried from ${results.continuityFromMonth}; sleep inputs remain estimates or plans.`
        : 'Starting sleep and body-clock state are assumed; no preceding roster is linked.'}</p>
      <button type="button" className={actionClass} onClick={() => context.inferredCrew[0] ? onDetails(context.inferredCrew[0]) : onView('calendar')}>
        {context.inferredCrew.length ? 'Confirm first crew assumption' : 'Review calendar inputs'} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">Flight-time limitations</p>
      <p className="text-sm font-medium">{context.warnings.length
        ? `${context.warnings.length} ${context.warnings.length === 1 ? 'finding' : 'findings'} to review`
        : context.unavailable ? 'Checks unavailable' : 'No findings in supplied activities'}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{!context.coverageKnown
        ? 'Check coverage is unavailable; this is not a compliance assessment.'
        : context.incompleteChecks
          ? `${context.incompleteChecks} ${context.incompleteChecks === 1 ? 'check is' : 'checks are'} incomplete or not assessed. Operator approvals still need verification.`
          : 'Checks cover supplied activities only. Operator approvals still need verification.'}</p>
      <button type="button" className={actionClass} onClick={() => onView('limits')}>Review findings &amp; coverage <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
    </div>
  </div>;
}
