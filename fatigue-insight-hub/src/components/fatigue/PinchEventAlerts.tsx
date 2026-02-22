import { AlertTriangle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DutyAnalysis, PinchEvent } from '@/types/fatigue';
import { format } from 'date-fns';

interface PinchEventAlertsProps {
  duties: DutyAnalysis[];
}

const getPhaseLabel = (phase: string): string => {
  const labels: Record<string, string> = {
    preflight: 'Pre-flight',
    taxi: 'Taxi',
    takeoff: 'Takeoff',
    climb: 'Climb',
    cruise: 'Cruise',
    descent: 'Descent',
    approach: 'Approach',
    landing: 'Landing',
  };
  return labels[phase] || phase;
};

export function PinchEventAlerts({ duties }: PinchEventAlertsProps) {
  // Collect all pinch events from duties
  const allPinchEvents = duties
    .filter(d => d.pinchEvents && d.pinchEvents.length > 0)
    .flatMap(d => 
      (d.pinchEvents || []).map(event => ({
        ...event,
        date: d.date,
        dutyId: format(d.date, 'MMM d'),
      }))
    )
    .sort((a, b) => (a.severity === 'critical' ? -1 : 1));

  const criticalCount = allPinchEvents.filter(e => e.severity === 'critical').length;
  const highCount = allPinchEvents.filter(e => e.severity === 'high').length;

  if (allPinchEvents.length === 0) {
    return null;
  }

  return (
    <Card variant="glass" className="border-critical/30 bg-critical/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-critical" />
          Pinch Events Detected
          <Badge variant="critical" className="ml-2">
            {allPinchEvents.length} events
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          High sleep pressure + low circadian alignment during critical flight phases
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex gap-4 text-sm">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-critical animate-pulse" />
              <span className="text-critical font-medium">{criticalCount} Critical</span>
            </div>
          )}
          {highCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-warning" />
              <span className="text-warning font-medium">{highCount} High</span>
            </div>
          )}
        </div>

        {/* Event List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allPinchEvents.slice(0, 8).map((event, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between rounded-lg p-3 ${
                event.severity === 'critical'
                  ? 'bg-critical/10 border border-critical/30'
                  : 'bg-warning/10 border border-warning/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    event.severity === 'critical' ? 'text-critical' : 'text-warning'
                  }`}
                />
                <div>
                  <p className="font-medium text-sm">
                    {event.dutyId} @ {event.time}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getPhaseLabel(event.phase)} phase
                  </p>
                </div>
              </div>
              <div className="text-right text-xs">
                <p className={event.severity === 'critical' ? 'text-critical' : 'text-warning'}>
                  {event.performance.toFixed(0)}% perf
                </p>
                <p className="text-muted-foreground">
                  C: {(event.circadian * 100).toFixed(0)}% | S: {(event.sleepPressure * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          ))}
        </div>

        {allPinchEvents.length > 8 && (
          <p className="text-xs text-muted-foreground text-center">
            + {allPinchEvents.length - 8} more events
          </p>
        )}

        {/* Explanation */}
        <div className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">What is a Pinch Event?</p>
          <p>
            A "pinch" occurs when high homeostatic sleep pressure (S {">"} 60%) coincides with 
            low circadian alertness (C {"<"} 40%) during critical flight phases like takeoff, 
            approach, or landing. This creates maximum fatigue vulnerability.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
