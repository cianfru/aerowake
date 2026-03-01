import { Plane, Clock, Users, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DutyAnalysis } from '@/types/fatigue';
import { format } from 'date-fns';

interface Props {
  duty: DutyAnalysis;
}

export function ReportDutyProfile({ duty }: Props) {
  const segments = duty.flightSegments?.filter(s => !s.isDeadhead && s.activityCode !== 'IR') ?? [];
  const dutyType = duty.dutyType ?? 'flight';

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        2. Duty Profile
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoItem
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Duty Period"
              value={`${duty.dutyHours.toFixed(1)}h`}
              detail={duty.reportTimeLocal && duty.releaseTimeLocal
                ? `${duty.reportTimeLocal} – ${duty.releaseTimeLocal} (base TZ)`
                : undefined}
            />
            <InfoItem
              icon={<Plane className="h-3.5 w-3.5" />}
              label="Sectors"
              value={`${duty.sectors}`}
              detail={`${duty.blockHours?.toFixed(1) ?? '—'}h block`}
            />
            <InfoItem
              icon={<Users className="h-3.5 w-3.5" />}
              label="Crew"
              value={crewLabel(duty.crewComposition)}
              detail={duty.restFacilityClass
                ? `${duty.restFacilityClass.replace('_', ' ').toUpperCase()} rest facility`
                : undefined}
            />
            <InfoItem
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Type"
              value={dutyType === 'simulator' ? 'Simulator' : dutyType === 'ground_training' ? 'Ground Training' : 'Flight'}
              detail={duty.aircraftType ?? undefined}
            />
          </div>

          {/* UTC times */}
          {(duty.reportTimeUtc || duty.releaseTimeUtc) && (
            <div className="text-xs text-muted-foreground print:text-gray-600 border-t border-border/30 pt-3">
              <span>Report: <span className="font-mono">{duty.reportTimeUtc ?? '—'}</span></span>
              <span className="mx-3">|</span>
              <span>Release: <span className="font-mono">{duty.releaseTimeUtc ?? '—'}</span></span>
            </div>
          )}

          {/* Flight segments */}
          {segments.length > 0 && (
            <div className="border-t border-border/30 pt-3 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground print:text-gray-600">Flight Sectors</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground print:text-gray-600">
                      <th className="text-left font-medium pb-1 pr-3">#</th>
                      <th className="text-left font-medium pb-1 pr-3">Flight</th>
                      <th className="text-left font-medium pb-1 pr-3">Route</th>
                      <th className="text-left font-medium pb-1 pr-3">Dep (local)</th>
                      <th className="text-left font-medium pb-1 pr-3">Arr (local)</th>
                      <th className="text-right font-medium pb-1">Block</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((seg, i) => (
                      <tr key={i} className="border-t border-border/20">
                        <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 pr-3 font-mono font-medium">{seg.flightNumber}</td>
                        <td className="py-1.5 pr-3">
                          <span className="font-mono">{seg.departure}</span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="font-mono">{seg.arrival}</span>
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-muted-foreground">
                          {seg.departureTimeAirportLocal ?? seg.departureTime ?? '—'}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-muted-foreground">
                          {seg.arrivalTimeAirportLocal ?? seg.arrivalTime ?? '—'}
                        </td>
                        <td className="py-1.5 text-right font-mono">
                          {seg.blockHours.toFixed(1)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function InfoItem({ icon, label, value, detail }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-muted-foreground print:text-gray-600">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold print:text-black">{value}</p>
      {detail && <p className="text-[10px] text-muted-foreground print:text-gray-500">{detail}</p>}
    </div>
  );
}

function crewLabel(composition: string): string {
  switch (composition) {
    case 'augmented_4': return 'Augmented (4-crew)';
    case 'augmented_3': return 'Augmented (3-crew)';
    default: return 'Standard (2-crew)';
  }
}
