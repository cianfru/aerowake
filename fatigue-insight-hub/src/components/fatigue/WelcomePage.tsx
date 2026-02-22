import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { 
  Target, 
  FlaskConical, 
  Rocket, 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  Cpu, 
  BookOpen, 
  PlayCircle,
  BarChart3,
  HeadphonesIcon,
  Scale,
  Award,
  History,
  Map,
  Lightbulb,
  Heart,
  Plane,
  UserCheck,
  Building2,
  Search
} from 'lucide-react';

export function WelcomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 md:space-y-8 p-4 md:p-6 pb-12 md:pb-16">
      {/* Hero Section */}
      <Card variant="glass" className="text-center">
        <CardHeader className="pb-3 md:pb-4">
          <CardTitle className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Aerowake</CardTitle>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground mt-2 md:mt-3">
            Your Evidence-Based Aviation Fatigue Analysis Tool
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-1.5 md:gap-2 flex-wrap">
            <Badge variant="info" className="text-[10px] md:text-xs">Borbély Two-Process Model</Badge>
            <Badge variant="success" className="text-[10px] md:text-xs">EASA ORO.FTL Compliant</Badge>
            <Badge variant="outline" className="text-[10px] md:text-xs">Professional Grade</Badge>
          </div>
        </CardContent>
      </Card>

      {/* What Is This Tool */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            What Is This Tool?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            <strong>Aerowake</strong> is a scientifically-validated aviation fatigue analysis platform 
            that helps pilots, safety managers, and aviation professionals understand and quantify pilot fatigue 
            using biomathematical modeling.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureItem 
              title="Objective Fatigue Assessment" 
              description="Mathematical predictions based on peer-reviewed research"
            />
            <FeatureItem 
              title="Roster Analysis" 
              description="Identify high-risk duties before they happen"
            />
            <FeatureItem 
              title="Educational Insights" 
              description="Understand why certain duty patterns are fatiguing"
            />
            <FeatureItem 
              title="SMS Documentation" 
              description="Generate evidence-based fatigue reports"
            />
            <FeatureItem 
              title="Advocacy Support" 
              description="Data-driven input for roster negotiations"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scientific Foundation */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary" />
            Scientific Foundation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            Built on the <strong>Borbély Two-Process Model</strong> of sleep regulation, validated by:
          </p>
          
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <p className="font-medium">30+ years of sleep research</p>
              <p className="text-sm text-muted-foreground">Borbély & Achermann, 1999</p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <p className="font-medium">EASA fatigue studies</p>
              <p className="text-sm text-muted-foreground">Moebus Report, 2008-2013</p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <p className="font-medium">NASA aviation research</p>
              <p className="text-sm text-muted-foreground">Gander et al., 1994</p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <p className="font-medium">Operational validation studies</p>
              <p className="text-sm text-muted-foreground">Signal et al., 2009</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">What Makes It Different?</h4>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Most pilots don't have access to the sophisticated Fatigue Risk Management Systems (FRMS) 
              used by airlines. This tool levels the playing field by providing:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" />
                <span><strong>The same science</strong> airlines use for their FRMS</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" />
                <span><strong>Full transparency</strong> — see exactly how calculations work</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" />
                <span><strong>Professional-grade analysis</strong> — developed with extensive domain expertise</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" />
                <span><strong>Comprehensive documentation</strong> — understand the methodology</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-primary" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6">
            <ProcessStep 
              number={1}
              title="Input Your Roster"
              description="Upload or manually enter your duty schedule including duty report/release times, flight segments and airports, and rest periods between duties."
            />
            <ProcessStep 
              number={2}
              title="Automatic Sleep Estimation"
              description="The system intelligently estimates sleep opportunities based on duty patterns, time available between duties, scientifically-validated sleep strategies, and circadian rhythm alignment."
            />
            <ProcessStep 
              number={3}
              title="Biomathematical Modeling"
              description="For each minute of every duty, the model calculates Process S (sleep pressure), Process C (circadian rhythm), Process W (sleep inertia), workload factors, and cumulative sleep debt."
            />
            <ProcessStep 
              number={4}
              title="Performance Predictions"
              description="Get minute-by-minute performance scores on a 0-100 scale, from optimal (90-100) through good, moderate, high risk, critical, to extreme impairment."
            />
            <ProcessStep 
              number={5}
              title="Actionable Insights"
              description="Receive visual timelines, monthly heatmaps, pinch event detection, SMS-ready reports with EASA references, and evidence-based mitigation suggestions."
            />
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Performance Scale Reference</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-3 p-2 rounded bg-success/10 border border-success/20">
                <span className="font-mono font-medium w-16">90-100</span>
                <span className="font-medium text-success">Optimal</span>
                <span className="text-muted-foreground">Full cognitive capacity</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-success/5 border border-success/10">
                <span className="font-mono font-medium w-16">75-90</span>
                <span className="font-medium text-success/80">Good</span>
                <span className="text-muted-foreground">Minor fatigue, safe operations</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/10 border border-warning/20">
                <span className="font-mono font-medium w-16">65-75</span>
                <span className="font-medium text-warning">Moderate</span>
                <span className="text-muted-foreground">Enhanced monitoring recommended</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warning/20 border border-warning/30">
                <span className="font-mono font-medium w-16">55-65</span>
                <span className="font-medium text-warning">High Risk</span>
                <span className="text-muted-foreground">Mitigation strategies required</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="font-mono font-medium w-16">45-55</span>
                <span className="font-medium text-destructive">Critical</span>
                <span className="text-muted-foreground">Roster modification mandatory</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/20 border border-destructive/30">
                <span className="font-mono font-medium w-16">0-45</span>
                <span className="font-medium text-destructive">Extreme</span>
                <span className="text-muted-foreground">Unsafe to operate</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Who Should Use This */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            Who Should Use This?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <UserCard 
              icon={Plane}
              title="Pilots"
              items={[
                "Before accepting rosters — identify problematic duties proactively",
                "Filing fatigue reports — provide objective evidence for SMS",
                "Understanding your fatigue — learn what makes duties fatiguing",
                "Comparing roster options — choose safer patterns when possible"
              ]}
            />
            <UserCard 
              icon={UserCheck}
              title="Safety Managers"
              items={[
                "Roster design — test duty patterns before publication",
                "Incident investigation — understand fatigue contributions",
                "Trend analysis — track fatigue risk across operations",
                "Compliance validation — verify EASA FTL adherence"
              ]}
            />
            <UserCard 
              icon={Building2}
              title="Pilot Unions & Associations"
              items={[
                "Collective bargaining — data-driven roster negotiations",
                "Member support — validate individual fatigue concerns",
                "Pattern analysis — identify systemic issues",
                "Policy development — evidence-based recommendations"
              ]}
            />
            <UserCard 
              icon={Search}
              title="Researchers & Students"
              items={[
                "Learning tool — understand biomathematical modeling",
                "Validation studies — compare predictions vs. operational data",
                "Model development — extend/improve algorithms",
                "Academic research — citation-ready scientific basis"
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Educational Philosophy */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-primary" />
            Educational Philosophy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            This tool is designed to <strong>empower through understanding</strong>:
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <h4 className="font-semibold mb-3">Transparent Methodology</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Every calculation is explained</li>
                <li>All formulas are documented</li>
                <li>Scientific references provided</li>
                <li>Source code available for review</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <h4 className="font-semibold mb-3">Learning-First Design</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Interactive visualizations</li>
                <li>Real-world examples</li>
                <li>Step-by-step explanations</li>
                <li>"Why does this happen?" sections</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-5">
              <h4 className="font-semibold mb-3">Evidence-Based</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Peer-reviewed research only</li>
                <li>Transparent assumptions</li>
                <li>Validated parameters</li>
                <li>Honest about limitations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What This Tool IS / IS NOT */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              What This Tool IS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <IsItem text="Educational — Learn about fatigue science" />
              <IsItem text="Analytical — Understand your roster" />
              <IsItem text="Predictive — Model likely fatigue levels" />
              <IsItem text="Evidence-based — Grounded in research" />
              <IsItem text="Advocacy tool — Support safety conversations" />
              <IsItem text="Professional-grade — Built with extensive expertise" />
            </ul>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              What This Tool IS NOT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <IsNotItem text="Not certified — Not for regulatory compliance certification" />
              <IsNotItem text="Not operational — Not for go/no-go duty decisions" />
              <IsNotItem text="Not medical — Not a fitness-for-duty assessment" />
              <IsNotItem text="Not a replacement — Doesn't replace airline FRMS" />
              <IsNotItem text="Not validated for you — Individual variation exists" />
              <IsNotItem text="Not guaranteed — No warranty for predictions" />
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Sections */}
      <Accordion type="multiple" className="space-y-4">
        {/* Privacy & Data */}
        <AccordionItem value="privacy" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Privacy & Data</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Your Data, Your Control</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span><strong>Secure processing</strong> — Industry-standard security practices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span><strong>No unnecessary tracking</strong> — Minimal data collection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span><strong>Export anytime</strong> — Download your data in open formats</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span><strong>Clear privacy policy</strong> — Transparent data handling</span>
                  </li>
                </ul>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Transparent Development</h4>
                <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
                  <p>GitHub Repository: github.com/cianfru/aerowake</p>
                  <p>Backend: github.com/cianfru/fatigue-tool</p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  The codebase is available for review, ensuring verifiable calculations, 
                  scientific accuracy, community feedback, and continuous improvement.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Technical Architecture */}
        <AccordionItem value="technical" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-primary" />
              <span className="font-semibold">Technical Architecture</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-2">Backend Engine</h4>
                <p className="text-sm text-muted-foreground mb-2">Python (FastAPI)</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Borbély fatigue model implementation</li>
                  <li>• EASA compliance validator</li>
                  <li>• Sleep quality calculator</li>
                  <li>• Workload integration system</li>
                  <li>• Circadian adaptation tracker</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-2">Frontend Interface</h4>
                <p className="text-sm text-muted-foreground mb-2">React + TypeScript (Vite)</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Interactive visualizations (Recharts)</li>
                  <li>• Roster import/export</li>
                  <li>• Real-time calculations</li>
                  <li>• Responsive design</li>
                  <li>• PDF report generation</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Documentation Structure */}
        <AccordionItem value="docs" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-semibold">Documentation Structure</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <p className="text-muted-foreground mb-4">
              This documentation is organized into four main sections:
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-1">Mathematical Model</h4>
                <p className="text-sm text-muted-foreground">
                  Borbély two-process equations, workload multipliers, circadian phase calculations, 
                  sleep quality algorithms, performance integration.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-1">Fatigue Science</h4>
                <p className="text-sm text-muted-foreground">
                  Types of fatigue, WOCL (Window of Circadian Low), sleep debt accumulation, 
                  fatigue recognition, mitigation strategies.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-1">Component Reference</h4>
                <p className="text-sm text-muted-foreground">
                  Sleep calculator implementation, EASA validator logic, timeline simulation, 
                  risk classification, API reference.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-1">Research & References</h4>
                <p className="text-sm text-muted-foreground">
                  Peer-reviewed papers, EASA regulations, accident case studies, additional reading, 
                  citation guidelines.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Getting Started */}
        <AccordionItem value="getting-started" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-primary" />
              <span className="font-semibold">Getting Started</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Quick Start (5 minutes)</h4>
                <div className="grid gap-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">1</span>
                    <span className="text-sm"><strong>Upload Your Roster</strong> — Dashboard → Import Roster → Choose CSV/PDF</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">2</span>
                    <span className="text-sm"><strong>Set Your Home Base</strong> — Settings → Home Base → Select timezone</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">3</span>
                    <span className="text-sm"><strong>View Analysis</strong> — Monthly Overview → See risk heatmap</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">4</span>
                    <span className="text-sm"><strong>Export Reports</strong> — Select duty → Generate SMS Report → Download PDF</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">First-Time User Guide</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Read "Understanding Fatigue" (10 min)</li>
                  <li>Review "The Borbély Model" (15 min)</li>
                  <li>Try "Sample Roster" example (5 min)</li>
                  <li>Upload your own roster (5 min)</li>
                  <li>Explore interactive visualizations</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Advanced Usage</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Custom parameters</strong> — Adjust model sensitivity</li>
                  <li>• <strong>Batch analysis</strong> — Compare multiple roster options</li>
                  <li>• <strong>Export data</strong> — JSON/CSV for external analysis</li>
                  <li>• <strong>API access</strong> — Integrate with other tools</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Use Cases & Examples */}
        <AccordionItem value="use-cases" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Use Cases & Examples</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-6">
              <UseCaseCard 
                title="Preventing Fatigue Before It Happens"
                scenario="You receive next month's roster"
                steps={[
                  "Upload roster to Aerowake",
                  "Monthly heatmap shows Day 23 in RED (critical risk)",
                  "Detailed view: Night departure after only 4.5h effective sleep",
                  "Export SMS report with scientific evidence",
                  "Submit to crew scheduling before roster becomes effective"
                ]}
                outcome="Proactive roster modification vs. reactive fatigue call"
              />
              <UseCaseCard 
                title="SMS Fatigue Report After Incident"
                scenario="You made an error on approach, want to file fatigue report"
                steps={[
                  "Input the duty details",
                  "System shows performance at 48/100 during approach (CRITICAL)",
                  "Report identifies: WOCL timing + 8h sleep debt + 9h into duty",
                  "Export includes timeline, EASA references, scientific citations",
                  "File with Safety Management System"
                ]}
                outcome='Evidence-based report vs. subjective "I was tired"'
              />
              <UseCaseCard 
                title="Roster Comparison for Bidding"
                scenario="You can choose between Line A and Line B"
                steps={[
                  "Import both rosters",
                  "Compare: Line A has 12 high-risk duties (avg 71/100), Line B has 4 (avg 78/100)",
                  "Identify specific problem duties in each",
                  "Make informed bid decision"
                ]}
                outcome="Data-driven choice vs. guessing"
              />
              <UseCaseCard 
                title="Understanding Why You're Always Tired"
                scenario="Feeling chronically fatigued, don't know why"
                steps={[
                  "Analyze last 3 months of rosters",
                  "Sleep debt graph shows cumulative buildup",
                  "Pattern emerges: Insufficient recovery time between trips",
                  "Average 6.2h effective sleep vs. 8h needed",
                  "Long-term deficit = 45 hours over 3 months"
                ]}
                outcome="Identify pattern vs. blaming yourself"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Support & Resources */}
        <AccordionItem value="support" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <HeadphonesIcon className="h-5 w-5 text-primary" />
              <span className="font-semibold">Support & Resources</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-2">Documentation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• This wiki — Complete user & technical docs</li>
                  <li>• API docs — OpenAPI/Swagger interface</li>
                  <li>• Code comments — Inline documentation</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-2">Community</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• GitHub Discussions — Q&A, feature requests</li>
                  <li>• Issues tracker — Bug reports</li>
                  <li>• Pull requests — Code contributions</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/30 p-4">
                <h4 className="font-medium mb-2">Scientific References</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Research page — All peer-reviewed papers</li>
                  <li>• EASA regulations — Regulatory framework</li>
                  <li>• External resources — Additional reading</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Educational Disclaimer */}
        <AccordionItem value="disclaimer" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <span className="font-semibold">Educational Disclaimer</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
                <h4 className="font-medium mb-2">Legal Notice</h4>
                <p className="text-muted-foreground">
                  This tool is provided for <strong>educational and informational purposes only</strong>.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">You must always:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Exercise professional judgment per EASA ORO.FTL.120</li>
                  <li>• Comply with your airline's approved FRMS</li>
                  <li>• Report fatigue concerns through proper SMS channels</li>
                  <li>• Make fitness-for-duty decisions based on how you actually feel</li>
                  <li>• Consult medical professionals for health concerns</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">This tool does NOT:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Replace regulatory compliance systems</li>
                  <li>• Provide medical advice</li>
                  <li>• Guarantee prediction accuracy</li>
                  <li>• Account for individual differences</li>
                  <li>• Replace professional judgment</li>
                </ul>
              </div>

              <p className="text-muted-foreground font-medium">
                Use at your own risk. No warranty is provided. See LICENSE for full terms.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Credits & Acknowledgments */}
        <AccordionItem value="credits" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold">Credits & Acknowledgments</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Scientific Foundation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Alexander Borbély</strong> — Two-process model pioneer</li>
                  <li>• <strong>EASA Research Team</strong> — Aviation fatigue validation</li>
                  <li>• <strong>NASA Aviation Safety</strong> — Operational research</li>
                  <li>• <strong>Sleep research community</strong> — Decades of foundational work</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Technical Implementation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• React, TypeScript, Vite</li>
                  <li>• Recharts for visualizations</li>
                  <li>• FastAPI for backend</li>
                  <li>• NumPy/SciPy for calculations</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Version History */}
        <AccordionItem value="version" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <span className="font-semibold">Version History</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="info">v2.1.2</Badge>
                <span className="text-sm text-muted-foreground">Current Version</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• New feature: Interactive Borbély visualizer</p>
                <p>• Bug fix: WOCL timezone calculation</p>
                <p>• Docs: Complete mathematical model reference</p>
                <p>• Performance: 40% faster roster processing</p>
              </div>
              <p className="text-sm text-muted-foreground">Full changelog available on GitHub.</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Roadmap */}
        <AccordionItem value="roadmap" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Map className="h-5 w-5 text-primary" />
              <span className="font-semibold">Roadmap</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Short-term (Next 3 months)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Mobile app (iOS/Android)</li>
                  <li>• Wearable integration (fitness trackers)</li>
                  <li>• Multi-language support</li>
                  <li>• PDF roster parsing improvements</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Medium-term (6-12 months)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Individual chronotype adjustment</li>
                  <li>• Machine learning validation</li>
                  <li>• Collaborative roster analysis</li>
                  <li>• Integration with popular roster apps</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Long-term (12+ months)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Real-time fatigue monitoring</li>
                  <li>• Predictive alerting</li>
                  <li>• Industry-wide data pooling (anonymous)</li>
                  <li>• Regulatory certification pathway</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground italic">
                Community priorities may adjust this roadmap.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Vision */}
        <AccordionItem value="vision" className="border border-border rounded-lg bg-card/50 backdrop-blur-sm px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-primary" />
              <span className="font-semibold">Vision</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Our Goal</h4>
                <p className="text-muted-foreground">
                  <strong>Make evidence-based fatigue analysis accessible to every pilot.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Airlines have sophisticated, expensive FRMS tools. Pilots should have access to the 
                  same science to understand their own fatigue, advocate for safer rosters, make informed 
                  career decisions, and contribute to safety culture.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Why This Matters</h4>
                <p className="text-muted-foreground">
                  <strong>Transparency builds trust.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Fatigue science should be understandable and transparent, based on peer-reviewed research, 
                  available to those who need it, and used to improve aviation safety.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This tool aims to bridge the gap between academic research and practical application, 
                  empowering pilots with the knowledge and tools to understand their own fatigue patterns.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Closing Statement */}
      <Card variant="glass" className="text-center">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <p className="text-lg font-medium">
            Thank you for using Aerowake
          </p>
          <p className="text-muted-foreground mt-2">
            Contributing to aviation safety through education and awareness.
          </p>
          <p className="text-sm text-muted-foreground mt-4 font-medium">
            Fly safe. Rest well. Stay informed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ProcessStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
        {number}
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}

function UserCard({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 text-primary" />
        <h4 className="font-semibold">{title}</h4>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function IsItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  );
}

function IsNotItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  );
}

function UseCaseCard({ title, scenario, steps, outcome }: { title: string; scenario: string; steps: string[]; outcome: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/30 p-4">
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground mb-3">Scenario: {scenario}</p>
      <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside mb-3">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <p className="text-sm font-medium text-success">Outcome: {outcome}</p>
    </div>
  );
}
