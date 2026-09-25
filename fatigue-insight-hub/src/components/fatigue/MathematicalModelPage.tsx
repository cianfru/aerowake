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
  CombinedPerformanceChart 
} from './charts';

export function MathematicalModelPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-16">
      {/* Header */}
      <Card variant="glass" className="text-center">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold tracking-tight">The Three Process Model of Alertness</CardTitle>
          <p className="text-lg text-muted-foreground mt-3">
            Predicted sleepiness (KSS) for airline pilots — engine aerowake-4.0-kss
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="outline">Process S (Homeostatic, with brake)</Badge>
            <Badge variant="outline">Process C (Circadian)</Badge>
            <Badge variant="outline">Process U (Ultradian)</Badge>
            <Badge variant="outline">KSS output</Badge>
            <Badge variant="outline">Ingre et al. 2014</Badge>
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
        <CardContent className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            AeroWake uses the Three Process Model of alertness (Åkerstedt &amp; Folkard, 1997) in the form
            validated against sleepiness ratings from airline crew by Ingre et al. (2014, PLoS ONE e108679,
            model 5c). It predicts the Karolinska Sleepiness Scale (KSS, 1 = extremely alert … 9 = very sleepy,
            fighting sleep) for a group-average pilot from three processes:
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Process S (Homeostatic)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Sleep pressure: builds while awake and recovers during sleep. Worth up to ~5.5 KSS points.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Process C (Circadian)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                The body clock, independent of time awake. Worth ~2.3 KSS points between peak and trough.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Waves className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Process U (Ultradian)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                A small 12-hour rhythm (≤ 0.5 KSS) that captures the post-lunch dip.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
            <p className="font-medium mb-1">Not in the score</p>
            <p className="text-muted-foreground">
              Sleep inertia, time-on-task, flight-phase workload, cabin hypoxia and a sleep-debt multiplier are
              not validated in this model family and are not part of the prediction. Duty length, sectors and
              timing are reported as separate contributing factors; the 7-day sleep deficit is reported separately.
            </p>
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
              While awake, alertness reserve S falls exponentially towards a lower asymptote; during sleep it
              recovers towards an upper asymptote. Recovery slows sharply near full restoration (the "brake"),
              which is why a short sleep restores a lot while the last hours add less.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">The Mathematics (Ingre et al. 2014, eq. 1.1–1.5)</h4>
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">During Wakefulness:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  S(t) = LA + (S₀ − LA) × e^(d·t)
                </code>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">During Sleep (with brake below BL):</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  S(t) = HA − (HA − S₀) × e^(g·t)
                </code>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">HA</code>
                  <span className="text-muted-foreground">Upper asymptote (fully rested) = <strong>14.3</strong></span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">LA</code>
                  <span className="text-muted-foreground">Lower asymptote while awake = <strong>2.4</strong></span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">d</code>
                  <span className="text-muted-foreground">Wake decay rate = <strong>−0.0353 /h</strong></span>
                </div>
                <div className="flex gap-3 p-2 rounded bg-muted/20">
                  <code className="font-mono text-primary w-16">BL</code>
                  <span className="text-muted-foreground">Brake level = <strong>12.2</strong> (recovery is linear below it, exponential above)</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The app shows S normalised to 0–1 as "sleep pressure" (0 = fully rested, 1 = depleted).
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Real-World Example</h4>
            <p className="text-sm text-muted-foreground mb-3">Scenario: You wake at 07:00 after a full night's sleep (S₀ ≈ 14.0)</p>
            <div className="grid gap-2 text-sm font-mono">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="w-14">07:00</span>
                <span className="w-20">S = 14.0</span>
                <span className="text-muted-foreground font-sans">Fully rested</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-success/5 border border-success/10">
                <span className="w-14">12:00</span>
                <span className="w-20">S = 12.1</span>
                <span className="text-muted-foreground font-sans">5h awake, +0.9 KSS from S</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="w-14">18:00</span>
                <span className="w-20">S = 10.3</span>
                <span className="text-muted-foreground font-sans">11h awake, +1.7 KSS from S</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/20 border border-warning/30">
                <span className="w-14">23:00</span>
                <span className="w-20">S = 9.0</span>
                <span className="text-muted-foreground font-sans">16h awake, +2.3 KSS from S</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="w-14">03:00</span>
                <span className="w-20">S = 8.1</span>
                <span className="text-muted-foreground font-sans">20h awake, +2.7 KSS from S</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
            <p className="font-medium mb-1">Scientific Reference:</p>
            <p className="text-muted-foreground">
              Ingre M, Van Leeuwen W, Klemets T, et al. (2014). <em>Validating and extending the three process
              model of alertness in airline operations.</em> PLoS ONE 9(10): e108679
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">Interactive Visualization (illustrative shape)</h4>
            <ProcessSChart />
          </div>
        </CardContent>
      </Card>

      {/* Process C */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            Process C: Circadian Rhythm (and U)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">The Science</h4>
            <p className="text-muted-foreground leading-relaxed">
              The suprachiasmatic nucleus generates a ~24-hour rhythm of alertness that is independent of how
              long you have been awake: highest in the late afternoon, lowest in the early morning body-clock
              hours.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">The Mathematics (Ingre et al. 2014, eq. 1.7–1.8)</h4>
            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4 space-y-2">
              <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                C(t) = 2.5 · cos(2π(t − 16.8)/24)
              </code>
              <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                U(t) = −0.5 + 0.5 · cos(2π(t − 19.8)/12)
              </code>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">t</code>
                <span className="text-muted-foreground">Body-clock time (home time adjusted for acclimatization)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">16.8 h</code>
                <span className="text-muted-foreground">Circadian acrophase (peak ≈ 16:48 body-clock time)</span>
              </div>
              <div className="flex gap-3 p-2 rounded bg-muted/20">
                <code className="font-mono text-primary w-24">30 %/day</code>
                <span className="text-muted-foreground">Acclimatization: the body clock moves ~30% of the remaining time-zone difference per day (eq. 1.10)</span>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/20 text-sm">
              <p className="font-medium">Normalised to [0, 1] in the app:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• <strong>1.0</strong> = circadian peak (late afternoon)</li>
                <li>• <strong>0.0</strong> = circadian trough (early morning, ~04:48 body clock)</li>
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
                The circadian term is near its minimum here. Compared with mid-afternoon it adds roughly
                2 KSS points for the same amount of prior sleep.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
              <p className="font-medium mb-1">EASA Definition:</p>
              <p className="text-muted-foreground">
                AMC1 ORO.FTL.105(10) defines the WOCL as 02:00–05:59 in the time zone to which the crew
                member is acclimatised.
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Real-World Example</h4>
            <p className="text-sm text-muted-foreground mb-3">Same person, same sleep, different times (C normalised 0–1):</p>
            <div className="grid gap-2 text-sm font-mono">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="w-24">14:00</span>
                <span className="w-20">C = 0.87</span>
                <span className="text-muted-foreground font-sans">Afternoon, strong circadian support</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="w-24">22:00</span>
                <span className="w-20">C = 0.60</span>
                <span className="text-muted-foreground font-sans">Evening, declining support</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="w-24">03:00</span>
                <span className="w-20">C = 0.05</span>
                <span className="text-muted-foreground font-sans">WOCL, near the circadian trough</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3 p-3 bg-muted/20 rounded-lg">
              <strong>Result:</strong> the circadian term alone makes a 04:00 landing about 2 KSS points
              sleepier than a 15:00 landing after the same duty.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4">Interactive Visualization (illustrative shape)</h4>
            <ProcessCChart />
          </div>
        </CardContent>
      </Card>

      {/* Sleep inertia — not in the score */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            Sleep Inertia (not in the score)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Grogginess immediately after waking is real, but in the airline validation study the default
            sleep-inertia function made the model fit worse, so it is not part of the KSS prediction. Allow
            15–30 minutes after waking (e.g. after controlled rest) before critical tasks.
          </p>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm">
            <p className="font-medium mb-1">References:</p>
            <p className="text-muted-foreground">
              Ingre et al. (2014); Tassi P, Muzet A (2000). <em>Sleep inertia.</em> Sleep Medicine Reviews, 4(4), 341-353
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calculator className="h-5 w-5 text-primary" />
            Integration: From S, C and U to KSS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-4">The Full Pipeline</h4>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
              <p className="text-sm font-medium mb-2">Transfer to KSS (eq. 1.9, model 5c):</p>
              <code className="block bg-background/50 rounded p-3 text-sm font-mono leading-relaxed">
                KSS = 9.68 − 0.46 × (S + C + U)
              </code>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
              <p className="text-sm font-medium mb-2">Derived outputs:</p>
              <div className="space-y-1 text-sm font-mono">
                <p>index = 110 − 10 × KSS   (KSS 1 → 100, KSS 5 → 60, KSS 9 → 20)</p>
                <p>KSS₉₀ = KSS + 1.07   (90th-percentile pilot, eq. 1.16)</p>
                <p>P(KSS &gt; k) = logistic(−0.599 × (S + C + U) − K_k + offset)   (eq. 1.17)</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">≤ 5.5</p>
                <p className="text-muted-foreground">KSS from S</p>
                <p className="text-xs text-muted-foreground mt-1">Fully rested → depleted</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">≤ 2.3</p>
                <p className="text-muted-foreground">KSS from C</p>
                <p className="text-xs text-muted-foreground mt-1">Peak → trough</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">≤ 0.5</p>
                <p className="text-muted-foreground">KSS from U</p>
                <p className="text-xs text-muted-foreground mt-1">Post-lunch dip</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="h-4 w-4 text-warning" />
                <span className="font-medium text-warning">Limitations</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Predicts a group-average pilot; the typical error of predicted vs. rated KSS is about ±1.4 KSS.</li>
                <li>• Individuals differ — see the 90th-percentile KSS for a more fatigue-sensitive pilot.</li>
                <li>• Subjective sleepiness plateaus under chronic restriction while performance keeps worsening, so the 7-day sleep deficit is shown separately.</li>
                <li>• Only as good as the sleep inputs. It is not a fitness-to-fly determination: your own assessment always takes precedence.</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Risk Bands (predicted KSS)</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="font-mono font-medium w-24">&lt; 5.5</span>
                <span className="font-medium text-success w-20">Low</span>
                <span className="text-muted-foreground">Alert … neither alert nor sleepy (index ≥ 55)</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="font-mono font-medium w-24">5.5 – 6.5</span>
                <span className="font-medium text-warning w-20">Moderate</span>
                <span className="text-muted-foreground">Some signs of sleepiness (index 45–55)</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-high/10 border border-high/20">
                <span className="font-mono font-medium w-24">6.5 – 7.5</span>
                <span className="font-medium text-high w-20">High</span>
                <span className="text-muted-foreground">Sleepy, no effort to stay awake (index 35–45)</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="font-mono font-medium w-24">7.5 – 8.5</span>
                <span className="font-medium text-destructive w-20">Critical</span>
                <span className="text-muted-foreground">Sleepy, some effort to stay awake (index 25–35)</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/20 border border-destructive/30">
                <span className="font-mono font-medium w-24">≥ 8.5</span>
                <span className="font-medium text-destructive w-20">Extreme</span>
                <span className="text-muted-foreground">Very sleepy, fighting sleep (index &lt; 25)</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              KSS ≥ 7 is associated with physiological signs of sleepiness and impaired waking function
              (Åkerstedt et al., 2014); KSS 8–9 with sharply more lapses in driving studies (Ingre et al., 2006).
              The index is not a percentage and not alcohol-equivalent.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Complete Example Timeline</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Scenario: acclimatised to home time, woke 07:00 after a full night, no nap, night duty reporting 23:00
            </p>
            <div className="space-y-2 text-sm">
              <TimelineRow time="07:00" event="Wake" values="S = 14.0, C = −2.1" performance={68} risk="LOW" note="KSS 4.2" />
              <TimelineRow time="15:00" event="Afternoon (8h awake)" values="S = 11.2, C = 2.2" performance={71} risk="LOW" note="KSS 3.9" />
              <TimelineRow time="23:00" event="Report (16h awake)" values="S = 9.0, C = −0.1" performance={51} risk="MODERATE" note="KSS 5.9" />
              <TimelineRow time="02:00" event="Cruise (19h awake, WOCL)" values="S = 8.3, C = −1.9" performance={38} risk="HIGH" note="KSS 7.2" />
              <TimelineRow time="05:00" event="Landing (22h awake, WOCL)" values="S = 7.7, C = −2.5" performance={35} risk="HIGH" note="KSS 7.5" />
            </div>
            <div className="mt-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <p className="font-semibold text-destructive mb-2">Why is this dangerous?</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>22 hours awake by landing — sleep pressure is high</li>
                <li>Landing near the circadian trough</li>
                <li>Predicted KSS ≈ 7.5: sleepy, on the edge of needing effort to stay awake</li>
                <li>A pre-duty afternoon nap would lower S and the predicted KSS</li>
              </ol>
            </div>
          </div>

          <Separator />

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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'Workload multipliers and the sector penalty are legacy mechanisms. They are not part of the aerowake-4.0-kss prediction; sectors and duty length are reported as separate contributing factors.'}
              </div>
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
                      <tr><td className="py-2">Any direction</td><td className="py-2 font-mono">30 % of remaining difference / day</td><td className="py-2 text-muted-foreground">Empirically optimal rate in airline data (Ingre et al. 2014, eq. 1.10)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Formula:</p>
                <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                  Shift(day) = Target × (1 − 0.7^day)
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
                    <span>Shift = -1.8h</span>
                    <span className="text-muted-foreground font-sans">(30% adapted)</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-muted/20">
                    <span className="w-14">Day 3:</span>
                    <span>Shift = -3.9h</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-muted/20">
                    <span className="w-14">Day 7:</span>
                    <span>Shift = -5.5h</span>
                    <span className="text-muted-foreground font-sans">(~92% adapted)</span>
                  </div>
                  <div className="flex gap-3 p-2 rounded bg-success/10 border border-success/20">
                    <span className="w-14">Day 8:</span>
                    <span>Shift = -5.7h</span>
                    <span className="text-muted-foreground font-sans">(~94% adapted)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-info/30 bg-info/5">
                <h4 className="font-medium mb-2">Alertness Impact</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Scenario: European-based pilot flying to New York on Day 2
                </p>
                <div className="text-sm space-y-2">
                  <p><strong>Body clock:</strong> Still mostly on European time</p>
                  <p><strong>NYC 02:00 = Europe 08:00</strong> (mid-morning, good circadian phase)</p>
                  <p className="text-success">Predicted KSS: much lower than if fully adapted</p>
                  <Separator className="my-3" />
                  <p className="text-muted-foreground">But on Day 8 after full adaptation:</p>
                  <p><strong>NYC 02:00 = NYC 02:00</strong> (WOCL, terrible circadian phase)</p>
                  <p className="text-destructive">Predicted KSS: ~2 points higher from the circadian term alone</p>
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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'Time-on-task is a legacy mechanism and is not part of the aerowake-4.0-kss prediction (the validated model has no time-on-task term). Duty length is reported as a separate contributing factor.'}
              </div>
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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'The debt multiplier is a legacy mechanism and is not part of the aerowake-4.0-kss prediction. Chronic restriction is instead shown as a separate 7-day sleep deficit (none < 5h, mild 5–10h, moderate 10–15h, severe ≥ 15h), because KSS plateaus under chronic restriction while objective performance keeps worsening.'}
              </div>
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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'Cabin hypoxia is a legacy mechanism and is not part of the aerowake-4.0-kss prediction. Cabin altitude is shown for context only.'}
              </div>
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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'Legacy mechanism. In aerowake-4.0-kss, sleep recovery follows the Three Process Model S process with its "brake" (Ingre et al. 2014), not this formula.'}
              </div>
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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'Legacy mechanism, not part of the aerowake-4.0-kss prediction.'}
              </div>
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
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-warning">Not in the score. </span>
                {'Legacy mechanism, not part of the aerowake-4.0-kss prediction. Individual differences are shown instead as the 90th-percentile KSS (Ingre et al. 2014, eq. 1.16).'}
              </div>
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
                Beyond predicted KSS, the app shows the probability of severe sleepiness from the published
                ordinal model and a legacy PVT-lapse heuristic.
              </p>

              <div>
                <h4 className="font-medium mb-3">PVT Lapses (legacy heuristic, not validated in this model)</h4>
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
                <h4 className="font-medium mb-3">P(KSS ≥ 7) and P(KSS = 9)</h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3">
                  <code className="block bg-background/50 rounded p-3 text-sm font-mono">
                    P(KSS &gt; k) = logistic(−0.599 × (S + C + U) − K_k + offset)
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  The published ordinal model (Ingre et al. 2014, eq. 1.17) gives the probability of each KSS
                  level. The app shows P(KSS ≥ 7, "sleepy") and, in the field labelled microsleep, P(KSS = 9,
                  "fighting sleep"). These are probabilities of a sleepiness rating, not measured microsleep rates.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Scientific Basis:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Basner & Dinges (2011): PVT lapses dose-response formula</li>
                  <li>• Ingre et al. (2014): Ordinal model of KSS levels (eq. 1.17)</li>
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
                Simplified implementation of the prediction (sleep recovery with the brake omitted):
              </p>

              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border">
                  <span className="text-sm font-medium">three-process-model.ts</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono">
{`// Three Process Model — Ingre et al. (2014), model 5c
const HA = 14.3, LA = 2.4, D = -0.0353;

// Process S while awake (hours since wake)
function processS(hoursAwake: number, S0: number): number {
  return LA + (S0 - LA) * Math.exp(D * hoursAwake);
}

// Process C and U (body-clock hour)
function processC(t: number): number {
  return 2.5 * Math.cos((2 * Math.PI * (t - 16.8)) / 24);
}
function processU(t: number): number {
  return -0.5 + 0.5 * Math.cos((2 * Math.PI * (t - 16.8 - 3)) / 12);
}

// KSS transfer (eq. 1.9) and the 20–100 index
function kss(S: number, t: number): number {
  const raw = 9.68 - 0.46 * (S + processC(t) + processU(t));
  return Math.min(9, Math.max(1, raw));
}
const index = (k: number) => 110 - 10 * k;`}
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
    'LOW': 'bg-success/10 border-success/20 text-success',
    'MODERATE': 'bg-warning/10 border-warning/20 text-warning',
    'HIGH': 'bg-high/10 border-high/20 text-high',
    'CRITICAL': 'bg-destructive/10 border-destructive/20 text-destructive',
    'EXTREME': 'bg-destructive/20 border-destructive/30 text-destructive',
  };

  return (
    <div className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded border ${riskColors[risk] || 'bg-muted/20 border-border'}`}>
      <span className="font-mono font-medium w-14">{time}</span>
      <span className="flex-1 text-sm">{event}</span>
      <span className="font-mono text-xs text-muted-foreground">{values}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold" title="index = 110 − 10·KSS">{performance}</span>
        <Badge variant={risk === 'LOW' ? 'success' : risk === 'MODERATE' ? 'warning' : risk === 'HIGH' ? 'high' : 'destructive'} className="text-xs">
          {risk}
        </Badge>
      </div>
      {note && <span className="text-xs text-muted-foreground italic">{note}</span>}
    </div>
  );
}
