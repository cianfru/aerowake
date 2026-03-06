import { useState } from 'react';
import { AlertTriangle, Clock, Moon, Zap, Mountain, Users, Globe, ChevronDown, BedDouble, Home, Building2, Sun, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DutyAnalysis } from '@/types/fatigue';
import { isTrainingDuty, getTrainingDutyLabel, formatAircraftType } from '@/lib/fatigue-utils';
import { FDPUtilizationBar } from './FDPUtilizationBar';
import { SleepQualityInfo } from './SleepQualityInfo';
import { CrewRestTimeline } from './CrewRestTimeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STRATEGY_LABELS: Record<string, string> = {
  normal: 'Normal',
  anchor: 'Anchor Sleep',
  split: 'Split Sleep',
  early_bedtime: 'Early Bedtime',
  restricted: 'Restricted',
  extended: 'Extended',
  recovery: 'Recovery',
  nap: 'Night Departure',
  afternoon_nap: 'Afternoon Nap',
  augmented_4_sleep: 'ULR (4-Crew)',
  augmented_3: 'Augmented (3-Crew)',
  wocl_duty: 'WOCL Duty',
  inter_duty_recovery: 'Inter-Duty Recovery',
  post_duty_recovery: 'Post-Duty Recovery',
};

interface DutyInfoColumnProps {
  duty: DutyAnalysis;
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
  onCrewReset?: (dutyId: string) => void;
  hasCrewContent: boolean;
}

/**
 * Left column of the DutyDetailsDialog — duty context, FDP, sleep, risk, crew.
 */
export function DutyInfoColumn({ duty, dutyCrewOverride, onCrewChange, onCrewReset, hasCrewContent }: DutyInfoColumnProps) {
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
      <div className="rounded-2xl glass p-4 space-y-2">
        {isTraining ? (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="info" className="text-[10px]">{getTrainingDutyLabel(duty.dutyType!)}</Badge>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted/60">
              {duty.trainingCode}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
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
                    'flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 text-xs border transition-colors',
                    isDH ? 'bg-muted/30 border-border/30 opacity-70' :
                    isIR ? 'bg-blue-500/5 border-blue-500/15' :
                    'bg-secondary/30 border-border/30 hover:bg-secondary/40'
                  )}
                >
                  <span className="font-mono font-bold text-primary tracking-wide">{seg.flightNumber}</span>

                  {(isDH || isIR) && (
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-md',
                      isDH ? 'bg-muted/60 text-muted-foreground' : 'bg-blue-500/15 text-blue-400'
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

                  <span className="text-muted-foreground font-mono">
                    {depTime}
                    {seg.departureUtcOffset != null && (
                      <span className="text-[8px] text-muted-foreground/60 ml-0.5">({formatOffset(seg.departureUtcOffset)})</span>
                    )}
                    {' → '}
                    {arrTime}
                    {seg.arrivalUtcOffset != null && (
                      <span className="text-[8px] text-muted-foreground/60 ml-0.5">({formatOffset(seg.arrivalUtcOffset)})</span>
                    )}
                  </span>
                </div>
              );
            })}

            {/* Cabin altitude */}
            {!isTraining && duty.cabinAltitudeFt && duty.cabinAltitudeFt > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
                <Mountain className="h-3 w-3" />
                <span>Cabin Altitude: <span className="font-medium font-mono text-foreground">{duty.cabinAltitudeFt.toLocaleString()} ft</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. FDP Utilization Bar */}
      {!isTraining && duty.maxFdpHours != null && duty.maxFdpHours > 0 && (
        <FDPUtilizationBar
          actualFdpHours={duty.actualFdpHours ?? duty.dutyHours ?? 0}
          maxFdpHours={duty.maxFdpHours}
          extendedFdpHours={duty.extendedFdpHours}
          usedDiscretion={duty.usedDiscretion}
        />
      )}

      {/* 3. Sleep & Risk Panel */}
      <div className="rounded-2xl glass p-4 space-y-4">
        {/* Pre-Duty Rest */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-transparent" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Pre-Duty Rest</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
              duty.priorSleep >= 7 ? 'bg-success/10 text-success' :
              duty.priorSleep >= 5 ? 'bg-warning/10 text-warning' :
              'bg-critical/10 text-critical',
            )}>
              <BedDouble className="h-3 w-3" />
              <span className="font-medium font-mono">{duty.priorSleep.toFixed(0)}h sleep</span>
            </div>
            <span className="flex items-center gap-1 text-muted-foreground">
              {duty.sleepEnvironment === 'hotel' || duty.sleepEnvironment === 'layover' ? (
                <><Building2 className="h-3 w-3" /> Layover</>
              ) : (
                <><Home className="h-3 w-3" /> Home</>
              )}
            </span>
            {(duty.preDutyAwakeHours ?? 0) > 0 && (
              <span className={cn(
                'flex items-center gap-1',
                (duty.preDutyAwakeHours ?? 0) > 17 ? 'text-critical' :
                (duty.preDutyAwakeHours ?? 0) > 14 ? 'text-warning' :
                'text-muted-foreground',
              )}>
                <Sun className="h-3 w-3" />
                <span className="font-mono">{(duty.preDutyAwakeHours ?? 0).toFixed(1)}h</span> awake
              </span>
            )}
          </div>
          {/* Sleep bar */}
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-out',
                  duty.priorSleep >= 7 ? 'bg-success' :
                  duty.priorSleep >= 5 ? 'bg-warning' :
                  'bg-critical',
                )}
                style={{ width: `${Math.min(100, (duty.priorSleep / 8) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground/70 font-mono">
              {duty.priorSleep.toFixed(0)}h / 8h recommended
            </p>
          </div>
          {/* Strategy explanation */}
          {duty.sleepEstimate && (
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                <Tag className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">
                    {STRATEGY_LABELS[duty.sleepEstimate.sleepStrategy] ?? duty.sleepEstimate.sleepStrategy}
                  </span>
                  {duty.sleepEstimate.explanation && (
                    <> — {duty.sleepEstimate.explanation}</>
                  )}
                </p>
              </div>
              <SleepQualityInfo
                variant="badge"
                explanation={duty.sleepEstimate.explanation}
                confidence={duty.sleepEstimate.confidence}
                confidenceBasis={duty.sleepEstimate.confidenceBasis}
                qualityFactors={duty.sleepEstimate.qualityFactors}
                references={duty.sleepEstimate.references}
              />
            </div>
          )}
        </div>

        {/* Fatigue Factors */}
        <div className="border-t border-border/30 pt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Fatigue Factors</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>
          <div className="space-y-2">
            <FactorBar
              icon={<Clock className="h-3 w-3" />}
              label="Sleep Debt"
              value={duty.sleepDebt ?? 0}
              unit="h"
              max={8}
              warnAt={3}
              critAt={5}
            />
            <FactorBar
              icon={<Moon className="h-3 w-3" />}
              label="WOCL Exposure"
              value={duty.woclExposure ?? 0}
              unit="h"
              max={4}
              warnAt={1}
              critAt={2}
            />
            {duty.returnToDeckPerformance != null && (
              <div className="flex items-center gap-2 text-xs">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground w-20 truncate">RTD Perf</span>
                <div className="flex-1" />
                <span className={cn('font-bold font-mono',
                  duty.returnToDeckPerformance < 60 ? 'text-critical' :
                  duty.returnToDeckPerformance < 70 ? 'text-warning' : 'text-foreground'
                )}>
                  {duty.returnToDeckPerformance.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="border-t border-border/30 pt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Risk Assessment</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RiskCell label="Overall" badge={getRiskBadge(duty.overallRisk)} />
            <RiskCell label="Min Perf" badge={getRiskBadge(duty.minPerformanceRisk)} />
            <RiskCell label="Landing" badge={getRiskBadge(duty.landingRisk)} />
          </div>
        </div>
      </div>

      {/* 4. Crew & Compliance (collapsible) */}
      {hasCrewContent && (
        <Collapsible open={crewOpen} onOpenChange={setCrewOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl bg-secondary/30 border border-border/25 p-3 text-xs font-medium hover:bg-secondary/40 transition-colors">
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              Crew & Compliance
              {duty.crewComposition && (
                <Badge variant="outline" className="text-[9px] capitalize">
                  {duty.crewComposition.replace('_', ' ')}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', crewOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {/* Crew toggle */}
            {onCrewChange && duty.crewComposition === 'augmented_4' && (() => {
              const autoDetected = duty.ulrCrewSet || 'crew_b';
              const effective = dutyCrewOverride || autoDetected;
              const hasOvr = !!dutyCrewOverride;
              return (
                <div className="rounded-xl glass p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Crew</span>
                    <div className="inline-flex rounded-lg bg-secondary/50 p-0.5">
                      {(['crew_a', 'crew_b'] as const).map(cs => (
                        <button
                          key={cs}
                          onClick={() => {
                            onCrewChange(duty.dutyId || '', cs);
                            toast.info(`Crew ${cs === 'crew_a' ? 'A' : 'B'} — re-run to update`);
                          }}
                          className={cn(
                            'px-2.5 py-0.5 text-[10px] font-medium rounded-md transition-all',
                            effective === cs
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {cs === 'crew_a' ? 'A' : 'B'}
                        </button>
                      ))}
                    </div>
                    {hasOvr ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[8px] px-1 py-0">OVERRIDE</Badge>
                        {onCrewReset && (
                          <button
                            onClick={() => {
                              onCrewReset(duty.dutyId || '');
                              toast.info(`Reset to auto: Crew ${autoDetected === 'crew_a' ? 'A' : 'B'}`);
                            }}
                            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">Auto</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ULR compliance */}
            {duty.isUlr && duty.ulrCompliance && (
              <Card variant="glass" className="rounded-xl">
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
                      <p className="font-medium font-mono">{(duty.ulrCompliance.maxPlannedFdp ?? 0).toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monthly ULR</span>
                      <p className="font-medium font-mono">{duty.ulrCompliance.monthlyUlrCount}/{duty.ulrCompliance.monthlyLimit}</p>
                    </div>
                  </div>
                  {duty.ulrCompliance.violations.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 p-2 text-[11px]">
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
                <div className="rounded-xl glass p-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">In-Flight Rest</p>
                  <div className="space-y-1">
                    {duty.inflightRestBlocks.map((block, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/30 px-2.5 py-1.5 text-[11px]">
                        <span className="font-mono text-muted-foreground">
                          {block.startUtc.slice(11, 16)}Z — {block.endUtc.slice(11, 16)}Z
                        </span>
                        <div className="flex items-center gap-2">
                          {block.isDuringWocl && <Badge variant="warning" className="text-[9px]">WOCL</Badge>}
                          <span className="text-muted-foreground font-mono">{(block.durationHours ?? 0).toFixed(1)}h</span>
                          <span className="font-medium font-mono">{(block.effectiveSleepHours ?? 0).toFixed(1)}h eff.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskCell({ label, badge }: { label: string; badge: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-secondary/20 py-2 px-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      {badge}
    </div>
  );
}

function FactorBar({
  icon,
  label,
  value,
  unit,
  max,
  warnAt,
  critAt,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  max: number;
  warnAt: number;
  critAt: number;
}) {
  const color = value >= critAt ? 'critical' : value >= warnAt ? 'warning' : 'success';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-20 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            color === 'success' && 'bg-success',
            color === 'warning' && 'bg-warning',
            color === 'critical' && 'bg-critical',
          )}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
      <span className={cn(
        'font-mono font-bold w-10 text-right tabular-nums',
        color === 'critical' && 'text-critical',
        color === 'warning' && 'text-warning',
        color === 'success' && 'text-foreground',
      )}>
        {value.toFixed(1)}{unit}
      </span>
    </div>
  );
}
