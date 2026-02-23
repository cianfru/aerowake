import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnalysisResults, DutyAnalysis, DutyModification } from '@/types/fatigue';

interface DutyComparisonTableProps {
  original: AnalysisResults;
  whatIf: AnalysisResults;
  modifications: Map<string, DutyModification>;
}

function getRiskVariant(risk: string): 'success' | 'warning' | 'high' | 'critical' {
  switch (risk) {
    case 'LOW': return 'success';
    case 'MODERATE': return 'warning';
    case 'HIGH': return 'high';
    case 'CRITICAL': return 'critical';
    default: return 'success';
  }
}

function DeltaCell({
  original,
  whatIf,
  format,
  higherIsBetter = true,
}: {
  original: number;
  whatIf: number;
  format: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const delta = whatIf - original;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const worsened = higherIsBetter ? delta < 0 : delta > 0;

  return (
    <div className="text-right">
      <span className="font-mono text-xs">{format(whatIf)}</span>
      {delta !== 0 && (
        <span
          className={`ml-1 text-[9px] font-mono ${
            improved ? 'text-green-400' : worsened ? 'text-red-400' : 'text-muted-foreground'
          }`}
        >
          ({delta > 0 ? '+' : ''}{format(delta)})
        </span>
      )}
    </div>
  );
}

function getRoute(duty: DutyAnalysis): string {
  if (!duty.flightSegments || duty.flightSegments.length === 0) return '—';
  const first = duty.flightSegments[0];
  const last = duty.flightSegments[duty.flightSegments.length - 1];
  return `${first.departure}→${last.arrival}`;
}

export function DutyComparisonTable({
  original,
  whatIf,
  modifications,
}: DutyComparisonTableProps) {
  const rows = useMemo(() => {
    const whatIfMap = new Map(whatIf.duties.map((d) => [d.dutyId, d]));

    return original.duties
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((origDuty) => {
        const dutyId = origDuty.dutyId || '';
        const mod = modifications.get(dutyId);
        const whatIfDuty = whatIfMap.get(dutyId);
        const isExcluded = mod?.excluded ?? false;
        const isModified = !!mod && !mod.excluded;

        return {
          origDuty,
          whatIfDuty,
          isExcluded,
          isModified,
          dutyId,
        };
      });
  }, [original.duties, whatIf.duties, modifications]);

  const pct = (v: number) => `${v.toFixed(1)}%`;
  const hrs = (v: number) => `${v.toFixed(1)}h`;

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Per-Duty Comparison</CardTitle>
        <p className="text-xs text-muted-foreground">
          Duty-by-duty metric changes — highlighted rows have modifications
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-2 py-2 font-medium">Route</th>
                <th className="text-right px-2 py-2 font-medium">Min Perf</th>
                <th className="text-right px-2 py-2 font-medium">Landing</th>
                <th className="text-right px-2 py-2 font-medium">Sleep Debt</th>
                <th className="text-center px-2 py-2 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {rows.map(({ origDuty, whatIfDuty, isExcluded, isModified, dutyId }) => (
                <tr
                  key={dutyId}
                  className={`
                    ${isExcluded ? 'opacity-40 line-through' : ''}
                    ${isModified ? 'bg-warning/5' : ''}
                    hover:bg-secondary/20 transition-colors
                  `}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium">
                      {origDuty.dateString || new Date(origDuty.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="text-muted-foreground ml-1">{origDuty.dayOfWeek?.slice(0, 3)}</span>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                    {getRoute(origDuty)}
                  </td>
                  <td className="px-2 py-2">
                    {isExcluded ? (
                      <span className="text-right block text-muted-foreground">—</span>
                    ) : whatIfDuty ? (
                      <DeltaCell
                        original={origDuty.minPerformance}
                        whatIf={whatIfDuty.minPerformance}
                        format={pct}
                        higherIsBetter
                      />
                    ) : (
                      <span className="text-right block font-mono">{pct(origDuty.minPerformance)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isExcluded ? (
                      <span className="text-right block text-muted-foreground">—</span>
                    ) : whatIfDuty ? (
                      <DeltaCell
                        original={origDuty.landingPerformance}
                        whatIf={whatIfDuty.landingPerformance}
                        format={pct}
                        higherIsBetter
                      />
                    ) : (
                      <span className="text-right block font-mono">{pct(origDuty.landingPerformance)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isExcluded ? (
                      <span className="text-right block text-muted-foreground">—</span>
                    ) : whatIfDuty ? (
                      <DeltaCell
                        original={origDuty.sleepDebt}
                        whatIf={whatIfDuty.sleepDebt}
                        format={hrs}
                        higherIsBetter={false}
                      />
                    ) : (
                      <span className="text-right block font-mono">{hrs(origDuty.sleepDebt)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isExcluded ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        {whatIfDuty && whatIfDuty.overallRisk !== origDuty.overallRisk ? (
                          <>
                            <Badge variant={getRiskVariant(origDuty.overallRisk)} className="text-[8px] px-1 py-0 opacity-50">
                              {origDuty.overallRisk}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">→</span>
                            <Badge variant={getRiskVariant(whatIfDuty.overallRisk)} className="text-[8px] px-1 py-0">
                              {whatIfDuty.overallRisk}
                            </Badge>
                          </>
                        ) : (
                          <Badge variant={getRiskVariant(origDuty.overallRisk)} className="text-[8px] px-1 py-0">
                            {origDuty.overallRisk}
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
