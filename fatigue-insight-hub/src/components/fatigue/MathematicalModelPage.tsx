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
  Info,
  Mountain,
  FlaskConical,
  Activity,
  Wrench,
  ShieldAlert,
  Gauge,
  User,
  Waves,
  Battery
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
            <Badge variant="outline">Time-on-Task</Badge>
            <Badge variant="outline">Sleep Debt</Badge>
            <Badge variant="outline">Cabin Hypoxia</Badge>
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
            <h4 className="font-semibold mb-4">The Mathematics — Two-Harmonic Model</h4>

            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
              <p className="text-sm font-medium mb-2">Fundamental + Second Harmonic:</p>
              <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                C(t) = M + A₁·cos(2π(t−φ₁)/24) + A₂·cos(4π(t−φ₂)/24)
              </code>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">M</code>
                <span className="text-muted-foreground">Mesor (midline) = <strong>0.5</strong></span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">A₁</code>
                <span className="text-muted-foreground">Fundamental amplitude = <strong>0.25</strong> (Dijk & Czeisler, 1994)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">φ₁</code>
                <span className="text-muted-foreground">Acrophase (peak time) = <strong>17:00</strong> (5 PM)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">A₂</code>
                <span className="text-muted-foreground">Second harmonic amplitude = <strong>0.08</strong> (≈ 0.3 × A₁)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">φ₂</code>
                <span className="text-muted-foreground">Second harmonic phase = <strong>20:00</strong> (8 PM)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">t</code>
                <span className="text-muted-foreground">Local hour adjusted for circadian phase shift</span>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-info/5 border border-info/20 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Waves className="h-4 w-4 text-info" />
                <p className="font-medium">Wake Maintenance Zone (WMZ)</p>
              </div>
              <p className="text-muted-foreground mb-2">
                The second harmonic creates a paradoxical alertness plateau between ~18:00-21:00 — the
                "forbidden zone for sleep" (Lavie, 1986). Despite rising homeostatic pressure in the evening,
                the circadian system actively promotes wakefulness, making it very difficult to fall asleep.
              </p>
              <p className="text-muted-foreground">
                This bimodal structure was confirmed by Strogatz et al. (1987) and is why a single cosine
                wave is insufficient to model real circadian alertness.
              </p>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-muted/20 text-sm">
              <p className="font-medium">Normalized to [0, 1] scale:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• <strong>1.0</strong> = Peak alertness (afternoon, ~17:00)</li>
                <li>• <strong>~0.7</strong> = WMZ plateau (evening, ~18:00-21:00)</li>
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
            <h4 className="font-semibold mb-4">The Full Pipeline</h4>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
              <p className="text-sm font-medium mb-2">6-Stage Computation:</p>
              <code className="block bg-background/50 rounded p-3 text-sm font-mono leading-relaxed">
                Base → Inertia → Time-on-Task → Debt Penalty → Hypoxia → Scale to 20-100
              </code>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
              <p className="text-sm font-medium mb-2">Where:</p>
              <div className="space-y-1 text-sm font-mono">
                <p>Base_Alertness = (S_alertness × 0.55) + (C_alertness × 0.45)</p>
                <p>S_alertness = 1 - S</p>
                <p>C_alertness = (C + 1) / 2</p>
                <p>After_Inertia = Base_Alertness × (1 - W)</p>
                <p>After_ToT = After_Inertia - T(hours_on_task)</p>
                <p>After_Debt = After_ToT × D(sleep_debt)</p>
                <p>After_Hypoxia = After_Debt × H(cabin_altitude)</p>
                <p>Performance = 20 + After_Hypoxia × 80</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">55%</p>
                <p className="text-muted-foreground">Process S Weight</p>
                <p className="text-xs text-muted-foreground mt-1">Dominant factor</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">45%</p>
                <p className="text-muted-foreground">Process C Weight</p>
                <p className="text-xs text-muted-foreground mt-1">Modulating factor</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">×</p>
                <p className="text-muted-foreground">Modifiers</p>
                <p className="text-xs text-muted-foreground mt-1">W, T, D, H multiplicative</p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="h-4 w-4 text-warning" />
                <span className="font-medium text-warning">Calibration Note</span>
              </div>
              <p className="text-muted-foreground">
                The 55/45 S/C weighting is an operational calibration choice — not directly from the
                literature. Gander et al. (2013) showed trained pilots maintain performance better
                than predicted during moderate circadian lows, supporting a slightly homeostatic-dominant
                weighting. The research config uses 50/50 for academic comparison.
              </p>
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

        {/* Non-Linear Time-on-Task */}
        <AccordionItem value="time-on-task" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">Non-Linear Time-on-Task</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Extended duty time causes cognitive fatigue that accelerates non-linearly beyond ~8 hours.
                The model uses a logarithmic ramp for normal duties with a quadratic acceleration for
                extended operations.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  T(h) = k₁ · log(1 + h) + k₂ · max(0, h − h_inf)²
                </code>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">k₁</code>
                  <span className="text-muted-foreground">Log coefficient = <strong>0.012</strong> (gentle initial ramp)</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">k₂</code>
                  <span className="text-muted-foreground">Quadratic coefficient = <strong>0.0005</strong> (acceleration after inflection)</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">h_inf</code>
                  <span className="text-muted-foreground">Inflection point = <strong>8.0 hours</strong></span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Fatigue Accumulation by Duty Length</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-14">4h</span>
                    <span className="w-24">T ≈ 0.019</span>
                    <span className="text-muted-foreground font-sans">Minimal time-on-task effect</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-success/5 border border-success/10">
                    <span className="w-14">8h</span>
                    <span className="w-24">T ≈ 0.026</span>
                    <span className="text-muted-foreground font-sans">At inflection point</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                    <span className="w-14">12h</span>
                    <span className="w-24">T ≈ 0.039</span>
                    <span className="text-muted-foreground font-sans">Quadratic acceleration begins</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <span className="w-14">16h</span>
                    <span className="w-24">T ≈ 0.058</span>
                    <span className="text-muted-foreground font-sans">Significant fatigue penalty</span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Folkard & Åkerstedt (1999): Linear time-on-task component</li>
                  <li>• Cabon et al. (2008): Non-linear acceleration beyond ~8h in cockpit environments</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Sleep Debt Vulnerability */}
        <AccordionItem value="sleep-debt" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold">Sleep Debt Vulnerability</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Chronic sleep restriction amplifies fatigue beyond what Process S alone predicts.
                Accumulated sleep debt acts as a multiplier on the performance deficit — even moderate
                nightly shortfalls compound into significant impairment over days.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  D = max(0.80, 1.0 − 0.025 × debt_hours)
                </code>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-20">0.025</code>
                  <span className="text-muted-foreground">Vulnerability coefficient per hour of debt</span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-20">0.80</code>
                  <span className="text-muted-foreground">Floor (debt alone cannot reduce below 80% of debt-free value)</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Impact by Accumulated Debt</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-20">0h debt</span>
                    <span className="w-20">D = 1.00</span>
                    <span className="text-muted-foreground font-sans">No penalty</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-success/5 border border-success/10">
                    <span className="w-20">4h debt</span>
                    <span className="w-20">D = 0.90</span>
                    <span className="text-muted-foreground font-sans">−10% alertness</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                    <span className="w-20">8h debt</span>
                    <span className="w-20">D = 0.80</span>
                    <span className="text-muted-foreground font-sans">−20% alertness (floor reached)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-info/20 bg-info/5 text-sm">
                <h4 className="font-medium mb-2">Sleep Debt Tracking</h4>
                <p className="text-muted-foreground mb-2">
                  Debt is calculated against an 8-hour baseline sleep need (Van Dongen et al., 2003).
                  It decays at a rate of 0.35 per day (half-life ≈ 2 days).
                </p>
                <p className="text-muted-foreground">
                  Banks et al. (2010) showed one night of 10h TIB was insufficient to fully restore
                  baseline after 5 nights of 4h restriction — debt recovery is slow and incremental.
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Van Dongen et al. (2003): Cumulative cost of additional wakefulness</li>
                  <li>• Banks & Dinges (2007): Performance degrades proportionally to accumulated debt</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Cabin Altitude Hypoxia */}
        <AccordionItem value="hypoxia" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Mountain className="h-5 w-5 text-primary" />
              <span className="font-semibold">Cabin Altitude Hypoxia</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Aircraft cabin pressure is maintained at an equivalent altitude of 6,000-8,000 ft,
                producing mild hypoxia that subtly degrades cognitive performance. The effect is small
                but compounds with other fatigue factors.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  H = 1.0 − 0.01 × max(0, cabin_alt − 5000) / 1000
                </code>
              </div>

              <div>
                <h4 className="font-medium mb-3">Cabin Altitude by Aircraft Type</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Aircraft</th>
                        <th className="text-left py-2 font-medium">Cabin Altitude</th>
                        <th className="text-left py-2 font-medium">Hypoxia Factor</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="py-2">A350</td>
                        <td className="py-2 font-mono">6,000 ft</td>
                        <td className="py-2 font-mono text-success">0.99</td>
                        <td className="py-2 text-muted-foreground">−1% (composite fuselage)</td>
                      </tr>
                      <tr>
                        <td className="py-2">A320 / A330</td>
                        <td className="py-2 font-mono">7,000 ft</td>
                        <td className="py-2 font-mono text-warning">0.98</td>
                        <td className="py-2 text-muted-foreground">−2% (standard cabin)</td>
                      </tr>
                      <tr>
                        <td className="py-2">777 / 787</td>
                        <td className="py-2 font-mono">7,300 ft</td>
                        <td className="py-2 font-mono text-warning">0.977</td>
                        <td className="py-2 text-muted-foreground">−2.3%</td>
                      </tr>
                      <tr>
                        <td className="py-2">Older narrowbody</td>
                        <td className="py-2 font-mono">8,000 ft</td>
                        <td className="py-2 font-mono text-destructive">0.97</td>
                        <td className="py-2 text-muted-foreground">−3% (maximum typical)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/20 text-sm text-muted-foreground">
                Below 5,000 ft cabin altitude there is no hypoxia effect. Ground operations and
                low-altitude flights are unaffected.
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Nesthus et al. (2007): FAA study on cognitive performance at cabin altitude</li>
                  <li>• Muhm et al. (2007): SpO₂ reduction and cognitive impairment at 6,000-8,000 ft</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SWA Diminishing Returns */}
        <AccordionItem value="swa" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-primary" />
              <span className="font-semibold">SWA Diminishing Returns</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Slow-wave activity (SWA) power declines exponentially during sleep, making the
                first hours of sleep the most restorative. After ~5-6 hours, recovery is increasingly
                dominated by lighter stages (Stage 2, REM) which contribute less to Process S recovery.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  τ_d_eff = τ_d × (1 + 0.15 × t_sleep / 8.0)
                </code>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">τ_d</code>
                  <span className="text-muted-foreground">Base decay time constant = <strong>4.2 hours</strong></span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">0.15</code>
                  <span className="text-muted-foreground">Diminishing returns coefficient</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Recovery Efficiency Over Time</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-24">After 4h</span>
                    <span className="w-28">τ_d_eff = 4.52</span>
                    <span className="text-muted-foreground font-sans">+7.5% slower (still highly efficient)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                    <span className="w-24">After 8h</span>
                    <span className="w-28">τ_d_eff = 4.83</span>
                    <span className="text-muted-foreground font-sans">+15% slower (diminishing returns)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                <p className="font-medium text-success mb-1">Key Insight</p>
                <p className="text-muted-foreground">
                  The first 4 hours of sleep are substantially more valuable than hours 5-8.
                  This is why even short sleep periods before a duty provide meaningful recovery.
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <p className="mt-1">Borbély & Achermann (1999): SWA power decline during sleep — Pharmacopsychiatry 32:56-67</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Recovery Sleep Rebound */}
        <AccordionItem value="recovery-rebound" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Battery className="h-5 w-5 text-primary" />
              <span className="font-semibold">Recovery Sleep Rebound</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                When carrying significant sleep debt, the body extends sleep duration beyond the
                normal baseline — a phenomenon known as "recovery rebound." However, recovery is
                capped by the circadian wake signal which terminates sleep regardless of remaining debt.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  recovery_duration = base + 0.15 × min(debt, 20)
                </code>
              </div>

              <div>
                <h4 className="font-medium mb-3">Rebound by Debt Level</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-3 p-2 rounded bg-muted/20">
                    <span className="w-20">0h debt</span>
                    <span className="text-muted-foreground font-sans">Base duration (7.5-8h)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-muted/20">
                    <span className="w-20">10h debt</span>
                    <span className="text-muted-foreground font-sans">+1.5h → ~9.0h total (aligns with Banks 2010)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-muted/20">
                    <span className="w-20">20h debt</span>
                    <span className="text-muted-foreground font-sans">+3.0h → ~10.5h (capped by circadian wake gate at ~10h)</span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Banks et al. (2010): Recovery sleep averaged 9.0h after chronic restriction</li>
                  <li>• Kitamura et al. (2016): Recovery duration scales with debt but saturates ~10h</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Circadian Amplitude Dampening */}
        <AccordionItem value="dampening" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-primary" />
              <span className="font-semibold">Circadian Amplitude Dampening</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Chronic sleep restriction doesn't just increase homeostatic pressure — it also dampens
                the amplitude of the circadian rhythm. Well-rested individuals show large day-night
                alertness differences, while sleep-deprived individuals show a flattened rhythm.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  A_eff = A × (1 − 0.25 × min(debt, 20) / 20)
                </code>
              </div>

              <div className="grid gap-2 text-sm font-mono">
                <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                  <span className="w-20">0h debt</span>
                  <span className="text-muted-foreground font-sans">Full circadian amplitude (large day-night swing)</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <span className="w-20">10h debt</span>
                  <span className="text-muted-foreground font-sans">Amplitude reduced by 12.5%</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <span className="w-20">20h debt</span>
                  <span className="text-muted-foreground font-sans">Amplitude reduced by 25% (rhythm substantially flattened)</span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <p className="mt-1">McCauley et al. (2013): Chronic sleep restriction dampens circadian performance amplitude — PNAS 110:E2380-E2389</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Chronotype & Individual Vulnerability */}
        <AccordionItem value="chronotype" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <span className="font-semibold">Chronotype & Individual Vulnerability</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Individuals differ in two important ways: their natural circadian timing (chronotype) and
                their vulnerability to sleep deprivation. These are trait-like characteristics — stable
                across time and conditions.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="font-medium mb-2">Chronotype Offset</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Shifts the circadian acrophase by ±2 hours:
                  </p>
                  <div className="space-y-1 text-sm font-mono">
                    <p className="text-success">Morning type: acrophase ~15:00</p>
                    <p>Average type: acrophase ~17:00</p>
                    <p className="text-warning">Evening type: acrophase ~19:00</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Default: 0h (average chronotype)</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="font-medium mb-2">Vulnerability Factor</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Scales the performance deficit:
                  </p>
                  <div className="space-y-1 text-sm font-mono">
                    <p className="text-success">0.7 = Resilient (tolerates sleep loss well)</p>
                    <p>1.0 = Average</p>
                    <p className="text-destructive">1.3 = Sensitive (3× greater impairment)</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Default: 1.0 (average vulnerability)</p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Roenneberg et al. (2007): Chronotype epidemiology — acrophase shifts ±2h</li>
                  <li>• Van Dongen et al. (2004): Trait-like differential vulnerability to sleep loss</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Derived Safety Metrics */}
        <AccordionItem value="safety-metrics" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <span className="font-semibold">Derived Safety Metrics</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Beyond the main performance score, the model derives two additional safety-critical
                metrics that quantify operational risk in more concrete terms.
              </p>

              <div>
                <h4 className="font-medium mb-3">PVT Lapses (Reaction Time Failures)</h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3">
                  <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                    L = 1.5 + 0.4 × debt + 1.2 × max(0, awake − 16)
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  PVT (Psychomotor Vigilance Test) lapses are attention failures where reaction time
                  exceeds 500ms. A well-rested baseline is ~1.5 lapses per 10-min test. Each hour of
                  debt adds 0.4 lapses; each hour awake beyond 16h adds 1.2 lapses.
                </p>
                <div className="mt-2 grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-40">0h debt, 8h awake</span>
                    <span className="text-muted-foreground font-sans">1.5 lapses (baseline)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                    <span className="w-40">4h debt, 14h awake</span>
                    <span className="text-muted-foreground font-sans">3.1 lapses</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <span className="w-40">8h debt, 20h awake</span>
                    <span className="text-muted-foreground font-sans">9.5 lapses (severely impaired)</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Microsleep Probability</h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3">
                  <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                    P = 0.02 × exp(4 × (S − 0.50)) × (1 + 2 × max(0, 0.5 − C))
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Microsleep events (involuntary sleep episodes lasting 0.5-15 seconds) are one of the
                  most dangerous consequences of fatigue during flight operations. The probability
                  increases exponentially with sleep pressure and is amplified during circadian lows.
                </p>
                <div className="mt-2 grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-32">S=0.3, C=0.7</span>
                    <span className="text-muted-foreground font-sans">P ≈ 0.9% (well-rested, daytime)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                    <span className="w-32">S=0.6, C=0.3</span>
                    <span className="text-muted-foreground font-sans">P ≈ 4.4% (tired, night)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <span className="w-32">S=0.8, C=0.15</span>
                    <span className="text-muted-foreground font-sans">P ≈ 17% (extreme fatigue, WOCL)</span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Basner & Dinges (2011): PVT lapses dose-response formula</li>
                  <li>• Åkerstedt et al. (2010): Microsleep probability — circadian and sleep pressure interaction</li>
                </ul>
              </div>
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
                Simplified implementation of the full pipeline:
              </p>

              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border">
                  <span className="text-sm font-medium">fatigue-pipeline.ts</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono">
{`// Process S — Homeostatic sleep pressure
function processS(hoursAwake: number, S0: number): number {
  return 0.95 - (0.95 - S0) * Math.exp(-hoursAwake / 18.2);
}

// Process C — Two-harmonic circadian rhythm
function processC(localHour: number, phaseShift = 0): number {
  const t = (localHour - phaseShift + 24) % 24;
  const fundamental = 0.25 * Math.cos((2 * Math.PI * (t - 17)) / 24);
  const secondHarmonic = 0.08 * Math.cos((4 * Math.PI * (t - 20)) / 24);
  return 0.5 + fundamental + secondHarmonic;
}

// Process W — Sleep inertia (exponential decay)
function processW(minutesAwake: number): number {
  if (minutesAwake > 30) return 0;
  return 0.30 * Math.exp(-minutesAwake / 10);
}

// Time-on-task (non-linear)
function timeOnTask(hours: number): number {
  return 0.012 * Math.log(1 + hours) +
    0.0005 * Math.max(0, hours - 8) ** 2;
}

// Sleep debt vulnerability
function debtPenalty(debtHours: number): number {
  return Math.max(0.80, 1.0 - 0.025 * debtHours);
}

// Cabin altitude hypoxia
function hypoxia(cabinAltFt: number): number {
  return 1.0 - 0.01 * Math.max(0, cabinAltFt - 5000) / 1000;
}

// Full pipeline
function performance(
  S: number, C: number, W: number,
  dutyHours: number, debtHours: number, cabinAlt = 7000
): number {
  const sAlert = 1 - S;
  const cAlert = (C + 1) / 2;
  const base = sAlert * 0.55 + cAlert * 0.45;
  const afterInertia = base * (1 - W);
  const afterToT = afterInertia - timeOnTask(dutyHours);
  const afterDebt = afterToT * debtPenalty(debtHours);
  const afterHypoxia = afterDebt * hypoxia(cabinAlt);
  return 20 + Math.max(0, afterHypoxia) * 80;
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
