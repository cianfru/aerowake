import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Brain,
  Clock,
  Zap,
  Calculator,
  Plane,
  Globe,
  Code,
  TrendingUp,
  AlertTriangle,
  Info
} from 'lucide-react';
import { 
  ProcessSChart, 
  ProcessCChart, 
  SleepInertiaChart, 
  CombinedPerformanceChart 
} from './charts';

export function MathematicalModelPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-16">
      {/* Header */}
      <Card variant="glass" className="text-center">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold tracking-tight">The Borbély Two-Process Model</CardTitle>
          <p className="text-lg text-muted-foreground mt-3">
            Mathematical foundation for predicting alertness and performance
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="outline">Process S (Homeostatic)</Badge>
            <Badge variant="outline">Process C (Circadian)</Badge>
            <Badge variant="outline">Process W (Inertia)</Badge>
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
        <CardContent>
          <p className="text-muted-foreground leading-relaxed mb-6">
            The Borbély model combines two independent biological processes to predict alertness and performance:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Process S (Sleep/Homeostatic)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Sleep pressure that builds during wakefulness. The longer you're awake, 
                the stronger the drive to sleep becomes.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Process C (Circadian)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Your internal 24-hour body clock that creates natural rhythms of alertness, 
                independent of how long you've been awake.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process S */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            Process S: Sleep Pressure (Homeostatic Drive)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">The Science</h4>
            <p className="text-muted-foreground leading-relaxed">
              When you're awake, adenosine accumulates in your brain, creating "sleep pressure." 
              The longer you're awake, the stronger this pressure becomes. During sleep, adenosine is cleared.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">The Mathematics</h4>
            
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">During Wakefulness:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  S(t) = S_max - (S_max - S₀) × e^(-t / τᵢ)
                </code>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">During Sleep:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  S(t) = S_min + (S₀ - S_min) × e^(-t / τd)
                </code>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">S(t)</code>
                  <span className="text-muted-foreground">Sleep pressure at time t</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">S_max</code>
                  <span className="text-muted-foreground">Maximum sleep pressure = <strong>0.95</strong></span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">S₀</code>
                  <span className="text-muted-foreground">Sleep pressure at wake time (typically 0.1-0.3)</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">τᵢ</code>
                  <span className="text-muted-foreground">Time constant for increase = <strong>18.2 hours</strong> (Jewett & Kronauer, 1999)</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">τd</code>
                  <span className="text-muted-foreground">Time constant for decrease = <strong>4.2 hours</strong> (Jewett & Kronauer, 1999)</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Real-World Example</h4>
            <p className="text-sm text-muted-foreground mb-3">Scenario: You wake at 07:00 after 8 hours of good sleep</p>
            <div className="grid gap-2 text-sm font-mono">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="w-14">07:00</span>
                <span className="w-20">S = 0.15</span>
                <span className="text-muted-foreground font-sans">Low pressure, well-rested</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-success/5 border border-success/10">
                <span className="w-14">12:00</span>
                <span className="w-20">S = 0.38</span>
                <span className="text-muted-foreground font-sans">5h awake, mild pressure building</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="w-14">18:00</span>
                <span className="w-20">S = 0.62</span>
                <span className="text-muted-foreground font-sans">11h awake, noticeable tiredness</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/20 border border-warning/30">
                <span className="w-14">23:00</span>
                <span className="w-20">S = 0.78</span>
                <span className="text-muted-foreground font-sans">16h awake, strong sleep drive</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="w-14">03:00</span>
                <span className="w-20">S = 0.89</span>
                <span className="text-muted-foreground font-sans">20h awake, extreme sleepiness</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
            <p className="font-medium mb-1">Scientific Reference:</p>
            <p className="text-muted-foreground">
              Borbély AA, Achermann P (1999). <em>Sleep homeostasis and models of sleep regulation.</em> 
              Journal of Biological Rhythms, 14(6), 559-570
            </p>
          </div>

          <Separator />

          {/* Interactive Chart */}
          <div>
            <h4 className="font-semibold mb-4">Interactive Visualization</h4>
            <ProcessSChart />
          </div>
        </CardContent>
      </Card>

      {/* Process C */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            Process C: Circadian Rhythm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">The Science</h4>
            <p className="text-muted-foreground leading-relaxed">
              Your suprachiasmatic nucleus (SCN) generates a natural ~24-hour rhythm of alertness 
              that's independent of how long you've been awake. You're naturally most alert in the 
              late afternoon and least alert in the early morning (02:00-06:00).
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">The Mathematics</h4>
            
            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
              <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                C(t) = M + A × cos(2π × (t_effective - φ) / 24)
              </code>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">M</code>
                <span className="text-muted-foreground">Mesor (midline) = <strong>0.5</strong></span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">A</code>
                <span className="text-muted-foreground">Amplitude = <strong>0.35</strong></span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">φ</code>
                <span className="text-muted-foreground">Acrophase (peak time) = <strong>17:00</strong> (5 PM)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">t_effective</code>
                <span className="text-muted-foreground">Local hour adjusted for circadian phase shift</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-muted/20 text-sm">
              <p className="font-medium">Normalized to [0, 1] scale:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• <strong>1.0</strong> = Peak alertness (afternoon)</li>
                <li>• <strong>0.0</strong> = Maximum circadian low (03:00-05:00)</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h4 className="font-semibold">The Window of Circadian Low (WOCL)</h4>
            </div>
            
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
              <p className="font-semibold text-destructive">Critical Period: 02:00 - 05:59 (reference time)</p>
              <p className="text-sm text-muted-foreground mt-2">
                This is when your circadian system produces the lowest alertness, regardless of sleep. 
                Even if you're well-rested, cognitive performance drops ~20-30% during WOCL.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
              <p className="font-medium mb-1">EASA Definition:</p>
              <p className="text-muted-foreground">
                AMC1 ORO.FTL.105(10) defines WOCL as the period when circadian desynchronization 
                has the most severe impact on performance.
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Real-World Example</h4>
            <p className="text-sm text-muted-foreground mb-3">Same person, same sleep quality, different report times:</p>
            <div className="grid gap-2 text-sm font-mono">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="w-24">Report 14:00</span>
                <span className="w-20">C = 0.82</span>
                <span className="text-muted-foreground font-sans">Afternoon peak, high circadian support</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="w-24">Report 22:00</span>
                <span className="w-20">C = 0.45</span>
                <span className="text-muted-foreground font-sans">Evening dip, moderate support</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="w-24">Report 03:00</span>
                <span className="w-20">C = 0.12</span>
                <span className="text-muted-foreground font-sans">WOCL, very low circadian support</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3 p-3 bg-muted/20 rounded-lg">
              <strong>Result:</strong> Landing at 04:00 after the same duty length shows 35-40% lower 
              performance due purely to circadian phase.
            </p>
          </div>

          <Separator />

          {/* Interactive Chart */}
          <div>
            <h4 className="font-semibold mb-4">Interactive Visualization</h4>
            <ProcessCChart />
          </div>
        </CardContent>
      </Card>

      {/* Process W */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            Process W: Sleep Inertia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">The Science</h4>
            <p className="text-muted-foreground leading-relaxed">
              Immediately after waking, your brain undergoes a transition period where performance 
              is temporarily impaired—even if you're well-rested. This is called "sleep inertia."
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">The Mathematics</h4>
            
            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
              <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                W(t) = W_max × e^(-t / (τw / 3))
              </code>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-16">W_max</code>
                <span className="text-muted-foreground">Maximum inertia magnitude = <strong>0.30</strong> (30% performance reduction)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-16">τw</code>
                <span className="text-muted-foreground">Duration of effect = <strong>30 minutes</strong> (Tassi & Muzet, 2000)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-16">t</code>
                <span className="text-muted-foreground">Minutes since waking</span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Time to Dissipate</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="font-mono w-24">10 minutes</span>
                <span className="text-muted-foreground">~70% of inertia remains</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="font-mono w-24">20 minutes</span>
                <span className="text-muted-foreground">~40% remains</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="font-mono w-24">30 minutes</span>
                <span className="text-muted-foreground">~13% remains (mostly resolved)</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
            <p className="font-medium mb-1">Scientific Reference:</p>
            <p className="text-muted-foreground">
              Tassi P, Muzet A (2000). <em>Sleep inertia.</em> Sleep Medicine Reviews, 4(4), 341-353
            </p>
          </div>

          <Separator />

          {/* Interactive Chart */}
          <div>
            <h4 className="font-semibold mb-4">Interactive Visualization</h4>
            <SleepInertiaChart />
          </div>
        </CardContent>
      </Card>

      {/* Integration */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calculator className="h-5 w-5 text-primary" />
            Integration: Calculating Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-4">The Final Formula</h4>
            
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
              <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                Performance = Floor + (Base_Alertness × (1 - W)) × (100 - Floor)
              </code>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
              <p className="text-sm font-medium mb-2">Where:</p>
              <div className="space-y-1 text-sm font-mono">
                <p>Base_Alertness = (S_alertness × 0.6) + (C_alertness × 0.4)</p>
                <p>S_alertness = 1 - S</p>
                <p>C_alertness = (C + 1) / 2</p>
                <p>Floor = 20.0  <span className="text-muted-foreground font-sans">(minimum safe performance)</span></p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">60%</p>
                <p className="text-muted-foreground">Process S Weight</p>
                <p className="text-xs text-muted-foreground mt-1">Dominant factor</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">40%</p>
                <p className="text-muted-foreground">Process C Weight</p>
                <p className="text-xs text-muted-foreground mt-1">Modulating factor</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">×</p>
                <p className="text-muted-foreground">Process W</p>
                <p className="text-xs text-muted-foreground mt-1">Multiplicative penalty</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Performance Scale</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="font-mono font-medium w-16">90-100</span>
                <span className="font-medium text-success w-20">Optimal</span>
                <span className="text-muted-foreground">Full cognitive capacity</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-success/5 border border-success/10">
                <span className="font-mono font-medium w-16">75-90</span>
                <span className="font-medium text-success/80 w-20">Good</span>
                <span className="text-muted-foreground">Minor fatigue, normal operations safe</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="font-mono font-medium w-16">65-75</span>
                <span className="font-medium text-warning w-20">Moderate</span>
                <span className="text-muted-foreground">Enhanced monitoring recommended</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/20 border border-warning/30">
                <span className="font-mono font-medium w-16">55-65</span>
                <span className="font-medium text-warning w-20">High Risk</span>
                <span className="text-muted-foreground">Mitigation strategies required</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="font-mono font-medium w-16">45-55</span>
                <span className="font-medium text-destructive w-20">Critical</span>
                <span className="text-muted-foreground">Roster modification mandatory</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/20 border border-destructive/30">
                <span className="font-mono font-medium w-16">0-45</span>
                <span className="font-medium text-destructive w-20">Extreme</span>
                <span className="text-muted-foreground">Unsafe to operate (≈ 0.05% BAC impairment*)</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              *Dawson & Reid (1997): 17-19h awake ≈ 0.05% blood alcohol impairment
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Complete Example Timeline</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Scenario: Home base in Middle East (UTC+3), Night departure 23:00
            </p>
            <div className="space-y-2 text-sm">
              <TimelineRow time="19:00" event="Wake from afternoon nap" values="S = 0.25, C = 0.52, W = 0.30" performance={63} risk="MODERATE" note="sleep inertia present" />
              <TimelineRow time="19:30" event="Sleep inertia cleared" values="S = 0.28, C = 0.48, W = 0.04" performance={74} risk="GOOD" />
              <TimelineRow time="23:00" event="Report time (4h awake)" values="S = 0.42, C = 0.38, W = 0.00" performance={68} risk="MODERATE" note="evening dip" />
              <TimelineRow time="02:00" event="Cruise (7h awake, WOCL)" values="S = 0.58, C = 0.15, W = 0.00" performance={48} risk="CRITICAL" note="WOCL + sleep pressure" />
              <TimelineRow time="05:00" event="Landing (10h awake, late WOCL)" values="S = 0.68, C = 0.18, W = 0.00" performance={43} risk="EXTREME" />
            </div>

            <div className="mt-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <p className="font-semibold text-destructive mb-2">Why is this dangerous?</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Sleep pressure built up for 10 hours</li>
                <li>Landing during deepest circadian low</li>
                <li>No restorative sleep since 19:00 nap</li>
                <li>Equivalent to ~0.06% BAC impairment</li>
              </ol>
            </div>
          </div>

          <Separator />

          {/* Interactive Chart */}
          <div>
            <h4 className="font-semibold mb-4">Interactive Model Visualization</h4>
            <CombinedPerformanceChart />
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Advanced Sections */}
      <Accordion type="multiple" className="space-y-4">
        {/* Workload Modulation */}
        <AccordionItem value="workload" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Plane className="h-5 w-5 text-primary" />
              <span className="font-semibold">Workload Modulation</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Not all flight time is equal in terms of fatigue accumulation. The model applies 
                workload multipliers based on flight phase and sector number.
              </p>

              <div>
                <h4 className="font-medium mb-3">Flight Phase Multipliers</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Phase</th>
                        <th className="text-left py-2 font-medium">Multiplier</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="py-2">Preflight</td><td className="py-2 font-mono">1.1×</td><td className="py-2 text-muted-foreground">Moderate (briefings, checks)</td></tr>
                      <tr><td className="py-2">Taxi Out</td><td className="py-2 font-mono">1.0×</td><td className="py-2 text-muted-foreground">Baseline</td></tr>
                      <tr><td className="py-2">Takeoff</td><td className="py-2 font-mono text-warning">1.8×</td><td className="py-2 text-muted-foreground">High workload, critical phase</td></tr>
                      <tr><td className="py-2">Climb</td><td className="py-2 font-mono">1.3×</td><td className="py-2 text-muted-foreground">Active control required</td></tr>
                      <tr><td className="py-2">Cruise</td><td className="py-2 font-mono text-success">0.8×</td><td className="py-2 text-muted-foreground">Below baseline (monitoring)</td></tr>
                      <tr><td className="py-2">Descent</td><td className="py-2 font-mono">1.2×</td><td className="py-2 text-muted-foreground">Planning, configuration</td></tr>
                      <tr><td className="py-2">Approach</td><td className="py-2 font-mono text-warning">1.5×</td><td className="py-2 text-muted-foreground">High precision required</td></tr>
                      <tr><td className="py-2">Landing</td><td className="py-2 font-mono text-destructive">2.0×</td><td className="py-2 text-muted-foreground">Highest workload, critical</td></tr>
                      <tr><td className="py-2">Taxi In</td><td className="py-2 font-mono">1.0×</td><td className="py-2 text-muted-foreground">Baseline</td></tr>
                      <tr><td className="py-2">Turnaround</td><td className="py-2 font-mono">1.2×</td><td className="py-2 text-muted-foreground">Time pressure</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Sector Penalty</h4>
                <p className="text-sm text-muted-foreground mb-3">Each additional sector adds cumulative fatigue:</p>
                <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
                  <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                    Effective_Wake_Time = Actual_Time × Phase_Multiplier × (1 + (Sector - 1) × 0.15)
                  </code>
                </div>

                <div className="text-sm space-y-1 font-mono mb-4">
                  <p>Sector 1 - 5h cruise = 5h × 0.8 × 1.00 = <strong>4.0h</strong> effective</p>
                  <p>Sector 2 - 5h cruise = 5h × 0.8 × 1.15 = <strong>4.6h</strong> effective</p>
                  <p>Sector 3 - 5h cruise = 5h × 0.8 × 1.30 = <strong>5.2h</strong> effective</p>
                  <p className="text-muted-foreground">Total: 13.8h effective vs 15h actual</p>
                </div>

                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                  <p className="font-medium text-warning mb-1">Why does this matter?</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Short-haul pilots experience MORE fatigue than wide-body pilots</li>
                    <li>• 4-sector day = 60% more fatigue than single long flight</li>
                    <li>• Regulatory FDP limits account for this (ORO.FTL.205 Table 1)</li>
                  </ul>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Gander et al. (1994): Crew factors in flight operations</li>
                  <li>• Bourgeois-Bougrine et al. (2003): Perceived fatigue in aviation</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Circadian Phase Shift */}
        <AccordionItem value="jetlag" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <span className="font-semibold">Circadian Phase Shift (Jet Lag)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                When you cross time zones, your internal circadian clock doesn't instantly adjust. 
                It adapts gradually at different rates depending on direction.
              </p>

              <div>
                <h4 className="font-medium mb-3">Adaptation Rates</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Direction</th>
                        <th className="text-left py-2 font-medium">Rate</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="py-2">Eastward</td><td className="py-2 font-mono">0.5 h/day</td><td className="py-2 text-muted-foreground">Harder (phase advance)</td></tr>
                      <tr><td className="py-2">Westward</td><td className="py-2 font-mono">0.9 h/day</td><td className="py-2 text-muted-foreground">Easier (phase delay)</td></tr>
                      <tr><td className="py-2">Large shift</td><td className="py-2 font-mono">0.3-0.7 h/day</td><td className="py-2 text-muted-foreground">Non-linear (depends on magnitude)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  Phase_Shift(t) = Phase_Shift₀ + min(|Target - Current|, Rate × Days) × sign(Target - Current)
                </code>
              </div>

              <div>
                <h4 className="font-medium mb-3">Example: Europe → New York (6h westward)</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex gap-3 p-2 rounded bg-muted/20">
                    <span className="w-14">Day 0:</span>
                    <span>Shift = 0h</span>
                    <span className="text-muted-foreground font-sans">(body still on home time)</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-muted/20">
                    <span className="w-14">Day 1:</span>
                    <span>Shift = -0.9h</span>
                    <span className="text-muted-foreground font-sans">(slight adaptation)</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-muted/20">
                    <span className="w-14">Day 3:</span>
                    <span>Shift = -2.7h</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-muted/20">
                    <span className="w-14">Day 7:</span>
                    <span>Shift = -5.4h</span>
                    <span className="text-muted-foreground font-sans">(almost adapted)</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-14">Day 8:</span>
                    <span>Shift = -6.0h</span>
                    <span className="text-muted-foreground font-sans">(fully adapted)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-info/30 bg-info/5">
                <h4 className="font-medium mb-2">Performance Impact</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Scenario: European-based pilot flying to New York on Day 2
                </p>
                <div className="text-sm space-y-2">
                  <p><strong>Body clock:</strong> Still mostly on European time</p>
                  <p><strong>NYC 02:00 = Europe 08:00</strong> (mid-morning, good circadian phase)</p>
                  <p className="text-success">Performance: Much better than if fully adapted!</p>
                  <Separator className="my-3" />
                  <p className="text-muted-foreground">But on Day 8 after full adaptation:</p>
                  <p><strong>NYC 02:00 = NYC 02:00</strong> (WOCL, terrible circadian phase)</p>
                  <p className="text-destructive">Performance: Significantly degraded</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                <strong>This is why</strong> EASA has complex acclimatization rules (AMC1 ORO.FTL.105)
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Code Implementation */}
        <AccordionItem value="code" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Code className="h-5 w-5 text-primary" />
              <span className="font-semibold">Code Implementation</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                TypeScript/JavaScript implementation of the Borbély model:
              </p>
              
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border">
                  <span className="text-sm font-medium">borbely-model.ts</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono">
{`interface BorbelyParams {
  S_max: 0.95;
  S_min: 0.0;
  tau_i: 18.2;  // hours
  tau_d: 4.2;   // hours
  C_amplitude: 0.35;
  C_mesor: 0.5;
  C_acrophase: 17.0;  // hours (5 PM)
  W_max: 0.30;
  W_tau: 30;  // minutes
}

function calculateProcessS(
  hoursAwake: number, 
  S_atWake: number
): number {
  const S_max = 0.95;
  const tau_i = 18.2;
  return S_max - (S_max - S_atWake) * Math.exp(-hoursAwake / tau_i);
}

function calculateProcessC(
  localHour: number, 
  phaseShift: number = 0
): number {
  const effectiveHour = (localHour - phaseShift + 24) % 24;
  const acrophase = 17.0;
  const angle = (2 * Math.PI * (effectiveHour - acrophase)) / 24;
  return 0.5 + 0.35 * Math.cos(angle);
}

function calculateSleepInertia(minutesAwake: number): number {
  if (minutesAwake > 30) return 0;
  return 0.30 * Math.exp(-minutesAwake / 10);
}

function calculatePerformance(
  S: number, 
  C: number, 
  W: number
): number {
  const S_alert = 1 - S;
  const C_alert = (C + 1) / 2;
  const baseAlert = S_alert * 0.6 + C_alert * 0.4;
  const alertWithInertia = baseAlert * (1 - W);
  return 20 + alertWithInertia * 80;
}`}
                </pre>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// Helper Components

function TimelineRow({ 
  time, 
  event, 
  values, 
  performance, 
  risk, 
  note 
}: { 
  time: string; 
  event: string; 
  values: string; 
  performance: number; 
  risk: string;
  note?: string;
}) {
  const riskColors: Record<string, string> = {
    'GOOD': 'bg-success/10 border-success/20 text-success',
    'MODERATE': 'bg-warning/10 border-warning/20 text-warning',
    'CRITICAL': 'bg-destructive/10 border-destructive/20 text-destructive',
    'EXTREME': 'bg-destructive/20 border-destructive/30 text-destructive',
  };

  return (
    <div className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded border ${riskColors[risk] || 'bg-muted/20 border-border'}`}>
      <span className="font-mono font-medium w-14">{time}</span>
      <span className="flex-1 text-sm">{event}</span>
      <span className="font-mono text-xs text-muted-foreground">{values}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold">{performance}</span>
        <Badge variant={risk === 'GOOD' ? 'success' : risk === 'MODERATE' ? 'warning' : 'destructive'} className="text-xs">
          {risk}
        </Badge>
      </div>
      {note && <span className="text-xs text-muted-foreground italic hidden lg:block">{note}</span>}
    </div>
  );
}
