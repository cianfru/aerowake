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
  Info,
  Zap,
  BedDouble,
  AlarmClock,
  Split,
  Hourglass
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
            <Badge variant="outline">WOCL Alignment</Badge>
            <Badge variant="outline">Recovery Factors</Badge>
            <Badge variant="outline">Nap Science</Badge>
            <Badge variant="outline">11 Quality Factors</Badge>
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

      {/* Step 2: WOCL Alignment */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-primary" />
            Step 2: WOCL Alignment Bonus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Sleep occurring during the Window of Circadian Low (02:00-06:00 local) is
            <strong> circadian-aligned</strong> — your body is naturally primed for deep sleep.
            Overlap with WOCL provides a quality bonus of <strong>+5% per hour</strong> (up to 4h).
          </p>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium mb-2">Formula:</p>
            <code className="block bg-background/50 rounded p-3 text-sm font-mono">
              woclBonus = 1.0 + min(woclOverlapHours, 4) × 0.05
            </code>
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
                <div className="flex gap-3 text-success">
                  <span className="w-28">Bonus:</span>
                  <span>1.0 + (4 × 0.05) = <strong>1.20</strong> (+20% quality boost)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-info/5 border border-info/20 text-sm">
            <p className="font-medium mb-1">Why a bonus instead of a penalty?</p>
            <p className="text-muted-foreground">
              WOCL (02:00-06:00) is when the circadian system most strongly promotes sleep.
              Sleep during this window achieves the deepest slow-wave sleep and most efficient
              adenosine clearance. The penalty applies to being <em>awake</em> during WOCL, not
              sleeping during it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Steps 3-6 in Accordion */}
      <Accordion type="multiple" defaultValue={["late-onset", "recovery", "time-pressure", "insufficient", "nap-efficiency", "sol", "first-night", "alarm-anxiety", "split-sleep"]} className="space-y-4">
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
                Anxiety about waking on time can reduce sleep quality. Shorter rest windows before
                the next duty create psychological pressure that fragments sleep.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Time Pressure Factor:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  {"< 3h → 0.93 | < 6h → 0.96 | < 9h → 0.98 | ≥ 9h → 1.00"}
                </code>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <span className="w-24">{"< 3h"}</span>
                  <span className="font-mono">0.93</span>
                  <span className="text-muted-foreground">−7% very short turnaround</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-24">{"< 6h"}</span>
                  <span className="font-mono">0.96</span>
                  <span className="text-muted-foreground">−4% short turnaround</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-muted/20">
                  <span className="w-24">{"< 9h"}</span>
                  <span className="font-mono">0.98</span>
                  <span className="text-muted-foreground">−2% moderate pressure</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-24">{">= 9h"}</span>
                  <span className="font-mono">1.00</span>
                  <span className="text-muted-foreground">No pressure</span>
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

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/20 border border-destructive/30">
                  <span className="w-24">{"< 4h"}</span>
                  <span className="font-mono">0.75</span>
                  <span className="text-muted-foreground">−25% severely insufficient</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-24">4-6h</span>
                  <span className="font-mono">0.88</span>
                  <span className="text-muted-foreground">−12% insufficient</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-24">{">= 6h"}</span>
                  <span className="font-mono">1.00</span>
                  <span className="text-muted-foreground">No penalty</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                <p className="font-medium text-warning mb-1">Implementation Note</p>
                <p className="text-muted-foreground">
                  This factor is currently <strong>disabled</strong> in the engine to avoid
                  double-counting — sleep debt already penalizes short sleep through the
                  vulnerability coefficient (Step 5 of the Mathematical Model). The values are
                  retained for documentation and future use with alternative model configurations.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 7: Nap Efficiency by Duration */}
        <AccordionItem value="nap-efficiency" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 7: Nap Efficiency by Duration</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Not all naps are equal. Duration determines which sleep stages are reached,
                directly affecting restorative value and post-nap inertia risk.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Duration</th>
                      <th className="text-left py-2 font-medium">Efficiency</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Sleep Stages & Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 font-mono">≤ 10 min</td>
                      <td className="py-2"><code className="font-mono text-warning">0.75</code></td>
                      <td className="py-2 text-muted-foreground">Mostly Stage 1 — limited restoration</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">10-20 min</td>
                      <td className="py-2"><code className="font-mono text-success">0.90</code></td>
                      <td className="py-2 text-muted-foreground">Optimal — Stage 2 without SWS inertia risk</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">20-30 min</td>
                      <td className="py-2"><code className="font-mono text-success">0.92</code></td>
                      <td className="py-2 text-muted-foreground">Some SWS entry, slight inertia risk</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">30-60 min</td>
                      <td className="py-2"><code className="font-mono">0.88</code></td>
                      <td className="py-2 text-muted-foreground">Deep SWS → inertia reduces net benefit</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">&gt; 60 min</td>
                      <td className="py-2"><code className="font-mono">0.85</code></td>
                      <td className="py-2 text-muted-foreground">Full cycle but high inertia risk on wake</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                <p className="font-medium text-success mb-1">The 10-20 Minute Sweet Spot</p>
                <p className="text-muted-foreground">
                  A 10-20 minute nap reaches Stage 2 sleep (spindle activity) which improves alertness
                  and reaction time, but avoids entering slow-wave sleep which causes grogginess upon waking.
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Brooks & Lack (2006): 10-min nap optimal for alertness restoration</li>
                  <li>• Tietzel & Lack (2002): Brief naps ({`<`}20 min) improve alertness without SWS inertia</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 8: Sleep Onset Latency */}
        <AccordionItem value="sol" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Hourglass className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 8: Sleep Onset Latency (SOL)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Not all time in bed is sleep. Sleep Onset Latency — the time it takes to actually
                fall asleep — varies with circadian phase and homeostatic pressure. The model
                subtracts estimated SOL from sleep duration to get actual sleep time.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  SOL = base × circadian_gate / max(0.3, S_pressure)
                </code>
                <p className="text-xs text-muted-foreground mt-2">Clamped to 5-60 minutes</p>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">base</code>
                  <span className="text-muted-foreground">= <strong>15 minutes</strong> (average SOL)</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">gate</code>
                  <span className="text-muted-foreground">Circadian gating factor — high during WMZ (18:00-21:00), low during WOCL</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">S</code>
                  <span className="text-muted-foreground">Sleep pressure — higher pressure = faster onset</span>
                </div>
              </div>

              <div className="grid gap-2 text-sm font-mono">
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-32">High S, WOCL</span>
                  <span className="w-20">SOL ≈ 5 min</span>
                  <span className="text-muted-foreground font-sans">Very tired, circadian low → instant sleep</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-muted/20">
                  <span className="w-32">Average</span>
                  <span className="w-20">SOL ≈ 15 min</span>
                  <span className="text-muted-foreground font-sans">Normal bedtime</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <span className="w-32">Low S, WMZ</span>
                  <span className="w-20">SOL ≈ 45 min</span>
                  <span className="text-muted-foreground font-sans">Not tired, "forbidden zone" → hard to sleep</span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Åkerstedt et al. (2008): SOL varies with circadian phase and homeostatic pressure</li>
                  <li>• Lavie (1986): Circadian gates for sleep onset — "forbidden zone" during WMZ</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 9: First-Night Effect */}
        <AccordionItem value="first-night" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <BedDouble className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 9: First-Night Effect</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                The first night in a novel environment (hotel, layover) produces measurably worse sleep.
                One brain hemisphere remains more vigilant — a survival mechanism that reduces deep sleep quality.
              </p>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-28">First night</span>
                  <span className="font-mono w-24">+12 min SOL</span>
                  <span className="text-muted-foreground">Increased SOL, reduced SWS%, more awakenings</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-muted/20">
                  <span className="w-28">Second night</span>
                  <span className="font-mono w-24">+5 min SOL</span>
                  <span className="text-muted-foreground">Attenuated effect</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-28">Third+ night</span>
                  <span className="font-mono w-24">+0 min</span>
                  <span className="text-muted-foreground">Negligible — adapted to environment</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-info/5 border border-info/20 text-sm">
                <p className="font-medium mb-1">Why This Matters for Pilots</p>
                <p className="text-muted-foreground">
                  Pilots frequently sleep in different hotel rooms across layovers. The first-night effect
                  means the first layover sleep is always slightly degraded — even in a quiet, comfortable hotel.
                  Multi-night layovers benefit from familiarization by the second night.
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Agnew et al. (1966): The first-night effect — EEG study of sleep</li>
                  <li>• Tamaki et al. (2016): Unihemispheric slow-wave activity on first night in novel environment</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 10: Alarm Anxiety */}
        <AccordionItem value="alarm-anxiety" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <AlarmClock className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 10: Alarm Anxiety (Early Report)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                When the next duty report time is before 06:00 local, pilots experience
                anticipatory arousal — anxiety about oversleeping that fragments the last hours
                of sleep and reduces overall quality by 3%.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Rule:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  If report_time {"<"} 06:00 → quality × 0.97 (−3%)
                </code>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-28">Report 04:30</span>
                  <span className="font-mono">× 0.97</span>
                  <span className="text-muted-foreground">Alarm anxiety — light sleep, early termination</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-28">Report 08:00</span>
                  <span className="font-mono">× 1.00</span>
                  <span className="text-muted-foreground">No alarm anxiety</span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <p className="mt-1">Kecklund & Åkerstedt (2004): Apprehension of the subsequent working day is associated with a low amount of sleep — Biol Psychol 66(2):169-176</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 11: Split Sleep Quality */}
        <AccordionItem value="split-sleep" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Split className="h-5 w-5 text-primary" />
              <span className="font-semibold">Step 11: Split Sleep Quality</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                When sleep is split across multiple blocks (e.g., nap + main sleep, or two separate rest
                periods), each fragment's restorative value depends on its duration. Longer fragments
                allow at least one full SWS cycle per block.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Fragment Length</th>
                      <th className="text-left py-2 font-medium">Efficiency</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 font-mono">≥ 4 hours</td>
                      <td className="py-2"><code className="font-mono text-success">0.92</code></td>
                      <td className="py-2 text-muted-foreground">Full SWS cycle possible — 4+4h split ≈ 92% of consolidated 8h</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">≥ 3 hours</td>
                      <td className="py-2"><code className="font-mono text-warning">0.85</code></td>
                      <td className="py-2 text-muted-foreground">Partial SWS — meaningful but reduced restoration</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">{"< 3 hours"}</td>
                      <td className="py-2"><code className="font-mono text-destructive">0.78</code></td>
                      <td className="py-2 text-muted-foreground">Too short for SWS entry — minimal deep sleep recovery</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Jackson et al. (2014): Split sleep (4+4h) maintains ~92% of consolidated 8h effectiveness</li>
                  <li>• Kosmadopoulos et al. (2017): Confirmed 4+4h split provides near-equivalent performance</li>
                </ul>
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
            <h4 className="font-semibold mb-3">Combined Formula (11 Factors)</h4>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
              <pre className="text-sm font-mono overflow-x-auto">
{`combinedEfficiency =
  baseEfficiency          // Step 1: Location (home/hotel/crew rest)
  × woclBonus             // Step 2: WOCL alignment (+5% per overlap hour)
  × lateOnsetPenalty      // Step 3: Late sleep start
  × recoveryBoost         // Step 4: Post-duty recovery
  × timePressure          // Step 5: Time until next duty
  × insufficientPenalty   // Step 6: Short sleep (currently disabled)
  × napEfficiency         // Step 7: Duration-dependent nap factor
  × solFactor             // Step 8: Sleep onset latency subtracted
  × firstNightFactor      // Step 9: Novel environment penalty
  × alarmAnxiety          // Step 10: Early report anxiety
  × splitSleepFactor      // Step 11: Fragment-size quality

// Clamped to range [0.50, 1.20]
finalEfficiency = clamp(combinedEfficiency, 0.50, 1.20)

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
                <span>1. Base efficiency (home)</span>
                <code className="font-mono">0.90</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>2. WOCL bonus (14:00-17:00, no overlap)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>3. Late onset penalty (14:00 start)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>4. Recovery boost (no previous duty)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>5. Time pressure (6h until report)</span>
                <code className="font-mono">0.96</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>7. Nap efficiency (3h = 20-30 min band? No, full 3h sleep)</span>
                <code className="font-mono">1.00</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>8. SOL (afternoon, low pressure → ~18 min subtracted)</span>
                <code className="font-mono">2.7h actual</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                <span>9-11. First-night / Alarm / Split (home, not applicable)</span>
                <code className="font-mono">1.00</code>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between p-2 rounded bg-primary/10 border border-primary/20">
                <span className="font-medium">Combined efficiency</span>
                <code className="font-mono font-bold">0.90 × 1.0 × 1.0 × 1.0 × 0.96 × 1.0 = 0.86</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-success/10 border border-success/20">
                <span className="font-medium">Effective sleep</span>
                <code className="font-mono font-bold">2.7h × 0.86 = 2.3h</code>
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
