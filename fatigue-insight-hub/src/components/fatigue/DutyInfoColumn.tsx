import { useState } from 'react';
import { AlertTriangle, Clock, Moon, Zap, Mountain, Users, Globe, RefreshCw, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DutyAnalysis } from '@/types/fatigue';
import { isTrainingDuty, getTrainingDutyLabel, formatAircraftType } from '@/lib/fatigue-utils';
import { FDPUtilizationBar } from './FDPUtilizationBar';
import { PriorSleepIndicator } from './PriorSleepIndicator';
import { SleepRecoveryIndicator } from './SleepRecoveryIndicator';
import { CrewRestTimeline } from './CrewRestTimeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DutyInfoColumnProps {
  duty: DutyAnalysis;
  globalCrewSet?: 'crew_a' | 'crew_b';
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
  hasCrewContent: boolean;
}

/**
 * Left column of the DutyDetailsDialog — duty context, FDP, sleep, risk, crew.
 */
export function DutyInfoColumn({ duty, globalCrewSet, dutyCrewOverride, onCrewChange, hasCrewContent }: DutyInfoColumnProps) {
  const isTraining = isTrainingDuty(duty);
  const [crewOpen, setCrewOpen] = useState(false);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW': return <Badge variant="success" className="text-[10px]">LOW</Badge>;
      case 'MODERATE': return <Badge variant="warning" className="text-[10px]">MODERATE</Badge>;
      case 'HIGH': return <Badge variant="high" className="text-[10px]">HIGH</Badge>;
      case 'CRITICAL': return <Badge variant="critical" className="text-[10px]">CRITICAL</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{risk}</Badge>;
    }
  };

  const formatOffset = (offset: number | null | undefined): string => {
    if (offset === null || offset === undefined) return '';
    const sign = offset >= 0 ? '+' : '';
    return `UTC${sign}${offset}`;
  };

  return (
    <div className="space-y-3">
      {/* 1. Flight Segments */}
      <Card variant="glass">
        <CardContent className="py-3 px-4 space-y-2">
          {isTraining ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info" className="text-[10px]">{getTrainingDutyLabel(duty.dutyType!)}</Badge>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                {duty.trainingCode}
              </span>
              <span className="text-xs text-muted-foreground">
                {duty.reportTimeLocal} — {duty.releaseTimeLocal}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(duty.flightSegments ?? []).map((seg, i) => {
                const isDH = seg.activityCode === 'DH';
                const isIR = seg.activityCode === 'IR';
                const depTime = seg.departureTimeAirportLocal || seg.departureTime;
                const arrTime = seg.arrivalTimeAirportLocal || seg.arrivalTime;

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 flex-wrap rounded-lg px-3 py-1.5 text-xs border',
                      isDH ? 'bg-muted/40 border-border/50 opacity-70' :
                      isIR ? 'bg-blue-500/5 border-blue-500/20' :
                      'bg-secondary/40 border-border/50'
                    )}
                  >
                    <span className="font-mono font-semibold text-primary">{seg.flightNumber}</span>

                    {(isDH || isIR) && (
                      <span className={cn(
                        'text-[9px] font-semibold px-1 py-0.5 rounded',
                        isDH ? 'bg-muted text-muted-foreground' : 'bg-blue-500/15 text-blue-400'
                      )}>
                        {isDH ? 'DH' : 'IR'}
                      </span>
                    )}

                    <span className="font-medium">{seg.departure} → {seg.arrival}</span>

                    {seg.aircraftType && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium">
                        {formatAircraftType(seg.aircraftType)}
                      </Badge>
                    )}

                    <span className="text-muted-foreground">
                      {depTime}
                      {seg.departureUtcOffset != null && (
                        <span className="text-[8px] text-muted-foreground ml-0.5">({formatOffset(seg.departureUtcOffset)})</span>
                      )}
                      {' → '}
                      {arrTime}
                      {seg.arrivalUtcOffset != null && (
                        <span className="text-[8px] text-muted-foreground ml-0.5">({formatOffset(seg.arrivalUtcOffset)})</span>
                      )}
                    </span>
                  </div>
                );
              })}

              {/* Cabin altitude (duty-level, inferred from aircraft type) */}
              {!isTraining && duty.cabinAltitudeFt && duty.cabinAltitudeFt > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
                  <Mountain className="h-3 w-3" />
                  <span>Cabin Altitude: <span className="font-medium text-foreground">{duty.cabinAltitudeFt.toLocaleString()} ft</span></span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. FDP Utilization Bar (full, prominent) */}
      {!isTraining && duty.maxFdpHours != null && duty.maxFdpHours > 0 && (
        <FDPUtilizationBar
          actualFdpHours={duty.actualFdpHours ?? duty.dutyHours ?? 0}
          maxFdpHours={duty.maxFdpHours}
          extendedFdpHours={duty.extendedFdpHours}
          usedDiscretion={duty.usedDiscretion}
        />
      )}

      {/* 3. Sleep & Risk Panel */}
      <Card variant="glass">
        <CardContent className="py-3 px-4 space-y-3">
          {/* Sleep indicators row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Prior Sleep</p>
              <PriorSleepIndicator duty={duty} variant="compact" />
            </div>
            {duty.sleepEstimate && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Recovery</p>
                <SleepRecoveryIndicator duty={duty} variant="compact" />
              </div>
            )}
          </div>

          {/* Risk grid */}
          <div className="border-t border-border/50 pt-2">
            <div className="flex items-center gap-2 mb-2">
              {getRiskBadge(duty.overallRisk)}
              {getRiskBadge(duty.minPerformanceRisk)}
              {getRiskBadge(duty.landingRisk)}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Sleep Debt</span>
                <span className={cn('font-medium ml-auto',
                  (duty.sleepDebt ?? 0) > 5 ? 'text-critical' : (duty.sleepDebt ?? 0) > 3 ? 'text-warning' : 'text-foreground'
                )}>
                  {(duty.sleepDebt ?? 0).toFixed(1)}h
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Moon className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">WOCL</span>
                <span className={cn('font-medium ml-auto',
                  (duty.woclExposure ?? 0) > 2 ? 'text-critical' : (duty.woclExposure ?? 0) > 1 ? 'text-warning' : 'text-foreground'
                )}>
                  {(duty.woclExposure ?? 0).toFixed(1)}h
                </span>
              </div>
              {(duty.preDutyAwakeHours ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Awake</span>
                  <span className={cn('font-medium ml-auto',
                    (duty.preDutyAwakeHours ?? 0) > 17 ? 'text-critical' : (duty.preDutyAwakeHours ?? 0) > 14 ? 'text-warning' : 'text-foreground'
                  )}>
                    {(duty.preDutyAwakeHours ?? 0).toFixed(1)}h
                  </span>
                </div>
              )}
              {duty.returnToDeckPerformance != null && (
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">RTD</span>
                  <span className={cn('font-medium ml-auto',
                    (duty.returnToDeckPerformance ?? 0) < 60 ? 'text-critical' : (duty.returnToDeckPerformance ?? 0) < 70 ? 'text-warning' : 'text-foreground'
                  )}>
                    {(duty.returnToDeckPerformance ?? 0).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Reportable */}
      {duty.smsReportable && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium">SMS Reportable — File fatigue report per EASA ORO.FTL.120</span>
        </div>
      )}

      {/* 4. Crew & Compliance (collapsible) */}
      {hasCrewContent && (
        <Collapsible open={crewOpen} onOpenChange={setCrewOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-secondary/50 p-2.5 text-xs font-medium hover:bg-secondary/60 transition-colors">
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              Crew & Compliance
              {duty.crewComposition && (
                <Badge variant="outline" className="text-[9px] capitalize">
                  {duty.crewComposition.replace('_', ' ')}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', crewOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {/* Crew toggle */}
            {onCrewChange && duty.crewComposition === 'augmented_4' && (
              <Card variant="glass">
                <CardContent className="py-2.5 px-3 space-y-2">
                  <Label className="text-[10px] text-muted-foreground">Crew Set</Label>
                  <div className="flex gap-2">
                    {(['crew_a', 'crew_b'] as const).map(cs => (
                      <Button
                        key={cs}
                        variant={(dutyCrewOverride || globalCrewSet || 'crew_b') === cs ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          onCrewChange(duty.dutyId || '', cs);
                          toast.info(`Crew set to ${cs === 'crew_a' ? 'A' : 'B'}`, { icon: <RefreshCw className="h-4 w-4" /> });
                        }}
                        className="flex-1 text-[10px] h-7"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {cs === 'crew_a' ? 'A (Operating)' : 'B (Relief)'}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ULR compliance */}
            {duty.isUlr && duty.ulrCompliance && (
              <Card variant="glass">
                <CardHeader className="pb-2 px-3 pt-2.5">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    ULR Compliance
                    {duty.ulrCompliance.violations.length > 0 ? (
                      <Badge variant="critical" className="text-[9px]">NON-COMPLIANT</Badge>
                    ) : (
                      <Badge variant="success" className="text-[9px]">COMPLIANT</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">Max FDP</span>
                      <p className="font-medium">{(duty.ulrCompliance.maxPlannedFdp ?? 0).toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monthly ULR</span>
                      <p className="font-medium">{duty.ulrCompliance.monthlyUlrCount}/{duty.ulrCompliance.monthlyLimit}</p>
                    </div>
                  </div>
                  {duty.ulrCompliance.violations.length > 0 && (
                    <div className="flex items-start gap-2 rounded border border-critical/50 bg-critical/10 p-2 text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-critical mt-0.5" />
                      <ul className="space-y-0.5 text-muted-foreground">
                        {duty.ulrCompliance.violations.map((v, i) => <li key={i}>- {v}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Crew rest timeline + in-flight rest */}
            {duty.inflightRestBlocks && duty.inflightRestBlocks.length > 0 && (
              <>
                <CrewRestTimeline duty={duty} />
                <Card variant="glass">
                  <CardContent className="py-2.5 px-3">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5">In-Flight Rest</p>
                    <div className="space-y-1">
                      {duty.inflightRestBlocks.map((block, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-secondary/50 px-2 py-1 text-[11px]">
                          <span className="font-mono text-muted-foreground">
                            {block.startUtc.slice(11, 16)}Z — {block.endUtc.slice(11, 16)}Z
                          </span>
                          <div className="flex items-center gap-2">
                            {block.isDuringWocl && <Badge variant="warning" className="text-[9px]">WOCL</Badge>}
                            <span className="text-muted-foreground">{(block.durationHours ?? 0).toFixed(1)}h</span>
                            <span className="font-medium">{(block.effectiveSleepHours ?? 0).toFixed(1)}h eff.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
