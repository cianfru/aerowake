import { useState } from 'react';
import { AlertTriangle, Clock, Moon, Zap, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DutyAnalysis } from '@/types/fatigue';
import { PriorSleepIndicator } from './PriorSleepIndicator';
import { SleepRecoveryIndicator } from './SleepRecoveryIndicator';

interface DutyDetailsSleepTabProps {
  duty: DutyAnalysis;
}

/**
 * Sleep & Recovery tab — "What was my sleep situation?"
 *
 * Composes:
 *  1. PriorSleepIndicator (detailed)
 *  2. SleepRecoveryIndicator (detailed)
 *  3. Risk Assessment — risk badges, fatigue factors grid, SMS reportable
 *  4. Detailed Assessment (collapsible) — fatigue factors + recommendations
 */
export function DutyDetailsSleepTab({ duty }: DutyDetailsSleepTabProps) {
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return <Badge variant="success">LOW</Badge>;
      case 'MODERATE':
        return <Badge variant="warning">MODERATE</Badge>;
      case 'HIGH':
        return <Badge variant="high">HIGH</Badge>;
      case 'CRITICAL':
        return <Badge variant="critical">CRITICAL</Badge>;
      default:
        return <Badge variant="outline">{risk}</Badge>;
    }
  };

  const getRiskEmoji = (risk: string) => {
    switch (risk) {
      case 'LOW': return '\u{1F7E2}';
      case 'MODERATE': return '\u{1F7E1}';
      case 'HIGH': return '\u{1F7E0}';
      case 'CRITICAL': return '\u{1F534}';
      default: return '\u26AA';
    }
  };

  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in">
      {/* 1. Prior Sleep */}
      <PriorSleepIndicator duty={duty} variant="detailed" />

      {/* 2. Sleep Recovery */}
      {duty.sleepEstimate && (
        <SleepRecoveryIndicator duty={duty} variant="detailed" />
      )}

      {/* 3. Risk Assessment */}
      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Overall Risk</p>
              <div className="flex items-center gap-2">
                <span>{getRiskEmoji(duty.overallRisk)}</span>
                {getRiskBadge(duty.overallRisk)}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Min Perf. Risk</p>
              {getRiskBadge(duty.minPerformanceRisk)}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Landing Risk</p>
              {getRiskBadge(duty.landingRisk)}
            </div>
          </div>

          {/* Fatigue factors summary */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs">
                <span className="text-muted-foreground">Sleep Debt: </span>
                <span className={`font-medium ${(duty.sleepDebt ?? 0) > 5 ? 'text-critical' : (duty.sleepDebt ?? 0) > 3 ? 'text-warning' : 'text-foreground'}`}>
                  {(duty.sleepDebt ?? 0).toFixed(1)}h
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs">
                <span className="text-muted-foreground">WOCL: </span>
                <span className={`font-medium ${(duty.woclExposure ?? 0) > 2 ? 'text-critical' : (duty.woclExposure ?? 0) > 1 ? 'text-warning' : 'text-foreground'}`}>
                  {(duty.woclExposure ?? 0).toFixed(1)}h
                </span>
              </div>
            </div>
            {duty.returnToDeckPerformance != null && (
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="text-xs">
                  <span className="text-muted-foreground">Return to Deck: </span>
                  <span className={`font-medium ${(duty.returnToDeckPerformance ?? 0) < 60 ? 'text-critical' : (duty.returnToDeckPerformance ?? 0) < 70 ? 'text-warning' : 'text-foreground'}`}>
                    {(duty.returnToDeckPerformance ?? 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            {(duty.preDutyAwakeHours ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="text-xs">
                  <span className="text-muted-foreground">Awake Pre-Duty: </span>
                  <span className={`font-medium ${(duty.preDutyAwakeHours ?? 0) > 17 ? 'text-critical' : (duty.preDutyAwakeHours ?? 0) > 14 ? 'text-warning' : 'text-foreground'}`}>
                    {(duty.preDutyAwakeHours ?? 0).toFixed(1)}h
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SMS Reportable Warning */}
          {duty.smsReportable && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
              <div>
                <p className="font-medium text-warning text-sm">SMS Reportable</p>
                <p className="text-xs text-muted-foreground">
                  File fatigue report per EASA ORO.FTL.120
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Detailed Assessment (Collapsible) */}
      <Collapsible open={assessmentOpen} onOpenChange={setAssessmentOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-secondary/50 p-3 text-sm hover:bg-secondary/60">
          <span className="flex items-center gap-2">
            Detailed Assessment & Recommendations
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${assessmentOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="space-y-3 rounded-lg bg-secondary/40 p-4 text-sm">
            <div>
              <h5 className="mb-1 font-medium">Fatigue Factors</h5>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {(duty.woclExposure ?? 0) > 0 && (
                  <li>Window of Circadian Low (WOCL) exposure: {(duty.woclExposure ?? 0).toFixed(1)}h</li>
                )}
                {(duty.sleepDebt ?? 0) > 3 && (
                  <li>Elevated sleep debt: {(duty.sleepDebt ?? 0).toFixed(1)}h accumulated</li>
                )}
                {(duty.priorSleep ?? 0) < 24 && (
                  <li>Limited prior sleep opportunity: {(duty.priorSleep ?? 0).toFixed(1)}h</li>
                )}
              </ul>
            </div>
            <div>
              <h5 className="mb-1 font-medium">Recommendations</h5>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {duty.overallRisk === 'CRITICAL' && (
                  <>
                    <li>Consider controlled rest if operationally feasible</li>
                    <li>Enhanced crew monitoring during critical phases</li>
                    <li>File SMS fatigue report</li>
                  </>
                )}
                {duty.overallRisk === 'HIGH' && (
                  <>
                    <li>Maximize rest opportunities</li>
                    <li>Consider caffeine strategically</li>
                  </>
                )}
                {duty.overallRisk === 'MODERATE' && (
                  <li>Maintain awareness of fatigue symptoms</li>
                )}
                {duty.overallRisk === 'LOW' && (
                  <li>Normal operations - no special mitigations required</li>
                )}
              </ul>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
