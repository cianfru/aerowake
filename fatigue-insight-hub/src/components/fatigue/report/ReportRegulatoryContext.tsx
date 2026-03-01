import { Scale, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DutyAnalysis } from '@/types/fatigue';

interface Props {
  duty: DutyAnalysis;
}

export function ReportRegulatoryContext({ duty }: Props) {
  const fdpCompliant = !(duty.fdpExceedance && duty.fdpExceedance > 0);
  const ulr = duty.ulrCompliance;

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        8. EASA Regulatory Context
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground print:text-gray-600">
              Compliance assessment against EASA ORO.FTL (EU 83/2014)
            </p>
          </div>

          {/* Compliance grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* FDP */}
            <ComplianceRow
              label="Flight Duty Period"
              regulation="ORO.FTL.205"
              compliant={fdpCompliant}
              detail={
                duty.actualFdpHours && duty.maxFdpHours
                  ? `${duty.actualFdpHours.toFixed(1)}h actual / ${duty.maxFdpHours.toFixed(1)}h maximum`
                  : `${duty.dutyHours.toFixed(1)}h duty`
              }
            />

            {/* Commander Discretion */}
            <ComplianceRow
              label="Commander Discretion"
              regulation="ORO.FTL.205(f)"
              compliant={true}
              detail={duty.usedDiscretion
                ? `Used — extended to ${duty.extendedFdpHours?.toFixed(1) ?? '—'}h`
                : 'Not used'}
            />

            {/* WOCL */}
            <ComplianceRow
              label="WOCL Exposure"
              regulation="AMC1 ORO.FTL.105(10)"
              compliant={true}
              detail={`${(duty.woclExposure ?? 0).toFixed(1)}h in 02:00–05:59 window`}
              isInfo
            />

            {/* Acclimatization */}
            <ComplianceRow
              label="Acclimatization"
              regulation="AMC1 ORO.FTL.105(1)"
              compliant={true}
              detail={formatAcclimatization(duty.acclimatizationState)}
              isInfo
            />
          </div>

          {/* ULR compliance (if applicable) */}
          {ulr && ulr.isUlr && (
            <div className="border-t border-border/30 pt-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 print:text-gray-600">
                Ultra Long Range (ULR) Compliance
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <ComplianceRow
                  label="ULR FDP"
                  regulation="ORO.FTL.205(e)"
                  compliant={ulr.fdpWithinLimit}
                  detail={`Max planned: ${ulr.maxPlannedFdp.toFixed(1)}h`}
                />
                <ComplianceRow
                  label="Rest Periods"
                  regulation="ORO.FTL.235"
                  compliant={ulr.restPeriodsValid}
                  detail="In-flight rest block validation"
                />
                <ComplianceRow
                  label="Pre-ULR Rest"
                  regulation="ORO.FTL.235"
                  compliant={ulr.preUlrRestCompliant}
                  detail="Minimum rest before ULR duty"
                />
                <ComplianceRow
                  label="Monthly ULR Count"
                  regulation="ORO.FTL.235"
                  compliant={ulr.monthlyUlrCount <= ulr.monthlyLimit}
                  detail={`${ulr.monthlyUlrCount} / ${ulr.monthlyLimit} max`}
                />
              </div>

              {/* Violations */}
              {ulr.violations && ulr.violations.length > 0 && (
                <div className="mt-3 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 print:bg-red-50 print:border-red-200">
                  <p className="text-xs font-medium text-critical print:text-red-700 mb-1">
                    ULR Violations Detected:
                  </p>
                  <ul className="text-[11px] text-muted-foreground print:text-gray-700 space-y-0.5">
                    {ulr.violations.map((v, i) => (
                      <li key={i}>• {v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ComplianceRow({ label, regulation, compliant, detail, isInfo }: {
  label: string;
  regulation: string;
  compliant: boolean;
  detail: string;
  isInfo?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/15 border border-border/20 px-3 py-2.5 print:bg-gray-50">
      {isInfo ? (
        <div className="w-4 h-4 flex-shrink-0" />
      ) : compliant ? (
        <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-critical flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium print:text-black truncate">{label}</span>
          <Badge variant="secondary" className="text-[8px] flex-shrink-0">{regulation}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground print:text-gray-500 truncate">{detail}</p>
      </div>
      {!isInfo && (
        <Badge variant={compliant ? 'success' : 'critical'} className="text-[9px] flex-shrink-0">
          {compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
        </Badge>
      )}
    </div>
  );
}

function formatAcclimatization(state: string): string {
  switch (state) {
    case 'acclimatized': return 'Acclimatized (within ±2h of home base)';
    case 'departed': return 'Departed (body clock shifting)';
    case 'unknown': return 'Unknown acclimatization state';
    default: return state;
  }
}
