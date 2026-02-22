import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Moon,
  MapPin,
  Clock,
  Sunrise,
  Battery,
  Timer,
  AlertTriangle,
  Calculator,
  FileText,
  Code,
  Info
} from 'lucide-react';
import { SleepEfficiencyChart } from './charts';

export function FatigueSciencePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-16">
      {/* Header */}
      <Card variant="glass" className="text-center">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold tracking-tight">Sleep Quality Calculation System</CardTitle>
          <p className="text-lg text-muted-foreground mt-3">
            Estimating effective restorative value of sleep periods
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="outline">Location Efficiency</Badge>
            <Badge variant="outline">WOCL Penalties</Badge>
            <Badge variant="outline">Recovery Factors</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Overview */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            The sleep quality calculator estimates the effective restorative value of sleep periods 
            based on multiple scientifically-validated factors. Not all sleep is equal—environment, 
            timing, and circumstances significantly affect recovery.
          </p>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium mb-2">Input Parameters:</p>
            <pre className="bg-background/50 rounded p-3 text-sm font-mono overflow-x-auto">
{`interface SleepBlock {
  start_utc: DateTime;           // When sleep started
  end_utc: DateTime;             // When sleep ended
  location_timezone: string;     // IANA timezone (e.g., "Europe/London")
  environment: string;           // 'home' | 'hotel' | 'crew_rest' | 'airport_hotel'
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Location Efficiency */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            Step 1: Base Efficiency by Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Where you sleep significantly impacts recovery quality. Home sleep serves as the baseline reference.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Location</th>
                  <th className="text-left py-2 font-medium">Efficiency</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3">Home</td>
                  <td className="py-3"><code className="font-mono text-success">0.90</code></td>
                  <td className="py-3 text-muted-foreground">Reference baseline</td>
                </tr>
                <tr>
                  <td className="py-3">Crew Rest Facility</td>
                  <td className="py-3"><code className="font-mono">0.88</code></td>
                  <td className="py-3 text-muted-foreground">-2% inflight limitations</td>
                </tr>
                <tr>
                  <td className="py-3">Crew House</td>
                  <td className="py-3"><code className="font-mono">0.87</code></td>
                  <td className="py-3 text-muted-foreground">-3% similar to hotel but more familiar</td>
                </tr>
                <tr>
                  <td className="py-3">Hotel</td>
                  <td className="py-3"><code className="font-mono text-warning">0.85</code></td>
                  <td className="py-3 text-muted-foreground">-5% unfamiliar environment</td>
                </tr>
                <tr>
                  <td className="py-3">Airport Hotel</td>
                  <td className="py-3"><code className="font-mono text-destructive">0.82</code></td>
                  <td className="py-3 text-muted-foreground">-8% noise, unfamiliar, time pressure</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
            <p className="font-medium mb-1">Scientific Basis:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Gander et al. (2013): Layover sleep ~15% less restorative</li>
              <li>• Åkerstedt et al. (1995): Home sleep efficiency baseline</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: WOCL Overlap */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-primary" />
            Step 2: WOCL Overlap Penalty
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Sleep occurring during WOCL (02:00-06:00 local) is less restorative due to circadian misalignment.
            The penalty is <strong>-5% per hour</strong> of overlap.
          </p>

          <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border">
              <span className="text-sm font-medium">WOCL Overlap Calculation</span>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono">
{`function calculateWOCLOverlap(sleepStart: DateTime, sleepEnd: DateTime): number {
  // Convert to local time FIRST
  const startLocal = sleepStart.toLocal();
  const endLocal = sleepEnd.toLocal();
  
  const WOCL_START = 2;  // 02:00
  const WOCL_END = 6;    // 06:00
  
  let overlapHours = 0;
  
  // Handle midnight-crossing sleep
  if (endLocal.date > startLocal.date) {
    // Check overlap on both days
    const day1Overlap = Math.max(0, 
      Math.min(24, WOCL_END) - Math.max(startLocal.hour, WOCL_START));
    const day2Overlap = Math.max(0, 
      Math.min(endLocal.hour, WOCL_END) - WOCL_START);
    overlapHours = day1Overlap + day2Overlap;
  } else {
    // Same-day sleep
    const overlapStart = Math.max(startLocal.hour, WOCL_START);
    const overlapEnd = Math.min(endLocal.hour, WOCL_END);
    overlapHours = Math.max(0, overlapEnd - overlapStart);
  }
  
  return overlapHours;
}

// Penalty calculation
const woclPenalty = 1.0 - (woclOverlap * 0.05);  // -5% per hour`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Example</h4>
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <div className="grid gap-2 font-mono">
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-28">Sleep:</span>
                  <span>23:00-08:00 (9h duration)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-28">WOCL overlap:</span>
                  <span>02:00-06:00 (4h)</span>
                </div>
                <div className="flex gap-3 text-destructive">
                  <span className="w-28">Penalty:</span>
                  <span>1.0 - (4 × 0.05) = <strong>0.80</strong> (20% reduction)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps 3-6 in Accordion */}
      <Accordion type="multiple" defaultValue={["late-onset", "recovery", "time-pressure", "insufficient"]} className="space-y-4">
        {/* Step 3: Late Sleep Onset */}
        <AccordionItem value="late-onset" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Sunrise className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 3: Late Sleep Onset Penalty</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Starting sleep very late (after midnight) reduces quality due to circadian rhythm disruption.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-sm font-mono overflow-x-auto">
{`function calculateLateOnsetPenalty(sleepStartHour: number): number {
  if (sleepStartHour >= 1 && sleepStartHour < 4) {
    return 0.93;  // -7% for 01:00-03:59 start
  } else if (sleepStartHour >= 0 && sleepStartHour < 1) {
    return 0.97;  // -3% for 00:00-00:59 start
  }
  return 1.0;  // No penalty
}`}
                </pre>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-32">Before midnight</span>
                  <span className="font-mono">1.00</span>
                  <span className="text-muted-foreground">No penalty</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-32">00:00-00:59</span>
                  <span className="font-mono">0.97</span>
                  <span className="text-muted-foreground">-3% penalty</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <span className="w-32">01:00-03:59</span>
                  <span className="font-mono">0.93</span>
                  <span className="text-muted-foreground">-7% penalty</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 4: Recovery Sleep Boost */}
        <AccordionItem value="recovery" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Battery className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 4: Recovery Sleep Boost</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Sleep immediately after duty (within 3h) is more restorative due to high sleep pressure.
                This provides a <strong>+10% recovery boost</strong>.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-sm font-mono overflow-x-auto">
{`function calculateRecoveryBoost(
  sleepStart: DateTime, 
  previousDutyEnd: DateTime | null
): number {
  if (!previousDutyEnd) return 1.0;
  
  const hoursSinceDuty = (sleepStart - previousDutyEnd).hours;
  
  if (hoursSinceDuty < 3) {
    return 1.10;  // +10% recovery boost
  }
  return 1.0;
}`}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                <p className="font-medium text-success">Why does this work?</p>
                <p className="text-muted-foreground mt-1">
                  High adenosine (sleep pressure) after extended wakefulness leads to deeper, more 
                  restorative slow-wave sleep in the first sleep cycle.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 5: Time Pressure */}
        <AccordionItem value="time-pressure" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 5: Time Pressure Factor</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Anxiety about waking on time can reduce sleep quality. Conversely, no time pressure allows 
                for more relaxed, higher-quality sleep.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-sm font-mono overflow-x-auto">
{`function calculateTimePressure(hoursUntilNextEvent: number): number {
  if (hoursUntilNextEvent < 1.5) {
    return 0.88;  // -12% very short turnaround
  } else if (hoursUntilNextEvent < 3) {
    return 0.93;  // -7% short turnaround
  } else if (hoursUntilNextEvent < 6) {
    return 0.97;  // -3% moderate pressure
  }
  return 1.03;  // +3% no pressure (relaxed)
}`}
                </pre>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <span className="w-24">{"< 1.5h"}</span>
                  <span className="font-mono">0.88</span>
                  <span className="text-muted-foreground">-12% very short turnaround</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/20 border border-warning/30">
                  <span className="w-24">{"< 3h"}</span>
                  <span className="font-mono">0.93</span>
                  <span className="text-muted-foreground">-7% short turnaround</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-24">{"< 6h"}</span>
                  <span className="font-mono">0.97</span>
                  <span className="text-muted-foreground">-3% moderate pressure</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-24">{">= 6h"}</span>
                  <span className="font-mono">1.03</span>
                  <span className="text-muted-foreground">+3% no pressure (relaxed)</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 6: Insufficient Sleep */}
        <AccordionItem value="insufficient" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 6: Insufficient Sleep Penalty</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Very short sleep ({"<"}6h) is disproportionately less effective. Naps are exempt from this penalty 
                as they serve a different physiological purpose.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-sm font-mono overflow-x-auto">
{`function calculateInsufficientPenalty(duration: number, isNap: boolean): number {
  if (isNap) return 1.0;  // Naps exempt
  
  if (duration < 4) {
    return 0.75;  // -25% for <4h
  } else if (duration < 6) {
    return 0.88;  // -12% for 4-6h
  }
  return 1.0;
}`}
                </pre>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/20 border border-destructive/30">
                  <span className="w-24">{"< 4h"}</span>
                  <span className="font-mono">0.75</span>
                  <span className="text-muted-foreground">-25% severely insufficient</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-24">4-6h</span>
                  <span className="font-mono">0.88</span>
                  <span className="text-muted-foreground">-12% insufficient</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-24">{">= 6h"}</span>
                  <span className="font-mono">1.00</span>
                  <span className="text-muted-foreground">No penalty</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Interactive Sleep Quality Calculator */}
      <SleepEfficiencyChart />

      {/* Final Calculation */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calculator className="h-5 w-5 text-primary" />
            Final Calculation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-3">Result Interface</h4>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <pre className="text-sm font-mono overflow-x-auto">
{`interface SleepQualityResult {
  total_sleep_hours: number;        // Raw duration
  actual_sleep_hours: number;       // Capped at biological max (10h)
  sleep_efficiency: number;         // Combined quality factor
  effective_sleep_hours: number;    // Actual × Efficiency
  wocl_overlap_hours: number;       // Hours during WOCL
  warnings: Warning[];              // Quality warnings
}`}
              </pre>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Combined Formula</h4>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
              <pre className="text-sm font-mono overflow-x-auto">
{`combinedEfficiency = 
  baseEfficiency ×
  woclPenalty ×
  lateOnsetPenalty ×
  recoveryBoost ×
  timePressure ×
  insufficientPenalty

// Clamped to range [0.50, 1.00]
finalEfficiency = Math.max(0.50, Math.min(1.0, combinedEfficiency))

// Final result
effectiveSleep = actualHours × finalEfficiency`}
              </pre>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Complete Example: Afternoon Nap Before Night Flight</h4>
            
            <div className="rounded-lg border border-border bg-muted/20 p-4 mb-4">
              <p className="text-sm font-medium mb-2">Scenario:</p>
              <div className="grid gap-1 text-sm font-mono">
                <p>Sleep: 14:00-17:00 local (3h duration)</p>
                <p>Location: Home</p>
                <p>Type: Nap</p>
                <p>Next duty report: 23:00 (6h away)</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>Base efficiency (home)</span>
                <code className="font-mono">0.90</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>Nap penalty</span>
                <code className="font-mono">0.88</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>WOCL penalty (14:00-17:00, no overlap)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>Late onset penalty (14:00 start)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>Recovery boost (no previous duty)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>Time pressure (6h until report)</span>
                <code className="font-mono">0.93</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>Insufficient penalty (naps exempt)</span>
                <code className="font-mono">1.00</code>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between p-2 rounded bg-primary/10 border border-primary/20">
                <span className="font-medium">Combined efficiency</span>
                <code className="font-mono font-bold">0.90 × 0.88 × 1.0 × 1.0 × 1.0 × 0.93 × 1.0 = 0.74</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-success/10 border border-success/20">
                <span className="font-medium">Effective sleep</span>
                <code className="font-mono font-bold">3.0h × 0.74 = 2.2h</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings Generation */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            Warnings Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            The system generates contextual warnings based on sleep quality metrics, with EASA regulatory references where applicable.
          </p>

          <div className="space-y-3">
            <WarningExample 
              severity="critical"
              threshold="Effective sleep < 5h"
              message="Critically insufficient sleep: X.Xh effective"
              recommendation="Consider fatigue mitigation or duty adjustment"
              reference="ORO.FTL.120(b) - Unfit for duty"
            />
            <WarningExample 
              severity="high"
              threshold="Effective sleep 5-6h"
              message="Insufficient sleep: X.Xh effective"
              recommendation="Extra vigilance required on next duty"
              reference="AMC1 ORO.FTL.120 - Enhanced monitoring"
            />
            <WarningExample 
              severity="moderate"
              threshold="Effective sleep 6-7h"
              message="Below optimal sleep: X.Xh effective"
              recommendation="Monitor fatigue levels during duty"
            />
            <WarningExample 
              severity="moderate"
              threshold="WOCL overlap > 2.5h"
              message="X.Xh sleep during WOCL (02:00-06:00)"
              recommendation="Sleep quality reduced due to circadian low"
              reference="AMC1 ORO.FTL.105(10) - WOCL definition"
            />
          </div>

          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="code" className="border border-border rounded-lg bg-card/30 px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Code className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">View Implementation Code</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <pre className="text-sm font-mono overflow-x-auto p-4 bg-muted/30 rounded-lg">
{`function generateWarnings(
  effectiveSleep: number,
  actualDuration: number,
  woclOverlap: number,
  isNap: boolean
): Warning[] {
  const warnings: Warning[] = [];
  
  // Critical insufficient sleep
  if (!isNap && effectiveSleep < 5) {
    warnings.push({
      severity: 'critical',
      message: \`Critically insufficient sleep: \${effectiveSleep.toFixed(1)}h effective\`,
      recommendation: 'Consider fatigue mitigation or duty adjustment',
      easa_reference: 'ORO.FTL.120(b) - Unfit for duty'
    });
  }
  
  // Insufficient sleep
  else if (!isNap && effectiveSleep < 6) {
    warnings.push({
      severity: 'high',
      message: \`Insufficient sleep: \${effectiveSleep.toFixed(1)}h effective\`,
      recommendation: 'Extra vigilance required on next duty',
      easa_reference: 'AMC1 ORO.FTL.120 - Enhanced monitoring'
    });
  }
  
  // Below optimal
  else if (!isNap && effectiveSleep < 7) {
    warnings.push({
      severity: 'moderate',
      message: \`Below optimal sleep: \${effectiveSleep.toFixed(1)}h effective\`,
      recommendation: 'Monitor fatigue levels during duty'
    });
  }
  
  // High WOCL overlap
  if (woclOverlap > 2.5) {
    warnings.push({
      severity: 'moderate',
      message: \`\${woclOverlap.toFixed(1)}h sleep during WOCL (02:00-06:00)\`,
      recommendation: 'Sleep quality reduced due to circadian low',
      easa_reference: 'AMC1 ORO.FTL.105(10) - WOCL definition'
    });
  }
  
  return warnings;
}`}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components

function WarningExample({ 
  severity, 
  threshold, 
  message, 
  recommendation,
  reference 
}: { 
  severity: 'critical' | 'high' | 'moderate'; 
  threshold: string;
  message: string; 
  recommendation: string;
  reference?: string;
}) {
  const severityColors = {
    critical: 'border-destructive/30 bg-destructive/5',
    high: 'border-warning/30 bg-warning/5',
    moderate: 'border-info/30 bg-info/5'
  };

  const severityBadge = {
    critical: 'destructive',
    high: 'warning',
    moderate: 'info'
  } as const;

  return (
    <div className={`rounded-lg border p-4 ${severityColors[severity]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={severityBadge[severity]} className="uppercase text-xs">
          {severity}
        </Badge>
        <span className="text-sm text-muted-foreground">{threshold}</span>
      </div>
      <p className="font-medium text-sm mb-1">{message}</p>
      <p className="text-sm text-muted-foreground">{recommendation}</p>
      {reference && (
        <p className="text-xs text-muted-foreground mt-2 font-mono">{reference}</p>
      )}
    </div>
  );
}
