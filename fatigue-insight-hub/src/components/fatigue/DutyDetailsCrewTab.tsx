import { AlertTriangle, Globe, Moon, Users, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DutyAnalysis } from '@/types/fatigue';
import { toast } from 'sonner';
import { CrewRestTimeline } from './CrewRestTimeline';

interface DutyDetailsCrewTabProps {
  duty: DutyAnalysis;
  globalCrewSet?: 'crew_a' | 'crew_b';
  dutyCrewOverride?: 'crew_a' | 'crew_b';
  onCrewChange?: (dutyId: string, crewSet: 'crew_a' | 'crew_b') => void;
}

/**
 * Crew & Compliance tab — only rendered for augmented/ULR duties.
 *
 * Composes:
 *  1. Crew Assignment toggle (A/B)
 *  2. ULR Compliance metrics
 *  3. CrewRestTimeline Gantt
 *  4. In-Flight Rest Periods
 */
export function DutyDetailsCrewTab({ duty, globalCrewSet, dutyCrewOverride, onCrewChange }: DutyDetailsCrewTabProps) {
  const effectiveCrewSet = dutyCrewOverride || globalCrewSet || 'crew_b';
  const hasOverride = !!dutyCrewOverride;

  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in">
      {/* 1. Crew Assignment */}
      {onCrewChange && duty.crewComposition === 'augmented_4' && (
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Crew Assignment
              <Badge variant="outline" className="text-[10px] capitalize">
                {duty.crewComposition.replace('_', ' ')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs text-muted-foreground">Your Crew Set for This Duty</Label>
            <div className="flex gap-2">
              <Button
                variant={effectiveCrewSet === 'crew_a' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  onCrewChange(duty.dutyId || '', 'crew_a');
                  toast.info('Crew set to A \u2014 re-run analysis to update metrics', { icon: <RefreshCw className="h-4 w-4" /> });
                }}
                className="flex-1 text-xs"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Crew A (Operating)
              </Button>
              <Button
                variant={effectiveCrewSet === 'crew_b' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  onCrewChange(duty.dutyId || '', 'crew_b');
                  toast.info('Crew set to B \u2014 re-run analysis to update metrics', { icon: <RefreshCw className="h-4 w-4" /> });
                }}
                className="flex-1 text-xs"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Crew B (Relief)
              </Button>
            </div>
            {hasOverride && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">CUSTOM</Badge>
                <span>Per-duty override (global: {globalCrewSet === 'crew_a' ? 'Crew A' : 'Crew B'})</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Select which crew set you'll fly as. Changes take effect on the next analysis run.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 2. ULR Compliance */}
      {duty.isUlr && duty.ulrCompliance && (
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-primary" />
              ULR Compliance
              {duty.ulrCompliance.violations.length > 0 ? (
                <Badge variant="critical">NON-COMPLIANT</Badge>
              ) : (
                <Badge variant="success">COMPLIANT</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Max Planned FDP</p>
                <p className="font-medium">{(duty.ulrCompliance.maxPlannedFdp ?? 0).toFixed(1)}h</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">FDP Within Limit</p>
                <Badge variant={duty.ulrCompliance.fdpWithinLimit ? 'success' : 'critical'}>
                  {duty.ulrCompliance.fdpWithinLimit ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Monthly ULR Count</p>
                <p className="font-medium">{duty.ulrCompliance.monthlyUlrCount} / {duty.ulrCompliance.monthlyLimit}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pre-ULR Rest</p>
                <Badge variant={duty.ulrCompliance.preUlrRestCompliant ? 'success' : 'critical'}>
                  {duty.ulrCompliance.preUlrRestCompliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Post-ULR Rest</p>
                <Badge variant={duty.ulrCompliance.postUlrRestCompliant ? 'success' : 'critical'}>
                  {duty.ulrCompliance.postUlrRestCompliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rest Periods Valid</p>
                <Badge variant={duty.ulrCompliance.restPeriodsValid ? 'success' : 'critical'}>
                  {duty.ulrCompliance.restPeriodsValid ? 'Valid' : 'Invalid'}
                </Badge>
              </div>
            </div>

            {/* Violations */}
            {duty.ulrCompliance.violations.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-critical/50 bg-critical/10 p-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-critical" />
                <div>
                  <p className="font-medium text-critical text-sm">Violations</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {duty.ulrCompliance.violations.map((v, i) => (
                      <li key={i}>- {v}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Warnings */}
            {duty.ulrCompliance.warnings.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-warning text-sm">Warnings</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {duty.ulrCompliance.warnings.map((w, i) => (
                      <li key={i}>- {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Crew Rest Timeline Gantt */}
      {duty.inflightRestBlocks && duty.inflightRestBlocks.length > 0 && (
        <CrewRestTimeline duty={duty} />
      )}

      {/* 4. In-Flight Rest Periods */}
      {duty.inflightRestBlocks && duty.inflightRestBlocks.length > 0 && (
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="h-4 w-4 text-chart-2" />
              In-Flight Rest Periods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {duty.inflightRestBlocks.map((block, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {block.startUtc.slice(11, 16)}Z - {block.endUtc.slice(11, 16)}Z
                    </span>
                    {block.isDuringWocl && (
                      <Badge variant="warning" className="text-[10px]">WOCL</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{(block.durationHours ?? 0).toFixed(1)}h</span>
                    <span className="font-medium">{(block.effectiveSleepHours ?? 0).toFixed(1)}h eff.</span>
                    {block.crewSet && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {block.crewSet.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
